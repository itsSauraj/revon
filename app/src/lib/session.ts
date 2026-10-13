import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { useSyncExternalStore } from 'react';

import { auth, isFirebaseConfigured } from './firebase';
import type { Profile } from './types';

const PROFILE_KEY = 'revon.profile';

type SessionState = {
  ready: boolean;
  uid: string | null;
  profile: Profile | null;
  error: string | null;
};

let state: SessionState = { ready: false, uid: null, profile: null, error: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

let started = false;

/** Restores the saved profile and signs in anonymously. Safe to call more than once. */
export function startSession() {
  if (started) return;
  started = true;

  const profilePromise = AsyncStorage.getItem(PROFILE_KEY)
    .then((raw) => (raw ? (JSON.parse(raw) as Profile) : null))
    .catch(() => null);

  if (!isFirebaseConfigured) {
    profilePromise.then((profile) =>
      setState({ ready: true, profile, error: 'Firebase is not configured. See backend/README.md.' }),
    );
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        setState({ ready: true, profile: await profilePromise, error: `Sign-in failed: ${String(e)}` });
      }
      return;
    }
    setState({ ready: true, uid: user.uid, profile: await profilePromise, error: null });
  });
}

export async function saveProfile(profile: Profile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  setState({ profile });
}

export function getSession() {
  return state;
}

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
