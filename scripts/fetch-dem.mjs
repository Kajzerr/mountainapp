// Pobiera model terenu Copernicus GLO-30 (bezpłatny, także do użytku komercyjnego) dla Tatr z okolicą,
// zmniejsza go do siatki ok. 90 m i zapisuje w src/data/tatry-dem.json – z tego pliku aplikacja liczy
// wysokość obserwatora i panoramę horyzontu (src/lib/dem.ts, src/lib/horizon.ts).
// Uruchom: npm.cmd run dem   (pobiera 4 pliki po kilkadziesiąt MB; trzyma je w .cache/dem, więc kolejne
// uruchomienie nie pobiera ich drugi raz). Pliki .tif pobrane ręcznie można wskazać: npm.cmd run dem -- --dir C:\folder
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fromArrayBuffer } from 'geotiff';

const root = new URL('../', import.meta.url);

// Obszar z zapasem: z Tatr widać Babią Górę, Pieniny, Gorce i Niżne Tatry (do ok. 100 km)
const AREA = { south: 48.8, north: 49.7, west: 19.3, east: 20.8 };
// Oczko siatki: 3" szerokości i 4,5" długości geograficznej ≈ 93 × 91 m na tej szerokości
const D_LAT = 3 / 3600;
const D_LON = 4.5 / 3600;
const NODATA = -32768;
const SOURCE =
  'Copernicus DEM GLO-30: © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 ' +
  'provided under COPERNICUS by the European Union and ESA; all rights reserved';

const args = process.argv.slice(2);
const dirArg = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : undefined;
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;
const cacheDir = dirArg ? new URL(`file:///${dirArg.replace(/\\/g, '/').replace(/^\/+/, '')}/`) : new URL('.cache/dem/', root);
const outFile = outArg ? new URL(`file:///${outArg.replace(/\\/g, '/').replace(/^\/+/, '')}`) : new URL('src/data/tatry-dem.json', root);

function tileName(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const la = String(Math.abs(lat)).padStart(2, '0');
  const lo = String(Math.abs(lon)).padStart(3, '0');
  return `Copernicus_DSM_COG_10_${ns}${la}_00_${ew}${lo}_00_DEM`;
}

async function exists(url) {
  try {
    return (await stat(url)).size > 0;
  } catch {
    return false;
  }
}

/** Plik kafla z dysku, a gdy go nie ma – pobrany z publicznego zasobu Copernicus na AWS (bez logowania). */
async function loadTile(lat, lon) {
  const name = tileName(lat, lon);
  const file = new URL(`${name}.tif`, cacheDir);
  if (!(await exists(file))) {
    if (dirArg) throw new Error(`brak pliku ${name}.tif w ${dirArg}`);
    const url = `https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`;
    process.stdout.write(`Pobieram ${name}.tif … `);
    const res = await fetch(url, { headers: { 'User-Agent': 'MountainMap-data-script/1.0 (com.massifmobile.mountainmap)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} dla ${url}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, bytes);
    console.log(`${(bytes.length / 1e6).toFixed(1)} MB`);
  }
  const buf = await readFile(file);
  const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const image = await tiff.getImage();
  const [originLon, originLat] = image.getOrigin();
  const [resLon, resLat] = image.getResolution();
  const [raster] = await image.readRasters();
  const noData = image.getGDALNoData();
  return { raster, width: image.getWidth(), height: image.getHeight(), originLon, originLat, resLon, resLat, noData };
}

const tiles = new Map();
for (let lat = Math.floor(AREA.south); lat < AREA.north; lat++) {
  for (let lon = Math.floor(AREA.west); lon < AREA.east; lon++) {
    tiles.set(`${lat},${lon}`, await loadTile(lat, lon));
  }
}

/** Średnia wysokość pikseli kafla w prostokącie [s, n] × [w, e] (zmniejszenie z 30 m do ok. 90 m). */
function meanIn(tile, s, n, w, e) {
  const x0 = Math.max(0, Math.floor((w - tile.originLon) / tile.resLon));
  const x1 = Math.min(tile.width - 1, Math.ceil((e - tile.originLon) / tile.resLon) - 1);
  // resLat jest ujemne: wiersz 0 to północna krawędź kafla
  const y0 = Math.max(0, Math.floor((n - tile.originLat) / tile.resLat));
  const y1 = Math.min(tile.height - 1, Math.ceil((s - tile.originLat) / tile.resLat) - 1);
  let sum = 0;
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const v = tile.raster[y * tile.width + x];
      if (!Number.isFinite(v) || v === tile.noData || v < -1000) continue;
      sum += v;
      count++;
    }
  }
  return count ? sum / count : null;
}

const rows = Math.round((AREA.north - AREA.south) / D_LAT);
const cols = Math.round((AREA.east - AREA.west) / D_LON);
const data = new Int16Array(rows * cols);
let missing = 0;
for (let r = 0; r < rows; r++) {
  const n = AREA.north - r * D_LAT;
  const s = n - D_LAT;
  const centerLat = n - D_LAT / 2;
  for (let c = 0; c < cols; c++) {
    const w = AREA.west + c * D_LON;
    const e = w + D_LON;
    const tile = tiles.get(`${Math.floor(centerLat)},${Math.floor(w + D_LON / 2)}`);
    const v = tile ? meanIn(tile, s, n, w, e) : null;
    if (v === null) missing++;
    data[r * cols + c] = v === null ? NODATA : Math.round(v);
  }
}

// Zapis little-endian niezależnie od komputera
const bytes = Buffer.alloc(data.length * 2);
data.forEach((v, i) => bytes.writeInt16LE(v, i * 2));
const out = {
  generated: new Date().toISOString(),
  source: SOURCE,
  north: AREA.north,
  west: AREA.west,
  dLat: D_LAT,
  dLon: D_LON,
  rows,
  cols,
  noData: NODATA,
  encoding: 'int16le-base64',
  data: bytes.toString('base64'),
};
await writeFile(outFile, JSON.stringify(out));
let max = -Infinity;
for (const v of data) if (v > max) max = v;
console.log(
  `OK – siatka ${cols} × ${rows}, najwyżej ${max} m, brak danych w ${missing} oczkach, ` +
    `zapisano ${(JSON.stringify(out).length / 1e6).toFixed(1)} MB do ${outFile.pathname}`,
);
