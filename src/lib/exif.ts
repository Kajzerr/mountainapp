// Odczyt danych EXIF ze zdjęć wybranych w galerii (expo-image-picker z opcją exif: true). Czyste funkcje, bez Reacta.
// iOS i Android zwracają EXIF trochę inaczej:
// - iOS: GPSLatitude dodatnie + GPSLatitudeRef "N"/"S" (czasem też całe {GPS} jako osobny słownik),
// - Android: GPSLatitude już ze znakiem (ujemne na półkuli S/W), Ref może być obecny mimo to,
// - starsze aparaty: liczby wymierne jako tekst "49/1,13/1,4567/100".

export type GeoPoint = { latitude: number; longitude: number };

type Exif = Record<string, unknown>;

/** Jedna liczba z EXIF: liczba, ułamek "4567/100", stopnie-minuty-sekundy (tekst albo tablica). */
export function exifNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    const parts = value.map(exifNumber);
    if (parts.length === 0 || parts.some((p) => p === null)) return null;
    return dms(parts as number[]);
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  const parts = text.split(/[,\s]+/).filter(Boolean).map(rational);
  if (parts.length === 0 || parts.some((p) => p === null)) return null;
  return parts.length === 1 ? (parts[0] as number) : dms(parts as number[]);
}

function rational(text: string): number | null {
  const [a, b] = text.split('/');
  const num = Number(a);
  if (b === undefined) return Number.isFinite(num) ? num : null;
  const den = Number(b);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function dms([d, m = 0, s = 0]: number[]): number {
  return d + m / 60 + s / 3600;
}

/** Współrzędna ze znakiem. Ref "S"/"W" zmienia znak tylko wartości dodatniej – Android podaje już ujemną. */
function coordinate(value: unknown, ref: unknown, negativeRef: 'S' | 'W'): number | null {
  const n = exifNumber(value);
  if (n === null) return null;
  const isNegativeRef = typeof ref === 'string' && ref.trim().toUpperCase().startsWith(negativeRef);
  return n > 0 && isNegativeRef ? -n : n;
}

function gpsDict(exif: Exif): Exif {
  const gps = exif['{GPS}'];
  return gps && typeof gps === 'object' ? (gps as Exif) : {};
}

/** Miejsce zrobienia zdjęcia albo null, gdy zdjęcie go nie ma (albo ma bzdurne „0, 0” bez sygnału GPS). */
export function gpsFromExif(exif: Exif | null | undefined): GeoPoint | null {
  if (!exif) return null;
  const gps = gpsDict(exif);
  const latitude = coordinate(exif.GPSLatitude ?? gps.Latitude, exif.GPSLatitudeRef ?? gps.LatitudeRef, 'S');
  const longitude = coordinate(exif.GPSLongitude ?? gps.Longitude, exif.GPSLongitudeRef ?? gps.LongitudeRef, 'W');
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

/** Data zrobienia zdjęcia jako tekst "RRRR-MM-DDTGG:MM:SS" (czas lokalny aparatu, bez strefy). */
export function takenAtFromExif(exif: Exif | null | undefined): string | undefined {
  if (!exif) return undefined;
  const nested = exif['{Exif}'] && typeof exif['{Exif}'] === 'object' ? (exif['{Exif}'] as Exif) : {};
  const candidates = [exif.DateTimeOriginal, nested.DateTimeOriginal, exif.DateTimeDigitized, exif.DateTime];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const m = value.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    // Aparaty bez ustawionego zegara zapisują "0000:00:00 00:00:00"
    if (m && m[1] !== '0000') return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}`;
  }
  return undefined;
}

/** Kierunek, w którym patrzył aparat (stopnie od północy) – przyda się do rozpoznawania szczytów. */
export function directionFromExif(exif: Exif | null | undefined): number | undefined {
  if (!exif) return undefined;
  const n = exifNumber(exif.GPSImgDirection ?? gpsDict(exif).ImgDirection);
  return n !== null && n >= 0 && n <= 360 ? n : undefined;
}

// ---- Dane do przyszłego rozpoznawania szczytów (PLAN.md, punkt 7.1) ----
// Nazwy kluczy na iOS pochodzą z ImageIO (np. "FocalLenIn35mmFilm"), na Androidzie z ExifInterface
// ("FocalLengthIn35mmFilm"), więc sprawdzamy obie. iOS kopiuje słownik {GPS} do kluczy "GPS<nazwa>",
// a słownik {TIFF} (Make, Model, Orientation) dokleja do głównego poziomu.

function nestedDict(exif: Exif, key: string): Exif {
  const d = exif[key];
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as Exif) : {};
}

/** Pierwsza wartość spośród kluczy, szukana na głównym poziomie i w słownikach {Exif}, {TIFF}, {ExifAux}. */
function pick(exif: Exif, keys: string[]): unknown {
  const dicts = [exif, nestedDict(exif, '{Exif}'), nestedDict(exif, '{TIFF}'), nestedDict(exif, '{ExifAux}')];
  for (const dict of dicts) {
    for (const key of keys) {
      const value = dict[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }
  return undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  // Niektóre aparaty dopełniają tekst zerami albo spacjami
  const t = value.replace(/\0/g, '').trim();
  return t || undefined;
}

/**
 * Wysokość n.p.m. w metrach. GPSAltitudeRef = 1 oznacza „poniżej poziomu morza” – zmienia znak tylko wartości
 * dodatniej, bo Android podaje już wysokość ze znakiem. Android wpisuje 0, gdy zdjęcie ma pozycję, ale nie ma
 * wysokości, więc 0 traktujemy jak brak danych (w Tatrach i tak nie występuje).
 */
export function altitudeFromExif(exif: Exif | null | undefined): number | undefined {
  if (!exif) return undefined;
  const gps = gpsDict(exif);
  const n = exifNumber(exif.GPSAltitude ?? gps.Altitude);
  if (n === null || n === 0) return undefined;
  const ref = exif.GPSAltitudeRef ?? gps.AltitudeRef;
  const below = ref === 1 || (typeof ref === 'string' && ref.trim() === '1');
  const altitude = n > 0 && below ? -n : n;
  return altitude >= -500 && altitude <= 9000 ? altitude : undefined;
}

/** Do czego odnosi się kierunek aparatu: "T" – północ geograficzna, "M" – magnetyczna. */
export function directionRefFromExif(exif: Exif | null | undefined): 'T' | 'M' | undefined {
  if (!exif) return undefined;
  const ref = text(exif.GPSImgDirectionRef ?? gpsDict(exif).ImgDirectionRef)?.toUpperCase();
  return ref === 'T' || ref === 'M' ? ref : undefined;
}

/** Ogniskowa przeliczona na pełną klatkę 35 mm (z niej liczy się kąt widzenia). */
export function focalLength35FromExif(exif: Exif | null | undefined): number | undefined {
  if (!exif) return undefined;
  const n = exifNumber(pick(exif, ['FocalLenIn35mmFilm', 'FocalLengthIn35mmFilm']));
  return n !== null && n > 0 && n <= 5000 ? n : undefined;
}

/** Rzeczywista ogniskowa obiektywu w mm (bez przeliczenia na 35 mm). */
export function focalLengthFromExif(exif: Exif | null | undefined): number | undefined {
  if (!exif) return undefined;
  const n = exifNumber(pick(exif, ['FocalLength']));
  return n !== null && n > 0 && n <= 5000 ? n : undefined;
}

/** Szacowany błąd pozycji GPS w metrach. */
export function positioningErrorFromExif(exif: Exif | null | undefined): number | undefined {
  if (!exif) return undefined;
  const n = exifNumber(exif.GPSHPositioningError ?? gpsDict(exif).HPositioningError);
  return n !== null && n >= 0 ? n : undefined;
}

/** Orientacja zdjęcia z EXIF (1–8; 6 i 8 to zdjęcie obrócone o 90°). */
export function orientationFromExif(exif: Exif | null | undefined): number | undefined {
  if (!exif) return undefined;
  const n = exifNumber(pick(exif, ['Orientation']));
  return n !== null && Number.isInteger(n) && n >= 1 && n <= 8 ? n : undefined;
}

export type CameraInfo = { make?: string; model?: string; lens?: string };

/** Producent, model aparatu i obiektyw – puste pola pomijamy. */
export function cameraFromExif(exif: Exif | null | undefined): CameraInfo {
  if (!exif) return {};
  const info: CameraInfo = {};
  const make = text(pick(exif, ['Make']));
  const model = text(pick(exif, ['Model']));
  const lens = text(pick(exif, ['LensModel']));
  if (make) info.make = make;
  if (model) info.model = model;
  if (lens) info.lens = lens;
  return info;
}
