import type { IconType } from 'react-icons';

import { Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconProps = { icon: IconType; size?: number; color?: string };

/** On web, react-icons render natively as <svg>. */
export function Icon({ icon: IconCmp, size = Size.icon, color }: IconProps) {
  const theme = useTheme();
  return (
    <IconCmp
      size={size}
      color={color ?? theme.text}
      aria-hidden
      style={{ display: 'block', flexShrink: 0, pointerEvents: 'none' }}
    />
  );
}
