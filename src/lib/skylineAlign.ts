// Automatyczne dopasowanie podpisów do zdjęcia: szukamy na zdjęciu krawędzi „jasne niebo nad ciemniejszymi
// górami” i obracamy aparat (głównie kierunek – kompas myli się o kilka stopni), aż policzona linia horyzontu
// najlepiej się z nią pokryje. Pochylenie i obrót z czujnika grawitacji są dokładne, więc zmieniamy je tylko
// trochę. Czyste funkcje, bez Reacta – testowalne w Node (prototyp sprawdzony na zdjęciach z test-photos).
import type { Horizon } from './horizon';
import type { CameraPose } from './peakLabels';

const RAD = Math.PI / 180;

export type AlignLimits = { heading: number; pitch: number; roll: number; hfov: number };
/** Zakres szukania wokół ustawienia z czujników (stopnie; hfov – ułamek). */
export const ALIGN_LIMITS: AlignLimits = { heading: 15, pitch: 2.5, roll: 2, hfov: 0.06 };
/** Zdjęcie bez danych o nachyleniu telefonu (np. Android) – pochylenie i obrót szukamy w szerszym zakresie. */
export const ALIGN_LIMITS_NO_TILT: AlignLimits = { heading: 15, pitch: 10, roll: 4, hfov: 0.06 };
/** Wynik dopasowania (0–1) musi być co najmniej taki i lepszy od wyjściowego o tyle – inaczej zostają czujniki. */
export const MIN_SCORE = 0.4;
export const MIN_GAIN = 0.15;
/** Bliższego terenu nie bierzemy pod uwagę – siatka 90 m źle oddaje bliskie skały. */
const NEAR = 300;

/** Mapa krawędzi: wartość 0–1 tam, gdzie powyżej jest jaśniej / bardziej „niebiesko” niż poniżej. */
export type EdgeMap = { width: number; height: number; data: Float32Array };

/**
 * Mapa krawędzi z pikseli (RGB albo RGBA, `channels`). Dwie cechy: jasność oraz jasność + niebieskość – pierwsza
 * lepiej działa przy zamglonych dalekich szczytach, druga przy białych od śniegu górach na tle błękitu. Bierzemy
 * większą z nich, każdą znormalizowaną do 99. percentyla.
 */
export function edgeMap(pixels: Uint8Array, width: number, height: number, channels = 4): EdgeMap {
  const n = width * height;
  const luma = new Float32Array(n);
  const mix = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = pixels[i * channels];
    const g = pixels[i * channels + 1];
    const b = pixels[i * channels + 2];
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    luma[i] = l;
    mix[i] = 0.5 * l + (b - r);
  }
  const a = verticalEdges(luma, width, height);
  const c = verticalEdges(mix, width, height);
  for (let i = 0; i < n; i++) a[i] = Math.max(a[i], c[i]);
  return { width, height, data: a };
}

/** Średnia z 3 pikseli nad punktem minus średnia z 3 pod nim, ucięta do 0–1 po normalizacji. */
function verticalEdges(f: Float32Array, width: number, height: number): Float32Array {
  const K = 3;
  const out = new Float32Array(width * height);
  for (let y = K; y < height - K; y++) {
    for (let x = 0; x < width; x++) {
      let above = 0;
      let below = 0;
      for (let k = 1; k <= K; k++) {
        above += f[(y - k) * width + x];
        below += f[(y + k) * width + x];
      }
      out[y * width + x] = (above - below) / K;
    }
  }
  const positive = out.filter((v) => v > 0).sort();
  const norm = positive.length ? positive[Math.floor(positive.length * 0.99)] || 1 : 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(1, out[i] / norm));
  return out;
}

/** Kierunki do punktów linii horyzontu (wschód, północ, góra) – liczone raz, potem tylko iloczyny skalarne. */
function horizonDirections(horizon: Horizon): Float64Array {
  const dirs: number[] = [];
  for (let i = 0; i < horizon.angles.length; i += 2) {
    if (horizon.distances[i] < NEAR || horizon.angles[i] <= -89) continue;
    const a = (horizon.from + i * horizon.step) * RAD;
    const e = horizon.angles[i] * RAD;
    dirs.push(Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e));
  }
  return Float64Array.from(dirs);
}

/**
 * Jak dobrze linia horyzontu przy danym ustawieniu leży na krawędzi gór i nieba (0–1). Średnia z mapy krawędzi
 * wzdłuż linii (najlepszy z 3 pikseli w pionie), pomniejszona, gdy linia zajmuje mały kawałek kadru.
 */
