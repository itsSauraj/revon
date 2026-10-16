import * as Location from 'expo-location';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  LuLocateFixed,
  LuMapPin,
  LuNavigation,
  LuRoute,
  LuSearch,
  LuUserPlus,
  LuUsers,
  LuX,
} from 'react-icons/lu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type MapRef, MapView, Polyline, PROVIDER_GOOGLE } from '@/components/map/map-view';
import { NavBar } from '@/components/nav/nav-bar';
import { StepsSheet } from '@/components/nav/steps-sheet';
import { PlaceMarker } from '@/components/ride/place-marker';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { CompassButton, isRotated } from '@/components/ui/compass-button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Size, Type } from '@/constants/theme';
import { useMapHeading } from '@/hooks/use-map-heading';
import { type Fix, useRouteFollow } from '@/hooks/use-route-follow';
import { useTheme } from '@/hooks/use-theme';
import { showMessage } from '@/lib/dialog';
import { decodePolyline, formatDistance, formatDuration } from '@/lib/geo';
import {
  computeRoute,
  newSessionToken,
  openGoogleMapsNav,
  placeDetails,
  placesAutocomplete,
  type Route,
  type Suggestion,
} from '@/lib/google';
import { getActiveRideId, startTracking } from '@/lib/location-task';
import { createRide } from '@/lib/rides';
import { useSession } from '@/lib/session';
import type { Place } from '@/lib/types';

const FALLBACK_REGION = { latitude: 20, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };

