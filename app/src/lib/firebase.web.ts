/**
 * Firebase on web: the Firebase JS SDK. Android/iOS use React Native Firebase (firebase.ts), because
 * phone-number verification needs the native SDKs.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);

export const DATABASE_URL = (firebaseConfig.databaseURL ?? '').replace(/\/$/, '');

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** Firebase Auth (browser persistence in IndexedDB). */
export const webAuth = getAuth(app);
export const db = getDatabase(app);
