// Model terenu (DEM): siatka wysokości Tatr z okolicą, przygotowana przez scripts/fetch-dem.mjs
// (Copernicus GLO-30 zmniejszony do ok. 90 m). Czyste funkcje, bez Reacta – testowalne w Node.
import type { GeoPoint } from './exif';

export type Dem = {
  /** Północna i zachodnia krawędź siatki (stopnie) */
  north: number;
  west: number;
  /** Rozmiar oczka w stopniach */
  dLat: number;
  dLon: number;
  rows: number;
  cols: number;
  /** Wysokości w metrach, wiersz po wierszu od północy; NO_DATA = brak danych */
  heights: Int16Array;
};

export const NO_DATA = -32768;

/** Tak jak zapisuje skrypt: wysokości int16 little-endian w base64. */
export type DemJson = {
  north: number;
  west: number;
  dLat: number;
  dLon: number;
  rows: number;
  cols: number;
  encoding: string;
  data: string;
  source?: string;
  generated?: string;
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 → bajty. Własna funkcja, bo w telefonie nie ma Buffer, a atob przy kilku MB jest wolny. */
export function base64ToBytes(text: string): Uint8Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? lookup[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < clean.length ? lookup[clean.charCodeAt(i + 3)] : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** Plik z danymi terenu → Dem; null, gdy plik jest pusty albo uszkodzony. */
export function parseDem(json: unknown): Dem | null {
  const j = json as Partial<DemJson> | null;
  if (!j || j.encoding !== 'int16le-base64' || typeof j.data !== 'string') return null;
  const { north, west, dLat, dLon, rows, cols } = j;
  const nums = [north, west, dLat, dLon, rows, cols];
  if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null;
  if (!(rows! > 1 && cols! > 1 && dLat! > 0 && dLon! > 0)) return null;
  const bytes = base64ToBytes(j.data);
  if (bytes.length < rows! * cols! * 2) return null;
  const heights = new Int16Array(rows! * cols!);
  for (let i = 0; i < heights.length; i++) {
    const v = bytes[2 * i] | (bytes[2 * i + 1] << 8);
    heights[i] = v >= 0x8000 ? v - 0x10000 : v;
  }
  return { north: north!, west: west!, dLat: dLat!, dLon: dLon!, rows: rows!, cols: cols!, heights };
}

/** Wysokość terenu w punkcie (interpolacja z 4 najbliższych oczek); null poza siatką albo bez danych. */
export function elevationAt(dem: Dem, latitude: number, longitude: number): number | null {
  // Środek oczka (r, c) leży w (north - (r + 0.5)·dLat, west + (c + 0.5)·dLon)
  const fr = (dem.north - latitude) / dem.dLat - 0.5;
  const fc = (longitude - dem.west) / dem.dLon - 0.5;
  if (!(fr >= -0.5 && fc >= -0.5 && fr <= dem.rows - 0.5 && fc <= dem.cols - 0.5)) return null;
  const r0 = Math.min(Math.max(Math.floor(fr), 0), dem.rows - 2);
  const c0 = Math.min(Math.max(Math.floor(fc), 0), dem.cols - 2);
  const tr = Math.min(Math.max(fr - r0, 0), 1);
  const tc = Math.min(Math.max(fc - c0, 0), 1);
  const i = r0 * dem.cols + c0;
  const h = dem.heights;
  const a = h[i];
  const b = h[i + 1];
  const c = h[i + dem.cols];
  const d = h[i + dem.cols + 1];
  if (a === NO_DATA || b === NO_DATA || c === NO_DATA || d === NO_DATA) return null;
  return (a * (1 - tc) + b * tc) * (1 - tr) + (c * (1 - tc) + d * tc) * tr;
}

/** Wzrost oka nad terenem w metrach. */
export const EYE_HEIGHT = 1.7;
/** Wysokość z GPS bierzemy tylko, gdy jest o tyle wyżej niż teren (wieża, schronisko) – GPS w pionie myli się o dziesiątki metrów. */
export const GPS_ABOVE_GROUND = 50;
/** Szczyt z bazy bliżej niż tyle metrów = stoimy na szczycie. */
export const ON_PEAK_RADIUS = 80;

export type ObserverHeight = {
  /** Wysokość oczu n.p.m. w metrach */
  elevation: number;
  /** Skąd: teren z DEM, wysokość szczytu z bazy (stoimy na nim) albo GPS telefonu */
  source: 'dem' | 'peak' | 'gps';
};

type PeakLike = GeoPoint & { ele?: number };

/**
 * Wysokość obserwatora (PLAN.md 7.2 pkt 2): teren z DEM + wzrost. Siatka 90 m obniża wierzchołki, więc gdy
 * zdjęcie zrobiono na szczycie z bazy, bierzemy jego wysokość. GPS tylko, gdy jest wyraźnie wyżej niż teren.
 */
export function observerHeight(
  dem: Dem | null,
  point: GeoPoint,
  options: { gpsAltitude?: number; peaks?: readonly PeakLike[] } = {},
): ObserverHeight | null {
  let ground = dem ? elevationAt(dem, point.latitude, point.longitude) : null;
  let source: ObserverHeight['source'] = 'dem';
  for (const peak of options.peaks ?? []) {
    if (peak.ele === undefined || flatDistance(point, peak) > ON_PEAK_RADIUS) continue;
    if (ground === null || peak.ele > ground) {
      ground = peak.ele;
      source = 'peak';
    }
  }
  const gps = options.gpsAltitude;
  if (ground === null) return gps !== undefined ? { elevation: gps, source: 'gps' } : null;
  if (gps !== undefined && gps > ground + GPS_ABOVE_GROUND) return { elevation: gps, source: 'gps' };
  return { elevation: ground + EYE_HEIGHT, source };
}

const M_PER_DEG_LAT = 111_320;

/** Szybka odległość w metrach dla małych odległości (do sprawdzania „czy stoimy na szczycie”). */
function flatDistance(a: GeoPoint, b: GeoPoint): number {
  const dy = (b.latitude - a.latitude) * M_PER_DEG_LAT;
  const dx = (b.longitude - a.longitude) * M_PER_DEG_LAT * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dx, dy);
}
