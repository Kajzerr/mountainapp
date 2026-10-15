import type { Dict } from '../lib/i18n';
import type { Trip, TripPoint } from '../lib/trip';
import { roleOf } from '../lib/trip';

/** Nazwa roli punktu na trasie: „Początek”, „Punkt 2”, „Koniec”; null = punktu nie ma na trasie. */
export function roleLabel(t: Dict, trip: Trip, point: Pick<TripPoint, 'id'>): string | null {
  const r = roleOf(trip, point.id);
  if (!r) return null;
  if (r.role === 'start') return t.trip.start;
  if (r.role === 'end') return t.trip.end;
  return t.trip.via(r.index ?? 1);
}
