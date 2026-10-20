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
