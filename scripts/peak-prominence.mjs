// Liczy wybitność szczytów (o ile metrów szczyt wznosi się nad najwyższą przełęcz, przez którą trzeba zejść, żeby
// dojść na wyższy teren) i zapisuje ją w src/data/tatry-prominence.json. Aplikacja wybiera po niej, które szczyty
// podpisać na zdjęciu: Kościelec przed bezimiennym garbem na grani. Liczymy z pełnej siatki 30 m (pliki .tif
// w .cache/dem, pobiera je `npm.cmd run dem`) – w siatce 90 m z aplikacji ostre wierzchołki są obniżone
// nawet o 150 m i wiele szczytów „znika”.
// Uruchom po `npm.cmd run pois` albo `npm.cmd run dem`:  npm.cmd run prominence  (potem commit pliku).
// Pliki .tif z innego folderu:  npm.cmd run prominence -- --dir C:\folder
import { readFile, writeFile } from 'node:fs/promises';
import { fromArrayBuffer } from 'geotiff';

const root = new URL('../', import.meta.url);
/** Powyżej tej wartości nie liczymy dalej – dla podpisów wystarczy wiedzieć, że szczyt jest bardzo wybitny. */
const CAP = 1000;
/** Od punktu z OSM idziemy w górę aż do wierzchołka (najwyżej tyle oczek ok. 30 m) – punkty w OSM bywają trochę obok. */
const CLIMB = 15;
/** Najpierw najwyższe oczko w promieniu tylu oczek (ok. 100 m) – na postrzępionej grani pierwsze wzniesienie
 * po drodze bywa tylko garbem pod właściwym wierzchołkiem. */
const SNAP = 3;
/** Obszar Tatr z zapasem (wszystkie szczyty z tatry-osm.json leżą w środku). */
const AREA = { south: 49.0, north: 49.45, west: 19.6, east: 20.45 };

const args = process.argv.slice(2);
const dirArg = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : undefined;
const cacheDir = dirArg ? new URL(`file:///${dirArg.replace(/\\/g, '/').replace(/^\/+/, '')}/`) : new URL('.cache/dem/', root);

const osm = JSON.parse(await readFile(new URL('src/data/tatry-osm.json', root), 'utf8'));

// Siatka 1" (ok. 30 × 20 m) z kafli Copernicus GLO-30 dla obszaru AREA
const STEP = 1 / 3600;
const rows = Math.round((AREA.north - AREA.south) / STEP);
const cols = Math.round((AREA.east - AREA.west) / STEP);
const north = AREA.north;
const west = AREA.west;
const dLat = STEP;
const dLon = STEP;
const heights = new Float32Array(rows * cols).fill(-1000);
for (let lon = Math.floor(AREA.west); lon < AREA.east; lon++) {
  const name = `Copernicus_DSM_COG_10_N${Math.floor(AREA.south)}_00_E0${lon}_00_DEM`;
  let buf;
  try {
    buf = await readFile(new URL(`${name}.tif`, cacheDir));
  } catch {
    console.error(`Brak pliku ${name}.tif w ${cacheDir.pathname} – najpierw uruchom: npm.cmd run dem`);
    process.exit(1);
  }
  const image = await (await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))).getImage();
  const [originLon, originLat] = image.getOrigin();
  const [raster] = await image.readRasters();
  const width = image.getWidth();
  for (let r = 0; r < rows; r++) {
    const y = Math.round((originLat - (north - (r + 0.5) * dLat)) / dLat - 0.5);
    if (y < 0 || y >= image.getHeight()) continue;
    for (let c = 0; c < cols; c++) {
      const x = Math.round((west + (c + 0.5) * dLon - originLon) / dLon - 0.5);
      if (x < 0 || x >= width) continue;
      heights[r * cols + c] = raster[y * width + x];
    }
  }
}

