/**
 * The system "Reduce Transparency" setting. Glass surfaces go solid (theme.surface, no blur) when
 * it's on.
 * - iOS: AccessibilityInfo (initial query + `reduceTransparencyChanged`).
 * - Web: `prefers-reduced-transparency: reduce`.
 * - Android: no such setting; always false.
 */
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

const listeners = new Set<() => void>();
let current = false;
let queried = false;
let media: MediaQueryList | null | undefined;

function notify() {
  listeners.forEach((l) => l());
}

function mediaQuery(): MediaQueryList | null {
  if (media !== undefined) return media;
  media =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-transparency: reduce)')
      : null;
  return media;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  let remove = () => {};
  if (Platform.OS === 'ios') {
    if (!queried) {
      queried = true;
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then((on) => {
          if (on !== current) {
            current = on;
            notify();
          }
        })
        .catch(() => {});
    }
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (on) => {
      current = on;
      notify();
    });
    remove = () => sub.remove();
  } else if (Platform.OS === 'web') {
    const mq = mediaQuery();
    if (mq) {
      const onChange = () => notify();
      mq.addEventListener('change', onChange);
      remove = () => mq.removeEventListener('change', onChange);
    }
  }
  return () => {
    listeners.delete(listener);
    remove();
  };
}

function getSnapshot() {
  if (Platform.OS === 'web') return mediaQuery()?.matches ?? false;
  return current;
}

const getServerSnapshot = () => false;

export function useReduceTransparency(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
