// Zapis zdjęcia z podpisami szczytów w galerii telefonu. Gdy zapis się nie uda (np. brak zgody albo Expo Go
// na Androidzie), otwieramy okno udostępniania – stamtąd też da się zapisać zdjęcie. Do pliku dopisujemy GPS
// z oryginału (exifWrite.ts), żeby galeria pokazała zdjęcie na mapie; data zostaje data zapisu.
import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { gpsExifSegment, type GpsTags, insertExif } from './exifWrite';

/** Dłuższy bok zapisanego zdjęcia w pikselach (pełne 12 Mpx byłoby ciężkie, a podpisy i tak są czytelne). */
export const EXPORT_MAX_SIDE = 3000;

/** Rozmiar zapisu w pikselach: proporcje zdjęcia, dłuższy bok najwyżej EXPORT_MAX_SIDE i nie większy niż oryginał. */
export function exportSize(width: number, height: number): { width: number; height: number } {
  const w = width > 0 ? width : 4;
  const h = height > 0 ? height : 3;
  const k = Math.min(1, EXPORT_MAX_SIDE / Math.max(w, h));
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

export type SaveResult = 'saved' | 'shared' | 'failed';

/**
 * Kopia pliku z dopisanym GPS (w pamięci podręcznej, nazwa „MountainMap_…”). Przy błędzie – oryginalny plik,
 * bo zdjęcie bez GPS jest lepsze niż żadne.
 */
async function withGps(uri: string, gps: GpsTags | undefined): Promise<string> {
  if (!gps) return uri;
  try {
    const bytes = await new File(uri).bytes();
    const out = new File(Paths.cache, `MountainMap_${Date.now()}.jpg`);
    out.write(insertExif(bytes, gpsExifSegment(gps)));
    return out.uri;
  } catch (e) {
    console.warn('Could not add GPS to photo', e);
    return uri;
  }
}

export async function saveToGallery(snapshotUri: string, gps?: GpsTags): Promise<SaveResult> {
  const uri = await withGps(snapshotUri, gps);
  try {
    // Tylko zapis (bez czytania galerii) – na iOS to osobna, węższa zgoda
    const permission = await requestPermissionsAsync(true);
    if (permission.granted) {
      await Asset.create(uri);
      return 'saved';
    }
  } catch (e) {
    console.warn('Could not save photo to the library', e);
  }
  try {
    if (await isAvailableAsync()) {
      await shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
      return 'shared';
    }
  } catch (e) {
    console.warn('Could not share photo', e);
  }
  return 'failed';
}
