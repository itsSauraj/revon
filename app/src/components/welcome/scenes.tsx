/**
 * Animated illustrations for the welcome intro. Each scene is a small "map" (roads, river, blocks)
 * with revon's markers animated on top, in the app's monochrome + accent style.
 *
 * Every loop is gated on `useReducedMotion()`: with reduced motion on, nothing loops and each piece
 * sits on its end frame (route drawn, pins down, tags shown). Curves and springs come from lib/motion.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LuCoffee, LuCornerUpRight, LuFuel, LuNavigation2, LuSiren, LuUsers } from 'react-icons/lu';
import Animated, {
  cancelAnimation,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { Icon } from '@/components/ui/icon';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EASE_IN_OUT, EASE_OUT, Spring, Timing } from '@/lib/motion';

import { Motorbike } from './motorbike';

export const SCENE = 280;

// The loops below never start under reduced motion (see the file comment), so the configs inside
// them must not short-circuit on their own: a live toggle would otherwise turn a loop into a blink.
const LOOP = { reduceMotion: ReduceMotion.Never } as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Route through the scene, as points (also drawn as the path below).
const ROUTE: [number, number][] = [
  [30, 240],
  [80, 200],
  [110, 205],
  [150, 160],
  [190, 150],
  [215, 105],
  [250, 60],
];
const ROUTE_D = ROUTE.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
const ROUTE_LEN = ROUTE.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - ROUTE[i][0], y - ROUTE[i][1]), 0);

/** Position along ROUTE for progress 0..1 (runs on the UI thread). */
function pointAt(t: number) {
  'worklet';
  const target = Math.min(Math.max(t, 0), 1) * ROUTE_LEN;
  let walked = 0;
  for (let i = 1; i < ROUTE.length; i++) {
    const [x0, y0] = ROUTE[i - 1];
    const [x1, y1] = ROUTE[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (walked + seg >= target) {
      const f = (target - walked) / seg;
      return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f };
    }
    walked += seg;
  }
  const [x, y] = ROUTE[ROUTE.length - 1];
  return { x, y };
}

/** Roads, river and blocks: the backdrop every scene shares. */
function MapBackdrop({ withRoute = true, drawRoute = false }: { withRoute?: boolean; drawRoute?: boolean }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const dash = useSharedValue(ROUTE_LEN);
  useEffect(() => {
    if (!drawRoute) return;
    if (reduced) {
      dash.set(0); // route fully drawn
      return;
    }
    dash.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: 1800, easing: EASE_OUT, ...LOOP }),
          withDelay(1600, withTiming(0, { duration: 1, ...LOOP })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(dash);
  }, [drawRoute, reduced, dash]);
  const routeProps = useAnimatedProps(() => ({ strokeDashoffset: drawRoute ? dash.get() : 0 }));

  return (
    <Svg width={SCENE} height={SCENE} viewBox={`0 0 ${SCENE} ${SCENE}`} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={SCENE} height={SCENE} rx={28} fill={theme.backgroundElement} />
      {/* blocks */}
      {[
        [24, 24, 70, 52],
        [176, 186, 76, 64],
        [32, 120, 56, 44],
        [168, 22, 40, 34],
      ].map(([x, y, w, h], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} rx={8} fill={theme.backgroundSelected} />
      ))}
      {/* river */}
      <Path d="M-10 95 C 60 70, 120 130, 290 85" stroke={theme.border} strokeWidth={16} fill="none" strokeLinecap="round" />
      {/* roads */}
      <Path
        d="M0 175 L280 140 M120 0 L95 280 M200 0 L240 280 M0 60 L280 30"
        stroke={theme.border}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      {withRoute && (
        <>
          <Path d={ROUTE_D} stroke={theme.routeOutline} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <AnimatedPath
            d={ROUTE_D}
            stroke={theme.route}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[ROUTE_LEN, ROUTE_LEN]}
            animatedProps={routeProps}
          />
        </>
      )}
    </Svg>
  );
}

