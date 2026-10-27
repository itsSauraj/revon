import { db, get, push, ref, serverTimestamp, update } from './db';

import type {
  Member,
  Place,
  Profile,
  RideEvent,
  RideEventType,
  RideMeta,
  RiderRole,
  RiderStatus,
} from './types';

export const RIDE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const MEMBER_COLORS = [
  '#208AEF', '#E5484D', '#30A46C', '#F76B15', '#8E4EC6', '#12A594',
  '#D6409F', '#FFB224', '#3E63DD', '#A18072', '#5B5BD6', '#29A383',
];

// No 0/O/1/I so codes are easy to read out loud on the roadside.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function memberFrom(profile: Profile, color: string, role: RiderRole): Member {
  return {
    name: profile.name,
    phone: profile.sharePhone && profile.phone ? profile.phone : null,
    color,
    role,
    status: 'riding',
    joinedAt: Date.now(),
  };
}

function eventPayload(uid: string, type: RideEventType, data?: RideEvent['data']) {
  return { type, uid, ts: serverTimestamp(), ...(data ? { data } : {}) };
}

export async function createRide(opts: {
  uid: string;
  profile: Profile;
  destination: Place;
  route: RideMeta['route'];
  avoid: RideMeta['avoid'];
}): Promise<{ rideId: string; code: string }> {
  const rideId = push(ref(db, 'rides')).key!;
  const now = Date.now();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const meta: RideMeta = {
      code,
      destination: opts.destination,
      route: opts.route,
      avoid: opts.avoid,
      createdAt: now,
      createdBy: opts.uid,
      lastActivityAt: now,
      locked: false,
      endedAt: null,
    };
    try {
      await update(ref(db), {
        [`codes/${code}`]: rideId,
        [`rides/${rideId}/meta`]: meta,
        [`rides/${rideId}/members/${opts.uid}`]: memberFrom(opts.profile, MEMBER_COLORS[0], 'lead'),
        [`rides/${rideId}/events/${push(ref(db, 'x')).key}`]: eventPayload(opts.uid, 'joined'),
      });
      return { rideId, code };
    } catch (e) {
      // A taken code is rejected by the security rules; try another one.
      if (attempt === 4) throw e;
    }
  }
  throw new Error('Could not create ride');
}

export class JoinError extends Error {}

export async function joinByCode(rawCode: string, uid: string, profile: Profile): Promise<string> {
  const code = normalizeCode(rawCode);
  const codeSnap = await get(ref(db, `codes/${code}`));
  if (!codeSnap.exists()) throw new JoinError('No ride found for that code.');
  const rideId = codeSnap.val() as string;

  const meta = (await get(ref(db, `rides/${rideId}/meta`))).val() as RideMeta | null;
  if (!meta) throw new JoinError('This ride no longer exists.');
  if (meta.endedAt || Date.now() - meta.lastActivityAt > RIDE_EXPIRY_MS) {
    throw new JoinError('This ride has ended.');
  }

  // Rejoining (e.g. after leaving or reinstalling with the same account) is always allowed.
  const existing = await get(ref(db, `rides/${rideId}/members/${uid}`)).catch(() => null);
  if (existing?.exists()) {
    await update(ref(db, `rides/${rideId}`), {
      [`members/${uid}/status`]: 'riding',
      [`events/${push(ref(db, 'x')).key}`]: eventPayload(uid, 'joined'),
    });
    return rideId;
  }
  if (meta.locked) throw new JoinError('This ride is locked. Ask a member to unlock it.');

  const color = MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
  await update(ref(db, `rides/${rideId}`), {
    [`members/${uid}`]: memberFrom(profile, color, null),
    [`events/${push(ref(db, 'x')).key}`]: eventPayload(uid, 'joined'),
    'meta/lastActivityAt': Date.now(),
  });
  return rideId;
}

export function postEvent(rideId: string, uid: string, type: RideEventType, data?: RideEvent['data']) {
  return update(ref(db, `rides/${rideId}`), {
    [`events/${push(ref(db, 'x')).key}`]: eventPayload(uid, type, data),
    'meta/lastActivityAt': Date.now(),
  });
}

export async function setStatus(rideId: string, uid: string, status: RiderStatus) {
  const type: RideEventType = status === 'sos' ? 'sos' : 'status';
  await update(ref(db, `rides/${rideId}`), {
    [`members/${uid}/status`]: status,
    [`events/${push(ref(db, 'x')).key}`]: eventPayload(uid, type, { status }),
    'meta/lastActivityAt': Date.now(),
  });
}

export async function clearSos(rideId: string, uid: string) {
  await update(ref(db, `rides/${rideId}`), {
    [`members/${uid}/status`]: 'riding',
    [`events/${push(ref(db, 'x')).key}`]: eventPayload(uid, 'sos_clear'),
  });
}

/** Each role is held by one rider at a time; claiming it takes it from whoever had it. */
export async function setRole(
  rideId: string,
  uid: string,
  role: RiderRole,
  members: Record<string, Member>,
) {
  const patch: Record<string, unknown> = { [`members/${uid}/role`]: role };
  if (role) {
    for (const [otherUid, m] of Object.entries(members)) {
      if (otherUid !== uid && m.role === role) patch[`members/${otherUid}/role`] = null;
    }
  }
  await update(ref(db, `rides/${rideId}`), patch);
}

export function setRegroup(rideId: string, uid: string, lat: number, lng: number, label: string) {
  return update(ref(db, `rides/${rideId}`), {
    regroup: { lat, lng, label, setBy: uid, ts: serverTimestamp() },
    [`events/${push(ref(db, 'x')).key}`]: eventPayload(uid, 'regroup', { label }),
  });
}

export function clearRegroup(rideId: string) {
  return update(ref(db, `rides/${rideId}`), { regroup: null });
}

export function setLocked(rideId: string, uid: string, locked: boolean) {
  return update(ref(db, `rides/${rideId}`), {
    'meta/locked': locked,
    [`events/${push(ref(db, 'x')).key}`]: eventPayload(uid, 'locked', { locked }),
  });
}

export async function leaveRide(rideId: string, uid: string) {
  await update(ref(db, `rides/${rideId}`), {
    [`members/${uid}/status`]: 'left',
    [`members/${uid}/role`]: null,
    [`locations/${uid}`]: null,
    [`events/${push(ref(db, 'x')).key}`]: eventPayload(uid, 'left'),
  });
}
