import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PhotoGrid } from '../components/PhotoGrid';
import { formatDay } from '../lib/dates';
import { parseIds } from '../lib/params';
import { oldestFirst, type Photo } from '../lib/photoModel';
import { usePhotos } from '../lib/photos';
import { useT } from '../lib/settings';
import { fonts, useColors } from '../lib/theme';

/** Zdjęcia z jednego miejsca na mapie (po dotknięciu znacznika). Parametr: ids – id zdjęć po przecinku. */
export default function PlaceScreen() {
  const colors = useColors();
  const t = useT();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { byId } = usePhotos();
  // Usunięte w międzyczasie zdjęcia po prostu znikają z listy
  const photos = useMemo(
    () => oldestFirst(parseIds(ids).map((id) => byId.get(id)).filter((p): p is Photo => !!p)),
    [ids, byId],
  );

  const first = formatDay(photos[0]?.takenAt);
  const last = formatDay(photos[photos.length - 1]?.takenAt);
  const days = first && last && first !== last ? `${first} – ${last}` : first;

  return (
    <>
      <Stack.Screen options={{ title: photos.length > 0 ? t.place.title(photos.length) : '' }} />
      <PhotoGrid
        photos={photos}
        header={days ? <Text style={[styles.days, { color: colors.textSecondary }]}>{days}</Text> : undefined}
        empty={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.place.gone}</Text>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  days: { fontFamily: fonts.medium, fontSize: 14, marginBottom: 10, marginLeft: 2 },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 15 },
});
