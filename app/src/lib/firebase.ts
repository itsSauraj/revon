import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  getAuth,
  // Exported by the React Native build of @firebase/auth, which Metro resolves at runtime.
  // @ts-ignore -- missing from the default (browser) type entry point
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
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

function createAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Already initialized (fast refresh).
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getDatabase(app);
