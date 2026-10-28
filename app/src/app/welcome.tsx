import { type ComponentType, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LuArrowRight } from 'react-icons/lu';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  LayoutAnimationConfig,
  ReduceMotion,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/ui/button';
import { ConvoyScene, GroupScene, NavScene, SCENE, SosScene } from '@/components/welcome/scenes';
import { TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EASE_OUT, Timing } from '@/lib/motion';
import { markWelcomeSeen } from '@/lib/session';

const SLIDES = [
  {
    key: 'convoy',
    Scene: ConvoyScene,
    title: 'Ride together',
    body: 'Start a group ride, share a code, and the whole convoy is on one live map.',
  },
  {
    key: 'group',
    Scene: GroupScene,
    title: 'See every rider, live',
    body: "Names, speed and stops on the map. Know who's ahead, who's behind and who pulled over for fuel.",
  },
  {
    key: 'sos',
    Scene: SosScene,
    title: 'Help is one hold away',
    body: 'Hold SOS for two seconds and every rider is alerted, with a route straight to you.',
  },
  {
    key: 'nav',
    Scene: NavScene,
    title: 'Navigate as one',
    body: 'Turn-by-turn in the app, a fresh route when you miss a turn, and a regroup pin anyone can drop.',
  },
];
const LAST = SLIDES.length - 1;

// Page dots: 7pt dots 6pt apart, the current page a 22pt pill. Dots after the pill sit 15pt further
// right, so the row is a fixed-size track and every piece moves by transform only.
const DOT = 7;
const DOT_GAP = 6;
const PILL = 22;
const DOT_STEP = DOT + DOT_GAP;
const PILL_SHIFT = PILL - DOT;
const TRACK_WIDTH = PILL + LAST * DOT_STEP;

// How much slower than the page the illustration and the copy travel (0 = glued to the page).
const SCENE_LAG = 0.25;
const COPY_LAG = 0.1;

const SKIP_IN = FadeIn.duration(Timing.enter.duration).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const SKIP_OUT = FadeOut.duration(Timing.exit.duration).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

/** First-launch intro. Ends at sign-in. */
export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const scroller = useAnimatedRef<Animated.ScrollView>();
  // The scroll offset lives on the UI thread; the dots and the parallax read it there, every frame.
  const x = useSharedValue(0);
  // React only needs the page index (button label, Skip): it changes when the offset crosses a half page.
  const [page, setPage] = useState(0);
  const last = page === LAST;
  const sceneScale = Math.min(1.15, (width - 48) / SCENE);

  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
  });

  useAnimatedReaction(
    () => Math.min(LAST, Math.max(0, Math.round(x.get() / width))),
    (current, previous) => {
      if (previous !== null && current !== previous) scheduleOnRN(setPage, current);
    },
  );

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(x.get(), [0, LAST * width], [0, LAST * DOT_STEP], Extrapolation.CLAMP) }],
  }));

  const next = () => {
    if (last) {
      markWelcomeSeen();
      return;
    }
    // Reduced motion: jump to the next page instead of sliding a screen's worth of content.
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: !reduced });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        <Text style={[styles.brand, { color: theme.text }]}>revon</Text>
        {/* Skip is there from the first frame; it only fades when the last page takes it away. */}
        <LayoutAnimationConfig skipEntering>
          {!last && (
            <Animated.View entering={SKIP_IN} exiting={SKIP_OUT}>
              <Button label="Skip" variant="ghost" size="sm" onPress={() => markWelcomeSeen()} />
            </Animated.View>
          )}
        </LayoutAnimationConfig>
      </View>

      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}>
        {SLIDES.map(({ key, ...slide }, i) => (
          <Slide key={key} index={i} x={x} width={width} sceneScale={sceneScale} reduced={reduced} {...slide} />
        ))}
      </Animated.ScrollView>

      <View style={styles.dotsRow}>
        <View style={[styles.track, { width: TRACK_WIDTH }]}>
          {SLIDES.map((s, i) => (
            <Dot key={s.key} index={i} x={x} width={width} color={theme.border} />
          ))}
          <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: theme.text }, pillStyle]} />
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={last ? 'Get started' : 'Next'}
          icon={last ? undefined : LuArrowRight}
          variant={last ? 'accent' : 'inverse'}
          onPress={next}
        />
      </View>
    </View>
  );
}

type SlideProps = {
  index: number;
  x: SharedValue<number>;
  width: number;
  sceneScale: number;
  reduced: boolean;
  Scene: ComponentType;
  title: string;
  body: string;
};

/**
 * One page. The illustration and the copy trail the page a little (and the illustration shrinks to
 * 0.92 at the edges), all interpolated from the scroll offset on the UI thread. The slide clips, so
 * a trailing neighbour never shows before its page does. Reduced motion: everything rides the page.
 */
function Slide({ index, x, width, sceneScale, reduced, Scene, title, body }: SlideProps) {
  const theme = useTheme();
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const sceneStyle = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ translateX: 0 }, { scale: 1 }] };
    const offset = x.get();
    return {
      transform: [
        { translateX: interpolate(offset, range, [-width * SCENE_LAG, 0, width * SCENE_LAG], Extrapolation.CLAMP) },
        { scale: interpolate(offset, range, [0.92, 1, 0.92], Extrapolation.CLAMP) },
      ],
    };
  });

  const copyStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [{ translateX: 0 }] };
    const offset = x.get();
    return {
      opacity: interpolate(offset, range, [0.5, 1, 0.5], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(offset, range, [-width * COPY_LAG, 0, width * COPY_LAG], Extrapolation.CLAMP) }],
    };
  });

  const side = SCENE * sceneScale;
  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[{ width: side, height: side }, styles.sceneBox, sceneStyle]}>
        <View style={{ transform: [{ scale: sceneScale }] }}>
          <Scene />
        </View>
      </Animated.View>
      <Animated.View style={[styles.copy, copyStyle]}>
        <Text style={[TextStyles.display, styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[TextStyles.body, styles.body, { color: theme.textSecondary }]}>{body}</Text>
      </Animated.View>
    </View>
  );
}

/** An inactive dot. It steps aside while the pill is on a page before it. */
function Dot({ index, x, width, color }: { index: number; x: SharedValue<number>; width: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          index * DOT_STEP + interpolate(x.get(), [(index - 1) * width, index * width], [PILL_SHIFT, 0], Extrapolation.CLAMP),
      },
    ],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 40 },
  brand: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  pager: { flex: 1 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14, overflow: 'hidden' },
  sceneBox: { alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', gap: 14 },
  title: { textAlign: 'center', marginTop: 18 },
  body: { textAlign: 'center', maxWidth: 360 },
  dotsRow: { alignItems: 'center', marginVertical: 18 },
  track: { height: DOT },
  dot: { position: 'absolute', left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2 },
  pill: { position: 'absolute', left: 0, top: 0, width: PILL, height: DOT, borderRadius: DOT / 2 },
  actions: { paddingHorizontal: 20 },
});
