import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import type { MapRef } from '@/components/map/map-view';
import {
  ARRIVED_M,
  decodePolyline,
  haversine,
  OFF_ROUTE_GRACE_MS,
  OFF_ROUTE_M,
  routeLength,
  splitRoute,
} from '@/lib/geo';
import { computeRoute, type RouteWithSteps } from '@/lib/google';
import type { LatLng, Place } from '@/lib/types';

/** A GPS fix from the map's user-location event. heading/speed are -1 when unknown. */
export type Fix = LatLng & { heading: number; speed: number };

const RETRY_MS = 15_000;
const FOLLOW_ZOOM = 17;
const FOLLOW_PITCH = 45;

/**
 * In-app ride view: follows the rider along a personal route to a target (the destination or
 * another rider), shows progress and re-routes after leaving the route. Deliberately no spoken
 * turn-by-turn prompts — see README "Known limitations".
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
        zoom: FOLLOW_ZOOM,
      },
      { duration: 900 },
    );
  }, [fix, following, target, map, northUp]);

  const fraction = split && geomLen > 0 ? Math.max(0, 1 - split.alongM / geomLen) : 1;

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
      setTarget(t);
    },
    stop() {
      setTarget(null);
      setRouteFor(null);
      setError(null);
      map.current?.animateCamera({ heading: 0, pitch: 0 }, { duration: 500 });
    },
    recenter() {
      setFollowing(true);
    },
    /** Call when the user drags the map: stop following until they tap re-centre. */
    pause() {
      setFollowing(false);
    },
  };
}
