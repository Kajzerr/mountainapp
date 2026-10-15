// Planowana wycieczka: kontekst + zapis w AsyncStorage + trasa po szlakach (BRouter).
// Ekrany zmieniają wycieczkę tylko przez useTrip().
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRoute } from './routing';
import {
  EMPTY_TRIP, insertVia, movePoint, orderedPoints, parseTrip, removePoint, reverseTrip, type RoutePoint,
  routeStats, type RouteStats, setEnd, setStart, type Trip, tripKey, type TripPoint,
} from './trip';

const TRIP_KEY = 'mountainmap.trip.v1';
const ROUTE_KEY = 'mountainmap.route.v1';
/** Chwila zwłoki – kilka szybkich zmian (np. przesuwanie punktów) = jedno zapytanie o trasę */
const ROUTE_DEBOUNCE_MS = 600;

export type RouteState =
  | { status: 'none' }
  | { status: 'loading' }
  /** exact = po szlakach; false = linie proste (brak sieci / błąd) */
  | { status: 'ready'; points: RoutePoint[]; stats: RouteStats; exact: boolean };

type TripContextValue = {
  trip: Trip;
  ordered: TripPoint[];
  route: RouteState;
  setStart: (p: TripPoint) => void;
  setEnd: (p: TripPoint) => void;
  /** position od 1 */
  addVia: (p: TripPoint, position: number) => void;
  remove: (id: string) => void;
  move: (id: string, delta: -1 | 1) => void;
  reverse: () => void;
  clear: () => void;
  retryRoute: () => void;
};

const TripContext = createContext<TripContextValue | null>(null);

type SavedRoute = { key: string; points: RoutePoint[] };

export function TripProvider({ children }: { children: ReactNode }) {
  const [trip, setTrip] = useState<Trip>(EMPTY_TRIP);
  const [loaded, setLoaded] = useState(false);
  const [route, setRoute] = useState<RouteState>({ status: 'none' });
  const [retry, setRetry] = useState(0);
  // Ostatnia trasa po szlakach – żeby po ponownym uruchomieniu nie pytać serwera o to samo
  const savedRoute = useRef<SavedRoute | null>(null);

  useEffect(() => {
    AsyncStorage.multiGet([TRIP_KEY, ROUTE_KEY])
      .then(([[, tripJson], [, routeJson]]) => {
        setTrip(parseTrip(tripJson));
        try {
          const r = routeJson ? (JSON.parse(routeJson) as SavedRoute) : null;
          if (r && typeof r.key === 'string' && Array.isArray(r.points)) savedRoute.current = r;
        } catch {
          // uszkodzona trasa – zostanie policzona od nowa
        }
      })
      .catch((e) => console.warn('Could not load trip', e))
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((change: (prev: Trip) => Trip) => {
    setTrip((prev) => {
      const next = change(prev);
      AsyncStorage.setItem(TRIP_KEY, JSON.stringify(next)).catch((e) => console.warn('Could not save trip', e));
      return next;
    });
  }, []);

  const ordered = useMemo(() => orderedPoints(trip), [trip]);
  const key = useMemo(() => tripKey(trip), [trip]);

  // Trasa liczy się sama po każdej zmianie kolejności lub punktów
  useEffect(() => {
    if (!loaded) return;
    if (ordered.length < 2) {
      setRoute({ status: 'none' });
      return;
    }
    const saved = savedRoute.current;
    if (saved && saved.key === key) {
      setRoute({ status: 'ready', points: saved.points, stats: routeStats(saved.points), exact: true });
      return;
    }
    let cancelled = false;
    setRoute({ status: 'loading' });
    const timer = setTimeout(async () => {
      const points = await fetchRoute(ordered);
      if (cancelled) return;
      if (points) {
        savedRoute.current = { key, points };
        AsyncStorage.setItem(ROUTE_KEY, JSON.stringify(savedRoute.current)).catch(() => {});
        setRoute({ status: 'ready', points, stats: routeStats(points), exact: true });
      } else {
        // Przybliżenie: linie proste; wysokości znamy tylko z punktów, które ją mają
        const straight: RoutePoint[] = ordered.map((p) => ({ latitude: p.latitude, longitude: p.longitude, ele: p.ele }));
        setRoute({ status: 'ready', points: straight, stats: routeStats(straight), exact: false });
      }
    }, ROUTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loaded, key, ordered, retry]);

  const value = useMemo<TripContextValue>(
    () => ({
      trip,
      ordered,
      route,
      setStart: (p) => update((t) => setStart(t, p)),
      setEnd: (p) => update((t) => setEnd(t, p)),
      addVia: (p, position) => update((t) => insertVia(t, p, position)),
      remove: (id) => update((t) => removePoint(t, id)),
      move: (id, delta) => update((t) => movePoint(t, id, delta)),
      reverse: () => update(reverseTrip),
      clear: () => update(() => EMPTY_TRIP),
      retryRoute: () => setRetry((n) => n + 1),
    }),
    [trip, ordered, route, update],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside TripProvider');
  return ctx;
}
