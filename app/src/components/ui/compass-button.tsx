import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LuNavigation2 } from 'react-icons/lu';

import { Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

type Props = {
  /** Map rotation in degrees clockwise from north. */
  heading: number;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Show the "locked to north" state (ride view north-up mode). */
  active?: boolean;
  style?: ViewStyle;
};

/** True when the map is turned away from north by more than a degree. */
export function isRotated(heading: number) {
  const h = ((heading % 360) + 360) % 360;
  return h > 1 && h < 359;
}

/** Floating compass: the arrow always points to north; tap to face north. */
export function CompassButton({ heading, onPress, accessibilityLabel = 'Face north', active, style }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: active ? theme.inverse : theme.surface,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}>
      <View style={{ transform: [{ rotate: `${-heading}deg` }] }}>
        <Icon icon={LuNavigation2} size={Math.round(Size.fab * 0.42)} color={active ? theme.onInverse : theme.text} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: Size.fab,
    height: Size.fab,
    borderRadius: Size.fab / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
