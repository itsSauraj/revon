import { StyleSheet, type ViewStyle } from 'react-native';
import type { IconType } from 'react-icons';

import { Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Glass } from './glass';
import { Icon } from './icon';
import { hitSlopFor, PressableScale } from './pressable-scale';

type Props = {
  icon: IconType;
  onPress: () => void;
  accessibilityLabel: string;
  /** `map` is for every button floating on the map: a glass disc in the theme's colors. */
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
    map: { bg: 'transparent', fg: theme.text },
  }[variant];

  const glass = variant === 'map';
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={hitSlopFor(size)}
      style={[
        styles.btn,
        floating && (glass ? styles.floatingGlass : styles.floating),
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.bg },
        style,
      ]}>
      {glass && <Glass interactive style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />}
      <Icon icon={icon} size={Math.round(size * 0.42)} color={palette.fg} />
    </PressableScale>
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
  // No Android elevation on translucent glass: the shadow would show through it.
  floatingGlass: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
