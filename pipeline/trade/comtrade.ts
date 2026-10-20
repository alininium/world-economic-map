import { CHAIN_FILES, CHAINS, type ChainTradeTable, type StageTrade } from '../../shared/chains';
import { COMMODITIES, RESOURCE_FILES, type ResourceTable } from '../../shared/commodities';
import type { SeriesTable } from '../../shared/indicators';
import {
  TRADE_SERIES,
  TRADE_SUMMARY_PATH,
  tradeProfilePath,
  type TradeEntry,
  type TradeProfile,
  type TradeSide,
} from '../../shared/trade';
import type { DatasetMeta } from '../../shared/types';
import { cachedFetch } from '../lib/fetch';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, readCountryIds, recordInManifest, writeDataset, writeRaw } from '../lib/write';

const API = 'https://comtradeapi.un.org/data/v1/get/C/A/HS';
const REF = 'https://comtradeapi.un.org/files/v1/app/reference';
/** Entries kept per list in a country's profile. */
const TOP_N = 10;
/** Reporters per request; keeps responses well under the API's record cap. */
const BATCH_PARTNERS = 10;
const BATCH_PRODUCTS = 5;
const YEARS_BACK = 3;

export type Flow = 'X' | 'M';

export interface ComtradeRow {
  reporterCode: number;
  partnerCode: number;
  flowCode: string;
  cmdCode: string;
  period: string;
  primaryValue: number | null;
}

interface RefFile<T> {
  results: T[];
}

interface ReporterRef {
  reporterCode: number;
  reporterCodeIsoAlpha3?: string;
  isGroup: boolean;
  entryExpiredDate?: string | null;
}

interface PartnerRef {
  PartnerCode: number;
  PartnerDesc: string;
  PartnerCodeIsoAlpha3?: string;
  isGroup: boolean;
}

interface HsRef {
  id: string;
  text: string;
}

/** Current (non-expired, non-group) reporter code per ISO3, restricted to known ids. */
export function reporterCodes(
  refs: ReporterRef[],
  validIds: ReadonlySet<string>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of refs) {
    const iso = r.reporterCodeIsoAlpha3?.trim();
    if (!iso || r.isGroup || r.entryExpiredDate || !validIds.has(iso)) continue;
    out.set(iso, r.reporterCode);
  }
  return out;
}

export interface PartnerInfo {
  code: string;
  name: string;
  /** Map entity id when the partner is one. */
  id: string | null;
}

export function partnerLookup(
  refs: PartnerRef[],
  validIds: ReadonlySet<string>,
): Map<number, PartnerInfo> {
  const out = new Map<number, PartnerInfo>();
  for (const p of refs) {
    const iso = p.PartnerCodeIsoAlpha3?.trim() ?? '';
    const id = !p.isGroup && validIds.has(iso) ? iso : null;
    out.set(p.PartnerCode, { code: id ?? String(p.PartnerCode), name: p.PartnerDesc.trim(), id });
  }
  return out;
}

/** "8471 - Automatic data processing machines…" → code → description. */
export function hsNames(refs: HsRef[]): Map<string, string> {
  return new Map(refs.map((r) => [r.id, r.text.replace(/^\S+\s+-\s+/, '').trim()]));
}

export function parseRows(body: string): ComtradeRow[] {
  const json = JSON.parse(body) as { data?: ComtradeRow[]; error?: string };
  if (json.error) throw new Error(`Comtrade API: ${json.error}`);
  if (!Array.isArray(json.data)) throw new Error('Unexpected Comtrade response');
  return json.data;
}

/** The latest year in which the reporter reported exports with the world (partner 0). */
export function latestYear(rows: readonly ComtradeRow[], reporter: number): number | null {
  let best: number | null = null;
  for (const r of rows) {
    if (r.reporterCode !== reporter || r.partnerCode !== 0 || r.cmdCode !== 'TOTAL') continue;
    if (r.flowCode !== 'X' || !r.primaryValue) continue;
    const y = Number(r.period);
    if (best === null || y > best) best = y;
  }
  return best;
}