function Pin({ x, y, label, me, delay = 0 }: { x: number; y: number; label: string; me?: boolean; delay?: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const drop = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      drop.set(1); // pin down
      return;
    }
    // The pin lands with a little bounce: it fell, so the spring carries momentum.
    drop.set(
      withRepeat(
        withSequence(
          withDelay(delay, withSpring(1, { ...Spring.momentum(), ...LOOP })),
          withDelay(2600, withTiming(0, { ...Timing.exit, ...LOOP })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(drop);
  }, [delay, reduced, drop]);
  const style = useAnimatedStyle(() => {
    const d = drop.get();
    return {
      opacity: d,
      transform: [{ translateY: interpolate(d, [0, 1], [-30, 0]) }, { scale: interpolate(d, [0, 1], [0.6, 1]) }],
    };
  });
  return (
    <Animated.View style={[styles.pin, { left: x - 15, top: y - 15 }, style]}>
      <View style={[styles.dot, { backgroundColor: me ? theme.me : theme.rider, borderColor: theme.markerBorder }]}>
        <Text style={[styles.dotText, { color: me ? theme.meInk : theme.riderInk }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

function Pulse({ x, y, color, size = 56, delay = 0 }: { x: number; y: number; color: string; size?: number; delay?: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      p.set(0.5); // a still, faint halo
      return;
    }
    p.set(withDelay(delay, withRepeat(withTiming(1, { duration: 1600, easing: EASE_OUT, ...LOOP }), -1)));
    return () => cancelAnimation(p);
  }, [delay, reduced, p]);
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return { opacity: interpolate(v, [0, 1], [0.55, 0]), transform: [{ scale: interpolate(v, [0, 1], [0.4, 1.6]) }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

function Tag({ x, y, icon, text, delay }: { x: number; y: number; icon: typeof LuFuel; text: string; delay: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const a = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      a.set(1); // tag shown
      return;
    }
    a.set(
      withRepeat(
        withSequence(
          withDelay(delay, withTiming(1, { ...Timing.enter, ...LOOP })),
          withDelay(2200, withTiming(0, { ...Timing.exit, ...LOOP })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(a);
  }, [a, delay, reduced]);
  const style = useAnimatedStyle(() => {
    const v = a.get();
    return { opacity: v, transform: [{ translateY: interpolate(v, [0, 1], [6, 0]) }] };
  });
  return (
    <Animated.View style={[styles.tag, { left: x, top: y, backgroundColor: theme.rider }, style]}>
      <Icon icon={icon} size={11} color={theme.riderInk} />
      <Text style={[styles.tagText, { color: theme.riderInk }]}>{text}</Text>
    </Animated.View>
  );
}

/** A rider dot trailing the lead by `lag` along the route. */
function Follower({ t, lag }: { t: SharedValue<number>; lag: number }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const progress = t.get() - lag;
    const p = pointAt(progress);
    return { opacity: progress > 0 ? 1 : 0, transform: [{ translateX: p.x - 9 }, { translateY: p.y - 9 }] };
  });
  return <Animated.View style={[styles.follower, { backgroundColor: theme.rider, borderColor: theme.markerBorder }, style]} />;
}

/** 1. The convoy: a motorbike leads riders along the route as it draws in. */
export function ConvoyScene() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      t.set(1); // convoy at the end of the route
      return;
    }
    t.set(
      withRepeat(
        withSequence(withTiming(1, { duration: 3400, easing: EASE_IN_OUT, ...LOOP }), withTiming(0, { duration: 0, ...LOOP })),
        -1,
      ),
    );
    return () => cancelAnimation(t);
  }, [reduced, t]);
  const lead = useAnimatedStyle(() => {
    const p = pointAt(t.get());
    return { transform: [{ translateX: p.x - 24 }, { translateY: p.y - 34 }] };
  });

  return (
    <View style={styles.scene}>
      <MapBackdrop drawRoute />
      {[0.12, 0.22, 0.32].map((lag) => (
        <Follower key={lag} t={t} lag={lag} />
      ))}
      <Animated.View style={[styles.lead, { backgroundColor: theme.me, borderColor: theme.routeOutline }, lead]}>
        <Motorbike size={34} color={theme.meInk} accent={theme.meInk} />
      </Animated.View>
    </View>
  );
}

/** 2. Everyone on one map: pins drop in with live status tags. */
export function GroupScene() {
  const theme = useTheme();
  return (
    <View style={styles.scene}>
      <MapBackdrop />
      <Pulse x={150} y={160} color={theme.me} />
      <Pin x={150} y={160} label="You" me delay={0} />
      <Pin x={80} y={200} label="AK" delay={250} />
      <Pin x={215} y={105} label="RS" delay={500} />
      <Pin x={110} y={205} label="MJ" delay={750} />
      <Tag x={180} y={70} icon={LuFuel} text="Fuel stop" delay={900} />
      <Tag x={34} y={160} icon={LuCoffee} text="Rest stop" delay={1300} />
    </View>
  );
}

/** 3. Safety: an SOS pulses and the alert drops in for everyone. */
export function SosScene() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const b = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      b.set(1); // alert shown
      return;
    }
    b.set(
      withRepeat(
        withSequence(
          withDelay(500, withTiming(1, { ...Timing.enter, ...LOOP })),
          withDelay(2200, withTiming(0, { ...Timing.exit, ...LOOP })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(b);
  }, [b, reduced]);
  const banner = useAnimatedStyle(() => {
    const v = b.get();
    return { opacity: v, transform: [{ translateY: interpolate(v, [0, 1], [-24, 0]) }] };
  });
  return (
    <View style={styles.scene}>
      <MapBackdrop />
      <Pulse x={150} y={170} color={theme.danger} size={90} />
      <Pulse x={150} y={170} color={theme.danger} size={90} delay={800} />
      <View style={[styles.sos, { backgroundColor: theme.danger }]}>
        <Icon icon={LuSiren} size={16} color={theme.onDanger} />
        <Text style={[styles.sosText, { color: theme.onDanger }]}>SOS</Text>
      </View>
      <Animated.View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.border }, banner]}>
        <Icon icon={LuSiren} size={14} color={theme.danger} />
        <Text style={[styles.bannerText, { color: theme.text }]}>Alex needs help · 1.2 km behind</Text>
      </Animated.View>
      <Pin x={70} y={225} label="RS" />
      <Pin x={230} y={210} label="You" me />
    </View>
  );
}

