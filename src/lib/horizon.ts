// Panorama horyzontu i widoczne szczyty z miejsca zdjęcia (PLAN.md 7.2 pkt 3–4). Czyste funkcje, bez Reacta.
// Promienie z punktu obserwatora idą po modelu terenu (dem.ts); uwzględniamy krzywiznę Ziemi i refrakcję.
import { elevationAt, type Dem } from './dem';
import type { GeoPoint } from './exif';
import { distanceMeters } from './places';

const EARTH_RADIUS = 6_371_000;
/** Współczynnik refrakcji: światło zakrzywia się w atmosferze i widać trochę dalej niż przy prostej linii. */
const REFRACTION = 0.13;
const M_PER_DEG_LAT = 111_320;
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

export type Observer = GeoPoint & { /** wysokość oczu n.p.m. (observerHeight w dem.ts) */ elevation: number };

export type RayOptions = {
  /** Najdalej (m) – dalej i tak kończy się siatka terenu */
  maxDistance?: number;
  /** Pierwszy krok (m) i przyrost kroku z odległością (0,005 = 0,5% odległości) */
  minStep?: number;
  stepFactor?: number;
};

const DEFAULTS: Required<RayOptions> = { maxDistance: 120_000, minStep: 30, stepFactor: 0.005 };

/** O tyle metrów teren „opada” na odległości d przez krzywiznę Ziemi (pomniejszone o refrakcję). */
export function curvatureDrop(distance: number): number {
  return ((distance * distance) / (2 * EARTH_RADIUS)) * (1 - REFRACTION);
}

/** Kąt (stopnie) nad poziomem oka, pod jakim widać punkt o wysokości `height` w odległości `distance`. */
export function elevationAngle(observerElevation: number, height: number, distance: number): number {
  return Math.atan2(height - observerElevation - curvatureDrop(distance), distance) * DEG;
}

/** Azymut (stopnie od północy, 0–360) z punktu a do b. */
export function bearing(a: GeoPoint, b: GeoPoint): number {
  const f1 = a.latitude * RAD;
  const f2 = b.latitude * RAD;
  const dl = (b.longitude - a.longitude) * RAD;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) * DEG) % 360 + 360) % 360;
}

type RayMax = { angle: number; distance: number };

/** Największy kąt terenu wzdłuż promienia w azymucie `azimuth`, między odległościami from i to (m). */
function rayMax(dem: Dem, o: Observer, azimuth: number, from: number, to: number, opt: Required<RayOptions>): RayMax {
  const mLon = M_PER_DEG_LAT * Math.cos(o.latitude * RAD);
  const dLat = Math.cos(azimuth * RAD) / M_PER_DEG_LAT;
  const dLon = Math.sin(azimuth * RAD) / mLon;
  let best: RayMax = { angle: -90, distance: 0 };
  let d = Math.max(from, opt.minStep);
  while (d <= to) {
    const h = elevationAt(dem, o.latitude + d * dLat, o.longitude + d * dLon);
    if (h === null) break; // koniec siatki
    const angle = Math.atan2(h - o.elevation - curvatureDrop(d), d) * DEG;
    if (angle > best.angle) best = { angle, distance: d };
    d += Math.max(opt.minStep, d * opt.stepFactor);
  }
  return best;
}

export type Horizon = {
  /** Co ile stopni azymutu; indeks i = azymut from + i·step */
  step: number;
  /** Azymut pierwszej próbki (stopnie) – 0 dla pełnej panoramy */
  from: number;
  /** Kąt linii horyzontu nad poziomem oka (stopnie); -90 = brak terenu w tym kierunku */
  angles: Float32Array;
  /** Odległość do miejsca, które tworzy horyzont (m) */
  distances: Float32Array;
};

/**
 * Panorama: dla każdego azymutu najwyżej widoczny punkt terenu. Domyślnie pełne 360° (przy kroku 0,1° to 3600
 * promieni); `range` = [od, szerokość] w stopniach liczy tylko wycinek – np. kadr zdjęcia z zapasem.
 */
