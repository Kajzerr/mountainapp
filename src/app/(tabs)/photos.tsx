import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PhotoGrid } from '../../components/PhotoGrid';
import { useImportPhotos } from '../../components/useImportPhotos';
import { newestFirst } from '../../lib/photoModel';
import { usePhotos } from '../../lib/photos';
import { useT } from '../../lib/settings';
import { fonts, useColors } from '../../lib/theme';

/** Zakładka „Zdjęcia”: wszystkie zdjęcia od najnowszego + zdjęcia czekające na lokalizację. */
export default function PhotosScreen() {
  const colors = useColors();
  const t = useT();
  const { photos, unlocated } = usePhotos();
  const { pick } = useImportPhotos();
  const sorted = useMemo(() => newestFirst(photos), [photos]);

  const header =
    photos.length === 0 ? undefined : (
      <View style={styles.header}>
        {unlocated.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHead}>
              <Ionicons name="location-outline" size={20} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t.photos.noLocationTitle(unlocated.length)}</Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>{t.photos.noLocationHint}</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/locate', params: { ids: unlocated.map((p) => p.id).join(',') } })}
              style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: colors.accentText }]}>{t.photos.setOnMap}</Text>
            </Pressable>
          </View>
        )}
        <Text style={[styles.section, { color: colors.textSecondary }]}>
          {t.photos.all} · {photos.length}
        </Text>
      </View>
    );

  const empty = (
    <View style={styles.empty}>
      <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.photos.empty}</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.photos.emptyHint}</Text>
      <Pressable
        onPress={pick}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, { color: colors.accentText }]}>{t.photos.add}</Text>
      </Pressable>
    </View>
  );

  return <PhotoGrid photos={sorted} header={header} empty={empty} />;
}

const styles = StyleSheet.create({
  header: { gap: 14, marginBottom: 10 },
  card: { padding: 14, borderRadius: 16, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, flex: 1 },
  cardText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  section: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.4, marginLeft: 4 },
  button: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 18 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
});
