import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { Country } from '../../shared/types';
import { commodityTrade, type ComtradeRow } from '../trade/comtrade';
import { energyTable } from './energy';
import { faoTable, isMainDataFile, streamZipLines, type FaoRow } from './fao';
import { nameResolver } from './names';
import { detectColumns, parseUsgsNumber, usgsTable } from './usgs';

// Row shapes follow each source's published layout; the numbers are invented for the tests.

const country = (id: string, name: string, aliases: string[] = []): Country => ({
  id,
  iso3: id,
  iso2: null,
  isoNumeric: null,
  name,
  formalName: null,
  status: 'un_member',
  sovereign: null,
  region: null,
  subregion: null,
  label: [0, 0],
  bbox: [0, 0, 1, 1],
  tiny: false,
  aliases,
});

describe('energyTable', () => {
  const rows = [
    { country: 'World', iso_code: '', year: '2024', oil_production: '100' },
    { country: 'Aland', iso_code: 'AAA', year: '2024', oil_production: '60' },
    { country: 'Bland', iso_code: 'BBB', year: '2016', oil_production: '5' },
    { country: 'Cland', iso_code: 'CCC', year: '2024', oil_production: '' },
  ];
  const t = energyTable(rows, new Set(['AAA', 'BBB', 'CCC']), 2026);

  it('takes the world total for shares and keeps recent producers', () => {
    expect(t.oil?.production?.world).toEqual({ value: 100, year: 2024 });
    expect(t.oil?.production?.values.AAA).toEqual({ value: 60, year: 2024 });
  });

  it('drops values from long before the world total (an older secondary series)', () => {
    expect(t.oil?.production?.values.BBB).toBeUndefined();
  });

  it('leaves blank cells missing rather than zero', () => {
    expect(t.oil?.production?.values.CCC).toBeUndefined();
  });
});

describe('USGS world data', () => {
  const header = [
    'Source',
    'COMMODITY',
    'COUNTRY',
    'TYPE',
    'UNIT_MEAS',
    'PROD_2023',
    'PROD_EST_2024',
    'RESERVES_2024',
  ];

  it('detects columns by pattern, newest production year first', () => {
    const cols = detectColumns(header);
    expect(cols.production.map((p) => p.year)).toEqual([2024, 2023]);
    expect(cols.reserves).toEqual({ name: 'RESERVES_2024', year: 2024 });
  });

  it('fails loudly, printing the header, when the layout is unknown', () => {
    expect(() => detectColumns(['a', 'b'])).toThrow(/unexpected header.*a \| b/);
  });

  it('treats withheld and unavailable codes as missing', () => {
    expect(parseUsgsNumber('1,234')).toBe(1234);
    expect(parseUsgsNumber('W')).toBeNull();
    expect(parseUsgsNumber('NA')).toBeNull();
    expect(parseUsgsNumber('>1000')).toBe(1000);
    expect(parseUsgsNumber('')).toBeNull();
  });

  const row = (country: string, type: string, p23: string, p24: string, res: string) =>
    Object.fromEntries(
      header.map((h, i) => [h, ['MCS', 'Cobalt', country, type, 'metric tons', p23, p24, res][i]!]),
    );
  const resolve = nameResolver([
    country('COD', 'Democratic Republic of the Congo'),
    country('IDN', 'Indonesia'),
  ]);
  const { table, unmatched } = usgsTable(
    [
      row('Congo (Kinshasa)', 'Mine production, cobalt content', '170000', '220000', '6000000'),
      row('Indonesia', 'Mine production, cobalt content', '17000', 'W', '640000'),
      row('Indonesia', 'Refinery production', '', '30000', ''),
      row('Other countries', 'Mine production, cobalt content', '10', '10', ''),
      row(
        'World total (rounded)',
        'Mine production, cobalt content',
        '230000',
        '290000',
        '11000000',
      ),
      row('Atlantis', 'Mine production, cobalt content', '1', '1', ''),
    ],
    resolve,
  );

  it('maps USGS country names and takes the latest numeric year', () => {
    expect(table.cobalt?.production?.values.COD).toEqual({ value: 220000, year: 2024 });
    expect(table.cobalt?.production?.values.IDN).toEqual({ value: 17000, year: 2023 });
  });

  it('separates refinery output and reads reserves and the world total', () => {
    expect(table.cobalt?.refining?.values.IDN).toEqual({ value: 30000, year: 2024 });
    expect(table.cobalt?.reserves?.values.COD).toEqual({ value: 6000000, year: 2024 });
    expect(table.cobalt?.production?.world).toEqual({ value: 290000, year: 2024 });
  });

  it('reports names it could not match instead of dropping them silently', () => {
    expect(unmatched).toEqual(['Atlantis']);
  });

  const pgm = (country: string, type: string, p24: string) =>
    Object.fromEntries(
      header.map((h, i) => [
        h,
        ['MCS', 'Platinum-group metals', country, type, 'kilograms', '', p24, ''][i]!,
      ]),
    );

  it('keeps different series apart instead of adding them together', () => {
    const r = usgsTable(
      [
        pgm('Indonesia', 'Mine production: Platinum', '100'),
        pgm('Indonesia', 'Mine production: Palladium', '300'),
        pgm('World total (rounded)', 'Mine production: Platinum', '1000'),
        pgm('World total (rounded)', 'Mine production: Palladium', '2000'),
      ],
      resolve,
    );
    expect(r.table.platinum?.production?.values.IDN).toEqual({ value: 100, year: 2024 });
    expect(r.table.platinum?.production?.world).toEqual({ value: 1000, year: 2024 });
    expect(r.table.palladium?.production?.values.IDN).toEqual({ value: 300, year: 2024 });
    expect(r.table.palladium?.production?.world).toEqual({ value: 2000, year: 2024 });
  });

  it('treats rows flagged as estimated as the same series', () => {
    const r = usgsTable(
      [
        row('Indonesia', 'Mine production, cobalt content', '', '500', ''),
        row('Congo (Kinshasa)', 'Mine production, cobalt content, estimated', '', '9000', ''),
        row('World total (rounded)', 'Mine production, cobalt content (estimated)', '', '9900', ''),
      ],
      resolve,
    );
    expect(r.table.cobalt?.production?.values).toEqual({
      IDN: { value: 500, year: 2024 },
      COD: { value: 9000, year: 2024 },
    });
    expect(r.table.cobalt?.production?.world).toEqual({ value: 9900, year: 2024 });
    expect(r.skipped).toEqual([]);
  });

  it('never lets an older row overwrite a newer one for the same country', () => {
    const r = usgsTable(
      [
        row('Indonesia', 'Mine production, cobalt content', '', '500', ''),
        row('Indonesia', 'Mine production, cobalt content', '40', 'W', ''),
      ],
      resolve,
    );
    expect(r.table.cobalt?.production?.values.IDN).toEqual({ value: 500, year: 2024 });
  });
});

