// Model zdjęcia i odczyt zapisanych danych. Czyste funkcje, bez Reacta i bez modułów Expo (testowalne w Node).
import {
  altitudeFromExif,
  cameraFromExif,
  directionFromExif,
  directionRefFromExif,
  focalLength35FromExif,
  focalLengthFromExif,
  gpsFromExif,
  orientationFromExif,
  positioningErrorFromExif,
  takenAtFromExif,
} from './exif';
import { photoTime } from './places';

export type Photo = {
  id: string;
  /** Nazwa pliku w katalogu zdjęć aplikacji. Nie pełna ścieżka: na iOS katalog aplikacji zmienia się po aktualizacji. */
  file: string;
  width: number;
  height: number;
  /** Miejsce zrobienia zdjęcia – oba pola albo żadne */
  latitude?: number;
  longitude?: number;
  /** "RRRR-MM-DDTGG:MM:SS" z EXIF (czas lokalny aparatu) */
  takenAt?: string;
  /** Kierunek aparatu w stopniach od północy (z EXIF), na później – rozpoznawanie szczytów */
  direction?: number;
  /** "T" – kierunek względem północy geograficznej, "M" – magnetycznej */
  directionRef?: 'T' | 'M';
  /** Wysokość n.p.m. w metrach z GPS telefonu */
  altitude?: number;
  /** Szacowany błąd pozycji GPS w metrach */
  gpsError?: number;
  /** Ogniskowa przeliczona na 35 mm (kąt widzenia) i rzeczywista ogniskowa w mm */
  focal35?: number;
  focal?: number;
  /** Orientacja z EXIF (1–8) */
  orientation?: number;
  /** Aparat: producent, model, obiektyw */
  make?: string;
  model?: string;
  lens?: string;
  /** Rozpoznanie duplikatu: id zdjęcia w galerii telefonu albo nazwa pliku + data */
  source?: string;
  /** Moment dodania do aplikacji, "RRRR-MM-DDTGG:MM:SS" */
  importedAt: string;
};

export type LocatedPhoto = Photo & { latitude: number; longitude: number };

export function hasLocation(p: Photo): p is LocatedPhoto {
  return typeof p.latitude === 'number' && typeof p.longitude === 'number';
}

/** To, czego potrzebujemy z wyniku expo-image-picker (ImagePickerAsset). */
export type PickedAsset = {
  uri: string;
  width: number;
  height: number;
  assetId?: string | null;
  fileName?: string | null;
  exif?: Record<string, unknown> | null;
};

/** Klucz do rozpoznania, że to samo zdjęcie dodano drugi raz. undefined = nie da się stwierdzić. */
export function sourceKey(asset: PickedAsset, takenAt: string | undefined): string | undefined {
  if (asset.assetId) return `asset:${asset.assetId}`;
  if (asset.fileName && takenAt) return `file:${asset.fileName}|${takenAt}`;
  return undefined;
}

/** Dane zdjęcia z EXIF (bez pliku – plik kopiuje lib/photos.tsx). */
export function photoFromAsset(asset: PickedAsset, id: string, file: string, importedAt: string): Photo {
  const takenAt = takenAtFromExif(asset.exif);
  const gps = gpsFromExif(asset.exif);
  const direction = directionFromExif(asset.exif);
  const photo: Photo = { id, file, width: asset.width, height: asset.height, importedAt };
  if (gps) {
    photo.latitude = gps.latitude;
    photo.longitude = gps.longitude;
  }
  if (takenAt) photo.takenAt = takenAt;
  if (direction !== undefined) photo.direction = direction;
  // Dane do przyszłego rozpoznawania szczytów (PLAN.md, punkt 7.1); zapisujemy tylko te, które są w EXIF
  const exif = asset.exif;
  const extra: Partial<Photo> = {
    directionRef: directionRefFromExif(exif),
    altitude: altitudeFromExif(exif),
    gpsError: positioningErrorFromExif(exif),
    focal35: focalLength35FromExif(exif),
    focal: focalLengthFromExif(exif),
    orientation: orientationFromExif(exif),
    ...cameraFromExif(exif),
  };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) (photo as Record<string, unknown>)[key] = value;
  }
  const source = sourceKey(asset, takenAt);
  if (source) photo.source = source;
  return photo;
}

/** Zapisane zdjęcia; uszkodzone wpisy pomijamy zamiast tracić wszystko. */
export function parsePhotos(json: string | null): Photo[] {
  if (!json) return [];
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (p): p is Photo =>
        !!p && typeof p === 'object' && typeof p.id === 'string' && typeof p.file === 'string' &&
        typeof p.importedAt === 'string',
    );
  } catch {
    return [];
  }
}

/** Od najnowszego (galeria w zakładce Zdjęcia). */
export function newestFirst(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => photoTime(b).localeCompare(photoTime(a)) || b.id.localeCompare(a.id));
}

/** Od najstarszego (zdjęcia jednego miejsca – kolejność wycieczki). */
export function oldestFirst(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => photoTime(a).localeCompare(photoTime(b)) || a.id.localeCompare(b.id));
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
