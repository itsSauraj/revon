import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  LuLayers,
  LuLocateFixed,
  LuMapPin,
  LuMinus,
  LuNavigation,
  LuPlus,
  LuRoute,
  LuSearch,
  LuUserPlus,
  LuUsers,
  LuX,
} from 'react-icons/lu';
import Animated, { Keyframe, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FADE_IN, FADE_OUT } from '@/components/auth/field-motion';
import { LayersSheet } from '@/components/map/layers-sheet';
import { type MapRef, MapView, Polyline } from '@/components/map/map-view';
import { RouteLine } from '@/components/map/route-line';
import { NavBar } from '@/components/nav/nav-bar';
import { NavPuck } from '@/components/nav/nav-puck';
import { RecenterButton } from '@/components/nav/recenter-button';
import { StepsSheet } from '@/components/nav/steps-sheet';
import { TripCard } from '@/components/nav/trip-card';
import { PlaceMarker } from '@/components/ride/place-marker';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { CompassButton, isRotated } from '@/components/ui/compass-button';
import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { noWebOutline, Size, TextStyles } from '@/constants/theme';
import { useLiveFix } from '@/hooks/use-live-fix';
import { useMapHeading } from '@/hooks/use-map-heading';
import { type Fix, useRouteFollow } from '@/hooks/use-route-follow';
import { useTheme } from '@/hooks/use-theme';
import { centerOn } from '@/lib/camera';
import { showMessage } from '@/lib/dialog';
import { computeRoute, openExternalNav } from '@/lib/directions';
import { decodePolyline, formatDistance, formatDuration } from '@/lib/geo';
import { startTracking } from '@/lib/location-task';
import { useMapSource } from '@/lib/map-source';
import { EASE_OUT, haptic, Timing } from '@/lib/motion';
import { newSessionToken, resolvePlace, searchPlaces } from '@/lib/places';
import { checkActiveRide, createRide } from '@/lib/rides';
import { useSession } from '@/lib/session';
import type { Place, Route, Suggestion } from '@/lib/types';

const FALLBACK_REGION = { latitude: 20, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };

const RISE = 16;
// The destination card is anchored to the bottom edge: it arrives from there and leaves the same way.
// Opacity rides along, so under Reduce Motion (builders skip to the end) the change still reads.
const CARD_IN = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: RISE }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
})
  .duration(Timing.enter.duration)
  .reduceMotion(ReduceMotion.System);
const CARD_OUT = new Keyframe({
  from: { opacity: 1, transform: [{ translateY: 0 }] },
  to: { opacity: 0, transform: [{ translateY: RISE }], easing: EASE_OUT },
})
  .duration(Timing.exit.duration)
  .reduceMotion(ReduceMotion.System);

