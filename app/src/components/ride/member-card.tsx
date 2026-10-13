import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Rider } from '@/hooks/use-ride';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatDuration, formatSpeed, haversine } from '@/lib/geo';
import { computeRoute, openGoogleMapsNav } from '@/lib/google';
import type { LatLng } from '@/lib/types';

import { initials, STATUS_ICON } from './member-marker';

const STATUS_LABEL: Record<string, string> = {
  riding: 'Riding',
  fuel: 'Fuel stop',
  rest: 'Rest stop',
  food: 'Food stop',
  mechanical: 'Mechanical issue',
  sos: 'NEEDS HELP',
  arrived: 'Arrived',
};

type Props = {
  rider: Rider | null;
  myPosition: LatLng | null;
  isMe: boolean;
  onClose: () => void;
};

export function MemberCard({ rider, myPosition, isMe, onClose }: Props) {
  const theme = useTheme();
  const [etaFor, setEtaFor] = useState<{ uid: string; text: string } | null>(null);
  const eta = etaFor && etaFor.uid === rider?.uid ? etaFor.text : null;

  // Road ETA is fetched only when a card is opened, not continuously for every rider.
  const target = rider?.loc ? { latitude: rider.loc.lat, longitude: rider.loc.lng } : null;
  useEffect(() => {
    if (!rider || !target || !myPosition || isMe) return;
    const uid = rider.uid;
    let cancelled = false;
    computeRoute(myPosition, target)
      .then((r) => {
        if (!cancelled && r) {
          setEtaFor({ uid, text: `${formatDuration(r.durationS)} · ${formatDistance(r.distanceM)} by road` });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Only refetch when a different rider is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.uid]);

  if (!rider) return null;

  const straight = target && myPosition ? haversine(myPosition, target) : null;
  const relative =
    rider.relativeM == null
      ? null
      : Math.abs(rider.relativeM) < 50
        ? 'Right beside you'
        : `${formatDistance(rider.relativeM)} ${rider.relativeM > 0 ? 'ahead of' : 'behind'} you`;
  const sos = rider.status === 'sos';

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: sos ? theme.danger : rider.color }]}>
            <Text style={styles.avatarText}>{initials(rider.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>
              {rider.name}
              {isMe ? ' (you)' : ''}
            </Text>
            <Text style={[styles.status, { color: sos ? theme.danger : theme.textSecondary }]}>
              {STATUS_ICON[rider.status] ? `${STATUS_ICON[rider.status]} ` : ''}
              {STATUS_LABEL[rider.status] ?? rider.status}
              {rider.role ? ` · ${rider.role === 'lead' ? 'Lead' : 'Sweep'}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label="Speed" value={rider.loc ? formatSpeed(rider.loc.speed) : '–'} />
          <Stat label="State" value={rider.stale ? 'No signal' : rider.moving ? 'Moving' : 'Stopped'} />
          <Stat label="Distance" value={straight != null ? formatDistance(straight) : '–'} />
        </View>
        {!isMe && relative && <Text style={[styles.line, { color: theme.text }]}>{relative}</Text>}
        {!isMe && eta && <Text style={[styles.line, { color: theme.textSecondary }]}>{eta}</Text>}
        {rider.loc?.offRoute && <Text style={[styles.line, { color: theme.warn }]}>Off the group route</Text>}

        {!isMe && (
          <View style={styles.actions}>
            {rider.phone && (
              <Action label="📞 Call" color={theme.success} onPress={() => Linking.openURL(`tel:${rider.phone}`)} />
            )}
            {target && (
              <Action
                label={sos ? '🏍 Ride to them' : '🧭 Navigate to'}
                color={sos ? theme.danger : theme.primary}
                onPress={() => openGoogleMapsNav(target)}
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function Action({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  card: { padding: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  name: { fontSize: 22, fontWeight: '800' },
  status: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  line: { fontSize: 16, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: { flex: 1, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
