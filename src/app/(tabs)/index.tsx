import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapButton } from '../../components/MapButton';
import { PhotoMarker } from '../../components/PhotoMarker';
import { TrailMap } from '../../components/TrailMap';
import { useImportPhotos } from '../../components/useImportPhotos';
import type { GeoPoint } from '../../lib/exif';
import { usePhotos } from '../../lib/photos';
import { useSettings, useT } from '../../lib/settings';
import { fonts, useColors } from '../../lib/theme';

/** Przybliżenie przy pokazywaniu jednego punktu (ok. 2 km wysokości ekranu). */
const CLOSE_DELTA = 0.02;
const FIT_PADDING = { top: 120, right: 70, bottom: 170, left: 70 };

/** Zakładka „Mapa”: szlaki, moja pozycja i znaczniki miejsc, w których zrobiono zdjęcia. */
export default function MapScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { places, byId, unlocated } = usePhotos();
  const { settings, setSetting } = useSettings();
  const [locationOn, setLocationOn] = useState(false);

  // Pozycję pokazujemy od razu, jeśli zgoda była już dana; o zgodę pytamy dopiero po dotknięciu przycisku
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setLocationOn(p.granted))
      .catch(() => {});
  }, []);

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

  return (
    <View style={styles.flex}>
      <TrailMap mapRef={mapRef} showsUserLocation={locationOn}>
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

      <View style={[styles.buttons, { top: insets.top + 12 }]}>
        <MapButton
          icon="layers-outline"
          label={t.map.layer}
          onPress={() => setSetting('mapLayer', settings.mapLayer === 'topo' ? 'standard' : 'topo')}
        />
        <MapButton icon="navigate-outline" label={t.map.myLocation} onPress={showMyLocation} />
        {places.length > 0 && (
          <MapButton icon="images-outline" label={t.map.showAll} onPress={() => showPoints(places)} />
        )}
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  buttons: { position: 'absolute', right: 12, gap: 10 },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 24, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  banner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, elevation: 3 },
  bannerTitle: { fontFamily: fonts.semibold, fontSize: 14 },
  bannerAction: { fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
