import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GAP_ALERT_M, type Rider } from '@/hooks/use-ride';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance } from '@/lib/geo';
import type { RideMeta, RiderRole, RiderStatus } from '@/lib/types';

import { initials, STATUS_ICON } from './member-marker';

const CHIPS: { status: RiderStatus; label: string }[] = [
  { status: 'fuel', label: '⛽ Fuel' },
  { status: 'rest', label: '☕ Rest' },
  { status: 'food', label: '🍔 Food' },
  { status: 'mechanical', label: '🔧 Mechanical' },
];

type Props = {
  meta: RideMeta;
  riders: Rider[];
  myUid: string;
  myStatus: RiderStatus;
  myRole: RiderRole;
  gapM: number | null;
  trackingNote: string | null;
  onStatus: (s: RiderStatus) => void;
  onRole: (r: RiderRole) => void;
  onRiderPress: (uid: string) => void;
  onInvite: () => void;
  onToggleLock: () => void;
  onRegroupHere: () => void;
  onLeave: () => void;
};

/** Bottom panel: one-tap status, the convoy list (front first), and ride actions. */
export function RidePanel(p: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const active = p.riders.length;

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 12 }]}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.handleRow} accessibilityRole="button">
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.summary}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {p.meta.destination.name}
            </Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              {active} rider{active === 1 ? '' : 's'} · code {p.meta.code}
              {p.meta.locked ? ' · 🔒 locked' : ''}
              {p.gapM != null ? ` · group spread ${formatDistance(p.gapM)}` : ''}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: theme.textSecondary }]}>{expanded ? '▾' : '▴'}</Text>
        </View>
      </Pressable>

      {p.trackingNote && <Text style={[styles.note, { color: theme.warn }]}>{p.trackingNote}</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CHIPS.map((c) => {
          const on = p.myStatus === c.status;
          return (
            <Pressable
              key={c.status}
              onPress={() => p.onStatus(on ? 'riding' : c.status)}
              style={[styles.chip, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary : 'transparent' }]}>
              <Text style={[styles.chipText, { color: on ? theme.onPrimary : theme.text }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {expanded && (
        <>
          <ScrollView style={styles.list}>
            {p.riders.map((r) => (
              <Pressable key={r.uid} onPress={() => p.onRiderPress(r.uid)} style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: r.status === 'sos' ? theme.danger : r.stale ? '#8B8D98' : r.color }]}>
                  <Text style={styles.avatarText}>{initials(r.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: theme.text }]}>
                    {r.name}
                    {r.uid === p.myUid ? ' (you)' : ''}
                    {r.role ? ` · ${r.role === 'lead' ? 'Lead' : 'Sweep'}` : ''}
                  </Text>
                  <Text style={[styles.sub, { color: r.status === 'sos' ? theme.danger : theme.textSecondary }]}>
                    {STATUS_ICON[r.status] ? `${STATUS_ICON[r.status]} ` : ''}
                    {r.status === 'sos'
                      ? 'NEEDS HELP'
                      : r.stale
                        ? 'No signal'
                        : r.relativeM != null
                          ? `${formatDistance(r.relativeM)} ${r.relativeM >= 0 ? 'ahead' : 'behind'}`
                          : r.status === 'arrived'
                            ? 'Arrived'
                            : r.moving
                              ? 'Moving'
                              : 'Stopped'}
                    {r.loc?.offRoute ? ' · off route' : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.roleRow}>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>My role:</Text>
            {(['lead', 'sweep', null] as RiderRole[]).map((role) => {
              const on = p.myRole === role;
              return (
                <Pressable
                  key={role ?? 'none'}
                  onPress={() => p.onRole(role)}
                  style={[styles.chip, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary : 'transparent' }]}>
                  <Text style={[styles.chipText, { color: on ? theme.onPrimary : theme.text }]}>
                    {role === 'lead' ? 'Lead' : role === 'sweep' ? 'Sweep' : 'Rider'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {p.gapM == null && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Set a Lead and a Sweep to get an alert when the group spreads over {formatDistance(GAP_ALERT_M)}.
            </Text>
          )}

          <View style={styles.actions}>
            <PanelButton label="📍 Regroup here" onPress={p.onRegroupHere} />
            <PanelButton label={p.meta.locked ? '🔓 Unlock' : '🔒 Lock'} onPress={p.onToggleLock} />
          </View>
        </>
      )}

      <View style={styles.actions}>
        <PanelButton label="➕ Invite" onPress={p.onInvite} primary />
        <PanelButton label="Leave ride" onPress={p.onLeave} danger />
      </View>
    </View>
  );
}

function PanelButton({ label, onPress, primary, danger }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean }) {
  const theme = useTheme();
  const bg = primary ? theme.primary : 'transparent';
  const fg = primary ? theme.onPrimary : danger ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, borderColor: primary ? bg : theme.border, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
  },
  handleRow: { paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  summary: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 19, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 2 },
  chevron: { fontSize: 18, marginLeft: 8 },
  note: { fontSize: 13, fontWeight: '600' },
  chips: { gap: 8 },
  chip: { paddingHorizontal: 16, height: 44, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center' },
  chipText: { fontSize: 16, fontWeight: '700' },
  list: { maxHeight: 260 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  rowName: { fontSize: 16, fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '800' },
});
