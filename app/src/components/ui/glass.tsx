/**
 * Frosted "liquid glass" surface for everything floating over the map.
 *
 * - iOS 26+: Apple's Liquid Glass (expo-glass-effect).
 * - Android: no system glass, and a blur can't sample Google Maps' native map surface, so this is a
 *   translucent tinted panel with a light edge.
 * - Web: see glass.web.tsx (CSS backdrop blur).
 * - Reduce Transparency on: a solid theme.surface panel, no blur (all platforms).
 * - `materialize`: animates in on mount as a material arriving (scale 0.97 → 1 and opacity, `Timing.enter`).
 *   On Liquid Glass the opacity half is the system's own effect transition ('none' → 'regular'):
 *   UIKit disables a visual effect while its alpha is below 1, so fading the view would break the blur.
 */
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useReduceTransparency } from '@/hooks/use-reduce-transparency';
import { useTheme } from '@/hooks/use-theme';
import { Timing } from '@/lib/motion';

import { useMaterialize } from './materialize';

const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

export type GlassProps = ViewProps & {
  /** Interactive glass reacts to touches on iOS 26 (use for buttons). */
  interactive?: boolean;
  /** Animate in on mount as a material arriving. */
  materialize?: boolean;
};

export function Glass({ style, children, interactive, materialize, ...rest }: GlassProps) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const solid = useReduceTransparency();
  const liquid = LIQUID && !solid;
  const entrance = useMaterialize(materialize, !liquid);

  // Liquid Glass arrives through the system effect animation, started on the frame after mount.
  const [effect, setEffect] = useState<'none' | 'regular'>(materialize && liquid ? 'none' : 'regular');
  useEffect(() => {
    if (!(materialize && liquid) || effect === 'regular') return;
    const id = requestAnimationFrame(() => setEffect('regular'));
    return () => cancelAnimationFrame(id);
  }, [materialize, liquid, effect]);

  if (liquid) {
    if (materialize) {
      return (
        <AnimatedGlassView
          {...rest}
          glassEffectStyle={{ style: effect, animate: true, animationDuration: Timing.enter.duration / 1000 }}
          colorScheme={dark ? 'dark' : 'light'}
          isInteractive={interactive}
          style={[style, entrance]}>
          {children}
        </AnimatedGlassView>
      );
    }
    return (
      <GlassView
        {...rest}
        glassEffectStyle="regular"
        colorScheme={dark ? 'dark' : 'light'}
        isInteractive={interactive}
        style={style}>
        {children}
      </GlassView>
    );
  }

  const surface = solid
    ? { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }
    : // Without a real blur, Android needs a more opaque tint to keep text readable.
      { backgroundColor: theme.glassSolid, borderColor: theme.glassBorder, borderWidth: 1 };

  if (materialize) {
    return (
      <Animated.View {...rest} style={[surface, style, entrance]}>
        {children}
      </Animated.View>
    );
  }
  return (
    <View {...rest} style={[surface, style]}>
      {children}
    </View>
  );
}
