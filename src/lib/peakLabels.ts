// Podpisy szczytów na zdjęciu (PLAN.md 7.2 pkt 5, krok 3): ustawienie aparatu → położenie szczytów i linii
// horyzontu na zdjęciu, wybór podpisów. Czyste funkcje, bez Reacta – testowalne w Node.
import { observerHeight, type Dem } from './dem';
import { computeHorizon, visiblePeaks, type Horizon, type Observer, type PeakLike, type PeakView } from './horizon';

const RAD = Math.PI / 180;

/** Przekątna klatki 35 mm (mm) – do niej odnosi się ogniskowa „35 mm” z EXIF. */
const FULL_FRAME_DIAGONAL = 43.27;
/** Ogniskowa, gdy zdjęcie jej nie podaje: główny aparat większości telefonów. */
export const DEFAULT_FOCAL_35 = 26;
/** Deklinacja magnetyczna w Tatrach (stopnie na wschód) – dla kierunku z kompasu magnetycznego ("M"). */
export const TATRY_DECLINATION = 5.5;
/** Linii horyzontu nie rysujemy bliżej niż tyle metrów – siatka 90 m „ścina” bliskie, strome skały. */
export const NEAR_HORIZON = 1500;
/** Zapas (stopnie) liczony poza kadrem z każdej strony – na przesuwanie palcem. */
export const PAN_MARGIN = 25;
/** Od tylu szczytów na zdjęciu pokazujemy same kropki, a nazwę dopiero po dotknięciu. */
export const DOTS_FROM = 5;

/** Ustawienie aparatu w stopniach. */
export type CameraPose = {
  /** Kierunek środka kadru od północy geograficznej */
  heading: number;
  /** Pochylenie w górę (+) / w dół (−) */
  pitch: number;
  /** Obrót kadru zgodnie z ruchem wskazówek zegara (+) */
  roll: number;
  /** Kąt widzenia w poziomie (szerokość zdjęcia) */
  hfov: number;
};

/** Kąt widzenia w poziomie (stopnie) dla zdjęcia width × height i ogniskowej 35 mm. */
export function horizontalFov(width: number, height: number, focal35 = DEFAULT_FOCAL_35): number {
  const diag = Math.hypot(width, height) || 1;
  const halfWidthMm = (FULL_FRAME_DIAGONAL / 2) * (width / diag);
  return (2 * Math.atan(halfWidthMm / focal35)) / RAD;
}

/** Kierunek względem północy geograficznej (kompas magnetyczny + deklinacja). */
export function trueHeading(direction: number, ref?: 'T' | 'M'): number {
  return ref === 'M' ? (direction + TATRY_DECLINATION + 360) % 360 : direction;
}

export type Point = { x: number; y: number };

/**
 * Punkt o azymucie i kącie wzniesienia → położenie na zdjęciu (0–1 od lewej i od góry). Pełna projekcja
 * kamery otworkowej; null, gdy punkt jest za aparatem. `aspect` = szerokość / wysokość zdjęcia.
 */
export function project(pose: CameraPose, aspect: number, azimuth: number, elevation: number): Point | null {
  const a = azimuth * RAD;
  const e = elevation * RAD;
  const h = pose.heading * RAD;
  const p = pose.pitch * RAD;
  const r = pose.roll * RAD;
  // Kierunek do punktu: (wschód, północ, góra)
  const d = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
  const fwd = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)];
  const right0 = [Math.cos(h), -Math.sin(h), 0];
  const up0 = [-Math.sin(h) * Math.sin(p), -Math.cos(h) * Math.sin(p), Math.cos(p)];
  // Obrót aparatu zgodnie z ruchem wskazówek zegara: prawa krawędź kadru schodzi w dół
  const right = right0.map((v, i) => v * Math.cos(r) - up0[i] * Math.sin(r));
  const up = up0.map((v, i) => v * Math.cos(r) + right0[i] * Math.sin(r));
  const dot = (u: number[]) => u[0] * d[0] + u[1] * d[1] + u[2] * d[2];
  const z = dot(fwd);
  if (z <= 1e-6) return null;
  const f = 0.5 / Math.tan((pose.hfov / 2) * RAD);
  return { x: 0.5 + (f * dot(right)) / z, y: 0.5 - (f * aspect * dot(up)) / z };
}

export type PhotoScene<P extends PeakLike> = {
  observer: Observer;
  /** Skąd wysokość obserwatora: teren, szczyt, na którym stoimy, albo GPS */
  heightSource: 'dem' | 'peak' | 'gps';
  /** Widoczne szczyty w wycinku kadr ± PAN_MARGIN */
  views: PeakView<P>[];
  horizon: Horizon;
};

/**
 * Ciężka część (ok. 1 s w telefonie): wysokość obserwatora, linia horyzontu i widoczne szczyty w wycinku wokół
 * kierunku zdjęcia. Liczona raz na zdjęcie; przesuwanie palcem korzysta już tylko z `layoutLabels`.
 */
