/** Authentication on web: Firebase JS SDK (Google popup, email/password, phone via reCAPTCHA). */
import {
  type ConfirmationResult,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithPhoneNumber,
  onAuthStateChanged,
  RecaptchaVerifier,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { isFirebaseConfigured, webAuth } from './firebase.web';
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
  return isFirebaseConfigured ? toAppUser(webAuth.currentUser) : null;
}

export function onUserChanged(cb: (user: AppUser | null) => void) {
  return onAuthStateChanged(webAuth, (u) => cb(toAppUser(u)));
}

export async function reloadUser(): Promise<AppUser | null> {
  const u = webAuth.currentUser;
  if (!u) return null;
  await reload(u);
  return toAppUser(webAuth.currentUser);
}

export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(webAuth, new GoogleAuthProvider());
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new AuthCancelled('Sign-in was cancelled.');
    }
    throw e;
  }
}

export async function registerWithEmail(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(webAuth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(webAuth, email, password);
}

export async function resendVerificationEmail() {
  if (webAuth.currentUser) await sendEmailVerification(webAuth.currentUser);
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(webAuth, email);
}

export type PhoneVerification = {
  autoCode: string | null;
  confirm: (code: string) => Promise<void>;
};

const RECAPTCHA_ID = 'revon-recaptcha';
let verifier: RecaptchaVerifier | null = null;

/** Invisible reCAPTCHA, required by Firebase phone auth on the web. */
function getVerifier() {
  if (!document.getElementById(RECAPTCHA_ID)) {
    const el = document.createElement('div');
    el.id = RECAPTCHA_ID;
    document.body.appendChild(el);
  }
  verifier ??= new RecaptchaVerifier(webAuth, RECAPTCHA_ID, { size: 'invisible' });
  return verifier;
}

/** Development only: skip reCAPTCHA (works with Firebase test phone numbers only). See auth.ts. */
export const PHONE_TEST_MODE = __DEV__ && process.env.EXPO_PUBLIC_PHONE_TEST_MODE === '1';

export async function startPhoneVerification(e164: string): Promise<PhoneVerification> {
  if (PHONE_TEST_MODE) webAuth.settings.appVerificationDisabledForTesting = true;
  const user = webAuth.currentUser;
  if (!user) throw new Error('You are signed out. Sign in again.');
  let confirmation: ConfirmationResult;
  try {
    confirmation = await linkWithPhoneNumber(user, e164, getVerifier());
  } catch (e) {
    // A used/expired reCAPTCHA can't be reused; reset it for the next attempt.
    verifier?.clear();
    verifier = null;
    throw e;
  }
  return {
    autoCode: null,
    async confirm(code: string) {
      await confirmation.confirm(code);
      if (webAuth.currentUser) {
        await reload(webAuth.currentUser);
        // New ID token with the phone_number claim (the database rules check it).
        await webAuth.currentUser.getIdToken(true);
      }
    },
  };
}

export async function signOut() {
  await fbSignOut(webAuth);
}

export async function getIdToken(): Promise<string | null> {
  await webAuth.authStateReady();
  return webAuth.currentUser ? webAuth.currentUser.getIdToken() : null;
}