// Kopiec (największa wysokość na górze) na indeksach oczek
class MaxHeap {
  items = [];
  push(i) {
    const a = this.items;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heights[a[p]] >= heights[a[k]]) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && heights[a[l]] > heights[a[m]]) m = l;
        if (r < a.length && heights[a[r]] > heights[a[m]]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

// Odwiedzone oczka: numer bieżącego liczenia (jedna tablica na wszystkie szczyty zamiast nowej za każdym razem)
const seen = new Uint16Array(rows * cols);
let stamp = 0;

/**
 * Wybitność szczytu o wysokości `top` (z OSM): z wierzchołka w siatce schodzimy zawsze najwyżej położonym sąsiadem,
 * aż trafimy w pobliże wyższego szczytu z OSM (albo na teren wyższy od `top`). Najniższy punkt po drodze to
 * przełęcz. Wysokości szczytów bierzemy z OSM, bo siatka (radar z satelity) obniża ostre wierzchołki
 * Tatr nawet o 100 m; przełęcze są w niej dokładniejsze.
 */
function prominence(start, top) {
  stamp++;
  const heap = new MaxHeap();
  heap.push(start);
  seen[start] = stamp;
  let lowest = Infinity;
  while (heap.size) {
    const i = heap.pop();
    const h = heights[i];
    if (h > top || nearPeak[i] > top) return top - Math.min(lowest, h);
    lowest = Math.min(lowest, h);
    if (top - lowest >= CAP) return CAP;
    const r = Math.floor(i / cols);
    const c = i % cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const j = rr * cols + cc;
        if (seen[j] !== stamp) {
          seen[j] = stamp;
          heap.push(j);
        }
      }
    }
  }
  return Math.min(top - lowest, CAP); // brzeg siatki – najwyższy punkt obszaru
}

/** Od oczka w górę po najwyżej położonym sąsiedzie (najwyżej `steps` razy) – do wierzchołka w siatce. */
function climb(i, steps) {
  for (let k = 0; k < steps; k++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    let best = i;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        if (heights[rr * cols + cc] > heights[best]) best = rr * cols + cc;
      }
    }
    if (best === i) break;
    i = best;
  }
  return i;
}

/** Najwyższe oczko w promieniu `radius` oczek. */
function highestNear(i, radius) {
  const r0 = Math.floor(i / cols);
  const c0 = i % cols;
  let best = i;
  for (let r = Math.max(0, r0 - radius); r <= Math.min(rows - 1, r0 + radius); r++) {
    for (let c = Math.max(0, c0 - radius); c <= Math.min(cols - 1, c0 + radius); c++) {
      if (heights[r * cols + c] > heights[best]) best = r * cols + c;
    }
  }
  return best;
}

const cellOf = (lat, lon) => {
  const r = Math.floor((north - lat) / dLat);
  const c = Math.floor((lon - west) / dLon);
  return r < 0 || c < 0 || r >= rows || c >= cols ? -1 : r * cols + c;
};

// Szczyty z OSM; bez podanej wysokości – wierzchołek z siatki
const peaks = osm.elements
  .filter((el) => el.type === 'node' && el.tags?.natural === 'peak' && cellOf(el.lat, el.lon) >= 0)
  .map((el) => {
    const summit = climb(highestNear(cellOf(el.lat, el.lon), SNAP), CLIMB);
    return { id: `n${el.id}`, name: el.tags.name, lat: el.lat, lon: el.lon, summit, ele: Number(el.tags.ele) || heights[summit] };
  });
// Oczka w pobliżu każdego szczytu (promień SNAP) znają wysokość najwyższego z nich
const nearPeak = new Float32Array(rows * cols).fill(-Infinity);
for (const p of peaks) {
  {
    const i = p.summit;
    const r0 = Math.floor(i / cols);
    const c0 = i % cols;
    for (let r = Math.max(0, r0 - SNAP); r <= Math.min(rows - 1, r0 + SNAP); r++) {
      for (let c = Math.max(0, c0 - SNAP); c <= Math.min(cols - 1, c0 + SNAP); c++) {
        nearPeak[r * cols + c] = Math.max(nearPeak[r * cols + c], p.ele);
      }
    }
  }
}
const out = {};
for (const p of peaks) out[p.id] = Math.round(Math.max(0, prominence(p.summit, p.ele)));
// Ten sam szczyt bywa w OSM dwa razy (np. Rysy: wierzchołek polski i słowacki) – oba dostają większą wybitność
for (const a of peaks) {
  for (const b of peaks) {
    const near = Math.abs(a.lat - b.lat) < 0.004 && Math.abs(a.lon - b.lon) < 0.006; // ok. 400 m
    if (a !== b && a.name && a.name === b.name && near) out[a.id] = Math.max(out[a.id], out[b.id]);
  }
}
await writeFile(new URL('src/data/tatry-prominence.json', root), JSON.stringify(out));
console.log(`OK – wybitność ${Object.keys(out).length} szczytów zapisana w src/data/tatry-prominence.json`);
