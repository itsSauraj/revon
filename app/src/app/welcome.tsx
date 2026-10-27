import { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LuArrowRight } from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ConvoyScene, GroupScene, NavScene, SCENE, SosScene } from '@/components/welcome/scenes';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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

/** First-launch intro. Ends at sign-in. */
export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;
  const sceneScale = Math.min(1.15, (width - 48) / SCENE);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const next = () => {
    if (last) {
      markWelcomeSeen();
      return;
    }
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        <Text style={[styles.brand, { color: theme.text }]}>revon</Text>
        {!last && (
          <Pressable accessibilityRole="button" onPress={() => markWelcomeSeen()} hitSlop={10}>
            <Text style={[styles.skip, { color: theme.textSecondary }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}>
        {SLIDES.map(({ key, Scene, title, body }) => (
          <View key={key} style={[styles.slide, { width }]}>
            <View style={{ width: SCENE * sceneScale, height: SCENE * sceneScale, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ transform: [{ scale: sceneScale }] }}>
                <Scene />
              </View>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[styles.dot, { backgroundColor: i === page ? theme.text : theme.border, width: i === page ? 22 : 7 }]}
          />
        ))}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 40 },
  brand: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  skip: { fontSize: Type.small + 1, fontWeight: '600' },
  pager: { flex: 1 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', marginTop: 18 },
  body: { fontSize: Type.body, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 18 },
  dot: { height: 7, borderRadius: 4 },
  actions: { paddingHorizontal: 20 },
});
