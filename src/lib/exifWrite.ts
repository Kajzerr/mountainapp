// Dopisanie położenia GPS do pliku JPEG (blok EXIF z samym GPS). Zapisane zdjęcie z podpisami szczytów nie ma
// metadanych – dzięki temu galeria pokaże je na mapie. Daty nie dopisujemy: zostaje data zapisu pliku.
// Czyste funkcje na bajtach, bez Reacta i Expo (testowalne w Node).

export type GpsTags = {
  latitude: number;
  longitude: number;
  /** Wysokość n.p.m. w metrach */
  altitude?: number;
  /** Kierunek aparatu w stopniach i odniesienie: "T" – północ geograficzna, "M" – magnetyczna */
  direction?: number;
  directionRef?: 'T' | 'M';
};

const BYTE = 1;
const ASCII = 2;
const LONG = 4;
const RATIONAL = 5;

type Entry = { tag: number; type: number; count: number; data: number[] };

/** Ułamek EXIF (licznik, mianownik) z dokładnością `den`. */
function rational(value: number, den: number): number[] {
  return [Math.round(Math.abs(value) * den), den];
}

/** Stopnie dziesiętne → stopnie, minuty, sekundy (sekundy z dokładnością 1/10000). */
function dms(value: number): number[] {
  const v = Math.abs(value);
  const deg = Math.floor(v);
  const minFloat = (v - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return [deg, 1, min, 1, ...rational(sec, 10000)];
}

function ascii(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0)).concat(0);
}

function gpsEntries(gps: GpsTags): Entry[] {
  const entries: Entry[] = [
    { tag: 0x0000, type: BYTE, count: 4, data: [2, 3, 0, 0] },
    { tag: 0x0001, type: ASCII, count: 2, data: ascii(gps.latitude >= 0 ? 'N' : 'S') },
    { tag: 0x0002, type: RATIONAL, count: 3, data: dms(gps.latitude) },
    { tag: 0x0003, type: ASCII, count: 2, data: ascii(gps.longitude >= 0 ? 'E' : 'W') },
    { tag: 0x0004, type: RATIONAL, count: 3, data: dms(gps.longitude) },
  ];
  if (gps.altitude !== undefined && Number.isFinite(gps.altitude)) {
    entries.push({ tag: 0x0005, type: BYTE, count: 1, data: [gps.altitude < 0 ? 1 : 0] });
    entries.push({ tag: 0x0006, type: RATIONAL, count: 1, data: rational(gps.altitude, 100) });
  }
  if (gps.direction !== undefined && Number.isFinite(gps.direction)) {
    entries.push({ tag: 0x0010, type: ASCII, count: 2, data: ascii(gps.directionRef === 'M' ? 'M' : 'T') });
    entries.push({ tag: 0x0011, type: RATIONAL, count: 1, data: rational(((gps.direction % 360) + 360) % 360, 100) });
  }
  return entries;
}

/** Rozmiar wartości w bajtach (BYTE/ASCII – po 1, LONG – 4, RATIONAL – 8). */
function valueSize(e: Entry): number {
  return e.type === RATIONAL ? 8 * e.count : e.type === LONG ? 4 * e.count : e.count;
}

/**
 * Segment APP1 „Exif” (TIFF little-endian): IFD0 z jednym wpisem – wskaźnikiem do katalogu GPS – i katalog GPS.
 */
export function gpsExifSegment(gps: GpsTags): Uint8Array {
  const gpsList = gpsEntries(gps);
  const ifd0Size = 2 + 12 + 4;
  const gpsOffset = 8 + ifd0Size;
  const gpsDirSize = 2 + 12 * gpsList.length + 4;
  let dataOffset = gpsOffset + gpsDirSize;
  const extraSize = gpsList.reduce((sum, e) => sum + (valueSize(e) > 4 ? valueSize(e) : 0), 0);
  const tiffSize = dataOffset + extraSize;

  const tiff = new Uint8Array(tiffSize);
  const view = new DataView(tiff.buffer);
  // Nagłówek TIFF: "II", 42, IFD0 od bajtu 8
  tiff[0] = 0x49;
  tiff[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  // IFD0: GPSInfo (0x8825) → katalog GPS
  view.setUint16(8, 1, true);
  view.setUint16(10, 0x8825, true);
  view.setUint16(12, LONG, true);
  view.setUint32(14, 1, true);
  view.setUint32(18, gpsOffset, true);
  view.setUint32(22, 0, true);
  // Katalog GPS (wpisy rosnąco po numerze)
  view.setUint16(gpsOffset, gpsList.length, true);
  gpsList.forEach((e, i) => {
    const at = gpsOffset + 2 + 12 * i;
    view.setUint16(at, e.tag, true);
    view.setUint16(at + 2, e.type, true);
    view.setUint32(at + 4, e.count, true);
    const size = valueSize(e);
    // Wartości do 4 bajtów są w samym wpisie, dłuższe – za katalogiem
    const target = size > 4 ? dataOffset : at + 8;
    if (size > 4) {
      view.setUint32(at + 8, dataOffset, true);
      dataOffset += size;
    }
    if (e.type === RATIONAL) e.data.forEach((v, k) => view.setUint32(target + 4 * k, v, true));
    else e.data.forEach((v, k) => (tiff[target + k] = v));
  });
  view.setUint32(gpsOffset + 2 + 12 * gpsList.length, 0, true);

  const header = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
  const length = 2 + header.length + tiffSize;
  const segment = new Uint8Array(2 + length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = length >> 8;
  segment[3] = length & 0xff;
  segment.set(header, 4);
  segment.set(tiff, 10);
  return segment;
}

/**
 * JPEG z dopisanym blokiem EXIF zaraz po znaczniku początku (SOI). Istniejące bloki APP1 „Exif” usuwamy,
 * żeby nie było dwóch. Gdy plik nie wygląda na JPEG – zwracamy go bez zmian.
 */
export function insertExif(jpeg: Uint8Array, segment: Uint8Array): Uint8Array {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const kept: Uint8Array[] = [];
  let pos = 2;
  // Przechodzimy przez segmenty nagłówka aż do danych obrazu (SOS)
  while (pos + 4 <= jpeg.length && jpeg[pos] === 0xff) {
    const marker = jpeg[pos + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = (jpeg[pos + 2] << 8) | jpeg[pos + 3];
    const end = pos + 2 + len;
    if (len < 2 || end > jpeg.length) return jpeg;
    const isExif =
      marker === 0xe1 && jpeg[pos + 4] === 0x45 && jpeg[pos + 5] === 0x78 && jpeg[pos + 6] === 0x69 && jpeg[pos + 7] === 0x66;
    if (!isExif) kept.push(jpeg.subarray(pos, end));
    pos = end;
  }
  // APP0 (JFIF) według specyfikacji powinien być pierwszy – zostawiamy go przed EXIF
  const app0 = kept.length && kept[0][1] === 0xe0 ? [kept.shift() as Uint8Array] : [];
  const parts = [jpeg.subarray(0, 2), ...app0, segment, ...kept, jpeg.subarray(pos)];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
