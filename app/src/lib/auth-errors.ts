/** Turns Firebase / Google Sign-In errors into short messages a rider can act on. */
const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/weak-password': 'That password is too weak. Follow the password rules.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Check your network and try again.',
  'auth/account-exists-with-different-credential':
    'This email is already registered with a different sign-in method. Use that method instead.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/invalid-phone-number': 'That phone number is not valid.',
  'auth/missing-phone-number': 'Enter your phone number.',
  'auth/invalid-verification-code': 'That code is not correct. Check the SMS and try again.',
  'auth/code-expired': 'That code has expired. Send a new one.',
  'auth/session-expired': 'That code has expired. Send a new one.',
  'auth/invalid-verification-id': 'This verification expired. Send a new code.',
  'auth/credential-already-in-use': 'This phone number is already linked to another revon account.',
  'auth/provider-already-linked': 'A phone number is already linked to this account.',
  'auth/quota-exceeded': 'SMS limit reached for now. Try again later.',
  'auth/captcha-check-failed': 'Security check failed. Try again.',
  'auth/missing-client-identifier': 'This device could not be verified. Try again.',
  'auth/app-not-authorized': 'This app build is not authorized with Firebase (check SHA-1 / SHA-256 in Firebase).',
  'auth/operation-not-allowed': 'This sign-in method is turned off in Firebase.',
  'auth/requires-recent-login': 'For security, sign in again and retry.',
};

export function authErrorCode(e: unknown): string | null {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') {
    return (e as { code: string }).code;
  }
  return null;
}

export function authErrorMessage(e: unknown): string {
  const code = authErrorCode(e);
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message = e instanceof Error ? e.message : String(e);
  return message.replace(/^\[?auth\/[a-z-]+\]?\s*/i, '') || 'Something went wrong. Try again.';
}
