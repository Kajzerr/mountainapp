// EXIF czytany wprost z pliku zdjęcia (JPEG albo HEIC) – dla podpisów szczytów. Przede wszystkim nachylenie telefonu:
// iPhone zapisuje wektor grawitacji w sekcji producenta (MakerNote Apple, tag 8 „AccelerationVector”), a
// expo-image-picker jej nie przekazuje. Przy okazji kierunek, ogniskowa 35 mm i orientacja – dla zdjęć dodanych,
// zanim aplikacja zaczęła je zapisywać. Czyste funkcje, bez Reacta: `read(offset, length)` dostarcza bajty pliku.

export type ReadBytes = (offset: number, length: number) => Uint8Array;

/** Wektor grawitacji w układzie telefonu (w jednostkach g): x – w poprzek ekranu, y – wzdłuż, z – z ekranu. */
export type Gravity = [number, number, number];

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];

/** Blok TIFF z danymi EXIF (od nagłówka "II"/"MM"); null, gdy plik go nie ma albo nie znamy formatu. */
export function findExifTiff(read: ReadBytes, fileSize: number): Uint8Array | null {
  const head = read(0, Math.min(fileSize, 16));
  if (head.length < 12) return null;
  if (head[0] === 0xff && head[1] === 0xd8) return jpegExif(read, fileSize);
  if (ascii(head, 4, 4) === 'ftyp') return heifExif(read, fileSize);
  return null;
}

/** JPEG: segment APP1 "Exif\0\0" na początku pliku. */
function jpegExif(read: ReadBytes, fileSize: number): Uint8Array | null {
  let o = 2;
  while (o + 4 <= fileSize) {
    const h = read(o, 4);
    if (h[0] !== 0xff) return null;
    const marker = h[1];
    const len = u16be(h, 2);
    if (marker === 0xda || marker === 0xd9) return null; // początek obrazu – EXIF-u już nie będzie
    if (marker === 0xe1 && len > 8) {
      const seg = read(o + 4, len - 2);
      if (ascii(seg, 0, 6) === 'Exif\0\0') return seg.subarray(6);
    }
    o += 2 + len;
  }
  return null;
}

type Box = { type: string; start: number; body: number; end: number };

/** Pudełka ISOBMFF (HEIC) w zakresie [from, to). */
function boxes(read: ReadBytes, from: number, to: number): Box[] {
  const out: Box[] = [];
  let o = from;
  while (o + 8 <= to) {
    const h = read(o, 16);
    let size = u32be(h, 0);
    const type = ascii(h, 4, 4);
    let body = o + 8;
    if (size === 1) {
      size = u32be(h, 8) * 2 ** 32 + u32be(h, 12);
      body = o + 16;
    } else if (size === 0) {
      size = to - o;
    }
    if (size < 8) break;
    out.push({ type, start: o, body, end: Math.min(o + size, to) });
    o += size;
  }
  return out;
}

