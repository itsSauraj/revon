import type { PhoneVerification } from './auth';

/** Carries the phone step's state to the OTP screen (kept in memory only). */
export type PendingPhone = {
  name: string;
  sharePhone: boolean;
  e164: string;
  /** Display form, e.g. "+91 98765 43210". */
  pretty: string;
  verification: PhoneVerification;
};

let pending: PendingPhone | null = null;

export function setPendingPhone(p: PendingPhone | null) {
  pending = p;
}

export function getPendingPhone() {
  return pending;
}
