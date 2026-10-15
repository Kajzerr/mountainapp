import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { MapPressEvent, Polyline, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapButton } from '../../components/MapButton';
import { PhotoMarker } from '../../components/PhotoMarker';
import { PoiMarker } from '../../components/PoiMarker';
import { PoiSheet } from '../../components/PoiSheet';
import { TrailMap } from '../../components/TrailMap';
import { TripMarker } from '../../components/TripMarker';
import { TripSummary } from '../../components/TripSummary';
import { roleLabel } from '../../components/tripLabels';
import { useImportPhotos } from '../../components/useImportPhotos';
import type { GeoPoint } from '../../lib/exif';
import { TATRY_REGION } from '../../lib/mapConfig';
import { usePhotos } from '../../lib/photos';
import { type Poi, POI_MAX_DELTA, visiblePois } from '../../lib/pois';
import { usePois } from '../../lib/poiStore';
import { useSettings, useT } from '../../lib/settings';
import { fonts, POI_COLORS, useColors } from '../../lib/theme';
import type { TripPoint } from '../../lib/trip';
import { useTrip } from '../../lib/tripStore';

/** Przybliżenie przy pokazywaniu jednego punktu (ok. 2 km wysokości ekranu). */
const CLOSE_DELTA = 0.02;
const FIT_PADDING = { top: 120, right: 70, bottom: 220, left: 70 };