/** HEIC: element typu "Exif" z listy iinf, jego położenie z iloc. */
function heifExif(read: ReadBytes, fileSize: number): Uint8Array | null {
  const meta = boxes(read, 0, fileSize).find((b) => b.type === 'meta');
  if (!meta) return null;
  // meta to „full box”: 4 bajty wersji i flag przed dziećmi; całe meta czytamy naraz (zwykle kilka KB)
  const m = read(meta.start, meta.end - meta.start);
  const rel = (b: Box) => ({ ...b, start: b.start - meta.start, body: b.body - meta.start, end: b.end - meta.start });
  const children = boxes((o, l) => m.subarray(o - meta.start, o - meta.start + l), meta.body + 4, meta.end).map(rel);
  const iinf = children.find((b) => b.type === 'iinf');
  const iloc = children.find((b) => b.type === 'iloc');
  if (!iinf || !iloc) return null;

  // iinf: liczba wpisów, potem pudełka infe
  const iinfVersion = m[iinf.body];
  let o = iinf.body + 4 + (iinfVersion === 0 ? 2 : 4);
  let exifId = -1;
  while (o + 8 <= iinf.end) {
    const size = u32be(m, o);
    if (size < 8) break;
    if (ascii(m, o + 4, 4) === 'infe') {
      const v = m[o + 8];
      if (v >= 2) {
        const p = o + 12;
        const id = v === 2 ? u16be(m, p) : u32be(m, p);
        const typeAt = p + (v === 2 ? 2 : 4) + 2;
        if (ascii(m, typeAt, 4) === 'Exif') {
          exifId = id;
          break;
        }
      }
    }
    o += size;
  }
  if (exifId < 0) return null;

  // iloc: położenie danych elementu w pliku
  const v = m[iloc.body];
  let p = iloc.body + 4;
  const offSize = m[p] >> 4;
  const lenSize = m[p] & 15;
  const baseSize = m[p + 1] >> 4;
  const idxSize = v === 1 || v === 2 ? m[p + 1] & 15 : 0;
  p += 2;
  const readN = (n: number) => {
    let value = 0;
    for (let i = 0; i < n; i++) value = value * 256 + m[p + i];
    p += n;
    return value;
  };
  const count = v < 2 ? readN(2) : readN(4);
  for (let i = 0; i < count; i++) {
    const id = v < 2 ? readN(2) : readN(4);
    if (v === 1 || v === 2) readN(2); // construction_method
    readN(2); // data_reference_index
    const base = readN(baseSize);
    const extents = readN(2);
    let first: { offset: number; length: number } | null = null;
    for (let e = 0; e < extents; e++) {
      if (idxSize) readN(idxSize);
      const offset = readN(offSize);
      const length = readN(lenSize);
      if (!first) first = { offset: base + offset, length };
    }
    if (id === exifId && first) {
      const data = read(first.offset, first.length);
      // Na początku 4 bajty: przesunięcie do nagłówka TIFF (zwykle 6 – po "Exif\0\0")
      const skip = 4 + u32be(data, 0);
      return skip < data.length ? data.subarray(skip) : null;
    }
  }
  return null;
}

export type FileMeta = {
  gravity?: Gravity;
  /** Kierunek aparatu (stopnie) i jego odniesienie: "T" geograficzne, "M" magnetyczne */
  direction?: number;
  directionRef?: 'T' | 'M';
  focal35?: number;
  orientation?: number;
  /** Obiektyw (LensModel), np. "iPhone 15 Pro front TrueDepth camera 2.69mm f/1.9" */
  lens?: string;
};

/** Dane z bloku TIFF: IFD0 → Exif IFD (ogniskowa, MakerNote Apple) i GPS IFD (kierunek). */
export function metaFromTiff(tiff: Uint8Array): FileMeta {
  const meta: FileMeta = {};
  if (tiff.length < 8) return meta;
  const le = tiff[0] === 0x49;
  const u16 = (o: number) => (le ? tiff[o] | (tiff[o + 1] << 8) : u16be(tiff, o));
  const u32 = (o: number) => (le ? (tiff[o] | (tiff[o + 1] << 8) | (tiff[o + 2] << 16)) + tiff[o + 3] * 2 ** 24 : u32be(tiff, o));
  const findTag = (ifd: number, tag: number) => {
    if (ifd <= 0 || ifd + 2 > tiff.length) return -1;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > tiff.length) return -1;
      if (u16(e) === tag) return e;
    }
    return -1;
  };
  const rational = (o: number) => (o + 8 <= tiff.length && u32(o + 4) !== 0 ? u32(o) / u32(o + 4) : NaN);
  const ifd0 = u32(4);

  const orient = findTag(ifd0, 0x0112);
  if (orient >= 0) {
    const v = u16(orient + 8);
    if (v >= 1 && v <= 8) meta.orientation = v;
  }

  const gpsPtr = findTag(ifd0, 0x8825);
  if (gpsPtr >= 0) {
    const gps = u32(gpsPtr + 8);
    const dir = findTag(gps, 0x11);
    if (dir >= 0) {
      const v = rational(u32(dir + 8));
      if (v >= 0 && v <= 360) meta.direction = v;
    }
    const ref = findTag(gps, 0x10);
    if (ref >= 0) {
      const c = String.fromCharCode(tiff[ref + 8]).toUpperCase();
      if (c === 'T' || c === 'M') meta.directionRef = c;
    }
  }

  const exifPtr = findTag(ifd0, 0x8769);
  if (exifPtr < 0) return meta;
  const exif = u32(exifPtr + 8);
  const f35 = findTag(exif, 0xa405);
  if (f35 >= 0) {
    const v = u16(f35 + 8);
    if (v > 0) meta.focal35 = v;
  }
  const lens = findTag(exif, 0xa434);
  if (lens >= 0) {
    // Tekst ASCII: do 4 znaków w samym wpisie, dłuższy pod wskazanym przesunięciem
    const count = u32(lens + 4);
    const start = count <= 4 ? lens + 8 : u32(lens + 8);
    if (count > 0 && start + count <= tiff.length) {
      const text = ascii(tiff, start, count).replace(/\0+$/, '').trim();
      if (text) meta.lens = text;
    }
  }
  const maker = findTag(exif, 0x927c);
  if (maker >= 0) {
    const start = u32(maker + 8);
    const gravity = appleGravity(tiff.subarray(start, start + u32(maker + 4)));
    if (gravity) meta.gravity = gravity;
  }
  return meta;
}

