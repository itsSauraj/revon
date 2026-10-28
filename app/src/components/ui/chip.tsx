import { StyleSheet } from 'react-native';
import type { IconType } from 'react-icons';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';
import { hitSlopFor, PressableScale } from './pressable-scale';
import { transition } from './transition';

type Props = { label: string; selected?: boolean; onPress: () => void; icon?: IconType };

/** Compact toggle. Selected chips invert (monochrome), they don't use the accent. */
export function Chip({ label, selected, onPress, icon }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const fg = selected ? theme.onInverse : theme.text;
  return (
    <PressableScale
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      haptic="selection"
      hitSlop={hitSlopFor(MIN_WIDTH, Size.chip)}>
      {/* Colours cross over with a CSS transition (Timing.toggle); the press scale lives on the wrapper. */}
      <Animated.View
        style={[
          styles.chip,
          transition(['backgroundColor', 'borderColor'], 'toggle', reduced),
          {
            backgroundColor: selected ? theme.inverse : theme.surface,
            borderColor: selected ? theme.inverse : theme.border,
          },
        ]}>
        {icon && <Icon icon={icon} size={Size.iconSm} color={fg} />}
        <Animated.Text style={[TextStyles.label, transition('color', 'toggle', reduced), { color: fg }]}>{label}</Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

// Chips are wider than the hit target; only the height needs slop.
const MIN_WIDTH = 44;

const styles = StyleSheet.create({
  chip: {
    height: Size.chip,
    borderRadius: Size.chip / 2,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
