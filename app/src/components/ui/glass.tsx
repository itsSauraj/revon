/**
 * Frosted "liquid glass" surface for everything floating over the map.
 *
 * - iOS 26+: Apple's Liquid Glass (expo-glass-effect).
 * - Android: no system glass, and a blur can't sample Google Maps' native map surface, so this is a
 *   translucent tinted panel with a light edge.
 * - Web: see glass.web.tsx (CSS backdrop blur).
 */
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, View, type ViewProps } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();

export type GlassProps = ViewProps & {
  /** Interactive glass reacts to touches on iOS 26 (use for buttons). */
  interactive?: boolean;
};

export function Glass({ style, children, interactive, ...rest }: GlassProps) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';

  if (LIQUID) {
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
  return (
    <View
      {...rest}
      // Without a real blur, Android needs a more opaque tint to keep text readable.
      style={[{ backgroundColor: theme.glassSolid, borderColor: theme.glassBorder, borderWidth: 1 }, style]}>
      {children}
    </View>
  );
}