/** Wektor grawitacji z MakerNote Apple; null dla innych aparatów. */
function appleGravity(mn: Uint8Array): Gravity | null {
  if (mn.length < 16 || ascii(mn, 0, 9) !== 'Apple iOS') return null;
  // MakerNote Apple jest zawsze big-endian, przesunięcia liczone od jego początku
  const s32 = (o: number) => (u32be(mn, o) | 0);
  const n = u16be(mn, 14);
  for (let i = 0; i < n; i++) {
    const e = 16 + i * 12;
    if (e + 12 > mn.length) break;
    if (u16be(mn, e) !== 8 || u16be(mn, e + 2) !== 10 || u32be(mn, e + 4) !== 3) continue;
    const off = u32be(mn, e + 8);
    if (off + 24 > mn.length) return null;
    const g = [0, 1, 2].map((k) => s32(off + k * 8) / s32(off + k * 8 + 4));
    return g.every(Number.isFinite) ? (g as Gravity) : null;
  }
  return null;
}

/** Dane z pliku zdjęcia; pusty obiekt, gdy plik nie ma EXIF albo jest nietypowy. */
export function metaFromFile(read: ReadBytes, fileSize: number): FileMeta {
  try {
    const tiff = findExifTiff(read, fileSize);
    return tiff ? metaFromTiff(tiff) : {};
  } catch {
    return {};
  }
}

export type Tilt = {
  /** Pochylenie aparatu w górę (+) / w dół (−) w stopniach */
  pitch: number;
  /** Obrót aparatu wokół osi obiektywu w stopniach (+ = zgodnie z ruchem wskazówek zegara, jak CameraPose.roll) */
  roll: number;
};

/** Zdjęcie z przedniego aparatu (selfie) – rozpoznajemy po nazwie obiektywu ("… front …"). */
export function isFrontCamera(lens?: string): boolean {
  return !!lens && /front/i.test(lens);
}

/**
 * Pochylenie i obrót kadru z wektora grawitacji. `orientation` z EXIF mówi, jak telefon był trzymany:
 * 1 – poziomo, 6 – pionowo (najczęstsze), 3 i 8 – odwrotnie. Przedni aparat patrzy w przeciwną stronę niż tylny
 * (obrót o 180° wokół pionowej osi telefonu), więc pochylenie i obrót mają odwrotny znak. Kierunek z EXIF iPhone
 * podaje już dla przedniego aparatu (sprawdzone na IMG_7333) – jego nie odwracamy.
 */
export function tiltFromGravity(g: Gravity, orientation = 1, front = false): Tilt {
  const [x, y, z] = g;
  const norm = Math.hypot(x, y, z) || 1;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, z / norm))) * 180) / Math.PI;
  // Kierunek „w dół kadru” w układzie telefonu i kierunek „w prawo kadru”
  const [down, right]: [[number, number], [number, number]] =
    orientation === 6 ? [[0, -1], [-1, 0]]
    : orientation === 3 ? [[1, 0], [0, -1]]
    : orientation === 8 ? [[0, 1], [1, 0]]
    : [[-1, 0], [0, 1]];
  const along = x * down[0] + y * down[1];
  const across = x * right[0] + y * right[1];
  // Sprawdzone na zdjęciach testowych: grawitacja w stronę prawej krawędzi kadru = aparat obrócony przeciwnie do zegara
  const roll = (Math.atan2(-across, along) * 180) / Math.PI;
  return front ? { pitch: -pitch, roll: -roll } : { pitch, roll };
}
