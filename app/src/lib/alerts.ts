import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';
import { AppState, Platform, Vibration } from 'react-native';

export type AlertLevel = 'info' | 'warn' | 'danger' | 'quiet';

export type Banner = { id: string; text: string; level: AlertLevel; uid?: string };

const CHANNEL_ALERTS = 'ride-alerts';
const CHANNEL_QUIET = 'ride-quiet';

let banners: Banner[] = [];
const listeners = new Set<() => void>();
const seen = new Set<string>();

function emit() {
  listeners.forEach((l) => l());
}

export function dismissBanner(id: string) {
  banners = banners.filter((b) => b.id !== id);
  emit();
}

export function useBanners() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => banners,
  );
}

let configured = false;

export async function setupNotifications() {
  if (configured) return;
  configured = true;
  // While the app is open the in-app banner + voice is enough; the OS banner is for background.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ALERTS, {
      name: 'Ride alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_QUIET, {
      name: 'Ride updates',
      importance: Notifications.AndroidImportance.LOW,
    });
  }
  await Notifications.requestPermissionsAsync().catch(() => null);
}

/**
 * Shows an alert once per id: in-app banner, spoken aloud (riders can't read while riding), and an
 * OS notification when the app is in the background.
 */
export function raiseAlert(id: string, text: string, level: AlertLevel, opts: { uid?: string; speak?: boolean } = {}) {
  if (seen.has(id)) return;
  seen.add(id);

  banners = [...banners.filter((b) => b.id !== id), { id, text, level, uid: opts.uid }].slice(-3);
  emit();
  if (level !== 'danger') setTimeout(() => dismissBanner(id), level === 'quiet' ? 4000 : 8000);

  if (level === 'danger') Vibration.vibrate([0, 500, 200, 500, 200, 500]);
  if (opts.speak !== false && level !== 'quiet') {
    Speech.speak(text, { rate: 1.0 });
  }

  if (AppState.currentState !== 'active') {
    Notifications.scheduleNotificationAsync({
      content: {
        title: level === 'danger' ? 'SOS' : 'Revon ride',
        body: text,
        sound: level === 'danger' || level === 'warn' ? 'default' : undefined,
        ...(Platform.OS === 'android'
          ? {}
          : { interruptionLevel: level === 'danger' ? 'timeSensitive' : level === 'quiet' ? 'passive' : 'active' }),
      },
      trigger:
        Platform.OS === 'android'
          ? { channelId: level === 'quiet' ? CHANNEL_QUIET : CHANNEL_ALERTS }
          : null,
    }).catch(() => {});
  }
}

export function clearBanners() {
  banners = [];
  emit();
}
