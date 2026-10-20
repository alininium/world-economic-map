import type { Observation } from '../../shared/indicators';

export interface RawPoint {
  id: string;
  year: number;
  value: number | null;
}

/**
 * Keeps, per country, the most recent non-missing value no later than `maxYear`.
 * Points for ids outside `validIds` (regional aggregates, retired codes) are dropped.
 */
export function latestByCountry(
  points: Iterable<RawPoint>,
  validIds: ReadonlySet<string>,
  maxYear: number,
  scale = 1,
): Record<string, Observation> {
  const out: Record<string, Observation> = {};
  for (const p of points) {
    if (p.value === null || !Number.isFinite(p.value) || p.year > maxYear) continue;
    if (!validIds.has(p.id)) continue;
    const prev = out[p.id];
    if (!prev || p.year > prev.year) out[p.id] = { value: p.value * scale, year: p.year };
  }
  return out;
}

/** All non-missing observations per country from `minYear` to `maxYear`, oldest first. */
export function historyByCountry(
  points: Iterable<RawPoint>,
  validIds: ReadonlySet<string>,
  minYear: number,
  maxYear: number,
): Record<string, Observation[]> {
  const out: Record<string, Observation[]> = {};
  for (const p of points) {
    if (p.value === null || !Number.isFinite(p.value)) continue;
    if (p.year < minYear || p.year > maxYear || !validIds.has(p.id)) continue;
    (out[p.id] ??= []).push({ value: p.value, year: p.year });
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.year - b.year);
  return out;
}
