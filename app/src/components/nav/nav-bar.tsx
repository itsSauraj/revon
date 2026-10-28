import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LuCheck, LuList, LuTriangleAlert, LuX } from 'react-icons/lu';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FADE_IN, FADE_OUT } from '@/components/auth/field-motion';
import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { transition } from '@/components/ui/transition';
import { Size, TextStyles } from '@/constants/theme';
import type { NextTurn } from '@/hooks/use-route-follow';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatDuration } from '@/lib/geo';

import { ARRIVE_ICON, maneuverIcon } from './maneuver';

type Props = {
  targetName: string;
  nextTurn: NextTurn | null;
  remainingM: number | null;
  remainingS: number | null;
  loading: boolean;
  error: string | null;
  offRoute: boolean;
  arrived: boolean;
  onSteps: () => void;
  onExit: () => void;
  /** Reports the card's height so floating buttons can sit just below it. */
  onHeight?: (h: number) => void;
};

function arrivalClock(seconds: number) {
  const d = new Date(Date.now() + seconds * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Top card of the in-app ride view: the next turn, then time/distance left. The card materialises
 * when the ride view starts; the maneuver tile and its text crossfade when the maneuver (or the
 * card's state) changes. The distance and time, which tick with every fix, never animate.
 */
export function NavBar(p: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const step = p.nextTurn?.step ?? null;
  let icon = maneuverIcon(step?.maneuver);
  let headline = p.nextTurn ? formatDistance(p.nextTurn.distanceM) : '';
  let detail = step?.instruction ?? (p.nextTurn ? `Arrive at ${p.targetName}` : '');
  if (p.nextTurn && !step) icon = ARRIVE_ICON;
  /** What the card is about: a maneuver or a state. Only a change of subject crossfades. */
  let subject = step ? `${step.maneuver}|${step.instruction}` : 'arrive';
  let alert = false;

  if (p.arrived) {
    icon = ARRIVE_ICON;
    headline = 'You have arrived';
    detail = p.targetName;
    subject = 'arrived';
  } else if (p.error) {
    icon = LuTriangleAlert;
    headline = 'No route';
    detail = p.error;
    subject = 'error';
    alert = true;
  } else if (p.offRoute) {
    icon = LuTriangleAlert;
    headline = 'Off route';
    detail = 'Finding a new route…';
    subject = 'off-route';
    alert = true;
  } else if (p.loading || !p.nextTurn) {
    headline = 'Finding route…';
    detail = p.targetName;
    subject = 'busy';
  }

  const summary =
    p.remainingM != null && p.remainingS != null && !p.arrived
      ? `${formatDuration(p.remainingS)} · ${formatDistance(p.remainingM)} · arrive ${arrivalClock(p.remainingS)}`
      : null;
  const busy = !p.arrived && !p.error && !p.offRoute && (p.loading || !p.nextTurn);
  // The maneuver tile is one of the few accent surfaces; it goes monochrome while something is wrong.
  const tileBg = alert ? theme.inverse : theme.accent;
  const tileFg = alert ? theme.onInverse : theme.onAccent;

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} onLayout={(e) => p.onHeight?.(e.nativeEvent.layout.height)}>
      <Glass materialize style={styles.card}>
        <View style={styles.turnRow}>
          <Animated.View style={[styles.tile, transition('backgroundColor', 'toggle', reduced), { backgroundColor: tileBg }]}>
            <Animated.View key={subject} entering={FADE_IN} exiting={FADE_OUT} style={styles.tileContent}>
              {busy ? <ActivityIndicator color={tileFg} /> : <Icon icon={icon} size={26} color={tileFg} />}
            </Animated.View>
          </Animated.View>
          <Animated.View key={subject} entering={FADE_IN} exiting={FADE_OUT} style={styles.text}>
            <Text style={[TextStyles.headline, { color: theme.text }]} numberOfLines={1}>
              {headline}
            </Text>
            <Text style={[TextStyles.small, { color: theme.textSecondary }]} numberOfLines={2}>
              {detail}
            </Text>
          </Animated.View>
          <View style={styles.actions}>
            {!p.arrived && (
              <IconButton icon={LuList} variant="soft" size={Size.controlSm} accessibilityLabel="Show directions list" onPress={p.onSteps} />
            )}
            <IconButton
              icon={p.arrived ? LuCheck : LuX}
              variant={p.arrived ? 'accent' : 'soft'}
              size={Size.controlSm}
              accessibilityLabel={p.arrived ? 'Done' : 'Exit ride view'}
              onPress={p.onExit}
            />
          </View>
        </View>
        {summary && (
          <View style={[styles.summaryRow, { borderTopColor: theme.glassBorder }]}>
            <Text style={[TextStyles.label, { color: theme.text }]} numberOfLines={1}>
              {summary}
            </Text>
          </View>
        )}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  card: {
    borderRadius: Size.radiusLg + 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  tile: { width: 52, height: 52, borderRadius: 14 },
  // Fills the tile, so the outgoing and incoming icon sit on exactly the same spot.
  tileContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  actions: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
  summaryRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
});
