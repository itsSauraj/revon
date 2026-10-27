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

// Presentation attributes react-icons sets on the root <svg>. They're copied onto every shape:
// on Android (new architecture) shapes don't reliably inherit them from <Svg>, and Lucide icons are
// stroke-only, so a lost stroke makes the icon invisible.
const PAINT_KEYS = ['fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'fillRule', 'clipRule'];

/** Replaces currentColor and turns numeric strings ("2") into numbers for react-native-svg. */
function normalize(attrs: Record<string, unknown>, color: string) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v === 'currentColor') out[k] = color;
    else if (typeof v === 'string' && k !== 'd' && k !== 'points' && k !== 'viewBox' && /^-?\d*\.?\d+$/.test(v)) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

function toNative(node: ReactNode, paint: Record<string, unknown>, color: string, key: number): ReactNode {
  if (!isValidElement(node) || typeof node.type !== 'string') return null;
  const Tag = TAGS[node.type];
  if (!Tag) return null;
  const { children, ...attrs } = node.props as { children?: ReactNode } & Record<string, unknown>;
  // Shape's own attributes win over the inherited root paint.
  const props = normalize({ ...paint, ...attrs }, color);
  const ownPaint = { ...paint };
  for (const k of PAINT_KEYS) if (k in attrs) ownPaint[k] = attrs[k];
  return (
    <Tag key={key} {...props}>
      {Children.map(children, (c, i) => toNative(c, ownPaint, color, i))}
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

  // IconBase defaults, overridden by the icon's own root attributes.
  const root: Record<string, unknown> = { fill: 'currentColor', stroke: 'currentColor', strokeWidth: '0', ...content.attr };
  const viewBox = (root.viewBox as string) ?? '0 0 24 24';
  const paint: Record<string, unknown> = {};
  for (const k of PAINT_KEYS) if (root[k] != null) paint[k] = root[k];

  return (
    <Svg width={size} height={size} viewBox={viewBox} color={c} accessible={false} pointerEvents="none">
      {content.children.map((child, i) => toNative(child, paint, c, i))}
    </Svg>
  );
}
