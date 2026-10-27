/**
 * Authentication on Android/iOS: React Native Firebase + native Google Sign-In.
 * auth.web.ts implements the same functions with the Firebase JS SDK.
 */
import {
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken as fbGetIdToken,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  PhoneAuthProvider,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
  verifyPhoneNumber,
} from '@react-native-firebase/auth';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

import { isFirebaseConfigured } from './firebase';
import type { AppUser } from './types';

export class AuthCancelled extends Error {}

function toAppUser(u: User | null): AppUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email,
    emailVerified: u.emailVerified,
    phoneNumber: u.phoneNumber,
    displayName: u.displayName,
    providers: u.providerData.map((p) => p.providerId),
  };
}

export function currentUser(): AppUser | null {
  return isFirebaseConfigured ? toAppUser(getAuth().currentUser) : null;
}

export function onUserChanged(cb: (user: AppUser | null) => void) {
  return onAuthStateChanged(getAuth(), (u) => cb(toAppUser(u)));
}

/** Re-reads the user from Firebase (after email verification or linking a phone). */
export async function reloadUser(): Promise<AppUser | null> {
  const u = getAuth().currentUser;
  if (!u) return null;
  await reload(u);
  return toAppUser(getAuth().currentUser);
}

// ---- Google ----

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  const webClientId: string | undefined = Constants.expoConfig?.extra?.googleWebClientId;
  GoogleSignin.configure({ webClientId });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<void> {
  configureGoogle();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) throw new AuthCancelled('Sign-in was cancelled.');
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('Google did not return an ID token. Check the web client ID in google-services.json.');
    await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) throw new AuthCancelled('Sign-in was cancelled.');
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play services is missing or out of date on this phone.');
      }
    }
    throw e;
  }
}

// ---- Email / password ----

export async function registerWithEmail(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(getAuth(), email, password);
  await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(getAuth(), email, password);
}

export async function resendVerificationEmail() {
  const u = getAuth().currentUser;
  if (u) await sendEmailVerification(u);
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(getAuth(), email);
}

// ---- Phone (OTP) ----

export type PhoneVerification = {
  /** Android can read the SMS code automatically; when it does, the code is here. */
  autoCode: string | null;
  confirm: (code: string) => Promise<void>;
};

/** Sends an SMS code to `e164` and returns a handle to link the verified number to this account. */
export async function startPhoneVerification(e164: string, forceResend = false): Promise<PhoneVerification> {
  const auth = getAuth();
  const snapshot = await verifyPhoneNumber(auth, e164, 60, forceResend);
  const verificationId = snapshot.verificationId;
  return {
    autoCode: snapshot.code ?? null,
    async confirm(code: string) {
      const user = auth.currentUser;
      if (!user) throw new Error('You are signed out. Sign in again.');
      await linkWithCredential(user, PhoneAuthProvider.credential(verificationId, code));
      await reload(user);
      // New ID token with the phone_number claim (the database rules check it).
      await fbGetIdToken(user, true);
    },
  };
}

// ---- Session ----

export async function signOut() {
  try {
    configureGoogle();
    await GoogleSignin.signOut();
  } catch {
    // not signed in with Google
  }
  await fbSignOut(getAuth());
}

/** ID token for REST calls (e.g. the background location task). Waits briefly for a cold start. */
export async function getIdToken(): Promise<string | null> {
  if (!isFirebaseConfigured) return null;
  const auth = getAuth();
  let user = auth.currentUser;
  if (!user) {
    user = await new Promise<User | null>((resolve) => {
      const timer = setTimeout(() => {
        unsub();
        resolve(null);
      }, 5000);
      const unsub = onAuthStateChanged(auth, (u) => {
        if (!u) return;
        clearTimeout(timer);
        unsub();
        resolve(u);
      });
    });
  }
  return user ? fbGetIdToken(user) : null;
}