function topEntries(
  items: { code: string; name: string; value: number; partnerId?: string | null }[],
  total: number,
): TradeEntry[] {
  return items
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N)
    .map((i) => ({ ...i, share: i.value / total }));
}

/** Groups rows by reporter once, so each profile only scans its own rows. */
export function byReporter(rows: readonly ComtradeRow[]): Map<number, ComtradeRow[]> {
  const out = new Map<number, ComtradeRow[]>();
  for (const r of rows) {
    const list = out.get(r.reporterCode);
    if (list) list.push(r);
    else out.set(r.reporterCode, [r]);
  }
  return out;
}

/**
 * Sums a set of HS codes per reporter and flow (partner World), keeping each reporter's latest
 * year with data for that flow.
 */
export function tradeByCodes(
  rows: readonly ComtradeRow[],
  codes: readonly string[],
  reporterIds: ReadonlyMap<number, string>,
): StageTrade {
  const wanted = new Set(codes);
  const out: StageTrade = { exports: {}, imports: {} };
  for (const [flow, key] of [
    ['X', 'exports'],
    ['M', 'imports'],
  ] as const) {
    // reporter id → year → summed value
    const sums = new Map<string, Map<number, number>>();
    for (const r of rows) {
      if (r.flowCode !== flow || r.partnerCode !== 0 || !wanted.has(r.cmdCode) || !r.primaryValue)
        continue;
      const id = reporterIds.get(r.reporterCode);
      if (!id) continue;
      const byYear = sums.get(id) ?? new Map<number, number>();
      const y = Number(r.period);
      byYear.set(y, (byYear.get(y) ?? 0) + r.primaryValue);
      sums.set(id, byYear);
    }
    for (const [id, byYear] of sums) {
      const year = Math.max(...byYear.keys());
      out[key][id] = { value: byYear.get(year)!, year };
    }
  }
  return out;
}

/** Exports and imports per strategic commodity, in the resource-table shape. */
export function commodityTrade(
  rows: readonly ComtradeRow[],
  reporterIds: ReadonlyMap<number, string>,
): ResourceTable {
  const table: ResourceTable = {};
  for (const c of COMMODITIES) {
    if (!c.hs.length) continue;
    const t = tradeByCodes(rows, c.hs, reporterIds);
    const note = `UN Comtrade, ${c.hsLabel}; as reported by each country.`;
    table[c.id] = {
      exports: { unit: 'US dollars', values: t.exports, note },
      imports: { unit: 'US dollars', values: t.imports, note },
    };
  }
  return table;
}

/** Exports and imports per production-chain stage; stages without HS codes are left out. */
export function chainTrade(
  rows: readonly ComtradeRow[],
  reporterIds: ReadonlyMap<number, string>,
): ChainTradeTable {
  const table: ChainTradeTable = {};
  for (const chain of CHAINS) {
    for (const stage of chain.stages) {
      if (!stage.hs.length) continue;
      (table[chain.id] ??= {})[stage.id] = tradeByCodes(rows, stage.hs, reporterIds);
    }
  }
  return table;
}

/** Herfindahl–Hirschman index over all product shares (0–1). */
export function hhi(values: readonly number[]): number | null {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (!total) return null;
  return values.reduce((s, v) => s + (Math.max(0, v) / total) ** 2, 0);
}

/**
 * Builds one reporter's profile for `year` from the partner-level (cmdCode TOTAL) and
 * product-level (HS4, partner World) rows.
 */
