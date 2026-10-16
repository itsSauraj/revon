import '@/global.css';

import { Platform } from 'react-native';

/**
 * Monochrome palette. `accent` (#C8F135) is the only brand color — use it sparingly: the main call to
 * action on a screen, your own marker, and "arrived". Always put dark text on it. `danger` is
 * reserved for SOS. Everything, including the map, follows the system light/dark theme.
 */
export const Colors = {
  light: {
    text: '#0A0A0A',
    background: '#FFFFFF',
    backgroundElement: '#F4F4F4',
    backgroundSelected: '#E8E8E8',
    textSecondary: '#6E6E6E',
    surface: '#FFFFFF',
    border: '#E4E4E4',
    inverse: '#0A0A0A',
    onInverse: '#FFFFFF',
    muted: '#9E9E9E',
    accent: '#C8F135',
    onAccent: '#0A0A0A',
    danger: '#E5484D',
    onDanger: '#FFFFFF',
    // Drawn on the map (the map itself follows the theme).
    route: '#0A0A0A',
    routeRidden: '#B5B5B5',
    groupRoute: '#8A8A8A',
    rider: '#0A0A0A',
    riderInk: '#FFFFFF',
    markerBorder: '#FFFFFF',
    me: '#C8F135',
    meInk: '#0A0A0A',
    stale: '#A3A3A3',
    nameBg: 'rgba(255,255,255,0.94)',
  },
  dark: {
    text: '#F2F2F2',
    background: '#0A0A0A',
    backgroundElement: '#1A1A1A',
    backgroundSelected: '#262626',
    textSecondary: '#9A9A9A',
    surface: '#151515',
    border: '#2A2A2A',
    inverse: '#F2F2F2',
    onInverse: '#0A0A0A',
    muted: '#5E5E5E',
    accent: '#C8F135',
    onAccent: '#0A0A0A',
    danger: '#F2555A',
    onDanger: '#FFFFFF',
    // Drawn on the map (the map itself follows the theme).
    route: '#F2F2F2',
    routeRidden: '#4A4A4A',
    groupRoute: '#6E6E6E',
    rider: '#F2F2F2',
    riderInk: '#0A0A0A',
    markerBorder: '#0A0A0A',
    me: '#C8F135',
    meInk: '#0A0A0A',
    stale: '#5E5E5E',
    nameBg: 'rgba(21,21,21,0.94)',
  },
} as const;

/** Component sizes. Controls stay at 40–44 pt so they remain easy to hit. */
export const Size = {
  control: 44,
  controlSm: 36,
  chip: 32,
  fab: 44,
  icon: 18,
  iconSm: 15,
  radius: 12,
  radiusLg: 16,
} as const;

export const Type = {
  title: 17,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
