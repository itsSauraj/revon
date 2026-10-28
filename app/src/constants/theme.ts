import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

/**
 * Monochrome palette. `accent` (#C8F135) is the only brand color — use it sparingly: the main call to
 * action on a screen, the route line and place pins, your own marker, and "arrived". Always put dark text on it. `danger` is
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
    // Frosted surfaces floating on the map (see components/ui/glass).
    glass: 'rgba(255,255,255,0.72)',
    glassSolid: 'rgba(255,255,255,0.9)',
    glassBorder: 'rgba(0,0,0,0.08)',
    // Drawn on the map (the map itself follows the theme).
    // Route line and place pins use the accent, outlined dark so they read on light/satellite maps.
    route: '#C8F135',
    routeOutline: '#0A0A0A',
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
    glass: 'rgba(21,21,21,0.62)',
    glassSolid: 'rgba(21,21,21,0.86)',
    glassBorder: 'rgba(255,255,255,0.12)',
    // Drawn on the map (the map itself follows the theme).
    route: '#C8F135',
    routeOutline: '#0A0A0A',
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
  /** Top corners of bottom sheets and the ride panel. */
  radiusSheet: 20,
} as const;

export const Type = {
  title: 17,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

/**
 * Type presets. Tracking is size-specific (tight on large text, slightly open on tiny text) and
 * leading scales inversely with size, so one preset carries size, line height, tracking and weight
 * as a set. Use these instead of raw fontSize values; all fonts stay scalable with the system setting.
 */
export const TextStyles = {
  display: { fontSize: 28, lineHeight: 32, letterSpacing: -0.5, fontWeight: '800' },
  headline: { fontSize: 22, lineHeight: 26, letterSpacing: -0.3, fontWeight: '800' },
  title: { fontSize: Type.title, lineHeight: 22, letterSpacing: -0.2, fontWeight: '700' },
  body: { fontSize: Type.body, lineHeight: 20, letterSpacing: 0, fontWeight: '400' },
  bodyStrong: { fontSize: Type.body, lineHeight: 20, letterSpacing: 0, fontWeight: '600' },
  small: { fontSize: Type.small, lineHeight: 18, letterSpacing: 0, fontWeight: '400' },
  label: { fontSize: Type.small, lineHeight: 16, letterSpacing: 0.1, fontWeight: '600' },
  tiny: { fontSize: Type.tiny, lineHeight: 14, letterSpacing: 0.2, fontWeight: '500' },
  caps: { fontSize: 10, lineHeight: 12, letterSpacing: 0.6, fontWeight: '800', textTransform: 'uppercase' },
} as const satisfies Record<string, TextStyle>;

/**
 * For TextInputs inside our own bordered fields: on web the browser also draws a focus outline inside
 * the field, which the field's border colour already communicates. Spread into the input's style.
 */
// `outlineStyle` is a react-native-web extension, so it isn't in RN's TextStyle type.
export const noWebOutline: TextStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {};

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