export default function MapHome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, uid, error: sessionError } = useSession();
  const map = useRef<MapRef>(null);

  const [me, setMe] = useState<Fix | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchToken, setSearchToken] = useState(newSessionToken);
  const [destination, setDestination] = useState<Place | null>(null);
  const [avoid, setAvoid] = useState({ highways: false, tolls: false });
  const nav = useRouteFollow(map, me, avoid);
  const compass = useMapHeading(map);
  // The route is stored with the request it answers, so a stale result is never shown.
  const routeKey = destination ? `${destination.latitude},${destination.longitude}|${avoid.highways}|${avoid.tolls}` : null;
  const [routeResult, setRouteResult] = useState<{ key: string; route: Route | null } | null>(null);
  const route = routeResult && routeResult.key === routeKey ? routeResult.route : null;
  const routing = Boolean(routeKey && me && routeResult?.key !== routeKey);
  const [starting, setStarting] = useState(false);
  const [activeRide, setActiveRide] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getActiveRideId().then(setActiveRide);
    }, []),
  );

  // Locate the rider once and centre the map on them.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMe({ ...p, heading: pos.coords.heading ?? -1, speed: pos.coords.speed ?? -1 });
      map.current?.animateToRegion({ ...p, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
    })().catch(() => {});
  }, []);

  // Debounced autocomplete.
  const searching = query.trim().length >= 2 && !destination;
  const visibleSuggestions = searching ? suggestions : [];
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => {
      placesAutocomplete(query, me, searchToken).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
    // `me` only biases results; don't re-query on every GPS update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searching, searchToken]);

  // Route from the rider to the destination; recomputed when avoid options change.
  useEffect(() => {
    if (!destination || !me || !routeKey) return;
    let cancelled = false;
    computeRoute(me, destination, avoid)
      .then((r) => {
        if (cancelled) return;
        setRouteResult({ key: routeKey, route: r });
        if (r) {
          map.current?.fitToCoordinates(decodePolyline(r.polyline), {
            edgePadding: { top: 160, right: 60, bottom: 360, left: 60 },
            animated: true,
          });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setRouteResult({ key: routeKey, route: null });
        showMessage('Could not get a route', String(e));
      });
    return () => {
      cancelled = true;
    };
    // Recompute when the request changes or our position first becomes known, not on GPS jitter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, me === null]);

  const routeCoords = useMemo(() => (route ? decodePolyline(route.polyline) : []), [route]);

  if (!profile) return <Redirect href="/onboarding" />;

  const choose = async (s: Suggestion) => {
    Keyboard.dismiss();
    setSuggestions([]);
    try {
      const place = await placeDetails(s.placeId, searchToken);
      setSearchToken(newSessionToken());
      setQuery(place.name);
      setDestination(place);
    } catch (e) {
      showMessage('Could not load place', String(e));
    }
  };

  const clear = () => {
    setQuery('');
    setDestination(null);
    setSuggestions([]);
  };

  const startGroupRide = async () => {
    if (!destination || !uid) return;
    setStarting(true);
    try {
      const { rideId } = await createRide({
        uid,
        profile,
        destination,
        route: route ?? null,
        avoid,
      });
      await startTracking({ rideId, uid, polyline: route?.polyline ?? null, destination });
      clear();
      router.push({ pathname: '/ride/[id]', params: { id: rideId, invite: '1' } });
    } catch (e) {
      showMessage('Could not start the ride', String(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={FALLBACK_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        mapPadding={{
          top: insets.top + (nav.active ? 220 : 60),
          right: 0,
          bottom: nav.active ? 32 : destination ? 250 : 70,
          left: 0,
        }}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (c) setMe({ latitude: c.latitude, longitude: c.longitude, heading: c.heading ?? -1, speed: c.speed ?? -1 });
        }}
        onPanDrag={nav.active ? nav.pause : undefined}
        onRegionChangeComplete={compass.onRegionChangeComplete}
        onLongPress={(e) => {
          if (nav.active) return;
          const c = e.nativeEvent.coordinate;
          const place = { ...c, name: 'Dropped pin' };
          setQuery(place.name);
          setDestination(place);
        }}>
        {destination && <PlaceMarker coordinate={destination} icon={LuMapPin} title={destination.name} />}
        {nav.active ? (
          <>
            {nav.travelled.length > 1 && (
              <Polyline coordinates={nav.travelled} strokeColor={theme.routeRidden} strokeWidth={6} />
            )}
            {nav.ahead.length > 1 && <Polyline coordinates={nav.ahead} strokeColor={theme.route} strokeWidth={6} />}
          </>
        ) : (
          routeCoords.length > 1 && <Polyline coordinates={routeCoords} strokeColor={theme.route} strokeWidth={5} />
        )}
      </MapView>

      {nav.active && nav.target && (
        <>
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
          <View style={[styles.mapButtons, { bottom: 24 }]}>
            <CompassButton
              heading={compass.heading}
              active={nav.northUp}
              accessibilityLabel={nav.northUp ? 'Switch to heading-up' : 'Switch to north-up'}
              onPress={nav.toggleNorthUp}
            />
            {!nav.following && (
              <IconButton
                icon={LuLocateFixed}
                variant="map"
                floating
                accessibilityLabel="Re-centre and follow me"
                onPress={nav.recenter}
              />
            )}
          </View>
          {showSteps && (
            <StepsSheet
              steps={nav.route?.steps ?? []}
              onClose={() => setShowSteps(false)}
              onOpenGoogleMaps={() => nav.target && openGoogleMapsNav(nav.target)}
            />
          )}
        </>
      )}

      {!nav.active && (
        <>
          {/* Search */}
          <View style={[styles.searchWrap, { top: insets.top + 8 }]}>
            <View style={[styles.search, { backgroundColor: theme.surface }]}>
              <Icon icon={LuSearch} size={Size.iconSm} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  if (destination) setDestination(null);
                }}
                placeholder="Where are you riding to?"
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <IconButton icon={LuX} variant="ghost" size={28} accessibilityLabel="Clear search" onPress={clear} />
              )}
            </View>
            {visibleSuggestions.length > 0 && (
              <FlatList
                data={visibleSuggestions}
                keyExtractor={(s) => s.placeId}
                keyboardShouldPersistTaps="handled"
                style={[styles.suggestions, { backgroundColor: theme.surface }]}
                renderItem={({ item }) => (
                  <Pressable onPress={() => choose(item)} style={[styles.suggestion, { borderBottomColor: theme.border }]}>
                    <Icon icon={LuMapPin} size={Size.iconSm} color={theme.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sMain, { color: theme.text }]} numberOfLines={1}>
                        {item.main}
                      </Text>
                      {!!item.secondary && (
                        <Text style={[styles.sSecondary, { color: theme.textSecondary }]} numberOfLines={1}>
                          {item.secondary}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                )}
              />
            )}
            {sessionError && (
              <Text style={[styles.error, { backgroundColor: theme.inverse, color: theme.onInverse }]}>{sessionError}</Text>
            )}
          </View>

          <View style={[styles.mapButtons, { bottom: destination ? 262 : 80 }]}>
            {isRotated(compass.heading) && <CompassButton heading={compass.heading} onPress={compass.resetNorth} />}
            <IconButton
              icon={LuLocateFixed}
              variant="map"
              floating
              accessibilityLabel="Show my location"
              onPress={() => me && map.current?.animateToRegion({ ...me, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500)}
            />
          </View>

          {destination ? (
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.destName, { color: theme.text }]} numberOfLines={1}>
                {destination.name}
              </Text>
              {!!destination.address && (
                <Text style={[styles.destAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                  {destination.address}
                </Text>
              )}
              <Text style={[styles.routeLine, { color: theme.text }]}>
                {routing
                  ? 'Finding a route…'
                  : route
                    ? `${formatDuration(route.durationS)} · ${formatDistance(route.distanceM)}`
                    : me
                      ? 'No route found'
                      : 'Waiting for your location…'}
              </Text>
              <View style={styles.avoidRow}>
                <Chip
                  label="Avoid highways"
                  selected={avoid.highways}
                  onPress={() => setAvoid((a) => ({ ...a, highways: !a.highways }))}
                />
                <Chip label="Avoid tolls" selected={avoid.tolls} onPress={() => setAvoid((a) => ({ ...a, tolls: !a.tolls }))} />
              </View>
              <View style={styles.buttons}>
                <Button label="Navigate" icon={LuNavigation} onPress={() => nav.start(destination)} style={styles.flex} />
                <Button
                  label="Start group ride"
                  icon={LuUsers}
                  variant="accent"
                  loading={starting}
                  disabled={!uid}
                  onPress={startGroupRide}
                  style={styles.flex}
                />
              </View>
            </View>
          ) : (
            <View style={styles.bottomPills}>
              {activeRide && (
                <Button
                  label="Back to my ride"
                  icon={LuRoute}
                  variant="accent"
                  onPress={() => router.push({ pathname: '/ride/[id]', params: { id: activeRide } })}
                  style={styles.shadow}
                />
              )}
              <Button
                label="Join a ride"
                icon={LuUserPlus}
                variant="map"
                onPress={() => router.push('/join')}
                style={styles.shadow}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.14,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  shadow,
  searchWrap: { position: 'absolute', left: 12, right: 12 },
  search: {
    height: Size.control,
    borderRadius: Size.control / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: Type.body, height: '100%' },
  suggestions: { marginTop: 6, borderRadius: Size.radius, maxHeight: 300, ...shadow },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sMain: { fontSize: Type.small + 1, fontWeight: '600' },
  sSecondary: { fontSize: Type.tiny + 1, marginTop: 1 },
  error: { marginTop: 6, padding: 8, borderRadius: Size.radius, overflow: 'hidden', fontSize: Type.small },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 20,
    borderTopLeftRadius: Size.radiusLg,
    borderTopRightRadius: Size.radiusLg,
    gap: 4,
    ...shadow,
  },
  destName: { fontSize: Type.title, fontWeight: '700' },
  destAddr: { fontSize: Type.small - 1 },
  routeLine: { fontSize: Type.small + 1, fontWeight: '600', marginTop: 4 },
  avoidRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mapButtons: { position: 'absolute', right: 14, gap: 10, alignItems: 'center' },
  bottomPills: { position: 'absolute', left: 14, right: 14, bottom: 16, gap: 8 },
});