export function analyzeScene<P extends PeakLike>(
  dem: Dem,
  peaks: readonly P[],
  photo: { latitude: number; longitude: number; altitude?: number },
  heading: number,
  hfov: number,
): PhotoScene<P> | null {
  const height = observerHeight(dem, photo, { gpsAltitude: photo.altitude, peaks });
  if (!height) return null;
  const observer: Observer = { latitude: photo.latitude, longitude: photo.longitude, elevation: height.elevation };
  const width = Math.min(360, hfov + 2 * PAN_MARGIN);
  const range: [number, number] = [heading - width / 2, width];
  return {
    observer,
    heightSource: height.source,
    views: visiblePeaks(dem, observer, peaks, { range }),
    horizon: computeHorizon(dem, observer, 0.1, {}, range),
  };
}

export type PeakLabel<P extends PeakLike> = Point & { view: PeakView<P> };

/**
 * Ważność podpisu. Składniki:
 * - sława: wybitność szczytu (25 m → 0, 50 m → 1, 100 m → 2 … 800 m → 5); bez danych – średnio,
 * - wyrazistość na zdjęciu: o ile stopni wierzchołek wystaje nad teren przed nim (do 8°), ale tylko dla szczytów
 *   z wybitnością – turnia na grani ważniejszego szczytu wystaje tak samo jak on, a nie jest osobną górą,
 * - premia za linię nieba i za wysokość.
 * Dzięki temu bliski, wyraźny Kościelec (z Granatów) wygrywa z ledwo widocznym garbem daleko na horyzoncie,
 * a Gerlach – z turnią obok niego.
 */
export function importance(view: PeakView<PeakLike>): number {
  const prominence = view.peak.prominence;
  const fame = prominence === undefined ? 1 : Math.min(5, Math.max(0, Math.log2(prominence / 25)));
  const distinct = prominence === undefined ? 0.5 : Math.min(1, prominence / 50);
  const salience = 0.4 * distinct * Math.min(Math.max(view.clearance, 0), 8);
  return fame + salience + (view.onSkyline ? 1 : 0) + ((view.peak.ele ?? 1500) - 1500) / 500;
}

function rank<P extends PeakLike>(a: PeakView<P>, b: PeakView<P>): number {
  return importance(b) - importance(a);
}

/**
 * Szczyty do podpisania przy danym ustawieniu aparatu, od lewej. Wybieramy od najważniejszych (`importance`);
 * pomijamy te poza kadrem, ledwo wystające zza bliższego terenu i stojące zbyt blisko ważniejszego (odstęp
 * `minGap` szerokości zdjęcia w poziomie i półtora raza tyle w pionie).
 */
export function layoutLabels<P extends PeakLike>(
  scene: PhotoScene<P>,
  pose: CameraPose,
  aspect: number,
  options: { max?: number; minGap?: number; minClearance?: number } = {},
): PeakLabel<P>[] {
  const { max = 15, minGap = 0.04, minClearance = 0.3 } = options;
  const chosen: PeakLabel<P>[] = [];
  for (const view of [...scene.views].sort(rank)) {
    if (chosen.length >= max) break;
    if (!view.onSkyline && view.clearance < minClearance) continue;
    const pt = project(pose, aspect, view.azimuth, view.angle);
    if (!pt || pt.x < 0.02 || pt.x > 0.98 || pt.y < 0.02 || pt.y > 0.98) continue;
    // Za blisko ważniejszego – w poziomie i w pionie (bliska turnia pod dalekim szczytem może zostać)
    if (chosen.some((c) => Math.abs(c.x - pt.x) < minGap && Math.abs(c.y - pt.y) < minGap * 1.5)) continue;
    // Drugi wierzchołek tego samego szczytu (ta sama nazwa) – jeden podpis wystarczy
    if (view.peak.name && chosen.some((c) => c.view.peak.name === view.peak.name && Math.abs(c.x - pt.x) < 0.15)) continue;
    chosen.push({ ...pt, view });
  }
  return chosen.sort((a, b) => a.x - b.x);
}

/** Linia horyzontu na zdjęciu: odcinki (pomijamy bliski teren i miejsca poza kadrem). */
export function horizonLine(scene: PhotoScene<PeakLike>, pose: CameraPose, aspect: number): Point[][] {
  const { horizon } = scene;
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (let i = 0; i < horizon.angles.length; i++) {
    const az = horizon.from + i * horizon.step;
    const pt = horizon.distances[i] >= NEAR_HORIZON ? project(pose, aspect, az, horizon.angles[i]) : null;
    if (pt && pt.x >= -0.05 && pt.x <= 1.05) {
      current.push(pt);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments.filter((s) => s.length > 1);
}