export function buildProfile(
  reporter: number,
  year: number,
  partnerRows: readonly ComtradeRow[],
  productRows: readonly ComtradeRow[],
  partners: ReadonlyMap<number, PartnerInfo>,
  products: ReadonlyMap<string, string>,
): { profile: TradeProfile; exportHhi: number | null } {
  const mine = (r: ComtradeRow) =>
    r.reporterCode === reporter && Number(r.period) === year && r.primaryValue !== null;
  const side = (flow: Flow): { side: TradeSide; productValues: number[] } => {
    const byPartner = partnerRows.filter(
      (r) => mine(r) && r.flowCode === flow && r.cmdCode === 'TOTAL',
    );
    const total = byPartner.find((r) => r.partnerCode === 0)?.primaryValue ?? null;
    const hs4 = productRows.filter(
      (r) => mine(r) && r.flowCode === flow && r.partnerCode === 0 && r.cmdCode.length === 4,
    );
    if (!total) return { side: { total: null, products: [], partners: [] }, productValues: [] };
    return {
      side: {
        total,
        partners: topEntries(
          byPartner
            .filter((r) => r.partnerCode !== 0)
            .map((r) => {
              const info = partners.get(r.partnerCode);
              return {
                code: info?.code ?? String(r.partnerCode),
                name: info?.name ?? `Partner ${r.partnerCode}`,
                value: r.primaryValue!,
                partnerId: info?.id ?? null,
              };
            }),
          total,
        ),
        products: topEntries(
          hs4.map((r) => ({
            code: r.cmdCode,
            name: products.get(r.cmdCode) ?? `HS ${r.cmdCode}`,
            value: r.primaryValue!,
          })),
          total,
        ),
      },
      productValues: hs4.map((r) => r.primaryValue!),
    };
  };
  const x = side('X');
  const m = side('M');
  return {
    profile: { year, exports: x.side, imports: m.side },
    exportHhi: hhi(x.productValues),
  };
}

