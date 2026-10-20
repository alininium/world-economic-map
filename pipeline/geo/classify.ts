import type { BBox, CountryStatus } from '../../shared/types';
import { NE_OVERRIDES, PARTIALLY_RECOGNIZED, UN_MEMBERS, UN_OBSERVERS } from './territories';

/** The subset of Natural Earth admin-0 properties the pipeline reads. */
export interface NeProps {
  ADM0_A3: string;
  ISO_A3_EH: string;
  ISO_A2_EH: string;
  SOV_A3: string;
  SOVEREIGNT: string;
  NAME_LONG: string;
  NAME: string;
  FORMAL_EN: string | null;
  REGION_UN: string;
  SUBREGION: string;
  LABEL_X: number;
  LABEL_Y: number;
  [lang: `NAME_${string}`]: string | null | undefined;
}

export type Classification =
  | { kind: 'merge'; into: string }
  | { kind: 'entity'; id: string; iso3: string | null; status: CountryStatus };

const validIso = (code: string | null | undefined): string | null =>
  code && /^[A-Z]{2,3}$/.test(code) ? code : null;

/** Decides what entity a Natural Earth feature becomes under the project's territory policy. */
export function classifyFeature(p: Pick<NeProps, 'ADM0_A3' | 'ISO_A3_EH'>): Classification {
  const override = NE_OVERRIDES[p.ADM0_A3];
  if (override && 'mergeInto' in override) return { kind: 'merge', into: override.mergeInto };
  if (override) {
    const iso3 = override.status === 'partially_recognized' ? override.id : null;
    return { kind: 'entity', id: override.id, iso3, status: override.status };
  }
  const iso3 = validIso(p.ISO_A3_EH);
  const id = iso3 ?? p.ADM0_A3;
  let status: CountryStatus = 'dependency';
  if (UN_MEMBERS.has(id)) status = 'un_member';
  else if (UN_OBSERVERS.has(id)) status = 'un_observer';
  else if (PARTIALLY_RECOGNIZED.has(id)) status = 'partially_recognized';
  return { kind: 'entity', id, iso3, status };
}

/** Bounding box of a set of rings, choosing the [0, 360) longitude frame when it is narrower (antimeridian). */
export function bboxOfRings(rings: readonly (readonly (readonly number[])[])[]): BBox {
  let s = Infinity;
  let n = -Infinity;
  let w = Infinity;
  let e = -Infinity;
  let w360 = Infinity;
  let e360 = -Infinity;
  for (const ring of rings) {
    for (const pt of ring) {
      const lng = pt[0] ?? 0;
      const lat = pt[1] ?? 0;
      s = Math.min(s, lat);
      n = Math.max(n, lat);
      w = Math.min(w, lng);
      e = Math.max(e, lng);
      const l360 = lng < 0 ? lng + 360 : lng;
      w360 = Math.min(w360, l360);
      e360 = Math.max(e360, l360);
    }
  }
  return e360 - w360 < e - w ? [w360, s, e360, n] : [w, s, e, n];
}

/** Planar area in square degrees, each ring scaled by cos(mean latitude) so it roughly tracks real area. */
export function approxArea(rings: readonly (readonly (readonly number[])[])[]): number {
  let total = 0;
  for (const ring of rings) {
    let twiceArea = 0;
    let latSum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1 = 0, y1 = 0] = ring[j] ?? [];
      const [x2 = 0, y2 = 0] = ring[i] ?? [];
      twiceArea += x1 * y2 - x2 * y1;
      latSum += y2;
    }
    const meanLat = ring.length ? latSum / ring.length : 0;
    total += (Math.abs(twiceArea) / 2) * Math.cos((meanLat * Math.PI) / 180);
  }
  return total;
}
