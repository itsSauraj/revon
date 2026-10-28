import { ActivityIndicator, StyleSheet, Text, type ViewStyle } from 'react-native';
import type { IconType } from 'react-icons';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Glass } from './glass';
import { Icon } from './icon';
import { hitSlopFor, PressableScale } from './pressable-scale';
import { transition } from './transition';

/** `map` is for buttons floating on the map: glass in the theme's colors. */
export type ButtonVariant = 'accent' | 'inverse' | 'outline' | 'danger' | 'ghost' | 'map';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconType;
  /** `accent` is for the one main action on a screen; prefer `inverse` or `outline` elsewhere. */
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

// Buttons are always wider than the hit target; only the height can fall short of 44pt.
const MIN_WIDTH = 44;

export function Button({ label, onPress, icon, variant = 'outline', size = 'md', disabled, loading, style }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    accent: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    inverse: { bg: theme.inverse, fg: theme.onInverse, border: theme.inverse },
    outline: { bg: 'transparent', fg: theme.text, border: theme.border },
    danger: { bg: theme.danger, fg: theme.onDanger, border: theme.danger },
    ghost: { bg: 'transparent', fg: theme.text, border: 'transparent' },
    map: { bg: 'transparent', fg: theme.text, border: 'transparent' },
  };
  const c = palette[variant];
  const h = size === 'sm' ? Size.controlSm : Size.control;
  const fade = transition('opacity', 'toggle', reduced);

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ busy: !!loading }}
      disabled={disabled || loading}
      // A busy button is working, not unavailable: keep it at full strength while the spinner shows.
      dimDisabled={!loading}
      hitSlop={hitSlopFor(MIN_WIDTH, h)}
      onPress={onPress}
      style={[styles.btn, { height: h, borderRadius: h / 2, backgroundColor: c.bg, borderColor: c.border }, style]}>
      {variant === 'map' && <Glass interactive style={[StyleSheet.absoluteFill, { borderRadius: h / 2 }]} />}
      {/* The label stays mounted while loading so the width never changes; spinner and label crossfade. */}
      <Animated.View style={[styles.content, fade, { opacity: loading ? 0 : 1 }]}>
        {icon && <Icon icon={icon} size={size === 'sm' ? Size.iconSm : Size.icon} color={c.fg} />}
        <Text style={[size === 'sm' ? TextStyles.label : TextStyles.bodyStrong, { color: c.fg }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.spinner, fade, { opacity: loading ? 1 : 0 }]}>
        <ActivityIndicator size="small" color={c.fg} animating={!!loading} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  spinner: { alignItems: 'center', justifyContent: 'center' },
});
