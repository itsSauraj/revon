import type { LatLng } from './types';

const R = 6371000; // earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;

export const OFF_ROUTE_M = 150;
export const OFF_ROUTE_GRACE_MS = 20_000;
export const ARRIVED_M = 100;
export const STOPPED_SPEED = 1.5; // m/s
export const STALE_MS = 60_000;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Decodes a Google encoded polyline (precision 5). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export type Projection = {
  alongM: number; // distance from route start to the closest point on the route
  crossM: number; // distance from the point to the route
};

/**
 * Projects a point onto a polyline using a local equirectangular approximation per segment
 * (accurate to well under 1% at segment lengths typical of road polylines).
 */
export function projectOntoRoute(p: LatLng, route: LatLng[]): Projection | null {
  if (route.length < 2) return null;
  let best: Projection | null = null;
  let walked = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const cosLat = Math.cos(toRad((a.latitude + b.latitude) / 2));
    const bx = toRad(b.longitude - a.longitude) * cosLat * R;
    const by = toRad(b.latitude - a.latitude) * R;
    const px = toRad(p.longitude - a.longitude) * cosLat * R;
    const py = toRad(p.latitude - a.latitude) * R;
    const segLen2 = bx * bx + by * by;
    const t = segLen2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / segLen2));
    const dx = px - t * bx;
    const dy = py - t * by;
    const crossM = Math.sqrt(dx * dx + dy * dy);
    const segLen = Math.sqrt(segLen2);
    if (!best || crossM < best.crossM) best = { alongM: walked + t * segLen, crossM };
    walked += segLen;
  }
  return best;
}

export function routeLength(route: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) total += haversine(route[i], route[i + 1]);
  return total;
}

export function formatDistance(m: number): string {
  const abs = Math.abs(m);
  if (abs < 1000) return `${Math.round(abs)} m`;
  return `${(abs / 1000).toFixed(abs < 10_000 ? 1 : 0)} km`;
}

export function formatSpeed(mps: number): string {
  if (mps < 0) return '–';
  return `${Math.round(mps * 3.6)} km/h`;
}

export function formatDuration(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
