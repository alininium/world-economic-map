import type { Unit } from '../shared/indicators';

const SCALES: [number, string][] = [
  [1e12, ' tn'],
  [1e9, ' bn'],
  [1e6, ' m'],
];

/** 1234567 → "1.23 m"; keeps three significant digits. */
export function compact(n: number): string {
  // Round first so 999.7 bn becomes "1.00 tn", not "1000 bn".
  const rounded = Number(Math.abs(n).toPrecision(3));
  for (const [size, suffix] of SCALES) {
    if (rounded >= size) return `${n < 0 ? '-' : ''}${trim(rounded / size)}${suffix}`;
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
    case 'intl_usd': {
      const prefix = unit === 'usd' ? '$' : 'Int$';
      const whole = Math.round(abs);
      return whole < 1e6
        ? `${sign}${prefix}${whole.toLocaleString('en-US')}`
        : `${sign}${prefix}${compact(abs)}`;
    }
    case 'percent':
      return `${sign}${abs.toFixed(1)}%`;
    case 'percent_gdp':
      return `${sign}${abs.toFixed(1)}% of GDP`;
    case 'people':
      return `${sign}${compact(abs)}`;
    case 'index':
      return `${sign}${abs.toFixed(3)}`;
  }
}

/** Shorter form for legend breaks: no "of GDP", no thousands separators. */
export function formatBreak(value: number, unit: Unit): string {
  if (value === 0) return unit === 'percent' || unit === 'percent_gdp' ? '0%' : '0';
  if (unit === 'percent' || unit === 'percent_gdp') {
    return `${value < 0 ? '−' : ''}${trim(Math.abs(value))}%`;
  }
  if (unit === 'index') return value.toFixed(2);
  const prefix = unit === 'usd' ? '$' : unit === 'intl_usd' ? 'Int$' : '';
  return `${value < 0 ? '−' : ''}${prefix}${compact(Math.abs(value))}`;
}