const chunk = <T>(xs: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function query(params: Record<string, string>, key: string) {
  const qs = new URLSearchParams({
    ...params,
    customsCode: 'C00',
    motCode: '0',
    partner2Code: '0',
    includeDesc: 'false',
    maxRecords: '100000',
  });
  const res = await cachedFetch(`${API}?${qs}`, { headers: { 'Ocp-Apim-Subscription-Key': key } });
  return { rows: parseRows(res.body), retrievedAt: res.retrievedAt };
}

async function ref<T>(file: string): Promise<T[]> {
  return (JSON.parse((await cachedFetch(`${REF}/${file}`)).body) as RefFile<T>).results;
}

export async function runComtrade(): Promise<void> {
  console.log('comtrade: UN Comtrade (annual, HS)');
  const key = process.env.COMTRADE_API_KEY;
  if (!key) throw new Error('COMTRADE_API_KEY is not set; add it to .env (see .env.example)');
  const ids = await readCountryIds();
  const reporters = reporterCodes(await ref<ReporterRef>('Reporters.json'), ids);
  const partners = partnerLookup(await ref<PartnerRef>('partnerAreas.json'), ids);
  const products = hsNames(await ref<HsRef>('HS.json'));
  const thisYear = new Date().getUTCFullYear();
  const period = Array.from({ length: YEARS_BACK }, (_, i) => thisYear - 1 - i).join(',');
  const codes = [...reporters.values()];
  let retrievedAt = '';
  const track = (d: string) => (retrievedAt = d > retrievedAt ? d : retrievedAt);

  const partnerRows: ComtradeRow[] = [];
  for (const batch of chunk(codes, BATCH_PARTNERS)) {
    console.log(`  partners: reporters ${batch.join(',')}`);
    const res = await query(
      { reporterCode: batch.join(','), period, flowCode: 'X,M', cmdCode: 'TOTAL' },
      key,
    );
    partnerRows.push(...res.rows);
    track(res.retrievedAt);
  }
  const productRows: ComtradeRow[] = [];
  for (const batch of chunk(codes, BATCH_PRODUCTS)) {
    console.log(`  products: reporters ${batch.join(',')}`);
    const res = await query(
      { reporterCode: batch.join(','), period, flowCode: 'X,M', cmdCode: 'AG4', partnerCode: '0' },
      key,
    );
    productRows.push(...res.rows);
    track(res.retrievedAt);
  }

  // HS4 codes are already in the AG4 product rows (partner World); only HS6 codes need a query.
  const hs6 = [
    ...new Set([
      ...COMMODITIES.flatMap((c) => c.hs),
      ...CHAINS.flatMap((c) => c.stages.flatMap((st) => st.hs)),
    ]),
  ].filter((h) => h.length === 6);
  const commodityRows: ComtradeRow[] = productRows.filter((r) => r.partnerCode === 0);
  for (const batch of hs6.length ? chunk(codes, BATCH_PARTNERS) : []) {
    console.log(`  commodities: reporters ${batch.join(',')}`);
    const res = await query(
      {
        reporterCode: batch.join(','),
        period,
        flowCode: 'X,M',
        cmdCode: hs6.join(','),
        partnerCode: '0',
      },
      key,
    );
    commodityRows.push(...res.rows);
    track(res.retrievedAt);
  }

  const summary: SeriesTable = {
    [TRADE_SERIES.exportsTotal]: {},
    [TRADE_SERIES.importsTotal]: {},
    [TRADE_SERIES.exportConcentration]: {},
  };
  const years: number[] = [];
  const partnerBy = byReporter(partnerRows);
  const productBy = byReporter(productRows);
  // Every download succeeded; replace the old profiles so countries that stopped
  // reporting do not keep a stale file.
  await rm(path.join(DATA_DIR, 'trade/by-country'), { recursive: true, force: true });
  for (const [id, code] of reporters) {
    const mineP = partnerBy.get(code) ?? [];
    const year = latestYear(mineP, code);
    if (year === null) continue;
    const { profile, exportHhi } = buildProfile(
      code,
      year,
      mineP,
      productBy.get(code) ?? [],
      partners,
      products,
    );
    await writeRaw(tradeProfilePath(id), profile);
    years.push(year);
    if (profile.exports.total)
      summary[TRADE_SERIES.exportsTotal]![id] = { value: profile.exports.total, year };
    if (profile.imports.total)
      summary[TRADE_SERIES.importsTotal]![id] = { value: profile.imports.total, year };
    if (exportHhi !== null)
      summary[TRADE_SERIES.exportConcentration]![id] = { value: exportHhi, year };
  }

  const meta: DatasetMeta = {
    id: 'comtrade',
    title: 'UN Comtrade merchandise trade',
    source: 'United Nations, UN Comtrade database (API v1), annual HS data as reported',
    sourceUrl: 'https://comtradeplus.un.org/',
    license: 'UN Comtrade terms of use: free for non-commercial use with attribution',
    retrievedAt,
    dataYear: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : null,
    notes:
      'Goods only (no services). Reporter-declared values: exports FOB, imports CIF. Latest year within 3 years per reporter; countries that did not report are missing.',
  };
  await writeDataset(TRADE_SUMMARY_PATH, meta, summary);
  const reporterIds = new Map([...reporters].map(([id, code]) => [code, id]));
  const commodityTable = commodityTrade(commodityRows, reporterIds);
  const commodityYears = Object.values(commodityTable).flatMap((m) =>
    Object.values(m).flatMap((t) => Object.values(t?.values ?? {}).map((o) => o.year)),
  );
  await writeDataset(
    RESOURCE_FILES.trade,
    {
      ...meta,
      id: 'comtrade-commodities',
      title: 'Strategic commodity trade',
      dataYear: commodityYears.length
        ? `${Math.min(...commodityYears)}–${Math.max(...commodityYears)}`
        : null,
      notes:
        'Exports and imports of each strategic commodity with the world, summing its HS codes (see shared/commodities.ts). Reporter-declared values in US dollars; latest year within 3 years per reporter and commodity. No world total: not every country reports.',
    },
    commodityTable,
  );
  await writeDataset(
    CHAIN_FILES.trade,
    {
      ...meta,
      id: 'comtrade-chains',
      title: 'Production-chain trade by stage',
      notes:
        'Exports and imports with the world of the HS codes standing for each production-chain stage (see shared/chains.ts). Reporter-declared values in US dollars; latest year within 3 years per reporter, stage and flow.',
    },
    chainTrade(commodityRows, reporterIds),
  );
  await recordInManifest('trade/by-country/', {
    ...meta,
    id: 'comtrade-profiles',
    title: 'Trade profiles per country',
  });
}
