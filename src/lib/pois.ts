// Punkty charakterystyczne Tatr (szczyty, przełęcze, schroniska, początki szlaków…) z OpenStreetMap.
// Czyste funkcje: zapytanie do Overpass API, odczyt odpowiedzi, wybór punktów widocznych na mapie.
import OVERPASS_QUERY from '../data/overpass-query.json';

export type PoiKind = 'peak' | 'saddle' | 'hut' | 'trailhead' | 'lake' | 'junction';

export type Poi = {
  /** id z OSM z literą typu: n123 (punkt), w456 (obszar, np. jezioro) */
  id: string;
  kind: PoiKind;
  /** Nazwa z mapy (po słowackiej stronie – słowacka) */
  name: string;
  /** Polska nazwa, jeśli różni się od `name` (np. „Gerlach” dla „Gerlachovský štít”) */
  namePl?: string;
  latitude: number;
  longitude: number;
  /** Wysokość n.p.m. w metrach */
  ele?: number;
};

/** Tatry polskie i słowackie z zapasem: [południe, zachód, północ, wschód]. */
export const TATRY_BBOX: readonly number[] = OVERPASS_QUERY.bbox;

/** Kolejność ważności: przy wielu punktach w kadrze pokazujemy najpierw ważniejsze. */
export const KIND_PRIORITY: Record<PoiKind, number> = {
  hut: 0, peak: 1, saddle: 2, trailhead: 3, lake: 4, junction: 5,
};

/** Rodzaje widoczne dopiero przy dużym przybliżeniu (dużo ich, np. drogowskazy na rozdrożach). */
const CLOSE_ONLY: PoiKind[] = ['junction'];

/** Zapytanie Overpass QL o wszystkie punkty planowania w Tatrach (wspólne z scripts/fetch-pois.mjs). */
export function overpassQuery(bbox: readonly number[] = TATRY_BBOX): string {
  return OVERPASS_QUERY.query.split('{{bbox}}').join(bbox.join(','));
}

/** Wysokość z tagu ele: "2499", "2499 m", "2 499,5" → liczba; bzdury → undefined. */
export function parseEle(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const n = Number(value.replace(/\s/g, '').replace(',', '.').replace(/m$/i, ''));
  return Number.isFinite(n) && n > 0 && n < 9000 ? Math.round(n) : undefined;
}

type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function kindOf(tags: Record<string, string>): PoiKind | null {
  if (tags.tourism === 'alpine_hut') return 'hut';
  if (tags.natural === 'peak') return 'peak';
  if (tags.natural === 'saddle' || tags.mountain_pass === 'yes') return 'saddle';
  if (tags.highway === 'trailhead') return 'trailhead';
  if (tags.natural === 'water') return 'lake';
  if (tags.information === 'guidepost') return 'junction';
  return null;
}

/** Odpowiedź Overpass → lista punktów (bez duplikatów, uszkodzone pomijamy). */
export function parseOverpass(json: unknown): Poi[] {
  const elements = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];
  const byId = new Map<string, Poi>();
  for (const el of elements as OsmElement[]) {
    const tags = el?.tags;
    if (!tags?.name) continue;
    const kind = kindOf(tags);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!kind || typeof lat !== 'number' || typeof lon !== 'number') continue;
    const id = `${el.type.charAt(0)}${el.id}`;
    const poi: Poi = { id, kind, name: tags.name, latitude: lat, longitude: lon };
    const pl = tags['name:pl'];
    if (pl && pl !== tags.name) poi.namePl = pl;
    const ele = parseEle(tags.ele);
    if (ele !== undefined) poi.ele = ele;
    byId.set(id, poi);
  }
  return [...byId.values()];
}

/** Nazwa w języku aplikacji: po polsku polska nazwa, jeśli istnieje. */
export function poiName(poi: Pick<Poi, 'name' | 'namePl'>, lang: string): string {
  return lang === 'pl' && poi.namePl ? poi.namePl : poi.name;
}

/** Zapisane punkty; uszkodzone wpisy pomijamy. */
export function parsePois(json: string | null): Poi[] {
  if (!json) return [];
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (p): p is Poi =>
        !!p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string' &&
        typeof p.latitude === 'number' && typeof p.longitude === 'number' && p.kind in KIND_PRIORITY,
    );
  } catch {
    return [];
  }
}

export type Bounds = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** Punkty pokazujemy dopiero od takiego przybliżenia (wysokość kadru w stopniach ≈ 17 km). */
export const POI_MAX_DELTA = 0.16;
/** Drogowskazy i podobne – dopiero przy większym przybliżeniu (≈ 5 km). */
export const CLOSE_MAX_DELTA = 0.05;
/** Najwięcej znaczników naraz – więcej spowalnia mapę. */
export const MAX_VISIBLE = 120;

/** Punkty w kadrze mapy: ważniejsze najpierw, wyższe szczyty przed niższymi, maks. `limit`. */
export function visiblePois(pois: Poi[], region: Bounds, limit = MAX_VISIBLE): Poi[] {
  if (region.latitudeDelta > POI_MAX_DELTA) return [];
  const close = region.latitudeDelta <= CLOSE_MAX_DELTA;
  const s = region.latitude - region.latitudeDelta / 2;
  const n = region.latitude + region.latitudeDelta / 2;
  const w = region.longitude - region.longitudeDelta / 2;
  const e = region.longitude + region.longitudeDelta / 2;
  return pois
    .filter(
      (p) =>
        (close || !CLOSE_ONLY.includes(p.kind)) &&
        p.latitude >= s && p.latitude <= n && p.longitude >= w && p.longitude <= e,
    )
    .sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || (b.ele ?? 0) - (a.ele ?? 0) || a.id.localeCompare(b.id))
    .slice(0, limit);
}
