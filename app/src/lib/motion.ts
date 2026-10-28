/**
 * Motion contract for the whole app. Every animation takes its spring, easing and haptic from here,
 * so the interface moves as one system.
 *
 * Springs use Apple's two designer parameters (response as `duration`, damping ratio), which
 * Reanimated takes directly. Rules of thumb:
 * - A finger was involved → spring, and pass the release velocity.
 * - No finger → timing with EASE_OUT (enter/exit) or EASE_IN_OUT (moving on screen).
 * - Bounce (dampingRatio < 1) only when the gesture carried momentum.
 * - Reduced motion is handled by `ReduceMotion.System` on every config: Reanimated then skips the
 *   animation and jumps to the end value. Pair translations with opacity so the state change still reads.
 */
import * as Haptics from 'expo-haptics';
import {
  cubicBezier,
  Easing,
  ReduceMotion,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';

// ---- Easing (never ease-in on UI) ----
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/** The same curves in the form Reanimated CSS transitions/animations take. */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const CSS_EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);

// ---- Springs (Apple: damping / response) ----
export const Spring = {
  /** Default settle with no overshoot: menus, cards, state changes. (damping 1.0, response 0.4) */
  settle: { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
  /** Same, snappier, for small elements (chips, buttons, badges). */
  quick: { duration: 250, dampingRatio: 1, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
  /** Reposition / snap back after a drag or flick. Slight bounce because the gesture carried momentum. */
  momentum: (velocity = 0): WithSpringConfig => ({
    duration: 400,
    dampingRatio: 0.8,
    velocity,
    reduceMotion: ReduceMotion.System,
  }),
  /** Sheets and drawers. (damping 0.8, response 0.3) */
  sheet: (velocity = 0): WithSpringConfig => ({
    duration: 300,
    dampingRatio: 0.8,
    velocity,
    reduceMotion: ReduceMotion.System,
  }),
  /** Sheet motion that must not pass a hard edge (e.g. the fully-open position). */
  sheetClamped: (velocity = 0): WithSpringConfig => ({
    duration: 300,
    dampingRatio: 0.8,
    velocity,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  }),
};

// ---- Timing (nothing a finger touches) ----
export const Timing = {
  press: { duration: 120, easing: EASE_OUT, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
  toggle: { duration: 180, easing: EASE_OUT, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
  enter: { duration: 220, easing: EASE_OUT, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
  exit: { duration: 180, easing: EASE_OUT, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
  move: { duration: 260, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
};

/** Press feedback scale for anything tappable (feedback on press-in, commit on press-out). */
export const PRESS_SCALE = 0.97;

// ---- Gesture physics (worklets: usable inside gesture handlers) ----

/**
 * Where a flick would come to rest, from its release velocity (px/s). Apple's projection from
 * "Designing Fluid Interfaces": `decelerationRate` 0.998 feels like scroll, 0.99 is snappier.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** The snap point closest to `value`. */
export function nearestSnap(value: number, points: readonly number[]): number {
  'worklet';
  let best = points[0];
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i] - value) < Math.abs(best - value)) best = points[i];
  }
  return best;
}

/**
 * Soft boundary: how far an element follows the finger past its limit. `overshoot` is the distance
 * past the bound, `dimension` the size of the element or track. The further past, the less it moves.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Clamp `value` to [min, max] with rubber-banding beyond the edges. */
export function rubberbandClamp(value: number, min: number, max: number, dimension: number): number {
  'worklet';
  if (value < min) return min - rubberband(min - value, dimension);
  if (value > max) return max + rubberband(value - max, dimension);
  return value;
}

// ---- Haptics (RN thread; from a worklet use scheduleOnRN(haptic.light)) ----
// One per user action, always paired with a visual, fired on the causal frame. Silently a no-op
// where unavailable (web, many Android phones).
const quiet = (p: Promise<unknown>) => p.catch(() => {});

export const haptic = {
  /** A value ticked past a step: segmented control, picker, chip selection. */
  selection: () => quiet(Haptics.selectionAsync()),
  /** Something snapped home: a sheet detent, a drag commit. */
  light: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A heavier landing or a destructive action firing. */
  medium: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