export default function MapHome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, uid, error: sessionError } = useSession();
  const map = useRef<MapRef>(null);

  // Live fixes from the device; the quick first locate below fills in until the watch delivers.
  const [firstFix, setFirstFix] = useState<Fix | null>(null);
  const live = useLiveFix();
  const me = live ?? firstFix;
  const [showSteps, setShowSteps] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [navH, setNavH] = useState(110);
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

  // A destination or route belongs to the source that produced it and must not be redrawn on the
  // other map, so a source switch (never possible mid-navigation; Settings locks it) clears them.
  const source = useMapSource();
  const prevSource = useRef(source);
  useEffect(() => {
    if (prevSource.current === source) return;
    prevSource.current = source;
    setQuery('');
    setDestination(null);
    setSuggestions([]);
    setRouteResult(null);
  }, [source]);

  useFocusEffect(
    useCallback(() => {
      // Only offer "Back to my ride" for a ride this rider is really still in.
      checkActiveRide(uid).then(setActiveRide).catch(() => setActiveRide(null));
    }, [uid]),
  );

  // Locate the rider once and centre the map on them.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setFirstFix({ ...p, heading: pos.coords.heading ?? -1, speed: pos.coords.speed ?? -1 });
      map.current?.animateToRegion({ ...p, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
    })().catch(() => {});
  }, []);

  // Debounced autocomplete.
  const searching = query.trim().length >= 2 && !destination;
  const visibleSuggestions = searching ? suggestions : [];
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => {
      searchPlaces(query, me, searchToken).then(setSuggestions).catch(() => setSuggestions([]));
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

  // The root layout only shows this screen once the profile is complete.
  if (!profile) return null;

  const choose = async (s: Suggestion) => {
    Keyboard.dismiss();
    setSuggestions([]);
    try {
      const place = await resolvePlace(s, searchToken);
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
      // The ride exists: one light tap as the screen hands over to it.
      haptic.light();
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
        style={StyleSheet.absoluteFill}
        // Read once per mount; a map that remounts after a source switch starts on the rider.
        initialRegion={me ? { latitude: me.latitude, longitude: me.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 } : FALLBACK_REGION}
        // The map's own dot gives way to the navigation puck while riding a route.
        showsUserLocation={!nav.active}
        mapPadding={{
          top: insets.top + (nav.active ? 220 : 60),
          right: 0,
          // Keeps the map logo and attribution above the trip card / destination card / pills.
          bottom: nav.active ? 150 : destination ? 250 : 70,
          left: 0,
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
              <Polyline coordinates={nav.travelled} strokeColor={theme.routeRidden} strokeWidth={6} zIndex={1} />
            )}
            <RouteLine coordinates={nav.ahead} width={6} />
            {/* The arrow points up the screen while following heading-up, and at the real heading otherwise. */}
            {me && <NavPuck coordinate={me} rotation={nav.heading - (nav.following ? nav.cameraHeading : compass.heading)} />}
          </>
        ) : (
          <RouteLine coordinates={routeCoords} />
        )}
      </MapView>

      {nav.active && nav.target && (
        <>
          <NavBar
            targetName={nav.target.name}
            nextTurn={nav.nextTurn}
            remainingM={nav.remainingM}
            remainingS={nav.remainingS}
            loading={nav.loading}
            error={nav.error}
            offRoute={nav.offRoute}
            arrived={nav.arrived}
            onSteps={() => setShowSteps(true)}
            onExit={() => {
              setShowSteps(false);
              nav.stop();
            }}
            onHeight={setNavH}
          />
          {/* Top right, just under the next-turn card. */}
          <View style={[styles.mapButtons, { top: insets.top + 8 + navH + 10 }]}>
            <IconButton
              icon={LuLayers}
              variant="map"
              floating
              accessibilityLabel="Map type and details"
              onPress={() => setShowLayers(true)}
            />
            <CompassButton
              heading={compass.heading}
              active={nav.northUp}
              accessibilityLabel={nav.northUp ? 'Switch to heading-up' : 'Switch to north-up'}
              onPress={nav.toggleNorthUp}
            />
            <IconButton icon={LuPlus} variant="map" floating accessibilityLabel="Zoom in" onPress={() => nav.zoomBy(1)} />
            <IconButton icon={LuMinus} variant="map" floating accessibilityLabel="Zoom out" onPress={() => nav.zoomBy(-1)} />
          </View>
          <View style={styles.tripCard}>
            {!nav.following && <RecenterButton onPress={nav.recenter} />}
            <TripCard from={nav.origin} toName={nav.target.name} toAddress={nav.target.address} />
          </View>
        </>
      )}

      {!nav.active && (
        <>
          {/* Search */}
          <View style={[styles.searchWrap, { top: insets.top + 8 }]}>
            <Glass style={styles.search}>
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
            </Glass>
            {/* The list fades in as one; rows are never animated individually. */}
            {visibleSuggestions.length > 0 && (
              <Animated.View entering={FADE_IN} exiting={FADE_OUT} style={[styles.suggestions, { backgroundColor: theme.surface }]}>
                <FlatList
                  data={visibleSuggestions}
                  keyExtractor={(s) => s.id}
                  keyboardShouldPersistTaps="handled"
                  style={styles.suggestionList}
                  renderItem={({ item }) => (
                    <PressableScale
                      accessibilityLabel={item.secondary ? `${item.main}, ${item.secondary}` : item.main}
                      onPress={() => choose(item)}
                      style={[styles.suggestion, { borderBottomColor: theme.border }]}>
                      <Icon icon={LuMapPin} size={Size.iconSm} color={theme.textSecondary} />
                      <View style={styles.flex}>
                        <Text style={[TextStyles.label, { color: theme.text }]} numberOfLines={1}>
                          {item.main}
                        </Text>
                        {!!item.secondary && (
                          <Text style={[TextStyles.small, { color: theme.textSecondary }]} numberOfLines={1}>
                            {item.secondary}
                          </Text>
                        )}
                      </View>
                    </PressableScale>
                  )}
                />
              </Animated.View>
            )}
            {sessionError && (
              <Animated.Text
                entering={FADE_IN}
                style={[TextStyles.small, styles.error, { backgroundColor: theme.inverse, color: theme.onInverse }]}>
                {sessionError}
              </Animated.Text>
            )}
          </View>

          {/* Top right, under the search bar, so the bottom card and pills never cover it. Fades out
              while suggestions are open. */}
          {visibleSuggestions.length === 0 && (
            <Animated.View
              entering={FADE_IN}
              exiting={FADE_OUT}
              style={[styles.mapButtons, { top: insets.top + 8 + Size.control + 10 }]}>
              <IconButton
                icon={LuLayers}
                variant="map"
                floating
                accessibilityLabel="Map type and details"
                onPress={() => setShowLayers(true)}
              />
              <IconButton
                icon={LuLocateFixed}
                variant="map"
                floating
                accessibilityLabel="Show my location"
                onPress={() => centerOn(map, me)}
              />
              {isRotated(compass.heading) && <CompassButton heading={compass.heading} onPress={compass.resetNorth} />}
            </Animated.View>
          )}

          {destination ? (
            <Animated.View key="destination" entering={CARD_IN} exiting={CARD_OUT} style={styles.cardWrap} pointerEvents="box-none">
              <Glass style={styles.card}>
                <Text style={[TextStyles.title, { color: theme.text }]} numberOfLines={1}>
                  {destination.name}
                </Text>
                {!!destination.address && (
                  <Text style={[TextStyles.small, { color: theme.textSecondary }]} numberOfLines={1}>
                    {destination.address}
                  </Text>
                )}
                <Text style={[TextStyles.label, styles.routeLine, { color: theme.text }]}>
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
              </Glass>
            </Animated.View>
          ) : (
            <Animated.View key="pills" entering={FADE_IN} exiting={FADE_OUT} style={styles.bottomPills} pointerEvents="box-none">
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
                style={styles.glassShadow}
              />
            </Animated.View>
          )}
        </>
      )}

      {/* Modal sheets stay mounted and paint over everything else. */}
      <StepsSheet
        visible={showSteps && nav.active}
        steps={nav.route?.steps ?? []}
        onDismiss={() => setShowSteps(false)}
        onOpenExternal={() => nav.target && openExternalNav(nav.target, nav.target.name)}
      />
      <LayersSheet visible={showLayers} onDismiss={() => setShowLayers(false)} />
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

// Glass surfaces get no Android elevation: the shadow would show through the translucent tint.
const glassShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.14,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  shadow,
  glassShadow,
  searchWrap: { position: 'absolute', left: 12, right: 12 },
  search: {
    height: Size.control,
    borderRadius: Size.control / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    overflow: 'hidden',
    ...glassShadow,
  },
  searchInput: { flex: 1, fontSize: TextStyles.body.fontSize, height: '100%', ...noWebOutline },
  suggestions: { marginTop: 6, borderRadius: Size.radius, ...shadow },
  suggestionList: { maxHeight: 300 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  error: { marginTop: 6, padding: 8, borderRadius: Size.radius, overflow: 'hidden' },
  cardWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  card: {
    padding: 16,
    paddingBottom: 20,
    borderTopLeftRadius: Size.radiusLg + 4,
    borderTopRightRadius: Size.radiusLg + 4,
    overflow: 'hidden',
    gap: 4,
    ...glassShadow,
  },
  routeLine: { marginTop: 4 },
  avoidRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mapButtons: { position: 'absolute', right: 14, gap: 10, alignItems: 'center' },
  bottomPills: { position: 'absolute', left: 14, right: 14, bottom: 16, gap: 8 },
  tripCard: { position: 'absolute', left: 12, right: 12, bottom: 16, gap: 10 },
});
