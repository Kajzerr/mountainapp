// Pobiera szczyty, przełęcze, schroniska, jeziora i początki szlaków Tatr z OpenStreetMap (Overpass API)
// i zapisuje je w src/data/tatry-osm.json – ten plik jest wbudowany w aplikację, więc działa bez internetu
// i bez zależności od serwerów Overpass w telefonie. Uruchom: npm.cmd run pois  (potem commit pliku).
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const { bbox, query } = JSON.parse(await readFile(new URL('src/data/overpass-query.json', root), 'utf8'));
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// Zostawiamy tylko tagi, których używa aplikacja – plik jest kilka razy mniejszy
const KEEP = ['name', 'name:pl', 'ele', 'natural', 'tourism', 'highway', 'mountain_pass', 'information'];

const body = `data=${encodeURIComponent(query.split('{{bbox}}').join(bbox.join(',')))}`;
for (const url of MIRRORS) {
  try {
    process.stdout.write(`${url} … `);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'MountainMap-data-script/1.0 (com.massifmobile.mountainmap)',
      },
      body,
    });
    if (!res.ok) {
      console.log(`HTTP ${res.status}`);
      continue;
    }
    const json = await res.json();
    const elements = (json.elements ?? []).map((el) => {
      const out = { type: el.type, id: el.id };
      if (el.lat !== undefined) Object.assign(out, { lat: el.lat, lon: el.lon });
      if (el.center) out.center = el.center;
      out.tags = Object.fromEntries(Object.entries(el.tags ?? {}).filter(([k]) => KEEP.includes(k)));
      return out;
    });
    if (elements.length === 0) {
      console.log(`brak punktów${json.remark ? ` (${json.remark})` : ''}`);
      continue;
    }
    const data = { generated: new Date().toISOString(), source: '© OpenStreetMap contributors (ODbL)', elements };
    await writeFile(new URL('src/data/tatry-osm.json', root), JSON.stringify(data));
    console.log(`OK – zapisano ${elements.length} punktów do src/data/tatry-osm.json`);
    process.exit(0);
  } catch (e) {
    console.log(`błąd: ${e.message}`);
  }
}
console.error('Nie udało się pobrać punktów z żadnego serwera.');
process.exit(1);
