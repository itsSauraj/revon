import Svg, { Circle, Path } from 'react-native-svg';

type Props = { size?: number; color: string; accent: string };

/** Side-view motorbike in the same outline style as the Lucide icons (Lucide has none). */
export function Motorbike({ size = 64, color, accent }: Props) {
  return (
    <Svg width={size} height={(size * 40) / 64} viewBox="0 0 64 40" fill="none">
      {/* wheels */}
      <Circle cx={13} cy={29} r={8.5} stroke={color} strokeWidth={2.5} />
      <Circle cx={51} cy={29} r={8.5} stroke={color} strokeWidth={2.5} />
      <Circle cx={13} cy={29} r={2} fill={color} />
      <Circle cx={51} cy={29} r={2} fill={color} />
      {/* frame, tank and seat */}
      <Path
        d="M13 29 L24 18 L36 18 L44 26 M24 18 L30 29 L44 26 M36 18 L41 11 M20 15 L33 15 L36 18"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* fork and handlebar */}
      <Path d="M41 11 L51 29 M38 9 L45 9" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      {/* headlight */}
      <Circle cx={46.5} cy={14} r={2.6} fill={accent} />
    </Svg>
  );
}
