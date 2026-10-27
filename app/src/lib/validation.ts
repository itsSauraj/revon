/**
 * Strict input validation shared by the sign-in, register and phone screens. Each validator
 * returns an error message, or null when the value is valid.
 */
import { AsYouType, type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js/mobile';

import { COUNTRIES, type Country } from './countries';

// Local part: letters, digits and . _ % + -, no leading/trailing/double dots. Domain: labels of
// letters/digits/hyphens (not starting or ending with a hyphen) and a 2+ letter TLD.
// (No lookbehind: not every JS engine the app runs on supports it.)
const LOCAL_RE = /^[A-Za-z0-9._%+-]{1,64}$/;
const DOMAIN_RE = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

function isEmail(e: string) {
  const at = e.lastIndexOf('@');
  if (at <= 0 || at !== e.indexOf('@')) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return LOCAL_RE.test(local) && DOMAIN_RE.test(domain) && domain.length <= 253;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const e = normalizeEmail(email);
  if (!e) return 'Enter your email address.';
  if (e.length > 254 || !isEmail(e)) return 'Enter a valid email address, like name@example.com.';
  return null;
}

export type PasswordRule = { id: string; label: string; test: (p: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: '8 to 64 characters', test: (p) => p.length >= 8 && p.length <= 64 },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', label: 'A number', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'A symbol, like ! @ # $', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
  { id: 'space', label: 'No spaces', test: (p) => p.length > 0 && !/\s/.test(p) },
];

export function validateNewPassword(password: string): string | null {
  const failed = PASSWORD_RULES.find((r) => !r.test(password));
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Re-enter your password.';
  return confirm === password ? null : "Passwords don't match.";
}

export function validateSignInPassword(password: string): string | null {
  return password ? null : 'Enter your password.';
}

/** Names may be in any script, but no digits or symbols other than . ' - and spaces. */
export function validateName(name: string): string | null {
  const n = name.trim().replace(/\s+/g, ' ');
  if (n.length < 2) return 'Enter your name (at least 2 characters).';
  if (n.length > 40) return 'Keep your name under 40 characters.';
  if (/[\d!@#$%^&*()_+=[\]{};:"\\|<>/?~`,]/.test(n)) return 'Use letters only (spaces, . \' and - are fine).';
  return null;
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Validates a mobile number for the selected country (libphonenumber mobile metadata), returning
 * the E.164 form when valid.
 */
export function validateMobile(national: string, country: CountryCode): { error: string | null; e164: string | null } {
  const digits = national.replace(/[^\d+]/g, '');
  if (!digits) return { error: 'Enter your mobile number.', e164: null };
  const parsed = parsePhoneNumberFromString(digits, country);
  if (!parsed || parsed.country !== country || !parsed.isValid()) {
    const name = COUNTRIES.find((c) => c.code === country)?.name ?? country;
    return { error: `Enter a valid ${name} mobile number.`, e164: null };
  }
  return { error: null, e164: parsed.number };
}

/** Formats the national number as the user types, e.g. "98765 43210" for India. */
export function formatAsYouType(national: string, country: CountryCode) {
  const digits = national.replace(/\D/g, '');
  return new AsYouType(country).input(digits);
}

/** Best guess of the user's country from the device locale, defaulting to India. */
export function defaultCountry(): Country {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split(/[-_]/).find((p) => /^[A-Z]{2}$/.test(p));
    const match = region && COUNTRIES.find((c) => c.code === region);
    if (match) return match;
  } catch {
    // fall through
  }
  return COUNTRIES.find((c) => c.code === 'IN')!;
}

export const OTP_LENGTH = 6;

export function validateOtp(code: string): string | null {
  return /^\d{6}$/.test(code) ? null : `Enter the ${OTP_LENGTH}-digit code.`;
}