/** 4. Navigation: the next-turn card with a turning compass. */
export function NavScene() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      spin.set(0); // compass pointing ahead
      return;
    }
    spin.set(
      withRepeat(
        withSequence(
          withTiming(-35, { duration: 1400, easing: EASE_IN_OUT, ...LOOP }),
          withTiming(10, { duration: 1400, easing: EASE_IN_OUT, ...LOOP }),
        ),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(spin);
  }, [reduced, spin]);
  const compass = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  return (
    <View style={styles.scene}>
      <MapBackdrop drawRoute />
      <View style={[styles.turnCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.turnTile, { backgroundColor: theme.accent }]}>
          <Icon icon={LuCornerUpRight} size={20} color={theme.onAccent} />
        </View>
        <View>
          <Text style={[styles.turnDist, { color: theme.text }]}>350 m</Text>
          <Text style={[styles.turnText, { color: theme.textSecondary }]}>Turn right onto Ring Road</Text>
        </View>
      </View>
      <View style={[styles.compass, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Animated.View style={compass}>
          <Icon icon={LuNavigation2} size={16} color={theme.text} />
        </Animated.View>
      </View>
      <View style={[styles.regroup, { backgroundColor: theme.route, borderColor: theme.routeOutline }]}>
        <Icon icon={LuUsers} size={13} color={theme.onAccent} />
      </View>
      <Pin x={150} y={160} label="You" me />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { width: SCENE, height: SCENE },
  pin: { position: 'absolute', width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: 9, fontWeight: '800' },
  follower: { position: 'absolute', left: 0, top: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  lead: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    height: 34,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11 },
  tagText: { fontSize: 10, fontWeight: '700' },
  sos: {
    position: 'absolute',
    left: 150 - 36,
    top: 170 - 36,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  sosText: { fontSize: Type.small, fontWeight: '900', letterSpacing: 1 },
  banner: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 18,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  bannerText: { fontSize: Type.tiny + 1, fontWeight: '700' },
  turnCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  turnTile: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  turnDist: { fontSize: 18, fontWeight: '800' },
  turnText: { fontSize: Type.tiny, fontWeight: '500' },
  compass: {
    position: 'absolute',
    right: 16,
    top: 96,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regroup: {
    position: 'absolute',
    left: 250 - 14,
    top: 60 - 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
