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
