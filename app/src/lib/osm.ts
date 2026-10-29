/**
 * OpenStreetMap services, the keyless counterpart of lib/google.ts with the same return shapes:
 * Photon (komoot) for place search and reverse geocoding, Valhalla for routing and OSRM as the
 * routing fallback. lib/places.ts and lib/directions.ts pick this module when the map source is
 * OpenStreetMap (lib/map-source.ts).
 *
 * These are shared community servers: no API key, but also no SLA, so every request has a short
 * timeout and routing falls through to the next provider on any failure.
 */
import { decodePolyline, encodePolyline } from './geo';
import { deviceLanguage, deviceLanguageCode } from './locale';
import type { Avoid, LatLng, Place, Route, RouteStep, RouteWithSteps, Suggestion } from './types';

export const PHOTON_URL = 'https://photon.komoot.io';
export const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
/** Tried in order once Valhalla fails: FOSSGIS's OSRM, then the OSRM project's demo server. */
export const OSRM_URLS = [
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  'https://router.project-osrm.org/route/v1/driving',
] as const;

const TIMEOUT_MS = 12_000;

/**
 * React Native's AbortController polyfill (abort-controller) predates `AbortSignal.timeout`, so
 * build the equivalent signal by hand there; browsers and Node have the static method.
 */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function getJson<T>(label: string, url: string): Promise<T> {
  const res = await fetch(url, { signal: timeoutSignal(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${label} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------------------------
// Photon (search and reverse geocoding)
// ---------------------------------------------------------------------------------------------

type PhotonProps = {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
};
type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: PhotonProps };
type PhotonResponse = { features?: PhotonFeature[] };

/** Photon only translates into these; any other `lang` is a 400, and no `lang` means English. */
const PHOTON_LANGS = new Set(['en', 'de', 'fr']);

function photonLang(): string {
  const code = deviceLanguageCode();
  return PHOTON_LANGS.has(code) ? `&lang=${code}` : '';
}

/** "railway_station" -> "Railway station", for features whose only label is their OSM tag value. */
function humanise(value: string): string {
  const text = value.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function streetLine(p: PhotonProps): string {
  return [p.street, p.housenumber].filter(Boolean).join(' ');
}

function locality(p: PhotonProps): string | undefined {
  return p.city ?? p.town ?? p.village ?? p.county;
}

function mainText(p: PhotonProps): string {
  if (p.name) return p.name;
  const street = streetLine(p);
  if (street) return street;
  // "yes" is the generic tag value (building=yes) and says nothing about the place.
  if (p.osm_value && p.osm_value !== 'yes') return humanise(p.osm_value);
  return '';
}

/** Address parts below the main text, most specific first, without repeats or the main text itself. */
function secondaryText(p: PhotonProps, main: string): string {
  const parts = [streetLine(p), p.district, locality(p), p.state, p.country];
  const seen = new Set<string>([main]);
  const out: string[] = [];
  for (const part of parts) {
    if (!part || seen.has(part)) continue;
    seen.add(part);
    out.push(part);
  }
  return out.join(', ');
}

function toSuggestion(f: PhotonFeature): Suggestion | null {
  const p = f.properties ?? {};
  const coords = f.geometry?.coordinates;
  if (!coords || p.osm_id == null) return null;
  const main = mainText(p);
  if (!main) return null;
  const secondary = secondaryText(p, main);
  const place: Place = { latitude: coords[1], longitude: coords[0], name: main, address: secondary || undefined };
  return { id: `${p.osm_type ?? ''}${p.osm_id}`, main, secondary, place };
}

/** Photon geocoder search, biased toward the rider's position. Results carry their coordinates. */
export async function searchPlaces(input: string, near: LatLng | null): Promise<Suggestion[]> {
  const q = input.trim();
  if (!q) return [];
  const bias = near ? `&lat=${near.latitude}&lon=${near.longitude}` : '';
  const data = await getJson<PhotonResponse>(
    'Photon',
    `${PHOTON_URL}/api/?q=${encodeURIComponent(q)}&limit=6${bias}${photonLang()}`,
  );
  // Photon can return the same object twice (e.g. a node and the way it belongs to share a name).
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const f of data.features ?? []) {
    const s = toSuggestion(f);
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

/**
 * Short "Name, Street, City" line for a coordinate (same shape as hooks/use-address.ts), or null.
 * The label is decorative, so a failed lookup is reported as "nothing found" rather than thrown.
 */
export async function reverseGeocode(point: LatLng): Promise<string | null> {
  try {
    const data = await getJson<PhotonResponse>(
      'Photon',
      `${PHOTON_URL}/reverse?lat=${point.latitude}&lon=${point.longitude}&limit=1${photonLang()}`,
    );
    const p = data.features?.[0]?.properties;
    if (!p) return null;
    const line = [p.name && p.name !== p.street ? p.name : null, streetLine(p), locality(p)]
      .filter(Boolean)
      .join(', ');
    return line || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Valhalla (primary routing)
// ---------------------------------------------------------------------------------------------

/** Languages Valhalla has narrative strings for; anything else is answered in en-US. */
export const VALHALLA_LANGUAGES = [
  'bg-BG',
  'ca-ES',
  'cs-CZ',
  'da-DK',
  'de-DE',
  'el-GR',
  'en-GB',
  'en-US',
  'en-US-x-pirate',
  'es-ES',
  'et-EE',
  'fi-FI',
  'fr-FR',
  'hi-IN',
  'hu-HU',
  'it-IT',
  'ja-JP',
  'nb-NO',
  'nl-NL',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'ro-RO',
  'ru-RU',
  'sk-SK',
  'sl-SI',
  'sv-SE',
  'tr-TR',
  'uk-UA',
] as const;

/** The exact device tag when Valhalla has it, else the first tag with the same language, else en-US. */
export function valhallaLanguage(tag: string = deviceLanguage()): string {
  const lower = tag.toLowerCase();
  const exact = VALHALLA_LANGUAGES.find((l) => l.toLowerCase() === lower);
  if (exact) return exact;
  const code = lower.split(/[-_]/)[0];
  return VALHALLA_LANGUAGES.find((l) => l.toLowerCase().split('-')[0] === code) ?? 'en-US';
}

/**
 * Valhalla maneuver type -> Google Routes maneuver name (components/nav/maneuver.ts). The arrival
 * types (4, 5, 6) are deliberately absent: the ride view shows its own arrival card once no step
 * starts ahead of the rider, so an arrival step would only delay it.
 */
export const VALHALLA_MANEUVER: Record<number, string> = {
  1: 'DEPART',
  2: 'DEPART',
  3: 'DEPART',
  7: 'STRAIGHT',
  8: 'STRAIGHT',
  9: 'TURN_SLIGHT_RIGHT',
  10: 'TURN_RIGHT',
  11: 'TURN_SHARP_RIGHT',
  12: 'UTURN_RIGHT',
  13: 'UTURN_LEFT',
  14: 'TURN_SHARP_LEFT',
  15: 'TURN_LEFT',
  16: 'TURN_SLIGHT_LEFT',
  17: 'STRAIGHT',
  18: 'RAMP_RIGHT',
  19: 'RAMP_LEFT',
  20: 'RAMP_RIGHT',
  21: 'RAMP_LEFT',
  22: 'STRAIGHT',
  23: 'FORK_RIGHT',
  24: 'FORK_LEFT',
  25: 'MERGE',
  26: 'ROUNDABOUT_RIGHT',
  27: 'STRAIGHT',
  28: 'FERRY',
  29: 'STRAIGHT',
  37: 'MERGE',
  38: 'MERGE',
};
export const VALHALLA_ARRIVE = new Set([4, 5, 6]);

/** Valhalla answers 400 with one of these when the request is fine but no road connects the points. */
const VALHALLA_NO_ROUTE = new Set([170, 171, 442]);

type ValhallaManeuver = { type?: number; instruction?: string; length?: number };
type ValhallaResponse = {
  trip?: {
    units?: string;
    summary?: { length?: number; time?: number };
    legs?: { shape?: string; maneuvers?: ValhallaManeuver[] }[];
  };
  error_code?: number;
  error?: string;
};

async function valhallaRoute(
  origin: LatLng,
  destination: LatLng,
  avoid: Avoid,
  withSteps: boolean,
): Promise<Route | RouteWithSteps | null> {
  const body = {
    locations: [
      { lat: origin.latitude, lon: origin.longitude },
      { lat: destination.latitude, lon: destination.longitude },
    ],
    costing: 'motorcycle',
    // use_* are preferences from 0 (avoid where possible) to 1 (prefer), not hard bans.
    costing_options: {
      motorcycle: { use_highways: avoid.highways ? 0 : 1, use_tolls: avoid.tolls ? 0 : 0.5 },
    },
    directions_options: { units: 'kilometers', language: valhallaLanguage() },
  };
  const res = await fetch(VALHALLA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutSignal(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => null)) as ValhallaResponse | null;
  if (!res.ok) {
    if (data?.error_code != null && VALHALLA_NO_ROUTE.has(data.error_code)) return null;
    throw new Error(`Valhalla ${res.status}: ${data?.error ?? ''}`);
  }
  const trip = data?.trip;
  const leg = trip?.legs?.[0];
  if (!trip?.summary || !leg?.shape) throw new Error('Valhalla: no trip in response');
  const toMetres = trip.units === 'miles' ? 1609.344 : 1000;
  const route: Route = {
    // Valhalla shapes are precision 6; rides store precision 5 like every other provider.
    polyline: encodePolyline(decodePolyline(leg.shape, 6), 5),
    distanceM: Math.round((trip.summary.length ?? 0) * toMetres),
    durationS: Math.round(trip.summary.time ?? 0),
  };
  if (!withSteps) return route;
  const steps: RouteStep[] = [];
  for (const m of leg.maneuvers ?? []) {
    if (m.type == null || VALHALLA_ARRIVE.has(m.type)) continue;
    steps.push({
      instruction: m.instruction ?? '',
      maneuver: VALHALLA_MANEUVER[m.type] ?? 'STRAIGHT',
      distanceM: Math.round((m.length ?? 0) * toMetres),
    });
  }
  return { ...route, steps };
}

// ---------------------------------------------------------------------------------------------
// OSRM (fallback routing; car profile, no avoid options, no instruction text)
// ---------------------------------------------------------------------------------------------

export type OsrmStep = {
  name?: string;
  ref?: string;
  distance?: number;
  driving_side?: string;
  maneuver?: { type?: string; modifier?: string; exit?: number; bearing_after?: number };
};
type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: string;
    legs?: { steps?: OsrmStep[] }[];
  }[];
};

/** OSRM answers these with HTTP 400; they mean "no road here", not "server broken". */
const OSRM_NO_ROUTE = new Set(['NoRoute', 'NoSegment']);

/** OSRM turn modifier -> Google maneuver, for the turn-like step types. */
export const OSRM_TURN: Record<string, string> = {
  left: 'TURN_LEFT',
  right: 'TURN_RIGHT',
  'slight left': 'TURN_SLIGHT_LEFT',
  'slight right': 'TURN_SLIGHT_RIGHT',
  'sharp left': 'TURN_SHARP_LEFT',
  'sharp right': 'TURN_SHARP_RIGHT',
  straight: 'STRAIGHT',
};

const OSRM_TURN_TYPES = new Set(['turn', 'end of road', 'continue', 'new name', 'notification']);
const OSRM_ROUNDABOUT_TYPES = new Set(['roundabout', 'rotary', 'roundabout turn']);
const OSRM_RAMP_TYPES = new Set(['on ramp', 'off ramp', 'ramp']);
const OSRM_EXIT_TYPES = new Set(['exit roundabout', 'exit rotary']);

function side(modifier: string | undefined): 'LEFT' | 'RIGHT' {
  return modifier?.includes('left') ? 'LEFT' : 'RIGHT';
}

/** OSRM maneuver (type, modifier, driving side) -> Google Routes maneuver name. */
export function osrmManeuver(type: string, modifier: string | undefined, drivingSide: string | undefined): string {
  if (type === 'depart') return 'DEPART';
  if (type === 'merge') return 'MERGE';
  if (OSRM_RAMP_TYPES.has(type)) return `RAMP_${side(modifier)}`;
  if (type === 'fork') return `FORK_${side(modifier)}`;
  // Which way round a roundabout goes depends on the side of the road, not on the modifier.
  if (OSRM_ROUNDABOUT_TYPES.has(type)) return drivingSide === 'left' ? 'ROUNDABOUT_LEFT' : 'ROUNDABOUT_RIGHT';
  if (OSRM_EXIT_TYPES.has(type)) return 'STRAIGHT';
  if (OSRM_TURN_TYPES.has(type)) {
    if (modifier === 'uturn') return drivingSide === 'left' ? 'UTURN_LEFT' : 'UTURN_RIGHT';
    return OSRM_TURN[modifier ?? ''] ?? 'STRAIGHT';
  }
  return 'STRAIGHT';
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

function compass(bearing: number): string {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

const TURN_WORDS: Record<string, string> = {
  left: 'Turn left',
  right: 'Turn right',
  'slight left': 'Turn slightly left',
  'slight right': 'Turn slightly right',
  'sharp left': 'Turn sharply left',
  'sharp right': 'Turn sharply right',
  uturn: 'Make a U-turn',
};

/** OSRM has no narrative, so build a short English line in the shape Valhalla and Google use. */
export function osrmInstruction(step: OsrmStep): string {
  const m = step.maneuver ?? {};
  const type = m.type ?? '';
  const name = step.name || step.ref || '';
  const onto = name ? ` onto ${name}` : '';
  const on = name ? ` on ${name}` : '';
  const dir = m.modifier?.includes('left') ? 'left' : m.modifier?.includes('right') ? 'right' : '';
  if (type === 'depart') return `Head ${compass(m.bearing_after ?? 0)}${on}`;
  if (type === 'merge') return `Merge${dir ? ` ${dir}` : ''}${onto}`;
  if (type === 'off ramp') return `Take the exit${dir ? ` on the ${dir}` : ''}${onto}`;
  if (OSRM_RAMP_TYPES.has(type)) return `Take the ramp${dir ? ` on the ${dir}` : ''}${onto}`;
  if (type === 'fork') return `Keep ${dir || 'straight'}${onto}`;
  if (OSRM_ROUNDABOUT_TYPES.has(type)) {
    return m.exit ? `At the roundabout take exit ${m.exit}${onto}` : `Enter the roundabout${onto}`;
  }
  if (OSRM_EXIT_TYPES.has(type)) return `Exit the roundabout${onto}`;
  const turn = TURN_WORDS[m.modifier ?? ''];
  if (turn) return `${turn}${onto}`;
  return `Continue${on}`;
}

async function osrmRoute(
  base: string,
  origin: LatLng,
  destination: LatLng,
  withSteps: boolean,
): Promise<Route | RouteWithSteps | null> {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const res = await fetch(`${base}/${coords}?overview=full&geometries=polyline&steps=${withSteps}`, {
    signal: timeoutSignal(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => null)) as OsrmResponse | null;
  if (data?.code && OSRM_NO_ROUTE.has(data.code)) return null;
  if (!res.ok || data?.code !== 'Ok') throw new Error(`OSRM ${res.status}: ${data?.message ?? data?.code ?? ''}`);
  const r = data.routes?.[0];
  if (!r?.geometry) throw new Error('OSRM: no route in response');
  // OSRM's polyline geometry is already precision 5.
  const route: Route = {
    polyline: r.geometry,
    distanceM: Math.round(r.distance ?? 0),
    durationS: Math.round(r.duration ?? 0),
  };
  if (!withSteps) return route;
  const steps: RouteStep[] = [];
  for (const s of r.legs?.[0]?.steps ?? []) {
    const type = s.maneuver?.type ?? '';
    if (type === 'arrive') continue;
    steps.push({
      instruction: osrmInstruction(s),
      maneuver: osrmManeuver(type, s.maneuver?.modifier, s.driving_side),
      distanceM: Math.round(s.distance ?? 0),
    });
  }
  return { ...route, steps };
}

// ---------------------------------------------------------------------------------------------
// Routing facade
// ---------------------------------------------------------------------------------------------

/**
 * Valhalla (motorcycle costing, honours `avoid`), then the OSRM servers in turn when it is down.
 * Resolves null as soon as a provider answers that no road connects the points: asking the next
 * one would not help, because OSRM snaps to the nearest road however far away and would happily
 * route to the wrong coast. Throws only when no provider answered at all.
 */
export async function computeRoute(
  origin: LatLng,
  destination: LatLng,
  avoid: Avoid,
  withSteps: boolean,
): Promise<Route | RouteWithSteps | null> {
  const attempts = [
    () => valhallaRoute(origin, destination, avoid, withSteps),
    ...OSRM_URLS.map((base) => () => osrmRoute(base, origin, destination, withSteps)),
  ];
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch {
      // Timeout, HTTP error or malformed body: try the next provider.
    }
  }
  throw new Error('Routing service unavailable');
}