export function computeHorizon(
  dem: Dem,
  observer: Observer,
  step = 0.1,
  options: RayOptions = {},
  range: [number, number] = [0, 360],
): Horizon {
  const opt = { ...DEFAULTS, ...options };
  const n = Math.max(1, Math.round(Math.min(range[1], 360) / step));
  const from = ((range[0] % 360) + 360) % 360;
  const angles = new Float32Array(n);
  const distances = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rayMax(dem, observer, (from + i * step) % 360, 0, opt.maxDistance, opt);
    angles[i] = r.angle;
    distances[i] = r.distance;
  }
  return { step, from, angles, distances };
}

/** Kąt horyzontu w danym azymucie (najbliższa próbka); NaN poza policzonym wycinkiem. */
export function horizonAt(horizon: Horizon, azimuth: number): number {
  const n = horizon.angles.length;
  const rel = (((azimuth - horizon.from) % 360) + 360) % 360;
  let i = Math.round(rel / horizon.step);
  if (n * horizon.step >= 359.999) i %= n;
  return i >= 0 && i < n ? horizon.angles[i] : NaN;
}

export type PeakLike = GeoPoint & { ele?: number };

export type PeakView<P extends PeakLike> = {
  peak: P;
  /** Azymut (stopnie od północy) i odległość (m) od obserwatora */
  azimuth: number;
  distance: number;
  /** Kąt wierzchołka nad poziomem oka (stopnie) */
  angle: number;
  /** O ile stopni wierzchołek wystaje nad teren przed nim (ujemne = zasłonięty) */
  clearance: number;
  /** true – wierzchołek tworzy linię nieba (nic dalej za nim nie jest wyżej); false – widać go na tle dalszych gór */
  onSkyline: boolean;
};

export type VisibleOptions = RayOptions & {
  /** Bliżej nie podpisujemy (stoimy na szczycie albo tuż przy nim) */
  minDistance?: number;
  /** Tolerancja na niedokładność siatki 90 m: szczyt „wystający” o -tolerance° jeszcze liczymy jako widoczny */
  tolerance?: number;
  /** Tylko szczyty w wycinku [od, szerokość] stopni azymutu (np. kadr zdjęcia z zapasem) */
  range?: [number, number];
};

/**
 * Szczyty widoczne z miejsca obserwatora (PLAN.md 7.2 pkt 4), posortowane wg azymutu. Wysokość szczytu: większa
 * z bazy OSM i z DEM (siatka obniża wierzchołki). Teren tuż przy szczycie pomijamy – to jego własne zbocze.
 */
export function visiblePeaks<P extends PeakLike>(
  dem: Dem,
  observer: Observer,
  peaks: readonly P[],
  options: VisibleOptions = {},
): PeakView<P>[] {
  const opt = { ...DEFAULTS, ...options };
  const minDistance = options.minDistance ?? 100;
  const tolerance = options.tolerance ?? 0.05;
  const out: PeakView<P>[] = [];
  for (const peak of peaks) {
    const distance = distanceMeters(observer, peak);
    if (distance < minDistance || distance > opt.maxDistance) continue;
    const demHeight = elevationAt(dem, peak.latitude, peak.longitude);
    const height = Math.max(peak.ele ?? -Infinity, demHeight ?? -Infinity);
    if (!Number.isFinite(height)) continue;
    const azimuth = bearing(observer, peak);
    if (options.range && (((azimuth - options.range[0]) % 360) + 360) % 360 > options.range[1]) continue;
    const angle = elevationAngle(observer.elevation, height, distance);
    const margin = Math.max(150, distance * 0.02);
    const before = rayMax(dem, observer, azimuth, 0, distance - margin, opt);
    const clearance = angle - before.angle;
    if (clearance < -tolerance) continue;
    const behind = rayMax(dem, observer, azimuth, distance + margin, opt.maxDistance, opt);
    out.push({ peak, azimuth, distance, angle, clearance, onSkyline: angle >= behind.angle });
  }
  return out.sort((a, b) => a.azimuth - b.azimuth);
}
