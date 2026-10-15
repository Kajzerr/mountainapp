// Punkty charakterystyczne w aplikacji. Skąd (w tej kolejności):
// 1. plik w telefonie (ostatnie pobranie / odświeżenie),
// 2. plik wbudowany w aplikację (src/data/tatry-osm.json, tworzy go `npm.cmd run pois`),
// 3. pobranie z OpenStreetMap (Overpass API) – kilka serwerów po kolei, bo pojedynczy bywa przeciążony.
import { File, Paths } from 'expo-file-system';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import BUNDLED from '../data/tatry-osm.json';
import { overpassQuery, parseOverpass, parsePois, type Poi } from './pois';

/** Serwery Overpass – publiczne, utrzymywane przez społeczność OSM; próbujemy po kolei. */
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const CACHE_FILE = 'pois-v1.json';
const TIMEOUT_MS = 60000;

export type PoiStatus = 'loading' | 'ready' | 'error';

type PoisContextValue = {
  pois: Poi[];
  status: PoiStatus;
  /** Przyczyna ostatniego błędu (np. "HTTP 429") – do pokazania przy komunikacie */
  errorDetail: string | null;
  byId: Map<string, Poi>;
  /** Pobiera punkty od nowa (Menu → odśwież albo „Ponów” po błędzie) */
  refresh: () => void;
};

const PoisContext = createContext<PoisContextValue | null>(null);

function cacheFile(): File {
  return new File(Paths.document, CACHE_FILE);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Pobranie z pierwszego serwera, który odpowie poprawnie; błąd zawiera przyczyny ze wszystkich serwerów. */
async function download(): Promise<Poi[]> {
  const body = `data=${encodeURIComponent(overpassQuery())}`;
  const problems: string[] = [];
  for (const url of OVERPASS_MIRRORS) {
    const host = url.split('/')[2];
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'MountainMap/1.0 (com.massifmobile.mountainmap)',
        },
        body,
      });
      if (!res.ok) {
        problems.push(`${host}: HTTP ${res.status}`);
        continue;
      }
      const json: unknown = await res.json();
      const pois = parseOverpass(json);
      if (pois.length > 0) return pois;
      const remark = (json as { remark?: unknown })?.remark;
      problems.push(`${host}: ${typeof remark === 'string' ? remark.slice(0, 80) : 'empty'}`);
    } catch (e) {
      problems.push(`${host}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(problems.join('; '));
}

export function PoisProvider({ children }: { children: ReactNode }) {
  const [pois, setPois] = useState<Poi[]>([]);
  const [status, setStatus] = useState<PoiStatus>('loading');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const poisRef = useRef<Poi[]>([]);

  const show = useCallback((list: Poi[]) => {
    poisRef.current = list;
    setPois(list);
    setStatus('ready');
    setErrorDetail(null);
  }, []);

  const load = useCallback(
    async (force: boolean) => {
      setStatus('loading');
      if (!force) {
        try {
          const file = cacheFile();
          const cached = file.exists ? parsePois(await file.text()) : [];
          if (cached.length > 0) return show(cached);
        } catch (e) {
          console.warn('Could not read cached points', e);
        }
        const bundled = parseOverpass(BUNDLED);
        if (bundled.length > 0) return show(bundled);
      }
      try {
        const fresh = await download();
        try {
          const file = cacheFile();
          file.create({ overwrite: true });
          file.write(JSON.stringify(fresh));
        } catch (e) {
          console.warn('Could not save points', e);
        }
        show(fresh);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.warn('Could not load points', detail);
        setErrorDetail(detail);
        // Przy odświeżaniu zostawiamy poprzednie punkty – błąd pokazujemy tylko, gdy nie ma żadnych
        setStatus(poisRef.current.length > 0 ? 'ready' : 'error');
      }
    },
    [show],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  const value = useMemo(
    () => ({ pois, status, errorDetail, byId: new Map(pois.map((p) => [p.id, p])), refresh }),
    [pois, status, errorDetail, refresh],
  );
  return <PoisContext.Provider value={value}>{children}</PoisContext.Provider>;
}

export function usePois(): PoisContextValue {
  const ctx = useContext(PoisContext);
  if (!ctx) throw new Error('usePois must be used inside PoisProvider');
  return ctx;
}