/** Zakładka „Mapa”: szlaki, moja pozycja, zdjęcia, punkty charakterystyczne i planowana trasa. */
export default function MapScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { places, byId, unlocated } = usePhotos();
  const { pois, status: poiStatus, errorDetail, refresh: refreshPois } = usePois();
  const { trip, ordered, route } = useTrip();
  const { settings, setSetting } = useSettings();
  const [locationOn, setLocationOn] = useState(false);
  const [region, setRegion] = useState<Region>(TATRY_REGION);
  const [selected, setSelected] = useState<Poi | null>(null);

  // Pozycję pokazujemy od razu, jeśli zgoda była już dana; o zgodę pytamy dopiero po dotknięciu przycisku
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setLocationOn(p.granted))
      .catch(() => {});
  }, []);

  // Punkty trasy rysujemy osobnymi znacznikami z numerem – nie dublujemy ich kropkami
  const tripIds = useMemo(() => new Set(ordered.map((p) => p.id)), [ordered]);
  const shownPois = useMemo(
    () => visiblePois(pois, region).filter((p) => !tripIds.has(p.id)),
    [pois, region, tripIds],
  );

  const showPoints = useCallback((items: GeoPoint[]) => {
    const map = mapRef.current;
    // Tylko współrzędne – zdjęcia i miejsca mają też inne pola, których mapa nie powinna dostać
    const points = items.map(({ latitude, longitude }) => ({ latitude, longitude }));
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.animateToRegion({ ...points[0], latitudeDelta: CLOSE_DELTA, longitudeDelta: CLOSE_DELTA });
    } else {
      map.fitToCoordinates(points, { edgePadding: FIT_PADDING, animated: true });
    }
  }, []);

  const { busy, pick } = useImportPhotos(showPoints);

  const showMyLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t.map.locationDeniedTitle, t.map.locationDeniedText, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.map.openSettings, onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      setLocationOn(true);
      // Ostatnia znana pozycja jest natychmiast; dokładną pobieramy tylko, gdy jej brak
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      showPoints([{ latitude: pos.coords.latitude, longitude: pos.coords.longitude }]);
    } catch (e) {
      console.warn('Location failed', e);
    }
  };

  const selectPoint = useCallback((p: Poi | TripPoint) => setSelected(p), []);
  // Dotknięcie pustej mapy zamyka kartę punktu (dotknięcie znacznika też przychodzi tu – pomijamy je)
  const onMapPress = (e: MapPressEvent) => {
    if (e.nativeEvent.action !== 'marker-press') setSelected(null);
  };

  const routeLine = route.status === 'ready' ? route.points : null;
  const zoomedOut = region.latitudeDelta > POI_MAX_DELTA;

  return (
    <View style={styles.flex}>
      <TrailMap mapRef={mapRef} showsUserLocation={locationOn} onRegionChangeComplete={setRegion} onPress={onMapPress}>
        {routeLine && (
          <Polyline
            coordinates={routeLine.map(({ latitude, longitude }) => ({ latitude, longitude }))}
            strokeColor={POI_COLORS.route}
            strokeWidth={5}
            lineDashPattern={route.status === 'ready' && !route.exact ? [12, 8] : undefined}
            zIndex={2}
          />
        )}
        {shownPois.map((poi) => (
          <PoiMarker key={poi.id} poi={poi} selected={selected?.id === poi.id} onPress={selectPoint} />
        ))}
        {ordered.map((p, i) => (
          <TripMarker key={p.id} point={p} number={i + 1} label={roleLabel(t, trip, p) ?? ''} onPress={selectPoint} />
        ))}
        {places.map((place) => {
          const cover = byId.get(place.photoIds[0]);
          if (!cover) return null;
          return (
            <PhotoMarker
              // Nowa okładka albo liczba zdjęć = nowy znacznik (react-native-maps nie odświeży sam miniatury)
              key={`${place.id}-${place.photoIds.length}`}
              place={place}
              cover={cover}
              onPress={() => router.push({ pathname: '/place', params: { ids: place.photoIds.join(',') } })}
            />
          );
        })}
      </TrailMap>

      <View style={[styles.top, { top: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.flex} pointerEvents="box-none">
          {poiStatus === 'loading' && (
            <View style={[styles.chip, { backgroundColor: colors.card }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.chipText, { color: colors.textSecondary }]}>{t.poi.loading}</Text>
            </View>
          )}
          {poiStatus === 'error' && (
            <Pressable onPress={refreshPois} style={[styles.chip, { backgroundColor: colors.card }]} accessibilityRole="button">
              <View style={styles.flexShrink}>
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                  {t.poi.error} <Text style={{ color: colors.accent }}>{t.poi.retry}</Text>
                </Text>
                {/* Przyczyna techniczna (np. HTTP 429) – pomaga ustalić, który serwer i dlaczego odmawia */}
                {errorDetail && (
                  <Text style={[styles.detail, { color: colors.textTertiary }]} numberOfLines={4}>
                    {errorDetail}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
          {poiStatus === 'ready' && zoomedOut && ordered.length === 0 && (
            <View style={[styles.chip, { backgroundColor: colors.card }]} pointerEvents="none">
              <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.chipText, { color: colors.textSecondary }]}>{t.poi.zoomIn}</Text>
            </View>
          )}
        </View>
        <View style={styles.buttons}>
          <MapButton
            icon="layers-outline"
            label={t.map.layer}
            onPress={() => setSetting('mapLayer', settings.mapLayer === 'topo' ? 'standard' : 'topo')}
          />
          <MapButton icon="navigate-outline" label={t.map.myLocation} onPress={showMyLocation} />
          {places.length > 0 && <MapButton icon="images-outline" label={t.map.showAll} onPress={() => showPoints(places)} />}
          {ordered.length > 0 && (
            <MapButton icon="trail-sign-outline" label={t.trip.show} onPress={() => showPoints(routeLine ?? ordered)} />
          )}
        </View>
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
        {selected ? (
          <PoiSheet poi={selected} onClose={() => setSelected(null)} />
        ) : (
          <>
            {ordered.length > 0 && (
              <Pressable
                onPress={() => router.push('/trip')}
                style={({ pressed }) => [styles.tripBar, { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={t.trip.open}
              >
                <Ionicons name="trail-sign-outline" size={22} color={POI_COLORS.route} />
                <View style={styles.flex}>
                  <TripSummary route={route} pointCount={ordered.length} />
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
            <View style={styles.bottomRow} pointerEvents="box-none">
              {unlocated.length > 0 ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/locate', params: { ids: unlocated.map((p) => p.id).join(',') } })}
                  style={({ pressed }) => [styles.banner, { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="location-outline" size={20} color={colors.accent} />
                  <View style={styles.flex}>
                    <Text style={[styles.bannerTitle, { color: colors.text }]} numberOfLines={1}>
                      {t.photos.noLocationTitle(unlocated.length)}
                    </Text>
                    <Text style={[styles.bannerAction, { color: colors.accent }]}>{t.photos.setOnMap}</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.flex} />
              )}
              <Pressable
                onPress={pick}
                disabled={busy}
                style={({ pressed }) => [styles.fab, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={busy ? t.photos.adding : t.photos.add}
              >
                {busy ? (
                  <ActivityIndicator color={colors.accentText} />
                ) : (
                  <Ionicons name="add" size={30} color={colors.accentText} />
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  buttons: { gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, elevation: 2,
  },
  chipText: { fontFamily: fonts.regular, fontSize: 13, flexShrink: 1 },
  flexShrink: { flexShrink: 1 },
  detail: { fontFamily: fonts.regular, fontSize: 11, marginTop: 4 },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 24, gap: 10 },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  tripBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, elevation: 3 },
  banner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, elevation: 3 },
  bannerTitle: { fontFamily: fonts.semibold, fontSize: 14 },
  bannerAction: { fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
