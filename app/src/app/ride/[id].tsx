import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertBanners } from '@/components/ride/alert-banner';
import { Fab } from '@/components/ride/fab';
import { MemberCard } from '@/components/ride/member-card';
import { MemberMarker } from '@/components/ride/member-marker';
import { RidePanel } from '@/components/ride/ride-panel';
import { SosButton } from '@/components/ride/sos-button';
import { useRide } from '@/hooks/use-ride';
import { useTheme } from '@/hooks/use-theme';
import { clearBanners, setupNotifications } from '@/lib/alerts';
import { openGoogleMapsNav } from '@/lib/google';
import { getActiveRideId, isTracking, startTracking, stopTracking, type TrackingMode } from '@/lib/location-task';
import {
  clearRegroup,
  clearSos,
  leaveRide,
  setLocked,
  setRegroup,
  setRole,
  setStatus,
} from '@/lib/rides';
import { useSession } from '@/lib/session';
import type { LatLng } from '@/lib/types';

export default function RideScreen() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { uid } = useSession();
  const ride = useRide(id, uid);
  const map = useRef<MapView>(null);

  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [panelH, setPanelH] = useState(220);
  const [tracking, setTracking] = useState<TrackingMode | null>(null);
  const invited = useRef(false);
  const fitted = useRef(false);

  useEffect(() => {
    setupNotifications().catch(() => {});
    return () => clearBanners();
  }, []);

  // Resume tracking if the app was restarted mid-ride (unless this rider has already arrived).
  useEffect(() => {
    if (!ride.meta || !uid || !ride.me || ride.me.status === 'arrived') return;
    let cancelled = false;
    (async () => {
      const sameRide = (await getActiveRideId()) === id;
      if (sameRide && (await isTracking())) {
        if (!cancelled) setTracking('background');
        return;
      }
      const mode = await startTracking({
        rideId: id,
        uid,
        polyline: ride.meta!.route?.polyline ?? null,
        destination: ride.meta!.destination,
      });
      if (!cancelled) setTracking(mode);
    })();
    return () => {
      cancelled = true;
    };
    // Run once the ride and my membership have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(ride.meta), Boolean(ride.me), id, uid]);

  const share = () => {
    if (!ride.meta) return;
    const link = Linking.createURL(`join/${ride.meta.code}`);
    Share.share({
      message: `Join my revon group ride to ${ride.meta.destination.name}.\nCode: ${ride.meta.code}\n${link}`,
    }).catch(() => {});
  };

  // Offer the invite sheet once, right after creating a ride.
  useEffect(() => {
    if (invite === '1' && ride.meta && !invited.current) {
      invited.current = true;
      share();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, ride.meta]);

  const fitAll = () => {
    const pts: LatLng[] = ride.riders
      .filter((r) => r.loc)
      .map((r) => ({ latitude: r.loc!.lat, longitude: r.loc!.lng }));
    if (ride.meta) pts.push(ride.meta.destination);
    if (pts.length) {
      map.current?.fitToCoordinates(pts, {
        edgePadding: { top: insets.top + 120, right: 80, bottom: panelH + 40, left: 80 },
        animated: true,
      });
    }
  };

  // Frame the group the first time positions arrive.
  const located = ride.riders.filter((r) => r.loc).length;
  useEffect(() => {
    if (!fitted.current && located > 0 && ride.meta) {
      fitted.current = true;
      fitAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located, ride.meta]);

  const routeCoords = ride.route;
  const selectedRider = useMemo(() => ride.riders.find((r) => r.uid === selected) ?? null, [ride.riders, selected]);

  if (!uid || !id) return null;

  if (!ride.loaded) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!ride.meta || !ride.isMember) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.msg, { color: theme.text }]}>
          {ride.meta ? "You're not in this ride." : 'This ride no longer exists.'}
        </Text>
        <Pressable onPress={() => router.replace('/')} style={[styles.homeBtn, { backgroundColor: theme.primary }]}>
          <Text style={styles.homeBtnText}>Back to map</Text>
        </Pressable>
      </View>
    );
  }

  const meta = ride.meta;
  const me = ride.me!;
  const sosActive = me.status === 'sos';

  const leave = () =>
    Alert.alert('Leave this ride?', 'Your group will stop seeing your location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await stopTracking({ keepContext: false });
          await leaveRide(id, uid).catch(() => {});
          router.replace('/');
        },
      },
    ]);

  const regroupAt = (p: LatLng, label: string) =>
    Alert.alert('Set regroup point?', 'Everyone will see this pin and their distance to it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Set', onPress: () => setRegroup(id, uid, p.latitude, p.longitude, label).catch(() => {}) },
    ]);

  const trackingNote =
    tracking === 'denied'
      ? 'Location permission is off: your group cannot see you.'
      : tracking === 'foreground-only'
        ? 'Background tracking unavailable: keep revon open to share your location.'
        : me.status === 'arrived'
          ? 'You have arrived. Location sharing has stopped.'
          : null;

  return (
    <View style={styles.screen}>
      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...meta.destination, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        mapPadding={{ top: insets.top + 60, right: 0, bottom: panelH, left: 0 }}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (c) setMyPos({ latitude: c.latitude, longitude: c.longitude });
        }}
        onLongPress={(e) => regroupAt(e.nativeEvent.coordinate, 'Regroup point')}>
        {routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor={theme.primary} strokeWidth={6} />
        )}
        <Marker coordinate={meta.destination} title={meta.destination.name} pinColor="#30A46C" />
        {ride.regroup && (
          <Marker
            coordinate={{ latitude: ride.regroup.lat, longitude: ride.regroup.lng }}
            title={ride.regroup.label}
            description="Tap to clear"
            pinColor="#FFB224"
            onCalloutPress={() => clearRegroup(id).catch(() => {})}
          />
        )}
        {ride.riders.map((r) => (
          <MemberMarker key={r.uid} rider={r} isMe={r.uid === uid} onPress={() => setSelected(r.uid)} />
        ))}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.topPill, { backgroundColor: theme.surface }]}>
          <Text style={[styles.topText, { color: theme.text }]}>‹ Map</Text>
        </Pressable>
        <Pressable onPress={share} style={[styles.topPill, { backgroundColor: theme.surface }]}>
          <Text style={[styles.topText, { color: theme.text }]}>
            {meta.locked ? '🔒 ' : ''}Code {meta.code}
          </Text>
        </Pressable>
      </View>

      <AlertBanners onPress={(b) => b.uid && b.uid !== uid && setSelected(b.uid)} />

      {/* Floating controls above the panel */}
      <View style={[styles.sos, { bottom: panelH + 16 }]}>
        <SosButton
          active={sosActive}
          onTrigger={() => setStatus(id, uid, 'sos').catch(() => {})}
          onClear={() => clearSos(id, uid).catch(() => {})}
        />
      </View>
      <View style={[styles.fabs, { bottom: panelH + 16 }]}>
        <Fab label="⤢" accessibilityLabel="Show whole group" onPress={fitAll} />
        <Fab
          label="◎"
          accessibilityLabel="Show my location"
          onPress={() => myPos && map.current?.animateToRegion({ ...myPos, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500)}
        />
        <Fab
          label="🧭"
          variant="primary"
          accessibilityLabel="Navigate to destination in Google Maps"
          onPress={() => openGoogleMapsNav(meta.destination)}
        />
      </View>

      <View onLayout={(e) => setPanelH(e.nativeEvent.layout.height)} style={styles.panelWrap} pointerEvents="box-none">
        <RidePanel
          meta={meta}
          riders={ride.riders}
          myUid={uid}
          myStatus={me.status}
          myRole={me.role}
          gapM={ride.gapM}
          trackingNote={trackingNote}
          onStatus={(s) => setStatus(id, uid, s).catch(() => {})}
          onRole={(r) => setRole(id, uid, r, ride.members).catch(() => {})}
          onRiderPress={setSelected}
          onInvite={share}
          onToggleLock={() => setLocked(id, uid, !meta.locked).catch(() => {})}
          onRegroupHere={() => myPos && regroupAt(myPos, `Regroup at ${me.name}`)}
          onLeave={leave}
        />
      </View>

      {selectedRider && (
        <MemberCard
          rider={selectedRider}
          myPosition={myPos}
          isMe={selectedRider.uid === uid}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  msg: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  homeBtn: { height: 52, paddingHorizontal: 28, borderRadius: 26, justifyContent: 'center' },
  homeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  topBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  topPill: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  topText: { fontSize: 16, fontWeight: '800' },
  sos: { position: 'absolute', left: 16 },
  fabs: { position: 'absolute', right: 16, gap: 12 },
  panelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