describe('FAOSTAT', () => {
  const csv =
    '"Area Code","Area Code (M49)","Area","Item Code","Item","Element Code","Element","Year","Unit","Value"\n' +
    '"5000","\'001","World","15","Wheat","5510","Production","2023","t","800"\n' +
    '"351","\'159","China","15","Wheat","5510","Production","2023","t","140"\n' +
    '"41","\'156","China, mainland","15","Wheat","5510","Production","2023","t","130"\n' +
    '"41","\'156","China, mainland","15","Wheat","5312","Area harvested","2023","ha","20"\n';

  it('streams lines of the main data file only, skipping code lists', () => {
    const zip = zipSync({
      'Production_Crops_Livestock_E_AreaCodes.csv': strToU8('"Area Code","Area"\n"1","X"\n'),
      'Production_Crops_Livestock_E_All_Data_(Normalized).csv': strToU8(csv),
      'Production_Crops_Livestock_E_Elements.csv': strToU8(
        '"Element Code","Element"\n"5510","Production"\n',
      ),
    });
    const lines: string[] = [];
    streamZipLines(zip, (l) => lines.push(l), isMainDataFile);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain('Area Code (M49)');
  });

  it('splits lines correctly when reading in slices smaller than a line', () => {
    // Multi-byte characters must survive being cut between slices.
    const text =
      csv + '"107","\'384","Côte d’Ivoire","15","Wheat","5510","Production","2023","t","1"';
    const zip = zipSync({
      'Production_Crops_Livestock_E_All_Data_(Normalized).csv': strToU8(text),
    });
    const sliced: string[] = [];
    streamZipLines(zip, (l) => sliced.push(l), isMainDataFile, 7);
    expect(sliced).toEqual(text.split('\n'));
  });

  it('maps M49 codes, keeps production only and reads the world total', () => {
    const rows: FaoRow[] = csv
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => {
        const f = l.split('","').map((x) => x.replace(/"/g, ''));
        return {
          'Area Code': f[0]!,
          'Area Code (M49)': f[1]!,
          'Item Code': f[3]!,
          'Element Code': f[5]!,
          Year: f[7]!,
          Unit: f[8]!,
          Value: f[9]!,
        };
      });
    const t = faoTable(rows, new Map([['156', 'CHN']]), 2026);
    expect(t.wheat?.production?.values).toEqual({ CHN: { value: 130, year: 2023 } });
    expect(t.wheat?.production?.world).toEqual({ value: 800, year: 2023 });
    expect(t.wheat?.production?.unit).toBe('tonnes');
  });
});

describe('commodityTrade', () => {
  const r = (p: Partial<ComtradeRow>): ComtradeRow => ({
    reporterCode: 152,
    partnerCode: 0,
    flowCode: 'X',
    cmdCode: '283691',
    period: '2024',
    primaryValue: 0,
    ...p,
  });

  it("sums a commodity's HS codes per reporter at its latest year", () => {
    const t = commodityTrade(
      [
        r({ cmdCode: '283691', primaryValue: 100 }),
        r({ cmdCode: '282520', primaryValue: 20 }),
        r({ cmdCode: '283691', primaryValue: 999, period: '2023' }),
        r({ cmdCode: '283691', primaryValue: 5, partnerCode: 156 }),
        r({ flowCode: 'M', reporterCode: 156, primaryValue: 70 }),
      ],
      new Map([
        [152, 'CHL'],
        [156, 'CHN'],
      ]),
    );
    expect(t.lithium?.exports?.values).toEqual({ CHL: { value: 120, year: 2024 } });
    expect(t.lithium?.imports?.values).toEqual({ CHN: { value: 70, year: 2024 } });
    expect(t.gallium).toBeUndefined();
  });
});
