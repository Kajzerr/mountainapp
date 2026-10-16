// Pliki zdjęć w katalogu aplikacji. Kopiujemy je z galerii, bo adres z expo-image-picker wskazuje na pamięć podręczną,
// którą system może w każdej chwili wyczyścić.
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { metaFromFile, type FileMeta } from './exifFile';

function photosDir(): Directory {
  return new Directory(Paths.document, 'photos');
}

/** Rozszerzenie z adresu pliku (jpg, heic, png…); domyślnie jpg. */
export function extensionOf(uri: string): string {
  const m = uri.split('?')[0].match(/\.([a-zA-Z0-9]{2,5})$/);
  return m ? m[1].toLowerCase() : 'jpg';
}

/** Kopiuje zdjęcie do katalogu aplikacji, zwraca nazwę pliku. */
export async function storePhotoFile(sourceUri: string, id: string): Promise<string> {
  const dir = photosDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = `${id}.${extensionOf(sourceUri)}`;
  await new File(sourceUri).copy(new File(dir, name));
  return name;
}

/** Adres pliku do wyświetlenia. */
export function photoUri(file: string): string {
  return new File(photosDir(), file).uri;
}

/** Dane do podpisów szczytów czytane wprost z pliku zdjęcia (czyta tylko potrzebne fragmenty, zwykle kilkadziesiąt KB). */
export function readPhotoFileMeta(file: string): FileMeta {
  const f = new File(photosDir(), file);
  if (!f.exists) return {};
  const size = f.size;
  const handle = f.open(FileMode.ReadOnly);
  try {
    return metaFromFile((offset, length) => {
      handle.offset = offset;
      return handle.readBytes(Math.max(0, Math.min(length, size - offset)));
    }, size);
  } finally {
    handle.close();
  }
}

export function deletePhotoFile(file: string) {
  try {
    const f = new File(photosDir(), file);
    if (f.exists) f.delete();
  } catch (e) {
    console.warn('Could not delete photo file', e);
  }
}

/** Katalog na pobrane kafelki mapy (react-native-maps sam je tam zapisuje). */
export function tileCacheDir(layer: string): string {
  return new Directory(Paths.document, 'tiles', layer).uri;
}
