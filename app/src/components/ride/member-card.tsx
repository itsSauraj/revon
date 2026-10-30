import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { LuNavigation, LuPhone, LuTriangleAlert, LuX } from 'react-icons/lu';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { SheetModal } from '@/components/ui/sheet';
import { Size, TextStyles } from '@/constants/theme';
import type { Rider } from '@/hooks/use-ride';
import { useTheme } from '@/hooks/use-theme';
import { computeRoute } from '@/lib/directions';
import { formatDistance, formatDuration, formatSpeed, haversine } from '@/lib/geo';
import type { MapSource } from '@/lib/map-source';
import type { LatLng, Place } from '@/lib/types';

import { initials, STATUS_META } from './status';

type Props = {
  /** The rider to show; null closes the card. Keep the component mounted and flip this. */
  rider: Rider | null;
  myPosition: LatLng | null;
  isMe: boolean;
  onClose: () => void;
  /** Opens the in-app ride view towards this rider. */
  onNavigate: (to: Place) => void;
  /** Routing source for the road ETA: the ride's, so it matches the map it is shown on. */
  source?: MapSource;
};

/** Modal sheet for one rider: status, live stats, call and navigate. */
export function MemberCard({ rider, myPosition, isMe, onClose, onNavigate, source }: Props) {
  const theme = useTheme();
  const [etaFor, setEtaFor] = useState<{ uid: string; text: string } | null>(null);
  // The sheet animates out after `rider` is cleared, so keep showing the last rider until it has.
  const [shown, setShown] = useState(rider ? { rider, isMe } : null);
  if (rider && (rider !== shown?.rider || isMe !== shown.isMe)) setShown({ rider, isMe });

  // Road ETA is fetched only when a card is opened, not continuously for every rider.
  const target = rider?.loc ? { latitude: rider.loc.lat, longitude: rider.loc.lng } : null;
  useEffect(() => {
    if (!rider || !target || !myPosition || isMe) return;
    const uid = rider.uid;
    let cancelled = false;
    computeRoute(myPosition, target, undefined, false, source)
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

  let body = null;
  if (shown) {
    const r = shown.rider;
    const me = shown.isMe;
    const loc = r.loc ? { latitude: r.loc.lat, longitude: r.loc.lng } : null;
    const eta = etaFor && etaFor.uid === r.uid ? etaFor.text : null;
    const straight = loc && myPosition ? haversine(myPosition, loc) : null;
    const relative =
      r.relativeM == null
        ? null
        : Math.abs(r.relativeM) < 50
          ? 'Right beside you'
          : `${formatDistance(r.relativeM)} ${r.relativeM > 0 ? 'ahead of' : 'behind'} you`;
    const sos = r.status === 'sos';
    const meta = STATUS_META[r.status];
    const avatarBg = sos ? theme.danger : r.stale ? theme.stale : me ? theme.me : theme.rider;
    const avatarInk = sos ? theme.onDanger : r.stale ? '#FFFFFF' : me ? theme.meInk : theme.riderInk;

    body = (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={[TextStyles.label, styles.avatarText, { color: avatarInk }]}>{initials(r.name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[TextStyles.title, { color: theme.text }]} numberOfLines={1}>
              {r.name}
              {me ? ' (you)' : ''}
            </Text>
            <View style={styles.statusRow}>
              {meta && <Icon icon={meta.icon} size={13} color={sos ? theme.danger : theme.textSecondary} />}
              <Text style={[TextStyles.small, { color: sos ? theme.danger : theme.textSecondary }]}>
                {meta?.tag ?? 'Riding'}
                {r.role ? ` · ${r.role === 'lead' ? 'Lead' : 'Sweep'}` : ''}
              </Text>
            </View>
          </View>
          <IconButton icon={LuX} variant="ghost" size={Size.controlSm} accessibilityLabel="Close" onPress={onClose} />
        </View>

        <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
          <Stat label="Speed" value={r.loc ? formatSpeed(r.loc.speed) : '–'} />
          <Stat label="State" value={!r.loc ? 'Waiting' : r.stale ? 'No signal' : r.moving ? 'Moving' : 'Stopped'} />
          <Stat label="Distance" value={straight != null ? formatDistance(straight) : '–'} />
        </View>
        {!me && relative && <Text style={[TextStyles.small, styles.line, { color: theme.text }]}>{relative}</Text>}
        {!me && eta && <Text style={[TextStyles.small, styles.line, { color: theme.textSecondary }]}>{eta}</Text>}
        {r.loc?.offRoute && (
          <View style={styles.statusRow}>
            <Icon icon={LuTriangleAlert} size={13} color={theme.text} />
            <Text style={[TextStyles.small, styles.line, { color: theme.text }]}>Off the group route</Text>
          </View>
        )}

        {!me && (
          <View style={styles.actions}>
            {r.phone && (
              <Button label="Call" icon={LuPhone} onPress={() => Linking.openURL(`tel:${r.phone}`)} style={styles.flex} />
            )}
            {loc && (
              <Button
                label={sos ? 'Ride to them' : 'Navigate to'}
                icon={LuNavigation}
                variant={sos ? 'danger' : 'inverse'}
                onPress={() => onNavigate({ ...loc, name: r.name })}
                style={styles.flex}
              />
            )}
          </View>
        )}
      </View>
    );
  }

  // No scroll view inside, so the whole sheet is the drag area.
  return (
    <SheetModal visible={rider !== null} onDismiss={onClose} dragArea="sheet">
      {body}
    </SheetModal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[TextStyles.bodyStrong, { color: theme.text }]}>{value}</Text>
      <Text style={[TextStyles.tiny, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  stats: { flexDirection: 'row', borderRadius: Size.radius, paddingVertical: 8 },
  stat: { flex: 1, alignItems: 'center' },
  line: { fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
});
