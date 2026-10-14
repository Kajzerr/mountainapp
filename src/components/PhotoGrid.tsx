import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { formatTakenAt } from '../lib/dates';
import { photoUri } from '../lib/photoFiles';
import type { Photo } from '../lib/photoModel';
import { useT } from '../lib/settings';
import { useColors } from '../lib/theme';

const COLUMNS = 3;
const GAP = 3;
const PADDING = 16;

type Props = { photos: Photo[]; header?: ReactElement; empty?: ReactElement };

/** Siatka miniatur; dotknięcie otwiera zdjęcie na pełnym ekranie. */
export function PhotoGrid({ photos, header, empty }: Props) {
  const colors = useColors();
  const t = useT();
  const { width } = useWindowDimensions();
  const size = Math.floor((width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <FlatList
      data={photos}
      keyExtractor={(p) => p.id}
      numColumns={COLUMNS}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => {
        const date = formatTakenAt(item.takenAt);
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/photo', params: { id: item.id } })}
            style={({ pressed }) => [{ width: size, height: size, opacity: pressed ? 0.75 : 1 }]}
            accessibilityRole="imagebutton"
            accessibilityLabel={date ? t.photos.open(date) : t.photos.openUndated}
          >
            <Image
              source={{ uri: photoUri(item.file) }}
              recyclingKey={item.id}
              style={[styles.thumb, { backgroundColor: colors.card }]}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: PADDING, gap: GAP, paddingBottom: 40 },
  row: { gap: GAP },
  thumb: { width: '100%', height: '100%', borderRadius: 6 },
});
