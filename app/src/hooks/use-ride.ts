import {
  limitToLast,
  onChildAdded,
  onValue,
  orderByChild,
  query,
  ref,
  startAt,
} from 'firebase/database';
import { useEffect, useMemo, useRef, useState } from 'react';

import { raiseAlert } from '@/lib/alerts';
import { db } from '@/lib/firebase';
import { decodePolyline, formatDistance, STALE_MS, STOPPED_SPEED } from '@/lib/geo';
import type { LatLng, Member, Regroup, RideEvent, RideMeta, RiderLocation } from '@/lib/types';

export const GAP_ALERT_M = 2000;

export type Rider = Member & {
  uid: string;
  loc: RiderLocation | null;
  stale: boolean;
  moving: boolean;
  /** Metres ahead (+) or behind (−) me along the route; null if unknown. */
  relativeM: number | null;
};

const STATUS_TEXT: Record<string, string> = {
  fuel: 'is stopping for fuel',
  rest: 'is taking a rest stop',
  food: 'is stopping for food',
  mechanical: 'has a mechanical problem',
  riding: 'is riding again',
};

function describeEvent(e: RideEvent, name: string, isMe: boolean): [string, 'info' | 'warn' | 'danger' | 'quiet'] | null {
  switch (e.type) {
    case 'joined':
      return isMe ? null : [`${name} joined the ride`, 'quiet'];
    case 'left':
      return isMe ? null : [`${name} left the ride`, 'info'];
    case 'sos':
      return isMe ? null : [`SOS. ${name} needs help`, 'danger'];
    case 'sos_clear':
      return isMe ? null : [`${name} is OK now`, 'info'];
    case 'off_route':
      return isMe ? ['You are off the group route', 'warn'] : [`${name} is off route`, 'warn'];
    case 'back_on_route':
      return isMe ? null : [`${name} is back on route`, 'quiet'];
    case 'arrived':
      return isMe ? ['You have arrived', 'quiet'] : [`${name} arrived at the destination`, 'quiet'];
    case 'status': {
      const s = String(e.data?.status ?? '');
      return isMe || !STATUS_TEXT[s] ? null : [`${name} ${STATUS_TEXT[s]}`, s === 'mechanical' ? 'warn' : 'info'];
    }
    case 'regroup':
      return [`Regroup point set: ${e.data?.label ?? 'pin'}`, 'info'];
    case 'locked':
      return isMe ? null : [e.data?.locked ? `${name} locked the ride` : `${name} unlocked the ride`, 'quiet'];
    default:
      return null;
  }
}

export function useRide(rideId: string | undefined, myUid: string | null) {
  const [meta, setMeta] = useState<RideMeta | null>(null);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [locations, setLocations] = useState<Record<string, RiderLocation>>({});
  const [regroup, setRegroup] = useState<Regroup | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!rideId) return;
    const base = `rides/${rideId}`;
    const onErr = (e: Error) => setError(e.message);
    const unsubs = [
      onValue(ref(db, `${base}/meta`), (s) => {
        setMeta(s.val());
        setLoaded(true);
      }, onErr),
      onValue(ref(db, `${base}/members`), (s) => setMembers(s.val() ?? {}), onErr),
      onValue(ref(db, `${base}/locations`), (s) => setLocations(s.val() ?? {}), onErr),
      onValue(ref(db, `${base}/regroup`), (s) => setRegroup(s.val()), onErr),
      onValue(ref(db, '.info/serverTimeOffset'), (s) => setServerOffset(s.val() ?? 0)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [rideId]);

  // Event feed → alerts. Only events from after we opened the ride.
  useEffect(() => {
    if (!rideId || !myUid) return;
    const since = Date.now() + serverOffset - 5000;
    const q = query(ref(db, `rides/${rideId}/events`), orderByChild('ts'), startAt(since), limitToLast(50));
    // Members are read lazily so names resolve even for riders who joined after we subscribed.
    let latestMembers: Record<string, Member> = {};
    const unsubMembers = onValue(ref(db, `rides/${rideId}/members`), (s) => {
      latestMembers = s.val() ?? {};
    });
    const unsub = onChildAdded(q, (s) => {
      const e = s.val() as RideEvent;
      const described = describeEvent(e, latestMembers[e.uid]?.name ?? 'A rider', e.uid === myUid);
      if (described) raiseAlert(`ev:${s.key}`, described[0], described[1], { uid: e.uid });
    });
    return () => {
      unsub();
      unsubMembers();
    };
    // serverOffset only shifts the window by a few seconds; don't resubscribe for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId, myUid]);

  // Re-evaluate staleness every few seconds.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const polyline = meta?.route?.polyline;
  const route = useMemo<LatLng[]>(() => (polyline ? decodePolyline(polyline) : []), [polyline]);

  const serverNow = now + serverOffset;
  const mine = myUid ? locations[myUid] : undefined;

  const riders: Rider[] = Object.entries(members)
    .filter(([, m]) => m.status !== 'left')
    .map(([uid, m]) => {
      const loc = locations[uid] ?? null;
      const stale = m.status !== 'arrived' && (!loc || serverNow - loc.ts > STALE_MS);
      const relativeM =
        uid !== myUid && loc?.alongM != null && mine?.alongM != null ? loc.alongM - mine.alongM : null;
      return { ...m, uid, loc, stale, moving: (loc?.speed ?? 0) > STOPPED_SPEED, relativeM };
    })
    // Front of the convoy first.
    .sort((a, b) => (b.loc?.alongM ?? -Infinity) - (a.loc?.alongM ?? -Infinity));

  const lead = riders.find((r) => r.role === 'lead');
  const sweep = riders.find((r) => r.role === 'sweep');
  const gapM =
    lead?.loc?.alongM != null && sweep?.loc?.alongM != null ? lead.loc.alongM - sweep.loc.alongM : null;

  // Gap alert, with hysteresis so it doesn't fire repeatedly around the threshold.
  const gapAlerted = useRef(false);
  useEffect(() => {
    if (gapM == null) return;
    if (!gapAlerted.current && gapM > GAP_ALERT_M) {
      gapAlerted.current = true;
      raiseAlert(
        `gap:${Date.now()}`,
        `Group is stretched ${formatDistance(gapM)}. Lead, slow down.`,
        'warn',
      );
    } else if (gapAlerted.current && gapM < GAP_ALERT_M * 0.6) {
      gapAlerted.current = false;
    }
  }, [gapM]);

  const isMember = Boolean(myUid && members[myUid] && members[myUid].status !== 'left');

  return { loaded, error, meta, members, riders, route, regroup, gapM, isMember, me: myUid ? members[myUid] : undefined };
}
