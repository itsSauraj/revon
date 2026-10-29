import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import type { MapRef } from '@/components/map/map-view';
import { computeRoute } from '@/lib/directions';
import {
  ARRIVED_M,
  decodePolyline,
  haversine,
  OFF_ROUTE_GRACE_MS,
  OFF_ROUTE_M,
  routeLength,
  splitRoute,
} from '@/lib/geo';
import type { LatLng, Place, RouteStep, RouteWithSteps } from '@/lib/types';

/** A GPS fix from the map's user-location event. heading/speed are -1 when unknown. */
export type Fix = LatLng & { heading: number; speed: number };

const RETRY_MS = 15_000;
const FOLLOW_ZOOM = 17;
const MIN_ZOOM = 12;
const MAX_ZOOM = 20;
const FOLLOW_PITCH = 45;

export type NextTurn = {
  /** The upcoming maneuver, or null when the next thing is arriving at the target. */
  step: RouteStep | null;
  /** Road distance from the rider to that maneuver (or to the target). */
  distanceM: number;
};

function findNextTurn(route: RouteWithSteps | null, alongM: number | null, geomLen: number): NextTurn | null {
  if (!route || alongM == null || geomLen <= 0) return null;
  const alongRoad = (alongM / geomLen) * route.distanceM;
  let start = 0;
  for (const step of route.steps) {
    if (start > alongRoad + 5) return { step, distanceM: start - alongRoad };
    start += step.distanceM;
  }
  return { step: null, distanceM: Math.max(0, route.distanceM - alongRoad) };
}

/**
 * In-app ride view: follows the rider along a personal route to a target (the destination or
 * another rider), shows the next turn and progress, and re-routes after leaving the route.
 *
 * Note: live next-turn guidance built on Routes data conflicts with Google Maps Platform Terms
 * §3.2.3(d)(iv); replace with the Google Navigation SDK before a store release.
 */
export function useRouteFollow(
  map: RefObject<MapRef | null>,
  fix: Fix | null,
  avoid?: { highways: boolean; tolls: boolean },
) {
  const [target, setTarget] = useState<Place | null>(null);
  const [routeFor, setRouteFor] = useState<{ target: Place; route: RouteWithSteps | null } | null>(null);
  const [following, setFollowing] = useState(true);
  // Heading-up (map turns with you) by default; north-up keeps north at the top while following.
  const [northUp, setNorthUp] = useState(false);
  const [zoom, setZoom] = useState(FOLLOW_ZOOM);
  // Where this ride view started, for the From → To card.
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inflight = useRef(false);
  const lastRequest = useRef(0);
  const offSince = useRef<number | null>(null);
  const lastHeading = useRef(0);

  // Only a route computed for the current target counts.
  const route = routeFor && routeFor.target === target ? routeFor.route : null;
  const coords = useMemo(() => (route ? decodePolyline(route.polyline) : []), [route]);
  const geomLen = useMemo(() => routeLength(coords), [coords]);
  const split = useMemo(() => (fix && coords.length > 1 ? splitRoute(fix, coords) : null), [fix, coords]);

  const offRoute = Boolean(split && split.crossM > OFF_ROUTE_M);
  const arrived = Boolean(fix && target && haversine(fix, target) < ARRIVED_M);

  // Fetch the first route, and a new one after riding off it for a while.
  useEffect(() => {
    if (!target || !fix || arrived) return;
    if (split && split.crossM <= OFF_ROUTE_M) offSince.current = null;
    const now = Date.now();
    const needFirst = !route;
    let needReroute = false;
    if (split && split.crossM > OFF_ROUTE_M) {
      offSince.current ??= now;
      needReroute = now - offSince.current > OFF_ROUTE_GRACE_MS;
    }
    if (!(needFirst || needReroute) || inflight.current || now - lastRequest.current < RETRY_MS) return;

    inflight.current = true;
    lastRequest.current = now;
    const forTarget = target;
    computeRoute(fix, forTarget, avoid, true)
      .then((r) => {
        setRouteFor({ target: forTarget, route: r });
        setError(r ? null : 'No route found');
      })
      .catch((e) => setError(String(e)))
      .finally(() => {
        inflight.current = false;
        offSince.current = null;
      });
  }, [target, fix, route, split, arrived, avoid]);

  // Camera that follows the rider, heading-up or north-up.
  useEffect(() => {
    if (!target || !following || !fix) return;
    if (fix.speed > 1 && fix.heading >= 0) lastHeading.current = fix.heading;
    map.current?.animateCamera(
      {
        center: { latitude: fix.latitude, longitude: fix.longitude },
        heading: northUp ? 0 : lastHeading.current,
        pitch: northUp ? 0 : FOLLOW_PITCH,
        zoom,
      },
      { duration: 900 },
    );
  }, [fix, following, target, map, northUp, zoom]);

  const fraction = split && geomLen > 0 ? Math.max(0, 1 - split.alongM / geomLen) : 1;

  // Steps describe the maneuver at their start. Map the rider's position along the drawn route to
  // road distance, then find the first step that starts ahead of them.
  const nextTurn = findNextTurn(route, split?.alongM ?? null, geomLen);

  return {
    active: Boolean(target),
    target,
    route,
    loading: Boolean(target) && !route && !error,
    error,
    travelled: split?.travelled ?? [],
    ahead: split?.remaining ?? coords,
    remainingM: route ? route.distanceM * fraction : null,
    remainingS: route ? route.durationS * fraction : null,
    nextTurn,
    origin,
    offRoute,
    arrived,
    following,
    northUp,
    /** Compass tap in the ride view: switch between heading-up and north-up, and resume following. */
    toggleNorthUp() {
      setNorthUp((n) => !n);
      setFollowing(true);
    },
    start(t: Place) {
      lastRequest.current = 0;
      offSince.current = null;
      setError(null);
      setFollowing(true);
      setZoom(FOLLOW_ZOOM);
      setOrigin(fix ? { latitude: fix.latitude, longitude: fix.longitude } : null);
      setTarget(t);
    },
    /** Zoom buttons: change the follow zoom while following, otherwise zoom the map directly. */
    zoomBy(delta: number) {
      if (target && following) {
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
        return;
      }
      map.current
        ?.getCamera()
        .then((c) => map.current?.animateCamera({ zoom: (c.zoom ?? 15) + delta }, { duration: 250 }))
        .catch(() => {});
    },
    stop() {
      setTarget(null);
      setRouteFor(null);
      setError(null);
      map.current?.animateCamera({ heading: 0, pitch: 0 }, { duration: 500 });
    },
    /** Re-center: follow the rider again at the navigation zoom (like Google Maps' Re-center). */
    recenter() {
      setZoom(FOLLOW_ZOOM);
      setFollowing(true);
    },
    /** Call when the user drags the map: stop following until they tap re-centre. */
    pause() {
      setFollowing(false);
    },
  };
}
