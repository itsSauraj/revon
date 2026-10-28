/**
 * Reanimated CSS-transition form of the `Timing` presets in '@/lib/motion', for two-state changes
 * with no finger on them (a chip changing colour, a spinner crossfading in). The curves are the same
 * beziers as EASE_OUT / EASE_IN_OUT, written for the CSS engine.
 *
 * CSS transitions have no `reduceMotion` option, so pass `useReducedMotion()` as `reduced` and the
 * transition collapses to an instant change.
 */
import type { CSSTransitionProperties } from 'react-native-reanimated';

import { CSS_EASE_IN_OUT, CSS_EASE_OUT, Timing } from '@/lib/motion';

export type TransitionPreset = keyof typeof Timing;

// Any animatable style key. Reanimated types the property against ViewStyle keys only, which drops
// Text-only ones such as `color`, so the name is widened here and cast.
export type TransitionProperty = string | string[];

export function transition(
  property: TransitionProperty,
  preset: TransitionPreset = 'toggle',
  reduced = false,
): CSSTransitionProperties {
  return {
    transitionProperty: property as CSSTransitionProperties['transitionProperty'],
    transitionDuration: reduced ? 0 : Timing[preset].duration,
    transitionTimingFunction: preset === 'move' ? CSS_EASE_IN_OUT : CSS_EASE_OUT,
  };
}
