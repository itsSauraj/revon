/**
 * Firebase on Android/iOS: React Native Firebase (native SDKs), configured from
 * google-services.json / GoogleService-Info.plist at build time. Web uses firebase.web.ts.
 */
import { getApp, getApps } from '@react-native-firebase/app';
import { getDatabase } from '@react-native-firebase/database';

export const DATABASE_URL = (process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '');

/** False when the app was built without the Firebase config files (see backend/README.md). */
export const isFirebaseConfigured = getApps().length > 0;

// Pass the URL explicitly so it works even if the config file predates the database.
export const db = isFirebaseConfigured
  ? getDatabase(getApp(), DATABASE_URL || undefined)
  : (null as unknown as ReturnType<typeof getDatabase>);
