import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { Rider } from '@/hooks/use-ride';

export const STATUS_ICON: Record<string, string> = {
  fuel: '⛽',
  rest: '☕',
  food: '🍔',
  mechanical: '🔧',
  sos: '🆘',
  arrived: '🏁',
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

type Props = { rider: Rider; isMe: boolean; onPress: () => void };

export function MemberMarker({ rider, isMe, onPress }: Props) {
  const sos = rider.status === 'sos';
  const icon = STATUS_ICON[rider.status];
  const color = sos ? '#E5484D' : rider.stale ? '#8B8D98' : rider.color;

  // Custom marker views are rasterised; only track view changes briefly after something visible
  // changes, otherwise 25 markers re-rendering every frame costs a lot of battery.
  const visualKey = `${color}|${rider.status}|${rider.role}|${rider.name}`;
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
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={tracking}
      zIndex={sos ? 1000 : isMe ? 500 : 100}>
      <View style={styles.wrap}>
        {sos && <View style={styles.sosRing} />}
        <View style={[styles.dot, { backgroundColor: color, borderColor: isMe ? '#111' : '#fff' }]}>
          <Text style={styles.initials}>{initials(rider.name)}</Text>
        </View>
        {icon && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{icon}</Text>
          </View>
        )}
        {rider.role && (
          <View style={[styles.role, { backgroundColor: rider.role === 'lead' ? '#111' : '#555' }]}>
            <Text style={styles.roleText}>{rider.role === 'lead' ? 'LEAD' : 'SWEEP'}</Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  sosRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(229,72,77,0.3)',
    borderWidth: 2,
    borderColor: '#E5484D',
  },
  dot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#fff', fontWeight: '800', fontSize: 14 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12 },
  role: { position: 'absolute', bottom: 0, paddingHorizontal: 4, borderRadius: 4 },
  roleText: { color: '#fff', fontSize: 8, fontWeight: '800' },
});
