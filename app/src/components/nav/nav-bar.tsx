import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LuCheck, LuList, LuTriangleAlert, LuX } from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
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

/** Top card of the in-app ride view: the next turn, then time/distance left. */
export function NavBar(p: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  let icon = maneuverIcon(p.nextTurn?.step?.maneuver);
  let headline = p.nextTurn ? formatDistance(p.nextTurn.distanceM) : '';
  let detail = p.nextTurn?.step?.instruction ?? (p.nextTurn ? `Arrive at ${p.targetName}` : '');
  if (p.nextTurn && !p.nextTurn.step) icon = ARRIVE_ICON;

  if (p.arrived) {
    icon = ARRIVE_ICON;
    headline = 'You have arrived';
    detail = p.targetName;
  } else if (p.error) {
    icon = LuTriangleAlert;
    headline = 'No route';
    detail = p.error;
  } else if (p.offRoute) {
    icon = LuTriangleAlert;
    headline = 'Off route';
    detail = 'Finding a new route…';
  } else if (p.loading || !p.nextTurn) {
    headline = 'Finding route…';
    detail = p.targetName;
  }

  const summary =
    p.remainingM != null && p.remainingS != null && !p.arrived
      ? `${formatDuration(p.remainingS)} · ${formatDistance(p.remainingM)} · arrive ${arrivalClock(p.remainingS)}`
      : null;
  const busy = !p.arrived && !p.error && !p.offRoute && (p.loading || !p.nextTurn);

  return (
    <View
      style={[styles.wrap, { top: insets.top + 8 }]}
      onLayout={(e) => p.onHeight?.(e.nativeEvent.layout.height)}>
      <Glass style={styles.card}>
        <View style={styles.turnRow}>
          {/* The maneuver tile is one of the few accent surfaces. */}
          <View style={[styles.tile, { backgroundColor: theme.accent }]}>
            {busy ? <ActivityIndicator color={theme.onAccent} /> : <Icon icon={icon} size={26} color={theme.onAccent} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headline, { color: theme.text }]} numberOfLines={1}>
              {headline}
            </Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={2}>
              {detail}
            </Text>
          </View>
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
            <Text style={[styles.summary, { color: theme.text }]} numberOfLines={1}>
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
  tile: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headline: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  detail: { fontSize: Type.small, fontWeight: '500', marginTop: 1 },
  actions: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
  summaryRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  summary: { fontSize: Type.small - 1, fontWeight: '600' },
});
