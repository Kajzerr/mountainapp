// Grupowanie zdjęć w „miejsca” – jeden znacznik na mapie dla zdjęć zrobionych w tym samym punkcie. Czyste funkcje.
import type { GeoPoint } from './exif';

/** Zdjęcia bliżej niż tyle metrów od środka miejsca trafiają do jednego znacznika. */
export const PLACE_RADIUS_M = 40;

export type Located = { id: string; latitude: number; longitude: number; takenAt?: string; importedAt: string };

export type Place = {
  /** id pierwszego (najwcześniejszego) zdjęcia – stałe, dopóki to zdjęcie istnieje */
  id: string;
  latitude: number;
  longitude: number;
  /** Od najwcześniejszego */
  photoIds: string[];
};

/** Odległość w metrach (wzór haversine – w skali Tatr dokładność aż nadto wystarczająca). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Kolejność chronologiczna: data z EXIF, a bez niej – moment dodania do aplikacji. */
export function photoTime(p: { takenAt?: string; importedAt: string }): string {
  return p.takenAt ?? p.importedAt;
}

/**
 * Zdjęcia → miejsca. Idziemy chronologicznie; zdjęcie dołącza do najbliższego miejsca w promieniu `radius`,
 * a środek miejsca to średnia jego zdjęć. Wynik nie zależy od kolejności zdjęć na wejściu.
 */
export function groupIntoPlaces<T extends Located>(photos: T[], radius = PLACE_RADIUS_M): Place[] {
  const sorted = [...photos].sort((a, b) => photoTime(a).localeCompare(photoTime(b)) || a.id.localeCompare(b.id));
  const places: Place[] = [];
  for (const p of sorted) {
    let best: Place | null = null;
    let bestDist = Infinity;
    for (const place of places) {
      const d = distanceMeters(place, p);
      if (d <= radius && d < bestDist) {
        best = place;
        bestDist = d;
      }
    }
    if (best) {
      const n = best.photoIds.length;
      best.latitude = (best.latitude * n + p.latitude) / (n + 1);
      best.longitude = (best.longitude * n + p.longitude) / (n + 1);
      best.photoIds.push(p.id);
    } else {
      places.push({ id: p.id, latitude: p.latitude, longitude: p.longitude, photoIds: [p.id] });
    }
  }
  return places;
}
