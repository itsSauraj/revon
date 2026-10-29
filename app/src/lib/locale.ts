/**
 * Language for search results and turn instructions (BCP-47, e.g. "en-IN"). Without it a routing
 * service infers a language from the route's location, which can return directions in a regional
 * script the rider doesn't read.
 */
export function deviceLanguage(): string {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as { language?: string }).language : undefined;
    return nav || Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    return 'en';
  }
}

/** Two-letter language code ("en" from "en-IN"). */
export function deviceLanguageCode(): string {
  return deviceLanguage().split(/[-_]/)[0].toLowerCase() || 'en';
}
