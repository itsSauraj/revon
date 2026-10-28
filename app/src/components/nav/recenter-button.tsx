import { StyleSheet, type ViewStyle } from 'react-native';
import { LuNavigation2 } from 'react-icons/lu';
import Animated, { Keyframe, ReduceMotion } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { EASE_OUT, Timing } from '@/lib/motion';

const RISE = 12;

// The pill sits at the bottom of the screen: it rises in from there and settles back the same way.
// Opacity rides along, so under Reduce Motion (builders skip to the end) the change still reads.
const PILL_IN = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: RISE }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
})
  .duration(Timing.enter.duration)
  .reduceMotion(ReduceMotion.System);
const PILL_OUT = new Keyframe({
  from: { opacity: 1, transform: [{ translateY: 0 }] },
  to: { opacity: 0, transform: [{ translateY: RISE }], easing: EASE_OUT },
})
  .duration(Timing.exit.duration)
  .reduceMotion(ReduceMotion.System);

/** Shown in the ride view after the rider drags the map; snaps back to following them. */
export function RecenterButton({ onPress, style }: { onPress: () => void; style?: ViewStyle }) {
  return (
    <Animated.View entering={PILL_IN} exiting={PILL_OUT} style={styles.wrap}>
      <Button label="Re-center" icon={LuNavigation2} variant="map" size="sm" onPress={onPress} style={{ ...styles.shadow, ...style }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  // No Android elevation on translucent glass: the shadow would show through it.
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
