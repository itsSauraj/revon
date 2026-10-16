import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  LuChevronLeft,
  LuFlag,
  LuLocateFixed,
  LuLock,
  LuNavigation,
  LuScan,
  LuShare2,
  LuUsers,
} from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type MapRef, MapView, Polyline, PROVIDER_GOOGLE } from '@/components/map/map-view';
import { NavBar } from '@/components/nav/nav-bar';
import { StepsSheet } from '@/components/nav/steps-sheet';
import { AlertBanners } from '@/components/ride/alert-banner';
import { MemberCard } from '@/components/ride/member-card';
import { MemberMarker } from '@/components/ride/member-marker';
import { PlaceMarker } from '@/components/ride/place-marker';
import { RidePanel } from '@/components/ride/ride-panel';
import { SosButton } from '@/components/ride/sos-button';
import { Button } from '@/components/ui/button';
import { CompassButton, isRotated } from '@/components/ui/compass-button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
import { useMapHeading } from '@/hooks/use-map-heading';
import { useRide } from '@/hooks/use-ride';
import { type Fix, useRouteFollow } from '@/hooks/use-route-follow';
import { useTheme } from '@/hooks/use-theme';
import { clearBanners, setupNotifications } from '@/lib/alerts';
import { confirmAction, shareText } from '@/lib/dialog';
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
  const map = useRef<MapRef>(null);

  const [myPos, setMyPos] = useState<Fix | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const nav = useRouteFollow(map, myPos, ride.meta?.avoid);
  const compass = useMapHeading(map);
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
    shareText(`Join my revon group ride to ${ride.meta.destination.name}.\nCode: ${ride.meta.code}\n${link}`);
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

  // Banner tap: centre the map on that rider and open their card.
  const focusRider = (riderUid: string) => {
    const r = ride.riders.find((x) => x.uid === riderUid);
    if (r?.loc) {
      if (nav.active) nav.pause();
      map.current?.animateToRegion({ latitude: r.loc.lat, longitude: r.loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    }
    setSelected(riderUid);
  };
  const selectedRider = useMemo(() => ride.riders.find((r) => r.uid === selected) ?? null, [ride.riders, selected]);

  if (!uid || !id) return null;

  if (!ride.loaded) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  if (!ride.meta || !ride.isMember) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.msg, { color: theme.text }]}>
          {ride.meta ? "You're not in this ride." : 'This ride no longer exists.'}
        </Text>
        <Button label="Back to map" variant="inverse" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const meta = ride.meta;
  const me = ride.me!;
  const sosActive = me.status === 'sos';

  const leave = async () => {
    const ok = await confirmAction({
      title: 'Leave this ride?',
      message: 'Your group will stop seeing your location.',
      confirmText: 'Leave',
      destructive: true,
    });
    if (!ok) return;
    await stopTracking({ keepContext: false });
    await leaveRide(id, uid).catch(() => {});
    router.replace('/');
  };

  const regroupAt = async (p: LatLng, label: string) => {
    const ok = await confirmAction({
      title: 'Set regroup point?',
      message: 'Everyone will see this pin and their distance to it.',
      confirmText: 'Set',
    });
    if (ok) setRegroup(id, uid, p.latitude, p.longitude, label).catch(() => {});
  };

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
        // In the ride view, a larger top inset puts the rider lower on screen to show more road ahead.
        mapPadding={{ top: insets.top + (nav.active ? 220 : 52), right: 0, bottom: panelH, left: 0 }}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (c) setMyPos({ latitude: c.latitude, longitude: c.longitude, heading: c.heading ?? -1, speed: c.speed ?? -1 });
        }}
        onPanDrag={nav.active ? nav.pause : undefined}
        onRegionChangeComplete={compass.onRegionChangeComplete}
        onLongPress={(e) => regroupAt(e.nativeEvent.coordinate, 'Regroup point')}>
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={nav.active ? theme.groupRoute : theme.route}
            strokeWidth={nav.active ? 3 : 5}
          />
        )}
        {nav.active && nav.travelled.length > 1 && (
          <Polyline coordinates={nav.travelled} strokeColor={theme.routeRidden} strokeWidth={6} />
        )}
        {nav.active && nav.ahead.length > 1 && (
          <Polyline coordinates={nav.ahead} strokeColor={theme.route} strokeWidth={6} />
        )}
        {nav.target && nav.target !== meta.destination && (
          <PlaceMarker coordinate={nav.target} icon={LuNavigation} title={nav.target.name} />
        )}
        <PlaceMarker coordinate={meta.destination} icon={LuFlag} title={meta.destination.name} />
        {ride.regroup && (
          <PlaceMarker
            coordinate={{ latitude: ride.regroup.lat, longitude: ride.regroup.lng }}
            icon={LuUsers}
            title={ride.regroup.label}
            description="Tap to clear"
            onCalloutPress={() => clearRegroup(id).catch(() => {})}
          />
        )}
        {ride.riders.map((r) => (
          <MemberMarker key={r.uid} rider={r} isMe={r.uid === uid} onPress={() => setSelected(r.uid)} />
        ))}
      </MapView>

      {nav.active && nav.target ? (
        <NavBar
          targetName={nav.target.name}
          remainingM={nav.remainingM}
          remainingS={nav.remainingS}
          loading={nav.loading}
          error={nav.error}
          offRoute={nav.offRoute}
          arrived={nav.arrived}
          onSteps={() => setShowSteps(true)}
          onExit={nav.stop}
        />
      ) : (
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={[styles.topPill, { backgroundColor: theme.surface }]}>
            <Icon icon={LuChevronLeft} size={Size.iconSm} color={theme.text} />
            <Text style={[styles.topText, { color: theme.text }]}>Map</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share ride code ${meta.code}`}
            onPress={share}
            style={[styles.topPill, { backgroundColor: theme.surface }]}>
            {meta.locked && <Icon icon={LuLock} size={13} color={theme.textSecondary} />}
            <Text style={[styles.topText, { color: theme.text }]}>{meta.code}</Text>
            <Icon icon={LuShare2} size={13} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}

      <AlertBanners
        top={insets.top + (nav.active ? 96 : 54)}
        onPress={(b) => b.uid && b.uid !== uid && focusRider(b.uid)}
      />

      {/* Floating controls above the panel */}
      <View style={[styles.sos, { bottom: panelH + 12 }]}>
        <SosButton
          active={sosActive}
          onTrigger={() => setStatus(id, uid, 'sos').catch(() => {})}
          onClear={() => clearSos(id, uid).catch(() => {})}
        />
      </View>
      <View style={[styles.fabs, { bottom: panelH + 12 }]}>
        {nav.active ? (
          <CompassButton
            heading={compass.heading}
            active={nav.northUp}
            accessibilityLabel={nav.northUp ? 'Switch to heading-up' : 'Switch to north-up'}
            onPress={nav.toggleNorthUp}
          />
        ) : (
          isRotated(compass.heading) && <CompassButton heading={compass.heading} onPress={compass.resetNorth} />
        )}
        <IconButton
          icon={LuScan}
          variant="map"
          floating
          accessibilityLabel="Show the whole group"
          onPress={() => {
            if (nav.active) nav.pause();
            fitAll();
          }}
        />
        {nav.active ? (
          !nav.following && (
            <IconButton
              icon={LuLocateFixed}
              variant="map"
              floating
              accessibilityLabel="Re-centre and follow me"
              onPress={nav.recenter}
            />
          )
        ) : (
          <>
            <IconButton
              icon={LuLocateFixed}
              variant="map"
              floating
              accessibilityLabel="Show my location"
              onPress={() => myPos && map.current?.animateToRegion({ ...myPos, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500)}
            />
            <IconButton
              icon={LuNavigation}
              variant="map"
              floating
              accessibilityLabel="Ride to the destination"
              onPress={() => nav.start(meta.destination)}
            />
          </>
        )}
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
          onNavigate={(to) => {
            setSelected(null);
            nav.start(to);
          }}
        />
      )}

      {showSteps && nav.target && (
        <StepsSheet
          steps={nav.route?.steps ?? []}
          onClose={() => setShowSteps(false)}
          onOpenGoogleMaps={() => nav.target && openGoogleMapsNav(nav.target)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  msg: { fontSize: Type.body, fontWeight: '600', textAlign: 'center' },
  topBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  topPill: {
    height: Size.controlSm,
    paddingHorizontal: 12,
    borderRadius: Size.controlSm / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  topText: { fontSize: Type.small + 1, fontWeight: '700', letterSpacing: 0.3 },
  sos: { position: 'absolute', left: 14 },
  fabs: { position: 'absolute', right: 14, gap: 10, alignItems: 'center' },
  panelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
