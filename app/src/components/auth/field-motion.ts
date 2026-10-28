/**
 * Motion shared by the auth form pieces. Everything here is the contract in lib/motion in a form the
 * form components can use directly: CSS transitions need the curve as `cubicBezier`, layout
 * animations need builders, and the failed-submit shake is one sequence for every field.
 */
import {
  FadeIn,
  FadeOut,
  Keyframe,
  LinearTransition,
  ReduceMotion,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CSS_EASE_OUT, EASE_IN_OUT, EASE_OUT, Timing } from '@/lib/motion';

export { CSS_EASE_OUT };

/**
 * Border and label colour on focus. Focus happens constantly, so this stays under the perception
 * threshold: it only takes the hard edge off the colour change.
 */
export const FOCUS_TRANSITION = {
  transitionProperty: 'borderColor',
  transitionDuration: Timing.press.duration,
  transitionTimingFunction: CSS_EASE_OUT,
} as const;

export const LABEL_TRANSITION = {
  transitionProperty: 'color',
  transitionDuration: Timing.press.duration,
  transitionTimingFunction: CSS_EASE_OUT,
} as const;

/** A small state flipping (checklist rule met, segment label). */
export const TOGGLE_COLOR_TRANSITION = {
  transitionProperty: 'color',
  transitionDuration: Timing.toggle.duration,
  transitionTimingFunction: CSS_EASE_OUT,
} as const;

export const TOGGLE_OPACITY_TRANSITION = {
  transitionProperty: 'opacity',
  transitionDuration: Timing.toggle.duration,
  transitionTimingFunction: CSS_EASE_OUT,
} as const;

/** Something appearing in the form (an error, a field, a notice). */
export const FADE_IN = FadeIn.duration(Timing.enter.duration).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
export const FADE_OUT = FadeOut.duration(Timing.exit.duration).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

/** Siblings moving to make room when a field enters or leaves. */
export const FORM_LAYOUT = LinearTransition.duration(Timing.move.duration).easing(EASE_IN_OUT).reduceMotion(ReduceMotion.System);

/** A digit landing in a code box: from 0.9 and transparent, never from nothing. */
export const POP_IN = new Keyframe({
  from: { opacity: 0, transform: [{ scale: 0.9 }] },
  to: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
})
  .duration(Timing.enter.duration)
  .reduceMotion(ReduceMotion.System);

const SHAKE_PX = 4;
const SHAKE_STEPS = 7; // three full cycles, then home
const SHAKE_STEP = { duration: Math.round(Timing.move.duration / SHAKE_STEPS), easing: EASE_IN_OUT };

/**
 * The "no" shake for a field whose submit failed validation: ±4pt, three cycles, ~260ms in all.
 * Callers skip it under reduced motion (`useReducedMotion()`); the colour change and the error text
 * carry the state on their own.
 */
export function shakeSequence() {
  return withSequence(
    withTiming(-SHAKE_PX, SHAKE_STEP),
    withTiming(SHAKE_PX, SHAKE_STEP),
    withTiming(-SHAKE_PX, SHAKE_STEP),
    withTiming(SHAKE_PX, SHAKE_STEP),
    withTiming(-SHAKE_PX, SHAKE_STEP),
    withTiming(SHAKE_PX, SHAKE_STEP),
    withTiming(0, SHAKE_STEP),
  );
}
