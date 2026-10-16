import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import type { IconType } from 'react-icons';

import { Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

type Props = {
  icon: IconType;
  onPress: () => void;
  accessibilityLabel: string;
  /** `map` is for every button floating on the map, so they all share one style (theme surface). */
  variant?: 'surface' | 'inverse' | 'accent' | 'ghost' | 'soft' | 'map';
  size?: number;
  /** Floating buttons over the map get a shadow. */
  floating?: boolean;
  style?: ViewStyle;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'surface',
  size = Size.fab,
  floating,
  style,
}: Props) {
  const theme = useTheme();
  const palette = {
    surface: { bg: theme.surface, fg: theme.text },
    inverse: { bg: theme.inverse, fg: theme.onInverse },
    accent: { bg: theme.accent, fg: theme.onAccent },
    ghost: { bg: 'transparent', fg: theme.text },
    // Secondary button inside a card.
    soft: { bg: theme.backgroundElement, fg: theme.text },
    map: { bg: theme.surface, fg: theme.text },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        floating && styles.floating,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.bg, opacity: pressed ? 0.75 : 1 },
        style,
      ]}>
      <Icon icon={icon} size={Math.round(size * 0.42)} color={palette.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
