import type { Unit } from '../shared/indicators';

const SCALES: [number, string][] = [
  [1e12, ' tn'],
  [1e9, ' bn'],
  [1e6, ' m'],
];

/** 1234567 → "1.23 m"; keeps three significant digits. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  for (const [size, suffix] of SCALES) {
    if (abs >= size) return `${trim(n / size)}${suffix}`;
  }
  return Math.round(n).toLocaleString('en-US');
}

function trim(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return n.toFixed(digits);
}

/** Formats a value for display with its unit; null shows as an em dash. */
export function formatValue(value: number | null | undefined, unit: Unit): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  switch (unit) {
    case 'usd':
      return abs < 1e6
        ? `${sign}$${Math.round(abs).toLocaleString('en-US')}`
        : `${sign}$${compact(abs)}`;
    case 'intl_usd':
      return abs < 1e6
        ? `${sign}Int$${Math.round(abs).toLocaleString('en-US')}`
        : `${sign}Int$${compact(abs)}`;
    case 'percent':
      return `${sign}${abs.toFixed(1)}%`;
    case 'percent_gdp':
      return `${sign}${abs.toFixed(1)}% of GDP`;
    case 'people':
      return `${sign}${compact(abs)}`;
  }
}

/** Shorter form for legend breaks: no "of GDP", no thousands separators. */
export function formatBreak(value: number, unit: Unit): string {
  if (value === 0) return unit === 'percent' || unit === 'percent_gdp' ? '0%' : '0';
  if (unit === 'percent' || unit === 'percent_gdp') {
    return `${value < 0 ? '−' : ''}${trim(Math.abs(value))}%`;
  }
  const prefix = unit === 'usd' ? '$' : unit === 'intl_usd' ? 'Int$' : '';
  return `${value < 0 ? '−' : ''}${prefix}${compact(Math.abs(value))}`;
}
