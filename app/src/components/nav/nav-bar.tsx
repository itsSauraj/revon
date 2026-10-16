import { StyleSheet, Text, View } from 'react-native';
import { LuCheck, LuFlag, LuList, LuNavigation, LuTriangleAlert, LuX } from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatDuration } from '@/lib/geo';

type Props = {
  targetName: string;
  remainingM: number | null;
  remainingS: number | null;
  loading: boolean;
  error: string | null;
  offRoute: boolean;
  arrived: boolean;
  onSteps: () => void;
  onExit: () => void;
};

function arrivalClock(seconds: number) {
  const d = new Date(Date.now() + seconds * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Top card of the in-app ride view: where you're going and how much is left. */
export function NavBar(p: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const status = p.arrived
    ? 'You have arrived'
    : p.error
      ? p.error
      : p.loading
        ? 'Finding route…'
        : p.offRoute
          ? 'Off route · finding a new route'
          : p.remainingM != null && p.remainingS != null
            ? `${formatDuration(p.remainingS)} · ${formatDistance(p.remainingM)} · arrive ${arrivalClock(p.remainingS)}`
            : '';

  // Arrival is one of the few places the accent is used; otherwise the card follows the theme.
  const bg = p.arrived ? theme.accent : theme.surface;
  const fg = p.arrived ? theme.onAccent : theme.text;
  const lead = p.arrived ? LuFlag : p.offRoute || p.error ? LuTriangleAlert : LuNavigation;

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={[styles.card, { backgroundColor: bg }]}>
        <Icon icon={lead} size={Size.icon} color={fg} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.to, { color: fg }]} numberOfLines={1}>
            {p.targetName}
          </Text>
          <Text style={[styles.status, { color: fg }]} numberOfLines={2}>
            {status}
          </Text>
        </View>
        {!p.arrived && (
          <IconButton icon={LuList} variant="soft" size={Size.controlSm} accessibilityLabel="Show directions list" onPress={p.onSteps} />
        )}
        <IconButton
          icon={p.arrived ? LuCheck : LuX}
          variant={p.arrived ? 'inverse' : 'soft'}
          size={Size.controlSm}
          accessibilityLabel={p.arrived ? 'Done' : 'Exit ride view'}
          onPress={p.onExit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: Size.radiusLg,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  to: { fontSize: Type.body + 1, fontWeight: '800' },
  status: { fontSize: Type.small - 1, fontWeight: '500', marginTop: 1, opacity: 0.9 },
});
