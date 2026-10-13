import * as Location from 'expo-location';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab } from '@/components/ride/fab';
import { useTheme } from '@/hooks/use-theme';
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
import type { LatLng, Place } from '@/lib/types';

const FALLBACK_REGION = { latitude: 20, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };

export default function MapHome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, uid, error: sessionError } = useSession();
  const map = useRef<MapView>(null);

  const [me, setMe] = useState<LatLng | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchToken, setSearchToken] = useState(newSessionToken);
  const [destination, setDestination] = useState<Place | null>(null);
  const [avoid, setAvoid] = useState({ highways: false, tolls: false });
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
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMe(p);
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
        Alert.alert('Could not get a route', String(e));
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
      Alert.alert('Could not load place', String(e));
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
      Alert.alert('Could not start the ride', String(e));
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
        mapPadding={{ top: insets.top + 70, right: 0, bottom: destination ? 300 : 90, left: 0 }}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (c) setMe({ latitude: c.latitude, longitude: c.longitude });
        }}
        onLongPress={(e) => {
          const c = e.nativeEvent.coordinate;
          const place = { ...c, name: 'Dropped pin' };
          setQuery(place.name);
          setDestination(place);
        }}>
        {destination && <Marker coordinate={destination} title={destination.name} />}
        {routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor={theme.primary} strokeWidth={6} />
        )}
      </MapView>

      {/* Search pill */}
      <View style={[styles.searchWrap, { top: insets.top + 10 }]}>
        <View style={[styles.search, { backgroundColor: theme.surface }]}>
          <Text style={styles.searchIcon}>🔍</Text>
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
            <Pressable onPress={clear} hitSlop={10}>
              <Text style={[styles.clear, { color: theme.textSecondary }]}>✕</Text>
            </Pressable>
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
                <Text style={[styles.sMain, { color: theme.text }]} numberOfLines={1}>{item.main}</Text>
                {!!item.secondary && (
                  <Text style={[styles.sSecondary, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.secondary}
                  </Text>
                )}
              </Pressable>
            )}
          />
        )}
        {sessionError && <Text style={[styles.error, { backgroundColor: theme.danger }]}>{sessionError}</Text>}
      </View>

      {/* My location */}
      <Fab
        label="◎"
        accessibilityLabel="Show my location"
        style={{ position: 'absolute', right: 16, bottom: destination ? 320 : 110 }}
        onPress={() => me && map.current?.animateToRegion({ ...me, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500)}
      />

      {/* Bottom card */}
      {destination ? (
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.destName, { color: theme.text }]} numberOfLines={1}>{destination.name}</Text>
          {!!destination.address && (
            <Text style={[styles.destAddr, { color: theme.textSecondary }]} numberOfLines={1}>{destination.address}</Text>
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
            <AvoidToggle label="Avoid highways" value={avoid.highways} onChange={(v) => setAvoid((a) => ({ ...a, highways: v }))} />
            <AvoidToggle label="Avoid tolls" value={avoid.tolls} onChange={(v) => setAvoid((a) => ({ ...a, tolls: v }))} />
          </View>
          <View style={styles.buttons}>
            <Pressable
              onPress={() => openGoogleMapsNav(destination)}
              style={[styles.btn, { borderColor: theme.border }]}>
              <Text style={[styles.btnText, { color: theme.text }]}>🧭 Navigate</Text>
            </Pressable>
            <Pressable
              disabled={starting || !uid}
              onPress={startGroupRide}
              style={[styles.btn, { backgroundColor: theme.primary, borderColor: theme.primary, opacity: starting || !uid ? 0.6 : 1 }]}>
              {starting ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={[styles.btnText, { color: theme.onPrimary }]}>🏍 Start Group Ride</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.bottomPills}>
          {activeRide && (
            <Pressable
              onPress={() => router.push({ pathname: '/ride/[id]', params: { id: activeRide } })}
              style={[styles.pill, { backgroundColor: theme.success }]}>
              <Text style={[styles.pillText, { color: '#fff' }]}>● Back to my ride</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.push('/join')} style={[styles.pill, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pillText, { color: theme.text }]}>👥 Join a ride</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function AvoidToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.avoid}>
      <Switch value={value} onValueChange={onChange} />
      <Text style={[styles.avoidText, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 6,
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchWrap: { position: 'absolute', left: 12, right: 12 },
  search: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, ...shadow },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 17 },
  clear: { fontSize: 18, paddingLeft: 10 },
  suggestions: { marginTop: 8, borderRadius: 16, maxHeight: 320, ...shadow },
  suggestion: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sMain: { fontSize: 16, fontWeight: '600' },
  sSecondary: { fontSize: 13, marginTop: 2 },
  error: { marginTop: 8, color: '#fff', padding: 10, borderRadius: 10, overflow: 'hidden' },
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 28, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 6, ...shadow },
  destName: { fontSize: 22, fontWeight: '800' },
  destAddr: { fontSize: 14 },
  routeLine: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  avoidRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  avoid: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avoidText: { fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { flex: 1, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '800' },
  bottomPills: { position: 'absolute', left: 16, right: 16, bottom: 24, gap: 10 },
  pill: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', ...shadow },
  pillText: { fontSize: 17, fontWeight: '800' },
});
