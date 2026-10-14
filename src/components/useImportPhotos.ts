import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { hasLocation, type LocatedPhoto } from '../lib/photoModel';
import { usePhotos } from '../lib/photos';
import { useT } from '../lib/settings';

/**
 * Dodawanie zdjęć z galerii telefonu. Zdjęcia z GPS od razu trafiają na mapę;
 * dla tych bez GPS proponujemy wskazanie miejsca na mapie (ekran /locate).
 * onLocated – np. przesunięcie mapy do nowo dodanych zdjęć.
 */
export function useImportPhotos(onLocated?: (photos: LocatedPhoto[]) => void) {
  const { importAssets } = usePhotos();
  const t = useT();
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async () => {
    try {
      // Systemowy wybór zdjęć nie wymaga zgody na dostęp do całej galerii
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 0,
        exif: true,
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) return;
      setBusy(true);
      const { added, duplicates, failed } = await importAssets(result.assets);
      setBusy(false);

      const located = added.filter(hasLocation);
      const unlocated = added.filter((p) => !hasLocation(p));
      if (located.length > 0) onLocated?.(located);
      // Wszystko poszło gładko – nie przeszkadzamy komunikatem, mapa sama pokazuje nowe zdjęcia
      if (unlocated.length === 0 && duplicates === 0 && failed === 0) return;

      const lines: string[] = [];
      if (added.length > 0) lines.push(t.import.summary(added.length, located.length));
      else if (failed === 0) lines.push(t.import.nothingNew);
      if (duplicates > 0 && added.length > 0) lines.push(t.import.duplicates(duplicates));
      if (failed > 0) lines.push(t.import.failed(failed));
      if (unlocated.length > 0) lines.push(t.import.noLocation(unlocated.length));

      Alert.alert(
        t.import.title,
        lines.join('\n\n'),
        unlocated.length > 0
          ? [
              { text: t.common.later, style: 'cancel' },
              {
                text: t.photos.setOnMap,
                onPress: () =>
                  router.push({ pathname: '/locate', params: { ids: unlocated.map((p) => p.id).join(',') } }),
              },
            ]
          : undefined,
      );
    } catch (e) {
      setBusy(false);
      console.warn('Import failed', e);
      Alert.alert(t.common.somethingWrong, String(e));
    }
  }, [importAssets, onLocated, t]);

  return { busy, pick };
}
