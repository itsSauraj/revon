import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import type { IconType } from 'react-icons';

import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Glass } from './glass';
import { Icon } from './icon';

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

export function Button({ label, onPress, icon, variant = 'outline', size = 'md', disabled, loading, style }: Props) {
  const theme = useTheme();
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { height: h, borderRadius: h / 2, backgroundColor: c.bg, borderColor: c.border },
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}>
      {variant === 'map' && <Glass interactive style={[StyleSheet.absoluteFill, { borderRadius: h / 2 }]} />}
      {loading ? (
        <ActivityIndicator size="small" color={c.fg} />
      ) : (
        <>
          {icon && <Icon icon={icon} size={size === 'sm' ? Size.iconSm : Size.icon} color={c.fg} />}
          <Text style={[styles.label, { color: c.fg, fontSize: size === 'sm' ? Type.small : Type.body }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  label: { fontWeight: '700' },
});