function lineScore(dirs: Float64Array, pose: CameraPose, aspect: number, edges: EdgeMap): number {
  const h = pose.heading * RAD;
  const p = pose.pitch * RAD;
  const r = pose.roll * RAD;
  // Ta sama kamera co w peakLabels.project
  const fwd = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)];
  const right0 = [Math.cos(h), -Math.sin(h), 0];
  const up0 = [-Math.sin(h) * Math.sin(p), -Math.cos(h) * Math.sin(p), Math.cos(p)];
  const right = right0.map((v, i) => v * Math.cos(r) - up0[i] * Math.sin(r));
  const up = up0.map((v, i) => v * Math.cos(r) + right0[i] * Math.sin(r));
  const f = 0.5 / Math.tan((pose.hfov / 2) * RAD);
  const { width, height, data } = edges;
  let sum = 0;
  let hits = 0;
  let inView = 0;
  for (let k = 0; k < dirs.length; k += 3) {
    const dx = dirs[k];
    const dy = dirs[k + 1];
    const dz = dirs[k + 2];
    const z = fwd[0] * dx + fwd[1] * dy + fwd[2] * dz;
    if (z <= 1e-6) continue;
    const x = 0.5 + (f * (right[0] * dx + right[1] * dy + right[2] * dz)) / z;
    if (x < 0 || x >= 1) continue;
    inView++;
    const y = 0.5 - (f * aspect * (up[0] * dx + up[1] * dy + up[2] * dz)) / z;
    if (y < 0 || y >= 1) continue;
    const px = Math.floor(x * width);
    const py = Math.floor(y * height);
    let best = 0;
    for (let d = -1; d <= 1; d++) {
      const yy = py + d;
      if (yy >= 0 && yy < height) best = Math.max(best, data[yy * width + px]);
    }
    sum += best;
    hits++;
  }
  if (!hits) return 0;
  return (sum / hits) * Math.min(1, (hits / Math.max(inView, 1)) * 1.5);
}

export type AlignResult = {
  pose: CameraPose;
  /** Wynik przed i po dopasowaniu (0–1) */
  before: number;
  after: number;
  /** true – dopasowanie pewne, można go użyć zamiast czujników */
  confident: boolean;
};

/**
 * Dopasowanie ustawienia aparatu do linii gór na zdjęciu. Najpierw zgrubnie kierunek (co 0,5°) i pochylenie,
 * potem dokładniej wszystkie cztery wartości. Kara za odejście od czujników chroni przed „przeskoczeniem” na
 * inną grań. `aspect` = szerokość / wysokość zdjęcia (tak jak w `project`).
 */
export function alignToSkyline(
  horizon: Horizon,
  base: CameraPose,
  aspect: number,
  edges: EdgeMap,
  limits: AlignLimits = ALIGN_LIMITS,
): AlignResult {
  const dirs = horizonDirections(horizon);
  const L = limits;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const limit = (p: CameraPose): CameraPose => ({
    heading: clamp(p.heading, base.heading - L.heading, base.heading + L.heading),
    pitch: clamp(p.pitch, base.pitch - L.pitch, base.pitch + L.pitch),
    roll: clamp(p.roll, base.roll - L.roll, base.roll + L.roll),
    hfov: clamp(p.hfov, base.hfov * (1 - L.hfov), base.hfov * (1 + L.hfov)),
  });
  const penalty = (p: CameraPose) =>
    ((p.heading - base.heading) / 10) ** 2 +
    ((p.pitch - base.pitch) / Math.max(2, L.pitch * 0.8)) ** 2 +
    ((p.roll - base.roll) / Math.max(2, L.roll)) ** 2 +
    ((p.hfov / base.hfov - 1) / 0.05) ** 2;
  const total = (p: CameraPose) => lineScore(dirs, p, aspect, edges) - 0.01 * penalty(p);

  // Zgrubnie pochylenie ±2° (z czujnikiem) albo w całym zakresie co 1° (bez danych o nachyleniu)
  const coarsePitch = L.pitch > ALIGN_LIMITS.pitch ? L.pitch : 2;
  const coarseStep = coarsePitch > 2 ? 1 : 0.5;
  let best = base;
  let bestTotal = total(base);
  for (let dh = -L.heading; dh <= L.heading; dh += 0.5) {
    for (let dp = -coarsePitch; dp <= coarsePitch; dp += coarseStep) {
      const p = { ...base, heading: base.heading + dh, pitch: base.pitch + dp };
      const t = total(p);
      if (t > bestTotal) {
        bestTotal = t;
        best = p;
      }
    }
  }
  for (let round = 0; round < 3; round++) {
    const c = best;
    for (let dh = -1; dh <= 1; dh += 0.25) {
      for (let dp = -0.5; dp <= 0.5; dp += 0.25) {
        for (let dr = -1; dr <= 1; dr += 0.5) {
          for (const scale of [0.97, 1, 1.03]) {
            const p = limit({ heading: c.heading + dh, pitch: c.pitch + dp, roll: c.roll + dr, hfov: c.hfov * scale });
            const t = total(p);
            if (t > bestTotal) {
              bestTotal = t;
              best = p;
            }
          }
        }
      }
    }
  }
  const before = lineScore(dirs, base, aspect, edges);
  const after = lineScore(dirs, best, aspect, edges);
  const pose = { ...best, heading: ((best.heading % 360) + 360) % 360 };
  return { pose, before, after, confident: after >= MIN_SCORE && after - before >= MIN_GAIN };
}
