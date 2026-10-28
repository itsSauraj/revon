/**
 * Stacked alerts at the top of the map. A banner drops in from above and leaves along the same path,
 * and the stack reflows beneath it. Swipe up to dismiss: 1:1 with the finger, rubber-banding
 * downward, released with the finger's velocity. SOS banners are solid red and stay until tapped or
 * swiped.
 */
import { StyleSheet, Text, View } from 'react-native';
import type { IconType } from 'react-icons';
import { LuBell, LuInfo, LuSiren, LuTriangleAlert, LuX } from 'react-icons/lu';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { FORM_LAYOUT as STACK_LAYOUT } from '@/components/auth/field-motion';
import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Banner, dismissBanner, useBanners } from '@/lib/alerts';
import { EASE_OUT, project, rubberband, Spring, Timing } from '@/lib/motion';

const LEVEL_ICON: Record<Banner['level'], IconType> = {
  danger: LuSiren,
  warn: LuTriangleAlert,
  info: LuInfo,
  quiet: LuBell,
};

/** How far above its place a banner starts and ends. */
const RISE = 16;
/** An upward release faster than this (px/s) dismisses, however short the drag. */
const FLICK = 800;
/** A drag projected past this fraction of the banner's height dismisses. */
const DISMISS_AT = 0.5;
/** Pan activation: a finger travels this far vertically before the banner follows it. */
const ACTIVATE = 6;
/** A mostly-horizontal move is not a banner swipe. */
const FAIL_X = 16;
const FALLBACK_H = 44;

// Enter from above and leave the same way. The translation always rides with opacity, so when Reduce
// Motion skips the builders to their end the change still reads.
const BANNER_IN = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: -RISE }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
})
  .duration(Timing.enter.duration)
  .reduceMotion(ReduceMotion.System);
const BANNER_OUT = new Keyframe({
  from: { opacity: 1, transform: [{ translateY: 0 }] },
  to: { opacity: 0, transform: [{ translateY: -RISE }], easing: EASE_OUT },
})
  .duration(Timing.exit.duration)
  .reduceMotion(ReduceMotion.System);

export function AlertBanners({ onPress, top, right }: { onPress?: (b: Banner) => void; top?: number; right?: number }) {
  const banners = useBanners();
  const insets = useSafeAreaInsets();
  // Stays mounted while empty so the last banner's exit can play out.
  return (
    <View style={[styles.wrap, { top: top ?? insets.top + 56, right: right ?? 12 }]} pointerEvents="box-none">
      {banners.map((b) => (
        <BannerItem key={b.id} banner={b} onPress={onPress} />
      ))}
    </View>
  );
}

function BannerItem({ banner, onPress }: { banner: Banner; onPress?: (b: Banner) => void }) {
  const theme = useTheme();
  /** Offset from its place in the stack; negative is up. */
  const ty = useSharedValue(0);
  const grab = useSharedValue(0);
  /** Finger down but not yet dragging. */
  const held = useSharedValue(false);
  const height = useSharedValue(FALLBACK_H);
  const danger = banner.level === 'danger';
  const fg = danger ? theme.onDanger : theme.text;
  const dismiss = () => dismissBanner(banner.id);

  const pan = Gesture.Pan()
    .activeOffsetY([-ACTIVATE, ACTIVATE])
    .failOffsetX([-FAIL_X, FAIL_X])
    .onBegin(() => {
      // A finger landing mid-flight grabs the banner where it is.
      held.set(true);
      ty.set(ty.get());
    })
    .onStart(() => {
      held.set(false);
      grab.set(ty.get());
    })
    .onUpdate((e) => {
      const y = grab.get() + e.translationY;
      // Upward is free; downward resists, there is nothing that way.
      ty.set(y < 0 ? y : rubberband(y, height.get()));
    })
    .onEnd((e) => {
      const h = height.get();
      const v = e.velocityY; // negative = up
      if (-v > FLICK || -(ty.get() + project(v)) > h * DISMISS_AT) {
        // Fly out carrying the finger's velocity. By the time the banner is removed it is already
        // transparent, so the wrapper's exit only closes the gap in the stack.
        ty.set(
          withSpring(-(h + RISE), Spring.sheetClamped(v), (finished) => {
            if (finished) scheduleOnRN(dismiss);
          }),
        );
      } else {
        ty.set(withSpring(0, Spring.momentum(v)));
      }
    })
    .onFinalize(() => {
      // Touched but never dragged: let it carry on home.
      if (!held.get()) return;
      held.set(false);
      if (ty.get() !== 0) ty.set(withSpring(0, Spring.settle));
    });

  const drag = useAnimatedStyle(() => {
    const y = ty.get();
    return {
      opacity: interpolate(y, [-height.get(), 0], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: y }],
    };
  });

  return (
    <Animated.View entering={BANNER_IN} exiting={BANNER_OUT} layout={STACK_LAYOUT}>
      <GestureDetector gesture={pan}>
        <Animated.View style={drag} onLayout={(e) => height.set(e.nativeEvent.layout.height)}>
          <PressableScale
            accessibilityLabel={banner.text}
            accessibilityHint="Dismisses the alert"
            hitSlop={0}
            onPress={() => {
              onPress?.(banner);
              dismiss();
            }}
            style={[styles.banner, danger && { backgroundColor: theme.danger, borderColor: theme.danger }]}>
            {/* SOS stays solid red; everything else is glass. */}
            {!danger && <Glass style={[StyleSheet.absoluteFill, { borderRadius: Size.radius }]} />}
            <Icon icon={LEVEL_ICON[banner.level]} size={Size.iconSm} color={fg} />
            <Text style={[TextStyles.label, styles.text, { color: fg }]} numberOfLines={2}>
              {banner.text}
            </Text>
            <Icon icon={LuX} size={14} color={fg} />
          </PressableScale>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, gap: 6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Size.radius,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { flex: 1 },
});
