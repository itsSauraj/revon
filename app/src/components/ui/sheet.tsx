/**
 * Bottom sheets. Two components share one motion model, so the ride panel and the modal cards move
 * as one system: the sheet's position is a shared value, drags track 1:1 with rubber-banding past the
 * ends, releases hand the finger's velocity to `Spring.sheet`, and a touch mid-flight grabs the sheet
 * where it is.
 *
 * ## BottomSheet: persistent, non-modal, snap points (the group-ride panel over the map)
 *
 *   <BottomSheet
 *     snapPoints={[collapsedH, expandedH]}        // visible heights in px, ascending (measure with onLayout)
 *     initialIndex={0}                           // or `index` to control it
 *     onIndexChange={(i) => setExpanded(i === 1)}
 *     onSettle={(h) => setMapPadding(h)}         // RN thread, once per settle: native map padding
 *     position={sheetHeight}                     // shared value, written every frame on the UI thread
 *     header={<Summary />}>                      // draggable, like the handle
 *     <ScrollView>...</ScrollView>               // scrolls normally
 *   </BottomSheet>
 *
 * - It fills its parent (absolute fill, `pointerEvents="box-none"`), so render it as a direct child of
 *   the screen, after the map and before any SheetModal. The surface is pinned to the bottom and the
 *   map underneath keeps receiving touches.
 * - `snapPoints` are visible heights. Children are laid out in the largest one; lower detents show
 *   the top part. When the numbers change (content re-measured) the sheet moves to the same detent's
 *   new height, unless a finger has it.
 * - `index` (controlled) / `initialIndex` (uncontrolled start, default 0). `onIndexChange(i)` fires
 *   once per release, on the RN thread, when the target detent changes. Echoing it back into
 *   `index` is safe: the sheet won't restart a spring that is already heading there.
 * - `position`: the sheet writes its live visible height into it, so a parent can float buttons off
 *   it in `useAnimatedStyle` (e.g. `transform: [{ translateY: -position.get() }]`).
 * - `onSettle(height, index)`: RN thread, once per settle (also once on mount).
 * - `glass` for the Glass material (default theme.surface); `handle` (default true); `style` goes on
 *   the surface.
 * - Haptic: `haptic.light` once per release, as the detent catches.
 *
 * ## SheetModal: modal bottom sheet (member card, layers, directions)
 *
 *   <SheetModal visible={!!rider} onDismiss={() => setRider(null)} title="Rider">...</SheetModal>
 *
 * - Rendered in place as an absolute-fill layer at the screen level (not RN `Modal`), so gestures and
 *   animations stay on the UI thread on Android, iOS and web. Place it last in the screen tree so it
 *   paints over everything else. Keep it mounted and flip `visible`.
 * - Enters from the bottom with `Spring.sheet`, leaves the same way with `Timing.exit`, and unmounts
 *   its content only after the exit has finished. The scrim's opacity is derived from the sheet's
 *   progress on the UI thread (max 0.4). Reduced motion: cross-fade, no translate.
 * - Dismiss: scrim tap, the close button (with `title`), drag down (a flick over 800 px/s, or a drag
 *   projected past 40% of the height), Android back, web Escape. All call `onDismiss`; the parent
 *   must then set `visible={false}`.
 * - `height`: px, or 'auto' (default, measured with onLayout). `dragArea`: 'handle' (default; the
 *   grabber and title row) or 'sheet' (the whole surface: only for content without its own scroll view).
 * - Material: theme.surface (or `glass`), top radius `Size.radiusSheet`, a handle bar, shadow upward.
 *   On iOS a KeyboardAvoidingView keeps text inputs above the keyboard.
 */
import { type ReactNode, useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LuX } from 'react-icons/lu';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { MaxContentWidth, Size, TextStyles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic, nearestSnap, project, rubberband, rubberbandClamp, Spring, Timing } from '@/lib/motion';

import { Glass } from './glass';
import { IconButton } from './icon-button';

/** A release faster than this (px/s) moves one detent in its direction, however short the drag. */
const FLICK = 800;
/** A modal sheet dragged (projected) past this fraction of its height is dismissed. */
const DISMISS_AT = 0.4;
const SCRIM_MAX = 0.4;
/** Extra surface below the largest detent so an overdrag bounce never shows a gap. */
const OVERDRAG = 200;
/** Pan activation: a finger must travel this far vertically before the sheet follows it. */
const ACTIVATE = 6;
/** A mostly-horizontal move (chips, carousels) is not a sheet drag. */
const FAIL_X = 16;

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

