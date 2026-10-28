/**
 * App session: welcome screen seen, signed-in user, rider profile, and which onboarding step the
 * user is on. The root layout routes on `stage`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import {
  currentUser,
  onUserChanged,
  reloadUser,
  signOut as authSignOut,
} from './auth';
import { db, get, ref, update } from './db';
import { isFirebaseConfigured } from './firebase';
import type { AppUser, Profile } from './types';

const WELCOME_KEY = 'revon.welcomeSeen';
const profileKey = (uid: string) => `revon.profile.${uid}`;

/**
 * - welcome: first launch, show the intro.
 * - auth: sign in / register.
 * - verifyEmail: email/password account whose email isn't verified yet.
 * - phone: needs a name and a verified phone number.
 * - ready: fully set up; the app.
 */
export type Stage = 'loading' | 'welcome' | 'auth' | 'verifyEmail' | 'phone' | 'ready';

type SessionState = {
  ready: boolean;
  welcomeSeen: boolean;
  user: AppUser | null;
  uid: string | null;
  profile: Profile | null;
  error: string | null;
};

let state: SessionState = { ready: false, welcomeSeen: false, user: null, uid: null, profile: null, error: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function stageOf(s: SessionState): Stage {
  if (!s.ready) return 'loading';
  if (!s.welcomeSeen) return 'welcome';
  if (!s.user) return 'auth';
  if (s.user.providers.includes('password') && !s.user.emailVerified) return 'verifyEmail';
  if (!s.user.phoneNumber || !s.profile?.name) return 'phone';
  return 'ready';
}

async function loadProfile(user: AppUser): Promise<Profile | null> {
  // Local cache first (works offline), then the server copy if there is one.
  let cached: Profile | null = null;
  try {
    const raw = await AsyncStorage.getItem(profileKey(user.uid));
    cached = raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    cached = null;
  }
  try {
    const snap = await get(ref(db, `users/${user.uid}`));
    const remote = snap.val() as (Profile & { phoneVerified?: boolean }) | null;
    if (remote?.name) {
      const profile = { name: remote.name, phone: user.phoneNumber ?? remote.phone ?? '', sharePhone: remote.sharePhone ?? true };
      await AsyncStorage.setItem(profileKey(user.uid), JSON.stringify(profile)).catch(() => {});
      return profile;
    }
  } catch {
    // offline or rules not deployed: fall back to the cache
  }
  if (cached) return { ...cached, phone: user.phoneNumber ?? cached.phone };
  // No profile anywhere but the phone is already verified (e.g. a fresh install while offline):
  // use the account's display name rather than sending the rider through SMS verification again,
  // which would fail because the number is already linked. saveProfile syncs it later.
  if (user.phoneNumber && user.displayName) {
    return { name: user.displayName, phone: user.phoneNumber, sharePhone: true };
  }
  return null;
}

let started = false;

/** Open the app anyway if Firebase hasn't answered by then (slow or blocked network). */
const READY_TIMEOUT_MS = 10_000;

export function startSession() {
  if (started) return;
  started = true;

  const welcomePromise = AsyncStorage.getItem(WELCOME_KEY)
    .then((v) => v === '1')
    .catch(() => false);

  if (!isFirebaseConfigured) {
    welcomePromise.then((welcomeSeen) =>
      setState({ ready: true, welcomeSeen, error: 'Firebase is not configured. See backend/README.md.' }),
    );
    return;
  }

  setTimeout(() => {
    if (state.ready) return;
    console.warn('[revon] Firebase is taking too long; opening the app without a connection.');
    welcomePromise.then((welcomeSeen) =>
      setState({
        ready: true,
        welcomeSeen,
        error: "Can't reach the server. Check your internet connection; revon keeps retrying.",
      }),
    );
  }, READY_TIMEOUT_MS);

  onUserChanged(async (user) => {
    const welcomeSeen = await welcomePromise;
    // Old anonymous sessions from earlier builds don't count as signed in.
    if (user && user.providers.length === 0) {
      await authSignOut().catch(() => {});
      return;
    }
    const profile = user ? await loadProfile(user) : null;
    setState({ ready: true, welcomeSeen: state.welcomeSeen || welcomeSeen, user, uid: user?.uid ?? null, profile, error: null });
  });
}

export async function markWelcomeSeen() {
  await AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {});
  setState({ welcomeSeen: true });
}

/** Re-reads the user (email verified? phone linked?) and moves to the next stage if so. */
export async function refreshUser() {
  const user = (await reloadUser()) ?? currentUser();
  const profile = user ? (state.profile ?? (await loadProfile(user))) : null;
  setState({ user, uid: user?.uid ?? null, profile });
  return user;
}

/** Saves the rider profile locally and to users/{uid}. The phone is always the verified one. */
export async function saveProfile(patch: Partial<Profile> & { name: string }) {
  const user = state.user ?? currentUser();
  if (!user) throw new Error('You are signed out.');
  const profile: Profile = {
    name: patch.name,
    phone: user.phoneNumber ?? patch.phone ?? state.profile?.phone ?? '',
    sharePhone: patch.sharePhone ?? state.profile?.sharePhone ?? true,
  };
  await AsyncStorage.setItem(profileKey(user.uid), JSON.stringify(profile));
  setState({ profile });
  await update(ref(db, `users/${user.uid}`), {
    name: profile.name,
    phone: profile.phone || null,
    phoneVerified: Boolean(user.phoneNumber),
    sharePhone: profile.sharePhone,
    email: user.email ?? null,
    updatedAt: Date.now(),
  }).catch((e) => console.warn('[revon] Could not save profile to the server:', e));
}

export async function signOut() {
  await authSignOut();
  setState({ user: null, uid: null, profile: null });
}

export function getSession() {
  return state;
}

export function useSession() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  return { ...s, stage: stageOf(s) };
}
