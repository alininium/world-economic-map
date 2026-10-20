import { describe, expect, it } from 'vitest';
import { approxArea, bboxOfRings, classifyFeature } from './classify';
import { UN_MEMBERS } from './territories';

describe('classifyFeature', () => {
  it('treats UN members as sovereign states', () => {
    expect(classifyFeature({ ADM0_A3: 'FRA', ISO_A3_EH: 'FRA' })).toEqual({
      kind: 'entity',
      id: 'FRA',
      iso3: 'FRA',
      status: 'un_member',
    });
  });

  it('classifies observers, partially recognized and disputed entities per the policy', () => {
    expect(classifyFeature({ ADM0_A3: 'PSX', ISO_A3_EH: 'PSE' })).toMatchObject({
      id: 'PSE',
      status: 'un_observer',
    });
    expect(classifyFeature({ ADM0_A3: 'TWN', ISO_A3_EH: 'TWN' })).toMatchObject({
      status: 'partially_recognized',
    });
    expect(classifyFeature({ ADM0_A3: 'KOS', ISO_A3_EH: '-99' })).toMatchObject({
      id: 'XKX',
      iso3: 'XKX',
      status: 'partially_recognized',
    });
    expect(classifyFeature({ ADM0_A3: 'SAH', ISO_A3_EH: 'ESH' })).toMatchObject({
      id: 'ESH',
      iso3: null,
      status: 'disputed',
    });
  });

  it('merges breakaway shapes into the recognized state', () => {
    expect(classifyFeature({ ADM0_A3: 'SOL', ISO_A3_EH: '-99' })).toEqual({
      kind: 'merge',
      into: 'SOM',
    });
  });

  it('falls back to the Natural Earth code when there is no ISO code', () => {
    expect(classifyFeature({ ADM0_A3: 'IOA', ISO_A3_EH: '-99' })).toMatchObject({
      id: 'IOA',
      iso3: null,
      status: 'dependency',
    });
  });

  it('lists exactly 193 UN members', () => {
    expect(UN_MEMBERS.size).toBe(193);
  });
});

describe('bboxOfRings', () => {
  it('returns a plain box away from the antimeridian', () => {
    expect(
      bboxOfRings([
        [
          [0, 0],
          [10, 5],
          [5, -5],
        ],
      ]),
    ).toEqual([0, -5, 10, 5]);
  });

  it('switches to 0–360 longitudes for shapes that cross the antimeridian', () => {
    const fiji = [
      [
        [178, -17],
        [179.9, -16],
      ],
      [
        [-179.9, -16.5],
        [-178, -17.5],
      ],
    ];
    expect(bboxOfRings(fiji)).toEqual([178, -17.5, 182, -16]);
  });
});

describe('approxArea', () => {
  it('measures a unit square at the equator as ~1', () => {
    const square = [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ];
    expect(approxArea(square)).toBeCloseTo(1, 2);
  });

  it('shrinks with latitude', () => {
    const north = [
      [
        [0, 60],
        [1, 60],
        [1, 61],
        [0, 61],
        [0, 60],
      ],
    ];
    expect(approxArea(north)).toBeCloseTo(0.49, 1);
  });
});
