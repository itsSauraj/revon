/**
 * Whether an in-app ride view (turn-by-turn) is running anywhere in the app. Settings reads it to
 * lock the map source while navigating: a route and destination belong to the source that produced
 * them and must not be carried over to the other map (Google Maps Platform terms, §3.2.3(e)).
 */
import { useSyncExternalStore } from 'react';

const active = new Set<string>();
const listeners = new Set<() => void>();

/** Called by each ride-view hook instance with its own id. */
export function setNavigating(id: string, on: boolean) {
  const before = active.size > 0;
  if (on) active.add(id);
  else active.delete(id);
  if (before !== active.size > 0) listeners.forEach((l) => l());
}

export function isNavigating(): boolean {
  return active.size > 0;
}

export function useNavigating(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    isNavigating,
  );
}
