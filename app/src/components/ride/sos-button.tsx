/**
 * SOS. Held for two seconds to send, so a bump or a glove tap never alerts the whole group; once
 * active, a single tap clears it.
 *
 * The hold runs on the UI thread: a shared value fills linearly over the two seconds, a reaction
 * fires the trigger and the heavy haptic on the frame it completes, and an early release retreats
 * the fill. Nothing is set per frame on the React side.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import { LuSiren } from 'react-icons/lu';
import Animated, {
  type CSSAnimationKeyframes,
  Easing,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/ui/icon';
import { hitSlopFor, PressableScale } from '@/components/ui/pressable-scale';
import { transition } from '@/components/ui/transition';
import { Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CSS_EASE_IN_OUT, haptic, Timing } from '@/lib/motion';

const HOLD_MS = 2000;
const MIN_WIDTH = 72;
/** SOS-only shades of the danger colour: the active button and the hold fill. */
const ACTIVE_BG = '#B3262B';
const FILL_BG = '#8F1D21';

// The hold is the safety timer itself, not decoration, so Reduce Motion must never skip it
// (ReduceMotion.System would jump to the end and send an SOS on a tap). Linear: constant progress.
const HOLD = { duration: HOLD_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never };

// Active: a glow breathing at 0.5 Hz (well away from the slow oscillations that trouble vestibular
// users), on a childless overlay so the label itself never dims.
const PULSE: CSSAnimationKeyframes<ViewStyle> = { from: { opacity: 0 }, '50%': { opacity: 0.18 }, to: { opacity: 0 } };
const pulse = {
  animationName: PULSE,
  animationDuration: 2000,
  animationIterationCount: 'infinite',
  animationTimingFunction: CSS_EASE_IN_OUT,
} as const;

type Props = { active: boolean; onTrigger: () => void; onClear: () => void };

export function SosButton({ active, onTrigger, onClear }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  /** 0 → 1 over the hold. */
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  // The SOS write flips `active` before the finger lifts; that release must not clear it.
  const justTriggered = useRef(false);

  const fire = () => {
    justTriggered.current = true;
    onTrigger();
  };

  // Completion is detected on the UI thread and crossed once; haptic and trigger land on that frame.
  useAnimatedReaction(
    () => progress.get() >= 1,
    (done, was) => {
      if (done && !was) {
        scheduleOnRN(haptic.heavy);
        scheduleOnRN(fire);
      }
    },
    [fire],
  );

  // Once the group has the SOS the fill has done its job; the active state takes over.
  useEffect(() => {
    if (active) progress.set(0);
  }, [active, progress]);

  const start = () => {
    if (active) return;
    setHolding(true);
    progress.set(0);
    progress.set(withTiming(1, HOLD));
  };
  const stop = () => {
    setHolding(false);
    // A completed hold keeps its fill until `active` arrives; an early release retreats.
    if (progress.get() < 1) progress.set(withTiming(0, Timing.press));
  };

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  return (
    <PressableScale
      accessibilityLabel={active ? 'Cancel SOS' : 'Hold for two seconds to send SOS'}
      hitSlop={hitSlopFor(MIN_WIDTH, Size.fab)}
      onPressIn={start}
      onPressOut={stop}
      onPress={() => {
        if (justTriggered.current) {
          justTriggered.current = false;
          return;
        }
        if (active) onClear();
      }}
      style={styles.shadow}>
      <Animated.View
        style={[styles.btn, transition('backgroundColor', 'toggle', reduced), { backgroundColor: active ? ACTIVE_BG : theme.danger }]}>
        {/* Absolutely positioned and childless: scaling it from the left edge costs no layout. */}
        <Animated.View pointerEvents="none" style={[styles.fill, fill]} />
        {active && !reduced && <Animated.View pointerEvents="none" style={[styles.glow, pulse]} />}
        <Icon icon={LuSiren} size={Size.iconSm} color={theme.onDanger} />
        <Text style={[TextStyles.label, styles.text, { color: theme.onDanger }]}>
          {active ? 'SOS sent · tap if OK' : holding ? 'Hold…' : 'SOS'}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: Size.fab / 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  btn: {
    flexDirection: 'row',
    gap: 6,
    minWidth: MIN_WIDTH,
    height: Size.fab,
    paddingHorizontal: 14,
    borderRadius: Size.fab / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    transformOrigin: 'left',
    backgroundColor: FILL_BG,
  },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' },
  text: { fontWeight: '800' },
});
