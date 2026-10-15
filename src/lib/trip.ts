// Plan wycieczki: początek, punkty pośrednie (w kolejności) i koniec. Czyste funkcje, bez Reacta.
import type { GeoPoint } from './exif';
import { distanceMeters } from './places';
import type { Poi } from './pois';

/** Punkt wycieczki – kopia danych punktu z mapy (wycieczka działa, nawet gdy punktów nie ma już w pamięci). */
export type TripPoint = Pick<Poi, 'id' | 'kind' | 'name' | 'namePl' | 'latitude' | 'longitude' | 'ele'>;

export type Trip = {
  start?: TripPoint;
  /** Punkty pośrednie w kolejności przejścia */
  via: TripPoint[];
  end?: TripPoint;
};

export type TripRole = 'start' | 'via' | 'end';

export const EMPTY_TRIP: Trip = { via: [] };

export function toTripPoint(p: TripPoint): TripPoint {
  const t: TripPoint = { id: p.id, kind: p.kind, name: p.name, latitude: p.latitude, longitude: p.longitude };
  if (p.namePl) t.namePl = p.namePl;
  if (p.ele !== undefined) t.ele = p.ele;
  return t;
}

/** Wszystkie punkty w kolejności przejścia. */
export function orderedPoints(trip: Trip): TripPoint[] {
  return [...(trip.start ? [trip.start] : []), ...trip.via, ...(trip.end ? [trip.end] : [])];
}

export function isEmpty(trip: Trip): boolean {
  return orderedPoints(trip).length === 0;
}

/** Rola punktu w wycieczce (null = punktu nie ma w wycieczce) i numer punktu pośredniego (od 1). */
export function roleOf(trip: Trip, id: string): { role: TripRole; index?: number } | null {
  if (trip.start?.id === id) return { role: 'start' };
  if (trip.end?.id === id) return { role: 'end' };
  const i = trip.via.findIndex((p) => p.id === id);
  return i >= 0 ? { role: 'via', index: i + 1 } : null;
}

/** Wycieczka bez danego punktu (punkt może być tylko w jednym miejscu trasy). */
export function removePoint(trip: Trip, id: string): Trip {
  return {
    start: trip.start?.id === id ? undefined : trip.start,
    via: trip.via.filter((p) => p.id !== id),
    end: trip.end?.id === id ? undefined : trip.end,
  };
}

/** Ustawia początek (poprzedni początek wypada). */
export function setStart(trip: Trip, p: TripPoint): Trip {
  return { ...removePoint(trip, p.id), start: toTripPoint(p) };
}

/** Ustawia koniec (poprzedni koniec wypada). */
export function setEnd(trip: Trip, p: TripPoint): Trip {
  return { ...removePoint(trip, p.id), end: toTripPoint(p) };
}

/** Wstawia punkt pośredni jako `position`-ty (od 1); poza zakresem – na koniec punktów pośrednich. */
export function insertVia(trip: Trip, p: TripPoint, position: number): Trip {
  const base = removePoint(trip, p.id);
  const via = [...base.via];
  const i = Math.max(0, Math.min(via.length, Math.round(position) - 1));
  via.splice(i, 0, toTripPoint(p));
  return { ...base, via };
}

/** Przebudowa z listy w kolejności, z zachowaniem tego, czy wycieczka ma początek i koniec. */
function fromOrdered(list: TripPoint[], hasStart: boolean, hasEnd: boolean): Trip {
  const rest = [...list];
  const start = hasStart ? rest.shift() : undefined;
  const end = hasEnd && rest.length > 0 ? rest.pop() : undefined;
  return { start, via: rest, end };
}

/** Przesuwa punkt o jedno miejsce w kolejności (delta -1 = wcześniej, +1 = później). */
export function movePoint(trip: Trip, id: string, delta: -1 | 1): Trip {
  const list = orderedPoints(trip);
  const i = list.findIndex((p) => p.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return trip;
  [list[i], list[j]] = [list[j], list[i]];
  return fromOrdered(list, !!trip.start, !!trip.end);
}

/** Trasa w drugą stronę. */
export function reverseTrip(trip: Trip): Trip {
  return { start: trip.end, via: [...trip.via].reverse(), end: trip.start };
}

/** Zapisana wycieczka; uszkodzone dane → pusta. */
export function parseTrip(json: string | null): Trip {
  if (!json) return EMPTY_TRIP;
  try {
    const raw = JSON.parse(json) as Partial<Trip>;
    const ok = (p: unknown): p is TripPoint =>
      !!p && typeof p === 'object' && typeof (p as TripPoint).id === 'string' &&
      typeof (p as TripPoint).latitude === 'number' && typeof (p as TripPoint).longitude === 'number';
    return {
      start: ok(raw.start) ? raw.start : undefined,
      via: Array.isArray(raw.via) ? raw.via.filter(ok) : [],
      end: ok(raw.end) ? raw.end : undefined,
    };
  } catch {
    return EMPTY_TRIP;
  }
}

/** Klucz trasy: zmienia się tylko, gdy zmienia się kolejność albo położenie punktów. */
export function tripKey(trip: Trip): string {
  return orderedPoints(trip).map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`).join('|');
}

// ── Statystyki trasy ──

/** Punkt trasy z wysokością (z wyznaczania trasy po szlakach). */
export type RoutePoint = GeoPoint & { ele?: number };

export type RouteStats = {
  distanceM: number;
  ascentM: number;
  descentM: number;
  /** Szacowany czas przejścia w minutach (bez postojów) */
  minutes: number;
};

/** Zmiany wysokości mniejsze niż tyle metrów traktujemy jako szum danych (inaczej podejścia wychodzą za duże). */
const ELE_NOISE_M = 5;

/** Suma podejść i zejść z profilu wysokości, z odfiltrowaniem drobnych wahań. */
export function climb(points: RoutePoint[]): { ascentM: number; descentM: number } {
  let ascent = 0;
  let descent = 0;
  let ref: number | undefined;
  for (const p of points) {
    if (p.ele === undefined) continue;
    if (ref === undefined) {
      ref = p.ele;
      continue;
    }
    const d = p.ele - ref;
    if (d >= ELE_NOISE_M) {
      ascent += d;
      ref = p.ele;
    } else if (d <= -ELE_NOISE_M) {
      descent -= d;
      ref = p.ele;
    }
  }
  return { ascentM: Math.round(ascent), descentM: Math.round(descent) };
}

export function pathLength(points: GeoPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += distanceMeters(points[i - 1], points[i]);
  return sum;
}

/**
 * Czas przejścia w minutach – reguła stosowana w turystyce górskiej (DIN 33466):
 * 4 km/h w poziomie, 300 m/h pod górę, 500 m/h w dół; dłuższa część + połowa krótszej.
 * Wynik zbliżony do czasów z tabliczek na szlakach, ale to tylko szacunek.
 */
export function hikingMinutes(distanceM: number, ascentM: number, descentM: number): number {
  const horizontal = distanceM / 1000 / 4;
  const vertical = ascentM / 300 + descentM / 500;
  const hours = Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
  return Math.round(hours * 60);
}

export function routeStats(points: RoutePoint[]): RouteStats {
  const distanceM = Math.round(pathLength(points));
  const { ascentM, descentM } = climb(points);
  return { distanceM, ascentM, descentM, minutes: hikingMinutes(distanceM, ascentM, descentM) };
}

/** Czas "5:30" (godziny:minuty). */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