function Handle() {
  const theme = useTheme();
  return <View style={[styles.handle, { backgroundColor: theme.muted }]} />;
}

// ---------------------------------------------------------------------------------------------
// BottomSheet
// ---------------------------------------------------------------------------------------------

export type BottomSheetProps = {
  /** Visible heights in px, ascending. */
  snapPoints: number[];
  /** Controlled detent. */
  index?: number;
  /** Starting detent when uncontrolled. */
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Receives the live visible height every frame (UI thread). */
  position?: SharedValue<number>;
  /** RN thread, once per settle. */
  onSettle?: (height: number, index: number) => void;
  glass?: boolean;
  handle?: boolean;
  /** Draggable, like the handle. */
  header?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function BottomSheet({
  snapPoints,
  index,
  initialIndex = 0,
  onIndexChange,
  position,
  onSettle,
  glass,
  handle = true,
  header,
  children,
  style,
}: BottomSheetProps) {
  const theme = useTheme();
  const key = snapPoints.join(',');
  const max = snapPoints.length ? snapPoints[snapPoints.length - 1] : 0;
  const start = Math.min(index ?? initialIndex, Math.max(0, snapPoints.length - 1));

  const points = useSharedValue<number[]>(snapPoints);
  /** Visible height: the single source of truth for the surface, `position` and the detent logic. */
  const height = useSharedValue(snapPoints[start] ?? 0);
  /** The detent we are resting at or heading to. */
  const target = useSharedValue(start);
  const grab = useSharedValue(0);
  const dragging = useSharedValue(false);
  /** Finger down but not yet dragging (the sheet is held still). */
  const held = useSharedValue(false);
  /** Measured height of the screen area we fill. */
  const frame = useSharedValue(0);
  /** Bumped (UI thread) each time the sheet comes to rest; relayed to `onSettle` below. */
  const settleTick = useSharedValue(0);

  const released = (from: number, to: number) => {
    haptic.light();
    if (to !== from) onIndexChange?.(to);
  };
  const settled = (h: number, i: number) => onSettle?.(h, i);

  // Mirror the live height into the parent's shared value, same frame, on the UI thread.
  useAnimatedReaction(
    () => height.get(),
    (h) => {
      if (position) position.set(h);
    },
    [position],
  );

  // One RN-thread call per settle, always through the latest `onSettle` (the reaction re-registers
  // when the callback changes, without touching the animations).
  useAnimatedReaction(
    () => settleTick.get(),
    (tick, previous) => {
      if (previous !== null && tick !== previous) scheduleOnRN(settled, height.get(), target.get());
    },
    [settled],
  );

  // Snap points changed (content measured): move to the same detent's new height, unless a finger has it.
  useEffect(() => {
    const pts = key ? key.split(',').map(Number) : [];
    points.set(pts);
    if (!pts.length || dragging.get()) return;
    const i = Math.min(target.get(), pts.length - 1);
    target.set(i);
    const h = pts[i];
    if (height.get() === h) {
      settleTick.set(settleTick.get() + 1);
      return;
    }
    height.set(
      withSpring(h, Spring.settle, (finished) => {
        'worklet';
        if (finished) settleTick.set(settleTick.get() + 1);
      }),
    );
  }, [key, points, dragging, target, height, settleTick]);

  // Controlled index: animate to it (no finger, so Spring.settle: critically damped).
  useEffect(() => {
    if (index === undefined || index === target.get() || dragging.get()) return;
    const pts = points.get();
    if (!pts.length) return;
    const i = Math.min(index, pts.length - 1);
    target.set(i);
    height.set(
      withSpring(pts[i], Spring.settle, (finished) => {
        'worklet';
        if (finished) settleTick.set(settleTick.get() + 1);
      }),
    );
  }, [index, points, dragging, target, height, settleTick]);

  const pan = Gesture.Pan()
    .activeOffsetY([-ACTIVATE, ACTIVATE])
    .failOffsetX([-FAIL_X, FAIL_X])
    .onBegin(() => {
      // A finger landing on a moving sheet grabs it where it is.
      held.set(true);
      height.set(height.get());
    })
    .onStart(() => {
      held.set(false);
      dragging.set(true);
      grab.set(height.get());
    })
    .onUpdate((e) => {
      const pts = points.get();
      if (!pts.length) return;
      const lo = pts[0];
      const hi = pts[pts.length - 1];
      height.set(rubberbandClamp(grab.get() - e.translationY, lo, hi, Math.max(hi, 1)));
    })
    .onEnd((e) => {
      dragging.set(false);
      const pts = points.get();
      if (!pts.length) return;
      const v = -e.velocityY; // positive opens
      const from = target.get();
      let to = pts.indexOf(nearestSnap(height.get() + project(v), pts));
      // A flick is enough even over a short distance: the velocity sign picks the neighbour.
      if (to === from && Math.abs(v) > FLICK) to = Math.min(pts.length - 1, Math.max(0, from + (v > 0 ? 1 : -1)));
      target.set(to);
      height.set(
        withSpring(pts[to], Spring.sheet(v), (finished) => {
          if (finished) settleTick.set(settleTick.get() + 1);
        }),
      );
      // Once per release: the haptic as the detent catches, and the index change.
      scheduleOnRN(released, from, to);
    })
    .onFinalize(() => {
      // Touched but never dragged (a tap on the header): let it carry on to its detent.
      if (!held.get()) return;
      held.set(false);
      const pts = points.get();
      if (!pts.length) return;
      const h = pts[target.get()];
      if (height.get() === h) return;
      height.set(
        withSpring(h, Spring.sheetClamped(0), (finished) => {
          if (finished) settleTick.set(settleTick.get() + 1);
        }),
      );
    });

  const surface = useAnimatedStyle(() => {
    const f = frame.get();
    // Hidden until the frame is measured; then the top edge sits `height` above the bottom.
    return { opacity: f > 0 ? 1 : 0, transform: [{ translateY: f - height.get() }] };
  });

  const radius = Size.radiusSheet;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={(e) => frame.set(e.nativeEvent.layout.height)}>
      <Animated.View style={[styles.surface, glass ? styles.shadowGlass : styles.shadow, { height: max + OVERDRAG }, surface]}>
        <View
          style={[
            styles.clip,
            { borderTopLeftRadius: radius, borderTopRightRadius: radius },
            !glass && { backgroundColor: theme.surface },
            style,
          ]}>
          {glass && <Glass style={StyleSheet.absoluteFill} />}
          {/* Until the content has been measured the box takes its natural height: a fixed 0 height
              collapses flex children on Android/iOS (Yoga has no min-height: auto), so nothing could
              ever be measured and the sheet would stay below the screen. */}
          <View style={max > 0 ? { height: max } : undefined}>
            <GestureDetector gesture={pan}>
              <View style={styles.grab}>
                {handle && <Handle />}
                {header}
              </View>
            </GestureDetector>
            <View style={max > 0 ? styles.body : undefined}>{children}</View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// SheetModal
// ---------------------------------------------------------------------------------------------

export type SheetModalProps = {
  visible: boolean;
  onDismiss: () => void;
  children?: ReactNode;
  /** Fixed height in px, or 'auto' to measure the content (default). */
  height?: number | 'auto';
  glass?: boolean;
  /** Adds a header row with the title and a close button. */
  title?: string;
  /** Where a drag starts: the grabber/title row (default) or anywhere on the sheet. */
  dragArea?: 'handle' | 'sheet';
  style?: StyleProp<ViewStyle>;
};

export function SheetModal({
  visible,
  onDismiss,
  children,
  height = 'auto',
  glass,
  title,
  dragArea = 'handle',
  style,
}: SheetModalProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();

  // Stay mounted through the exit animation; `exiting` is cleared by the animation's callback.
  const [exiting, setExiting] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    setExiting(!visible);
  }
  const rendered = visible || exiting;

  /** 0 = hidden (translated down by its own height), 1 = shown. Drags move it in px / height. */
  const progress = useSharedValue(0);
  const sheetH = useSharedValue(typeof height === 'number' ? height : 0);
  const grab = useSharedValue(0);
  const held = useSharedValue(false);

  useEffect(() => {
    if (typeof height === 'number') sheetH.set(height);
  }, [height, sheetH]);

  // Enter along the path it leaves by. Under reduced motion the same presets drive a pure cross-fade,
  // so the fade itself must run (ReduceMotion.Never) instead of being skipped.
  useEffect(() => {
    if (visible) {
      progress.set(
        reduced ? withTiming(1, { ...Timing.enter, reduceMotion: ReduceMotion.Never }) : withSpring(1, Spring.sheet()),
      );
      return;
    }
    progress.set(
      withTiming(0, reduced ? { ...Timing.exit, reduceMotion: ReduceMotion.Never } : Timing.exit, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(setExiting, false);
      }),
    );
  }, [visible, reduced, progress]);

  // Android hardware back and web Escape dismiss.
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onDismiss();
        return true;
      });
      return () => sub.remove();
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onDismiss();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [visible, onDismiss]);

  const pan = Gesture.Pan()
    .activeOffsetY([-ACTIVATE, ACTIVATE])
    .failOffsetX([-FAIL_X, FAIL_X])
    .onBegin(() => {
      held.set(true);
      progress.set(progress.get());
    })
    .onStart(() => {
      held.set(false);
      grab.set(progress.get());
    })
    .onUpdate((e) => {
      const h = sheetH.get();
      if (h <= 0) return;
      // Pixels below the resting position; downward is free, upward rubber-bands.
      const y = (1 - grab.get()) * h + e.translationY;
      progress.set(1 - (y < 0 ? -rubberband(-y, h) : y) / h);
    })
    .onEnd((e) => {
      const h = sheetH.get();
      if (h <= 0) return;
      const y = (1 - progress.get()) * h;
      const v = e.velocityY; // positive = down
      const vp = -v / h; // in progress units
      if (v > FLICK || y + project(v) > h * DISMISS_AT) {
        progress.set(
          withSpring(0, Spring.sheetClamped(vp), (finished) => {
            if (finished) scheduleOnRN(onDismiss);
          }),
        );
      } else {
        progress.set(withSpring(1, Spring.sheet(vp)));
      }
    })
    .onFinalize(() => {
      // Touched during the entrance but never dragged: carry on.
      if (!held.get()) return;
      held.set(false);
      if (progress.get() !== 1) progress.set(withSpring(1, Spring.sheetClamped(0)));
    });

  const scrim = useAnimatedStyle(() => ({ opacity: clamp01(progress.get()) * SCRIM_MAX }));
  const sheet = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduced) return { opacity: clamp01(p), transform: [{ translateY: 0 }] };
    const h = sheetH.get();
    // Hidden until measured, so an 'auto' sheet never flashes at its final position.
    return { opacity: h > 0 ? 1 : 0, transform: [{ translateY: (1 - p) * h }] };
  });

  if (!rendered) return null;

  const radius = Size.radiusSheet;
  const grabArea = (
    <View style={styles.grab}>
      <Handle />
      {title !== undefined && (
        <View style={styles.titleRow}>
          <Text style={[TextStyles.title, styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <IconButton icon={LuX} variant="ghost" size={Size.controlSm} accessibilityLabel="Close" onPress={onDismiss} />
        </View>
      )}
    </View>
  );
  const surface = (
    <Animated.View
      accessibilityViewIsModal
      onLayout={height === 'auto' ? (e: LayoutChangeEvent) => sheetH.set(e.nativeEvent.layout.height) : undefined}
      style={[styles.modalSheet, glass ? styles.shadowGlass : styles.shadow, sheet]}>
      <View
        style={[
          styles.modalClip,
          { borderTopLeftRadius: radius, borderTopRightRadius: radius, paddingBottom: insets.bottom + 12 },
          !glass && { backgroundColor: theme.surface },
          typeof height === 'number' && { height },
          style,
        ]}>
        {glass && <Glass style={StyleSheet.absoluteFill} />}
        {dragArea === 'sheet' ? grabArea : <GestureDetector gesture={pan}>{grabArea}</GestureDetector>}
        {children}
      </View>
    </Animated.View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalLayout}
        pointerEvents="box-none">
        {dragArea === 'sheet' ? <GestureDetector gesture={pan}>{surface}</GestureDetector> : surface}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shared
  clip: { flex: 1, overflow: 'hidden' },
  grab: { paddingTop: 8 },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 2.5, marginBottom: 8 },
  body: { flex: 1 },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  // No Android elevation on translucent glass: the shadow would show through it.
  shadowGlass: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  // BottomSheet
  surface: { position: 'absolute', left: 0, right: 0, top: 0 },
  // SheetModal
  layer: { zIndex: 10 },
  scrim: { backgroundColor: '#000' },
  modalLayout: { flex: 1, justifyContent: 'flex-end' },
  // Sized by its content: with `flex: 1` here Yoga collapses the view to its padding inside the
  // auto-height surface (browsers resolve it to the content height), leaving the sheet mostly
  // off screen on Android and iOS.
  modalClip: { overflow: 'hidden' },
  modalSheet: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  title: { flex: 1 },
});
