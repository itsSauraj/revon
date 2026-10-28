import { useEffect, useRef } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { LuNavigation2 } from 'react-icons/lu';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Spring } from '@/lib/motion';

import { Glass } from './glass';
import { Icon } from './icon';
import { hitSlopFor, PressableScale } from './pressable-scale';

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

/** Signed shortest turn from `from` to `to`, in degrees (−180, 180]. */
function shortestTurn(from: number, to: number) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Floating compass: the arrow always points to north; tap to face north. */
export function CompassButton({ heading, onPress, accessibilityLabel = 'Face north', active, style }: Props) {
  const theme = useTheme();
  // Accumulated rotation (not wrapped) so each heading change takes the shortest path and the
  // spring continues from wherever the arrow is, carrying its velocity.
  const rotation = useSharedValue(-heading);
  const resting = useRef(-heading);

  useEffect(() => {
    const next = resting.current + shortestTurn(resting.current, -heading);
    resting.current = next;
    rotation.set(withSpring(next, Spring.settle));
  }, [heading, rotation]);

  const arrow = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      hitSlop={hitSlopFor(Size.fab)}
      style={[styles.btn, { backgroundColor: active ? theme.inverse : 'transparent' }, style]}>
      {!active && <Glass interactive style={[StyleSheet.absoluteFill, { borderRadius: Size.fab / 2 }]} />}
      <Animated.View style={arrow}>
        <Icon icon={LuNavigation2} size={Math.round(Size.fab * 0.42)} color={active ? theme.onInverse : theme.text} />
      </Animated.View>
    </PressableScale>
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
  },
});
