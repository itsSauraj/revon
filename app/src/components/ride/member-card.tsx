import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LuNavigation, LuPhone, LuTriangleAlert, LuX } from 'react-icons/lu';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
import type { Rider } from '@/hooks/use-ride';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatDuration, formatSpeed, haversine } from '@/lib/geo';
import { computeRoute } from '@/lib/google';
import type { LatLng, Place } from '@/lib/types';

import { initials, STATUS_META } from './status';

type Props = {
  rider: Rider | null;
  myPosition: LatLng | null;
  isMe: boolean;
  onClose: () => void;
  /** Opens the in-app ride view towards this rider. */
  onNavigate: (to: Place) => void;
};

export function MemberCard({ rider, myPosition, isMe, onClose, onNavigate }: Props) {
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
  const meta = STATUS_META[rider.status];
  const avatarBg = sos ? theme.danger : rider.stale ? theme.stale : isMe ? theme.me : theme.rider;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text
              style={[
                styles.avatarText,
                { color: sos ? theme.onDanger : rider.stale ? '#FFFFFF' : isMe ? theme.meInk : theme.riderInk },
              ]}>
              {initials(rider.name)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {rider.name}
              {isMe ? ' (you)' : ''}
            </Text>
            <View style={styles.statusRow}>
              {meta && <Icon icon={meta.icon} size={13} color={sos ? theme.danger : theme.textSecondary} />}
              <Text style={[styles.status, { color: sos ? theme.danger : theme.textSecondary }]}>
                {meta?.tag ?? 'Riding'}
                {rider.role ? ` · ${rider.role === 'lead' ? 'Lead' : 'Sweep'}` : ''}
              </Text>
            </View>
          </View>
          <IconButton icon={LuX} variant="ghost" size={Size.controlSm} accessibilityLabel="Close" onPress={onClose} />
        </View>

        <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
          <Stat label="Speed" value={rider.loc ? formatSpeed(rider.loc.speed) : '–'} />
          <Stat label="State" value={!rider.loc ? 'Waiting' : rider.stale ? 'No signal' : rider.moving ? 'Moving' : 'Stopped'} />
          <Stat label="Distance" value={straight != null ? formatDistance(straight) : '–'} />
        </View>
        {!isMe && relative && <Text style={[styles.line, { color: theme.text }]}>{relative}</Text>}
        {!isMe && eta && <Text style={[styles.line, { color: theme.textSecondary }]}>{eta}</Text>}
        {rider.loc?.offRoute && (
          <View style={styles.statusRow}>
            <Icon icon={LuTriangleAlert} size={13} color={theme.text} />
            <Text style={[styles.line, { color: theme.text }]}>Off the group route</Text>
          </View>
        )}

        {!isMe && (
          <View style={styles.actions}>
            {rider.phone && (
              <Button
                label="Call"
                icon={LuPhone}
                onPress={() => Linking.openURL(`tel:${rider.phone}`)}
                style={styles.flex}
              />
            )}
            {target && (
              <Button
                label={sos ? 'Ride to them' : 'Navigate to'}
                icon={LuNavigation}
                variant={sos ? 'danger' : 'inverse'}
                onPress={() => onNavigate({ ...target, name: rider.name })}
                style={styles.flex}
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  card: {
    padding: 16,
    paddingBottom: 28,
    borderTopLeftRadius: Size.radiusLg,
    borderTopRightRadius: Size.radiusLg,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: Type.small },
  name: { fontSize: Type.title, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  status: { fontSize: Type.small, fontWeight: '500' },
  stats: { flexDirection: 'row', borderRadius: Size.radius, paddingVertical: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: Type.body, fontWeight: '700' },
  statLabel: { fontSize: Type.tiny, marginTop: 1 },
  line: { fontSize: Type.small, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  flex: { flex: 1 },
});
