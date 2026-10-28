import { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { useReduceTransparency } from '@/hooks/use-reduce-transparency';
import { useTheme } from '@/hooks/use-theme';

import { useMaterialize } from './materialize';

export type GlassProps = ViewProps & { interactive?: boolean; materialize?: boolean };

const BLUR = 'blur(18px) saturate(1.6)';

/**
 * Web glass: translucent tint with a CSS backdrop blur over the map. Solid (theme.surface, no blur)
 * when `prefers-reduced-transparency` is on. `materialize` animates it in on mount.
 */
export function Glass({ style, children, interactive: _interactive, materialize, ...rest }: GlassProps) {
  const theme = useTheme();
  const solid = useReduceTransparency();
  const ref = useRef<View>(null);
  const entrance = useMaterialize(materialize);

  // react-native-web doesn't pass backdrop-filter through styles, so set it on the DOM node.
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el?.style) return;
    if (solid) {
      el.style.removeProperty('backdrop-filter');
      el.style.removeProperty('-webkit-backdrop-filter');
      return;
    }
    el.style.setProperty('backdrop-filter', BLUR);
    el.style.setProperty('-webkit-backdrop-filter', BLUR);
  }, [solid]);

  const surface = solid
    ? { backgroundColor: theme.surface, borderColor: theme.border }
    : { backgroundColor: theme.glass, borderColor: theme.glassBorder };

  if (materialize) {
    return (
      <Animated.View ref={ref} {...rest} style={[styles.base, surface, style, entrance]}>
        {children}
      </Animated.View>
    );
  }
  return (
    <View ref={ref} {...rest} style={[styles.base, surface, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ base: { borderWidth: 1 } });
