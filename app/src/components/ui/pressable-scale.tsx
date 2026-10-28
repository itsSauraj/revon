/**
 * The one press primitive. Wraps RN `Pressable`:
 * - Feedback on press-in (scale to PRESS_SCALE with `Timing.press`, interruptible), commit on press-out.
 * - `pressRetentionOffset` so a finger drifting a few pixels doesn't cancel a press the user meant.
 * - 44x44 minimum hit area: pass `hitSlop` (see `hitSlopFor`) when you know the size, otherwise it
 *   measures itself once and adds the slop.
 * - No Android ripple, `accessibilityRole="button"` by default, `disabled` dims via opacity.
 * - `haptic` fires once on press (the commit), the same frame the scale releases.
 * - Reduced motion: no scale; a brief opacity highlight so the press still reads.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  type Insets,
  type LayoutChangeEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic, PRESS_SCALE, Timing } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Minimum touch target, in pt. */
export const MIN_HIT = 44;
/** Reduced-motion press highlight, in place of the scale. */
const PRESS_DIM = 0.75;
const DISABLED_OPACITY = 0.45;

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children' | 'android_ripple'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Haptic fired once on press, paired with the visual release. Default: none. */
  haptic?: 'selection' | 'light' | 'medium' | null;
  /** Dim to 45% while disabled (default true). Turn off for a control that is busy, not disabled. */
  dimDisabled?: boolean;
};

/** Insets that bring a `width` by `height` visual up to the minimum hit target. */
export function hitSlopFor(width: number, height = width): Insets {
  const x = Math.max(0, Math.ceil((MIN_HIT - width) / 2));
  const y = Math.max(0, Math.ceil((MIN_HIT - height) / 2));
  return { top: y, bottom: y, left: x, right: x };
}

export function PressableScale({
  style,
  children,
  haptic: hapticKind = null,
  dimDisabled = true,
  disabled,
  hitSlop,
  pressRetentionOffset = 16,
  accessibilityRole = 'button',
  accessibilityState,
  onLayout: onLayoutProp,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);
  // Only when no hitSlop was given: measured once (the update bails out when nothing changed).
  const [measured, setMeasured] = useState<Insets | null>(null);

  const animated = useAnimatedStyle(() => ({
    opacity: dim.get() * (disabled && dimDisabled ? DISABLED_OPACITY : 1),
    transform: [{ scale: scale.get() }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    onLayoutProp?.(e);
    if (hitSlop !== undefined) return;
    const { width, height } = e.nativeEvent.layout;
    const next = hitSlopFor(width, height);
    setMeasured((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  };

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop ?? measured ?? undefined}
      pressRetentionOffset={pressRetentionOffset}
      onLayout={onLayout}
      onPressIn={(e) => {
        // Reduced motion: Timing.press carries ReduceMotion.System, so this is an instant highlight.
        if (reduced) dim.set(withTiming(PRESS_DIM, Timing.press));
        else scale.set(withTiming(PRESS_SCALE, Timing.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, Timing.press));
        dim.set(withTiming(1, Timing.press));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticKind) haptic[hapticKind]();
        onPress?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
