/**
 * Renders a react-icons icon on Android/iOS. react-icons outputs DOM <svg> elements, which React
 * Native can't display, so this reads the icon's SVG tree and redraws it with react-native-svg.
 * icon.web.tsx renders react-icons directly. All app icons come from one family: Lucide (`react-icons/lu`).
 */
import { Children, isValidElement, type ReactElement, type ReactNode, useMemo } from 'react';
import type { IconType } from 'react-icons';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconProps = { icon: IconType; size?: number; color?: string };

const TAGS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  path: Path as never,
  circle: Circle as never,
  rect: Rect as never,
  line: Line as never,
  polyline: Polyline as never,
  polygon: Polygon as never,
  ellipse: Ellipse as never,
  g: G as never,
};

function withColor(attrs: Record<string, unknown>, color: string) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) out[k] = v === 'currentColor' ? color : v;
  return out;
}

function toNative(node: ReactNode, color: string, key: number): ReactNode {
  if (!isValidElement(node) || typeof node.type !== 'string') return null;
  const Tag = TAGS[node.type];
  if (!Tag) return null;
  const { children, ...attrs } = node.props as { children?: ReactNode } & Record<string, unknown>;
  return (
    <Tag key={key} {...withColor(attrs, color)}>
      {Children.map(children, (c, i) => toNative(c, color, i))}
    </Tag>
  );
}

export function Icon({ icon, size = Size.icon, color }: IconProps) {
  const theme = useTheme();
  const c = color ?? theme.text;
  const content = useMemo(() => {
    // react-icons components are plain functions returning <IconBase attr={...}>{tree}</IconBase>.
    const el = icon({}) as ReactElement<{ attr?: Record<string, string>; children?: ReactNode }>;
    const attr = el.props.attr ?? {};
    return { attr, children: Children.toArray(el.props.children) };
  }, [icon]);

  const { viewBox = '0 0 24 24', fill = 'currentColor', stroke = 'currentColor', strokeWidth = '0', ...rest } = content.attr;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={viewBox}
      {...withColor({ fill, stroke, strokeWidth, ...rest }, c)}
      accessible={false}
      pointerEvents="none">
      {content.children.map((child, i) => toNative(child, c, i))}
    </Svg>
  );
}
