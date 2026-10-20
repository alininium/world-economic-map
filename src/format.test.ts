import { describe, expect, it } from 'vitest';
import { compact, formatBreak, formatValue } from './format';

describe('formatValue', () => {
  it('abbreviates large dollar amounts', () => {
    expect(formatValue(27.36e12, 'usd')).toBe('$27.4 tn');
    expect(formatValue(4.2e9, 'usd')).toBe('$4.20 bn');
    expect(formatValue(-812e9, 'usd')).toBe('−$812 bn');
  });

  it('keeps per-capita amounts in full', () => {
    expect(formatValue(54321.7, 'usd')).toBe('$54,322');
    expect(formatValue(12000, 'intl_usd')).toBe('Int$12,000');
  });

  it('formats percentages', () => {
    expect(formatValue(3.456, 'percent')).toBe('3.5%');
    expect(formatValue(-0.4, 'percent')).toBe('−0.4%');
    expect(formatValue(112.04, 'percent_gdp')).toBe('112.0% of GDP');
  });

  it('shows missing values as a dash, never as zero', () => {
    expect(formatValue(null, 'usd')).toBe('—');
    expect(formatValue(undefined, 'percent')).toBe('—');
    expect(formatValue(Number.NaN, 'percent')).toBe('—');
  });
});

describe('compact and formatBreak', () => {
  it('moves to the next unit when rounding reaches it', () => {
    expect(formatValue(999.7e9, 'usd')).toBe('$1.00 tn');
    expect(formatValue(99.996e9, 'usd')).toBe('$100 bn');
    expect(formatValue(999999.6, 'usd')).toBe('$1.00 m');
  });

  it('uses three significant digits', () => {
    expect(compact(1_234_567)).toBe('1.23 m');
    expect(compact(950)).toBe('950');
  });

  it('formats legend breaks briefly', () => {
    expect(formatBreak(2.5e11, 'usd')).toBe('$250 bn');
    expect(formatBreak(-3.25, 'percent')).toBe('−3.25%');
    expect(formatBreak(0, 'percent')).toBe('0%');
    expect(formatBreak(0.0149, 'index')).toBe('0.0149');
    expect(formatBreak(0.0151, 'index')).toBe('0.0151');
    expect(formatBreak(0.012, 'index')).toBe('0.012');
  });
});
