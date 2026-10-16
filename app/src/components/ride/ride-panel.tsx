import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LuChevronDown, LuChevronUp, LuLock, LuLockOpen, LuLogOut, LuMapPin, LuUserPlus } from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Size, Type } from '@/constants/theme';
import { GAP_ALERT_M, type Rider } from '@/hooks/use-ride';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance } from '@/lib/geo';
import type { RideMeta, RiderRole, RiderStatus } from '@/lib/types';

import { initials, STATUS_META, STOP_STATUSES } from './status';

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

function riderLine(r: Rider) {
  const where = !r.loc
    ? 'Waiting for location'
    : r.stale && r.status !== 'arrived'
      ? 'No signal'
      : r.relativeM != null
        ? `${formatDistance(r.relativeM)} ${r.relativeM >= 0 ? 'ahead' : 'behind'}`
        : r.status === 'arrived'
          ? null
          : r.moving
            ? 'Moving'
            : 'Stopped';
  return [STATUS_META[r.status]?.tag, where, r.loc?.offRoute ? 'off route' : null].filter(Boolean).join(' · ');
}

/** Bottom panel: one-tap status, the convoy list (front first), and ride actions. */
export function RidePanel(p: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const active = p.riders.length;

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 10 }]}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={styles.handleRow}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse ride panel' : 'Expand ride panel'}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.summary}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {p.meta.destination.name}
            </Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
              {active} rider{active === 1 ? '' : 's'} · code {p.meta.code}
              {p.meta.locked ? ' · locked' : ''}
              {p.gapM != null ? ` · spread ${formatDistance(p.gapM)}` : ''}
            </Text>
          </View>
          <Icon icon={expanded ? LuChevronDown : LuChevronUp} size={Size.icon} color={theme.textSecondary} />
        </View>
      </Pressable>

      {p.trackingNote && <Text style={[styles.note, { color: theme.textSecondary }]}>{p.trackingNote}</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STOP_STATUSES.map((s) => {
          const m = STATUS_META[s]!;
          const on = p.myStatus === s;
          return <Chip key={s} label={m.label} icon={m.icon} selected={on} onPress={() => p.onStatus(on ? 'riding' : s)} />;
        })}
      </ScrollView>

      {expanded && (
        <>
          <ScrollView style={styles.list}>
            {p.riders.map((r) => {
              const isMe = r.uid === p.myUid;
              const sos = r.status === 'sos';
              const bg = sos ? theme.danger : r.stale ? theme.stale : isMe ? theme.me : theme.rider;
              return (
                <Pressable key={r.uid} onPress={() => p.onRiderPress(r.uid)} style={styles.row}>
                  <View style={[styles.avatar, { backgroundColor: bg }]}>
                    <Text
                      style={[
                        styles.avatarText,
                        { color: sos ? theme.onDanger : r.stale ? '#FFFFFF' : isMe ? theme.meInk : theme.riderInk },
                      ]}>
                      {initials(r.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                      {r.name}
                      {isMe ? ' (you)' : ''}
                      {r.role ? ` · ${r.role === 'lead' ? 'Lead' : 'Sweep'}` : ''}
                    </Text>
                    <Text style={[styles.sub, { color: sos ? theme.danger : theme.textSecondary }]} numberOfLines={1}>
                      {riderLine(r)}
                    </Text>
                  </View>
                  {STATUS_META[r.status] && (
                    <Icon icon={STATUS_META[r.status]!.icon} size={Size.iconSm} color={sos ? theme.danger : theme.textSecondary} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.roleRow}>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>My role</Text>
            {(['lead', 'sweep', null] as RiderRole[]).map((role) => (
              <Chip
                key={role ?? 'none'}
                label={role === 'lead' ? 'Lead' : role === 'sweep' ? 'Sweep' : 'Rider'}
                selected={p.myRole === role}
                onPress={() => p.onRole(role)}
              />
            ))}
          </View>
          {p.gapM == null && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Set a Lead and a Sweep to get an alert when the group spreads over {formatDistance(GAP_ALERT_M)}.
            </Text>
          )}

          <View style={styles.actions}>
            <Button label="Regroup here" icon={LuMapPin} size="sm" onPress={p.onRegroupHere} style={styles.flex} />
            <Button
              label={p.meta.locked ? 'Unlock' : 'Lock'}
              icon={p.meta.locked ? LuLockOpen : LuLock}
              size="sm"
              onPress={p.onToggleLock}
              style={styles.flex}
            />
          </View>
        </>
      )}

      <View style={styles.actions}>
        <Button label="Invite" icon={LuUserPlus} variant="inverse" size="sm" onPress={p.onInvite} style={styles.flex} />
        <Button label="Leave" icon={LuLogOut} size="sm" onPress={p.onLeave} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopLeftRadius: Size.radiusLg,
    borderTopRightRadius: Size.radiusLg,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  handleRow: { paddingTop: 6 },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginBottom: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: Type.body, fontWeight: '700' },
  sub: { fontSize: Type.small - 1, marginTop: 1 },
  note: { fontSize: Type.tiny + 1 },
  chips: { gap: 6 },
  list: { maxHeight: 220 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: Type.tiny },
  rowName: { fontSize: Type.small + 1, fontWeight: '600' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { fontSize: Type.tiny },
  actions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
