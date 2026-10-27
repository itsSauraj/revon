import { useEffect, useRef } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type GlassProps = ViewProps & { interactive?: boolean };

/** Web glass: translucent tint with a CSS backdrop blur over the map. */
export function Glass({ style, children, interactive: _interactive, ...rest }: GlassProps) {
  const theme = useTheme();
  const ref = useRef<View>(null);

  // react-native-web doesn't pass backdrop-filter through styles, so set it on the DOM node.
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el?.style) return;
    el.style.setProperty('backdrop-filter', 'blur(18px) saturate(1.6)');
    el.style.setProperty('-webkit-backdrop-filter', 'blur(18px) saturate(1.6)');
  }, []);

  return (
    <View
      ref={ref}
      {...rest}
      style={[{ backgroundColor: theme.glass, borderColor: theme.glassBorder, borderWidth: 1 }, style]}>
      {children}
    </View>
  );
}
