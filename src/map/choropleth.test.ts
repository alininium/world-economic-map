import { describe, expect, it } from 'vitest';
import { buildClasses, classify, colorFor, quantileThresholds } from './choropleth';

const palette = {
  sequential: ['s1', 's2', 's3', 's4', 's5'],
  negative: ['n-far', 'n-mid', 'n-near'],
  positive: ['p-near', 'p-mid', 'p-far'],
};

describe('quantileThresholds', () => {
  it('splits values into equal-sized groups', () => {
    expect(quantileThresholds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toEqual([3, 5, 7, 9]);
  });

  it('drops duplicate thresholds for tied data', () => {
    expect(quantileThresholds([1, 1, 1, 1, 1, 1, 2, 2], 4)).toEqual([2]);
  });
});

describe('buildClasses', () => {
  it('uses all five sequential colours for spread-out data', () => {
    const bins = buildClasses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'sequential', palette);
    expect(bins.map((b) => b.color)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(colorFor(1, bins)).toBe('s1');
    expect(colorFor(10, bins)).toBe('s5');
    expect(colorFor(5, bins)).toBe('s3');
  });

  it('keeps both ends of the ramp when ties reduce the class count', () => {
    const bins = buildClasses([1, 1, 1, 1, 1, 1, 2, 2], 'sequential', palette);
    expect(bins.map((b) => b.color)).toEqual(['s1', 's5']);
  });

  it('puts the diverging boundary at zero', () => {
    const bins = buildClasses([-9, -6, -3, -1, 0.5, 2, 4, 8], 'diverging', palette);
    expect(bins.some((b) => b.max === 0)).toBe(true);
    expect(colorFor(-9, bins)).toBe('n-far');
    expect(colorFor(-0.1, bins)).toBe('n-near');
    expect(colorFor(0, bins)).toBe('p-near');
    expect(colorFor(8, bins)).toBe('p-far');
  });

  it('handles a metric with no negative values', () => {
    const bins = buildClasses([1, 2, 3], 'diverging', palette);
    expect(bins.every((b) => b.color.startsWith('p-'))).toBe(true);
  });

  it('gives an unranked negative value a negative class even when no ranked value is negative', () => {
    const bins = buildClasses([1, 2, 3], 'diverging', palette, [1, 2, 3, -4]);
    expect(colorFor(-4, bins)).toMatch(/^n-/);
    expect(colorFor(2, bins)).toMatch(/^p-/);
  });

  it('returns no classes when there is no data', () => {
    expect(buildClasses([], 'sequential', palette)).toEqual([]);
  });
});

describe('classify', () => {
  it('takes breaks from ranked entities but colours every entity', () => {
    const { bins, colors } = classify(
      [
        ['A', 1],
        ['B', 2],
        ['DEP', 1000],
      ],
      (id) => id !== 'DEP',
      'sequential',
      palette,
    );
    expect(bins.at(-1)!.min).toBeLessThan(1000);
    expect(Object.keys(colors).sort()).toEqual(['A', 'B', 'DEP']);
    expect(colors.DEP).toBe(bins.at(-1)!.color);
  });
});
