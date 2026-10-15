// Wyznaczanie trasy po szlakach przez BRouter (darmowy serwer brouter.de, dane OpenStreetMap, profil górski).
// Bez internetu albo przy błędzie serwera – linie proste między punktami (oznaczone jako przybliżenie).
import type { GeoPoint } from './exif';
import type { RoutePoint } from './trip';

const BROUTER_URL = 'https://brouter.de/brouter';
/** Profil pieszy dopuszczający trudne ścieżki górskie (sprawdzane po kolei, gdyby serwer nie znał pierwszego) */
export const BROUTER_PROFILES = ['hiking-mountain', 'shortest'];
const TIMEOUT_MS = 20000;

export function brouterUrl(points: GeoPoint[], profile: string): string {
  const lonlats = points.map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join('|');
  return `${BROUTER_URL}?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;
}

/** Odpowiedź BRouter (GeoJSON) → punkty trasy z wysokością; null, gdy to nie jest poprawna trasa. */
export function parseBrouter(json: unknown): RoutePoint[] | null {
  const features = (json as { features?: unknown })?.features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const coords = (features[0] as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const points: RoutePoint[] = [];
  for (const c of coords) {
    if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') return null;
    const p: RoutePoint = { latitude: c[1], longitude: c[0] };
    if (typeof c[2] === 'number') p.ele = c[2];
    points.push(p);
  }
  return points;
}

/** Trasa po szlakach; null = nie udało się (brak sieci, serwer, punkt poza szlakami). */
export async function fetchRoute(points: GeoPoint[]): Promise<RoutePoint[] | null> {
  if (points.length < 2) return null;
  for (const profile of BROUTER_PROFILES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(brouterUrl(points, profile), { signal: controller.signal });
      if (!res.ok) continue;
      const route = parseBrouter(await res.json());
      if (route) return route;
    } catch (e) {
      console.warn('Routing failed', e);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
