import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Marker } from '@/components/map/map-view';
import { Icon } from '@/components/ui/icon';
import type { Rider } from '@/hooks/use-ride';
import { useTheme } from '@/hooks/use-theme';

import { initials, STATUS_META } from './status';

// Fixed layout so the anchor stays on the dot's centre whether or not a tag is shown.
const W = 120;
const TAG_H = 24;
const DOT_AREA = 40;
const NAME_H = 18;
const H = TAG_H + DOT_AREA + NAME_H;
const ANCHOR = { x: 0.5, y: (TAG_H + DOT_AREA / 2) / H };

type Props = { rider: Rider; isMe: boolean; onPress: () => void };

export function MemberMarker({ rider, isMe, onPress }: Props) {
  const theme = useTheme();
  const sos = rider.status === 'sos';
  const meta = STATUS_META[rider.status];
  const fill = sos ? theme.danger : rider.stale ? theme.stale : isMe ? theme.me : theme.rider;
  const ink = sos ? theme.onDanger : rider.stale ? '#FFFFFF' : isMe ? theme.meInk : theme.riderInk;
  const name = isMe ? 'You' : rider.name;
  const nameLabel = rider.stale && rider.status !== 'arrived' ? `${name} · no signal` : name;

  // Custom marker views are rasterised; only track view changes briefly after something visible
  // changes, otherwise 25 markers re-rendering every frame costs a lot of battery.
  // Includes theme colors so markers redraw when the system theme changes.
  const visualKey = `${fill}|${theme.nameBg}|${rider.status}|${rider.role}|${nameLabel}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const tracking = settledKey !== visualKey;
  useEffect(() => {
    const t = setTimeout(() => setSettledKey(visualKey), 600);
    return () => clearTimeout(t);
  }, [visualKey]);

  if (!rider.loc) return null;

  return (
    <Marker
      coordinate={{ latitude: rider.loc.lat, longitude: rider.loc.lng }}
      anchor={ANCHOR}
      onPress={onPress}
      tracksViewChanges={tracking}
      // Riders with a status (stops, SOS) draw above everyone else so they're never hidden.
      zIndex={sos ? 1000 : meta ? 800 : isMe ? 500 : 100}>
      <View style={styles.wrap}>
        <View style={styles.tagArea}>
          {meta && (
            <View style={[styles.tag, { backgroundColor: sos ? theme.danger : theme.rider }]}>
              <Icon icon={meta.icon} size={11} color={sos ? theme.onDanger : theme.riderInk} />
              <Text style={[styles.tagText, { color: sos ? theme.onDanger : theme.riderInk }]} numberOfLines={1}>
                {meta.tag}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.dotArea}>
          {sos && <View style={[styles.sosRing, { borderColor: theme.danger }]} />}
          <View style={[styles.dot, { backgroundColor: fill, borderColor: theme.markerBorder }]}>
            <Text style={[styles.initials, { color: ink }]}>{initials(rider.name)}</Text>
          </View>
          {rider.role && (
            <View style={[styles.role, { backgroundColor: theme.markerBorder }]}>
              <Text style={[styles.roleText, { color: theme.rider }]}>{rider.role === 'lead' ? 'LEAD' : 'SWEEP'}</Text>
            </View>
          )}
        </View>
        <View style={[styles.name, { backgroundColor: theme.nameBg }]}>
          <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
            {nameLabel}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: H, alignItems: 'center' },
  tagArea: { height: TAG_H, justifyContent: 'flex-end', paddingBottom: 3 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    height: 19,
    borderRadius: 10,
    maxWidth: W,
  },
  tagText: { fontSize: 10, fontWeight: '700' },
  dotArea: { height: DOT_AREA, width: DOT_AREA, alignItems: 'center', justifyContent: 'center' },
  sosRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229,72,77,0.25)',
    borderWidth: 1.5,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontWeight: '800', fontSize: 10 },
  role: { position: 'absolute', bottom: 0, paddingHorizontal: 3, borderRadius: 3 },
  roleText: { fontSize: 7, fontWeight: '800' },
  name: {
    height: NAME_H,
    paddingHorizontal: 6,
    borderRadius: 5,
    justifyContent: 'center',
    maxWidth: W,
  },
  nameText: { fontSize: 10, fontWeight: '600' },
});
