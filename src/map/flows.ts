import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { TradeProfile } from '../../shared/trade';
import type { Country, LngLat } from '../../shared/types';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Points along the great circle from a to b. Longitudes are unwrapped (may leave
 * [-180, 180]) so a route across the antimeridian draws as one continuous line.
 */
export function greatCircle(a: LngLat, b: LngLat, segments = 64): LngLat[] {
  const [lon1, lat1, lon2, lat2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );
  if (d === 0) return [a, b];
  const points: LngLat[] = [];
  let prevLon: number | null = null;
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    let lon = deg(Math.atan2(y, x));
    const lat = deg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    prevLon = lon;
    points.push([lon, lat]);
  }
  return points;
}

export interface FlowProps {
  flow: 'exports' | 'imports';
  /** The selected country the lines belong to. */
  origin: string;
  partner: string;
  share: number;
}

/** Lines from the country to its top partners that are map entities. */
export function flowLines(
  origin: Country,
  profile: TradeProfile,
  countries: ReadonlyMap<string, Country>,
  perFlow = 5,
): FeatureCollection<LineString, FlowProps> {
  const features: Feature<LineString, FlowProps>[] = [];
  for (const flow of ['exports', 'imports'] as const) {
    const partners = profile[flow].partners
      .filter((p) => p.partnerId && countries.has(p.partnerId) && p.partnerId !== origin.id)
      .slice(0, perFlow);
    for (const p of partners) {
      const dest = countries.get(p.partnerId!)!;
      // Always unwrap from the selected country so every line starts in the same world copy;
      // import lines are then reversed to run from the partner to the country.
      const path = greatCircle(origin.label, dest.label);
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: flow === 'exports' ? path : path.reverse() },
        properties: { flow, origin: origin.id, partner: dest.id, share: p.share },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
