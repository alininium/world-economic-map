import type { ScaleKind } from '../../shared/indicators';
import type { MapPalette } from './palette';

export interface ClassBin {
  color: string;
  /** Inclusive lower bound; -Infinity for the first bin. */
  min: number;
  /** Exclusive upper bound; Infinity for the last bin. */
  max: number;
}

/**
 * Thresholds that split sorted values into `n` groups of (nearly) equal size.
 * Duplicate thresholds are dropped, so heavily tied data yields fewer classes.
 */
export function quantileThresholds(values: readonly number[], n: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length < 2 || n < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < n; i++) {
    const t = sorted[Math.floor((i * sorted.length) / n)]!;
    if (t > sorted[0]! && !out.includes(t)) out.push(t);
  }
  return out;
}

function binsFrom(
  thresholds: number[],
  colors: readonly string[],
  lo: number,
  hi: number,
): ClassBin[] {
  // With fewer thresholds than colours, spread the bins across the ramp so its ends stay in use.
  const count = thresholds.length + 1;
  const pick = (i: number) =>
    colors[count === 1 ? colors.length - 1 : Math.round((i * (colors.length - 1)) / (count - 1))]!;
  const edges = [lo, ...thresholds, hi];
  return Array.from({ length: count }, (_, i) => ({
    color: pick(i),
    min: edges[i]!,
    max: edges[i + 1]!,
  }));
}

/**
 * Quantile classes for the map. Sequential metrics split all values across one ramp.
 * Diverging metrics split negatives and positives separately, so zero is always a class
 * boundary and the sign is readable from the hue alone.
 */
export function buildClasses(
  values: readonly number[],
  kind: ScaleKind,
  palette: Pick<MapPalette, 'sequential' | 'negative' | 'positive'>,
): ClassBin[] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [];
  if (kind === 'sequential') {
    const t = quantileThresholds(finite, palette.sequential.length);
    return binsFrom(t, palette.sequential, -Infinity, Infinity);
  }
  const neg = finite.filter((v) => v < 0);
  const pos = finite.filter((v) => v >= 0);
  const negBins = neg.length
    ? binsFrom(quantileThresholds(neg, palette.negative.length), palette.negative, -Infinity, 0)
    : [];
  const posBins = pos.length
    ? binsFrom(quantileThresholds(pos, palette.positive.length), palette.positive, 0, Infinity)
    : [];
  return [...negBins, ...posBins];
}

export function colorFor(value: number, bins: readonly ClassBin[]): string | undefined {
  return bins.find((b) => value >= b.min && value < b.max)?.color ?? bins.at(-1)?.color;
}
