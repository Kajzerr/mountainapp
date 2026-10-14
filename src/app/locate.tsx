import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Region } from 'react-native-maps';
import { TrailMap } from '../components/TrailMap';
import type { GeoPoint } from '../lib/exif';
import { TATRY_REGION } from '../lib/mapConfig';
import { parseIds } from '../lib/params';
import { photoUri } from '../lib/photoFiles';
import { hasLocation, type Photo } from '../lib/photoModel';
import { usePhotos } from '../lib/photos';
import { useT } from '../lib/settings';
import { fonts, useColors } from '../lib/theme';

const MAX_THUMBS = 5;

/**
 * Ręczne ustawienie miejsca zdjęć (gdy plik nie ma GPS albo GPS się pomylił).
 * Użytkownik przesuwa mapę pod stałą pinezką na środku. Parametr: ids – id zdjęć po przecinku.
 */
export default function LocateScreen() {
  const colors = useColors();
  const t = useT();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { byId, setLocation } = usePhotos();
  const photos = useMemo(
    () => parseIds(ids).map((id) => byId.get(id)).filter((p): p is Photo => !!p),
    [ids, byId],
  );

  // Start: dotychczasowe miejsce zdjęcia (zmiana lokalizacji) albo całe Tatry
  const [initialRegion] = useState<Region>(() => {
    const known = photos.find(hasLocation);
    return known
      ? { latitude: known.latitude, longitude: known.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      : TATRY_REGION;
  });
  const [center, setCenter] = useState<GeoPoint>({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });

  const confirm = () => {
    setLocation(photos.map((p) => p.id), center);
    router.back();
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.flex}>
        <TrailMap
          initialRegion={initialRegion}
          onRegionChangeComplete={(r) => setCenter({ latitude: r.latitude, longitude: r.longitude })}
        />
        {/* Pinezka: czubek ikony dokładnie w środku mapy (środek regionu mapy) */}
        <View style={styles.pinWrap} pointerEvents="none">
          <Ionicons name="location" size={44} color={colors.accent} style={styles.pin} />
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.thumbs}>
          {photos.slice(0, MAX_THUMBS).map((p) => (
            <Image key={p.id} source={{ uri: photoUri(p.file) }} style={styles.thumb} contentFit="cover" />
          ))}
          {photos.length > MAX_THUMBS && (
            <Text style={[styles.more, { color: colors.textSecondary }]}>+{photos.length - MAX_THUMBS}</Text>
          )}
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {photos.length === 1 ? t.locate.hintOne : t.locate.hint}
        </Text>
        <Pressable
          onPress={confirm}
          disabled={photos.length === 0}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent, opacity: photos.length === 0 ? 0.4 : pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: colors.accentText }]}>{t.locate.confirm}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pinWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // Ikona 44 pt ma czubek na dole – podnosimy ją o połowę wysokości
  pin: { transform: [{ translateY: -22 }] },
  panel: { padding: 16, paddingBottom: 32, gap: 12 },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: { width: 40, height: 40, borderRadius: 8 },
  more: { fontFamily: fonts.medium, fontSize: 14, marginLeft: 4 },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
});
