import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { formatDay } from '../lib/dates';
import { photoUri } from '../lib/photoFiles';
import type { Photo } from '../lib/photoModel';
import type { Place } from '../lib/places';
import { useT } from '../lib/settings';
import { fonts, useColors } from '../lib/theme';

type Props = { place: Place; cover: Photo; onPress: () => void };

/** Znacznik miejsca na mapie: miniatura pierwszego zdjęcia + liczba zdjęć. */
export function PhotoMarker({ place, cover, onPress }: Props) {
  const colors = useColors();
  const t = useT();
  // Znacznik z własnym widokiem trzeba odświeżać, dopóki miniatura się nie wczyta – potem wyłączamy (wydajność)
  const [tracks, setTracks] = useState(true);
  const count = place.photoIds.length;

  return (
    <Marker
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      onPress={onPress}
      accessibilityLabel={t.map.placeA11y(count, formatDay(cover.takenAt))}
    >
      <View style={styles.box}>
        <View style={[styles.frame, { borderColor: colors.accent, backgroundColor: colors.card }]}>
          <Image
            source={{ uri: photoUri(cover.file) }}
            style={styles.thumb}
            contentFit="cover"
            onLoad={() => setTracks(false)}
            onError={() => setTracks(false)}
          />
        </View>
        {count > 1 && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.accentText }]}>{count}</Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  // Odznaka musi mieścić się w obrysie – Android przycina widok znacznika
  box: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 46, height: 46, borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute', top: 0, right: 0, minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 12 },
});
