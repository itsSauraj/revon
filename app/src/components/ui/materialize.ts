/**
 * Mount animation for a Glass surface arriving: scale 0.97 → 1 with (optionally) opacity 0 → 1,
 * `Timing.enter`. Opacity and transform only; the blur itself is never animated.
 */
import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Timing } from '@/lib/motion';

export function useMaterialize(enabled: boolean | undefined, fade = true) {
  const progress = useSharedValue(enabled ? 0 : 1);

  useEffect(() => {
    if (enabled) progress.set(withTiming(1, Timing.enter));
  }, [enabled, progress]);

  return useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: fade ? p : 1, transform: [{ scale: 0.97 + 0.03 * p }] };
  });
}
