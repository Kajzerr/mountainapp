# MountainMap – instrukcje dla Claude

Aplikacja do chodzenia po Tatrach na iPhone'a i Androida (nazwa w telefonie: **Mountain Map**). Wydawca: **Massif Mobile**
(identyfikator `com.massifmobile.mountainmap` – iOS i Android; nie zmieniać).
React Native + **Expo SDK 57** + **Expo Router** + TypeScript (strict) – te same technologie i konwencje co DailyPlanner.
Dane tylko lokalnie (AsyncStorage + pliki zdjęć w katalogu aplikacji). Plan rozwoju: `PLAN.md`.
Ogólne zasady Expo (dokumentacja, `expo install`, EAS): @AGENTS.md

## Środowisko właściciela projektu
- **Windows**, terminal PowerShell (w VS Code). Polityka skryptów blokuje `npx.ps1` → w poleceniach dla użytkownika
  podawaj **`npx.cmd` / `npm.cmd`** (albo cmd). Nie proponuj WSL ani Git Bash do Expo.
- **npm 11** – nie usuwaj `react-dom` z `package.json`: bez niego `npm install` kończy się błędem ERESOLVE.
- Testowanie: **Expo Go na iPhonie**. Brak Maca.
- Commity i `git push` robi **użytkownik**. Po zmianach podaj mu gotowe polecenia. Nie usuwaj plików – podaj `git rm …`.
- **Opisy commitów po angielsku** (krótki tytuł w trybie rozkazującym).

## Polecenia
```powershell
npm.cmd install
npx.cmd expo start            # --clear po zmianie zależności, --tunnel gdy telefon nie widzi komputera
npx.cmd tsc --noEmit          # sprawdzenie typów – zawsze przed oddaniem zmian
npx.cmd expo export --platform ios --platform android --output-dir dist   # czy aplikacja się buduje
npx.cmd expo install <pakiet> # nowe biblioteki – zawsze tak
npm.cmd run pois              # pobiera szczyty/schroniska z OSM do src/data/tatry-osm.json (wbudowane w aplikację)
npm.cmd run dem               # pobiera model terenu Copernicus do src/data/tatry-dem.json (pliki źródłowe w .cache/dem)
npx.cmd eas-cli@latest build -p android --profile preview   # testowy APK na Androida
```
Nowe biblioteki muszą działać w **Expo Go** – sprawdź `node_modules/expo/bundledNativeModules.json`. Inaczej najpierw zapytaj.
Dlatego mapa to `react-native-maps` (jest w Expo Go), a nie MapLibre (wymaga własnego buildu – plan na później).

## Struktura
```
src/app/                    – ekrany (Expo Router: plik = ekran)
  _layout.tsx               – SettingsProvider → Stack (motyw, czcionki Sora) → PhotosProvider → PoisProvider → TripProvider
  (tabs)/_layout.tsx        – zakładki: Mapa, Zdjęcia (z „+” w nagłówku), Menu
  (tabs)/index.tsx          – mapa: szlaki, moja pozycja, znaczniki miejsc ze zdjęciami, „+” dodaje zdjęcia,
                              baner „N zdjęć bez lokalizacji”; punkty charakterystyczne (po przybliżeniu),
                              karta punktu (PoiSheet), planowana trasa (linia + numerowane punkty), pasek trasy → /trip
  (tabs)/photos.tsx         – wszystkie zdjęcia (od najnowszego) + karta zdjęć bez lokalizacji
  (tabs)/menu.tsx           – Język, Motyw, Rodzaj mapy (topo / zwykła), informacje o danych mapy
  place.tsx                 – zdjęcia jednego miejsca (po dotknięciu znacznika); parametr ids="a,b,c"
  photo.tsx                 – jedno zdjęcie: podgląd, „Pokaż szczyty” (PeaksLayer), data, współrzędne, zmiana miejsca,
                              usuwanie; parametr id
  locate.tsx                – ręczne ustawienie miejsca (modal): mapa pod stałą pinezką; parametr ids="a,b,c"
  trip.tsx                  – planowana trasa: podsumowanie, punkty w kolejności (↑ ↓ ✕), odwróć, wyczyść
  theme.tsx, language.tsx   – jak w DailyPlanner
src/components/
  TrailMap.tsx              – MapView + kafelki OpenTopoMap (podkład) + Waymarked Trails (szlaki) + podpis autorów
  PhotoMarker.tsx           – znacznik miejsca: miniatura pierwszego zdjęcia + liczba zdjęć
  PhotoGrid.tsx             – siatka miniatur (FlatList, 3 kolumny), dotknięcie → /photo
  MapButton.tsx             – okrągły przycisk nad mapą
  useImportPhotos.ts        – wybór zdjęć z galerii (expo-image-picker, exif: true) + komunikat po imporcie
  PoiMarker.tsx             – punkt charakterystyczny: kolorowa kropka (POI_COLORS wg rodzaju)
  PoiSheet.tsx              – karta punktu: nazwa, rodzaj, wysokość; Początek / Punkt trasy (wybór miejsca 1..n) / Koniec
  TripMarker.tsx            – punkt trasy z numerem w kolejności przejścia
  TripSummary.tsx           – „12,3 km ↑ 850 m ↓ 850 m ok. 5:30 h” albo stan liczenia
  tripLabels.ts             – roleLabel: „Początek” / „Punkt 2” / „Koniec”
  useBriefTracking.ts       – tracksViewChanges na chwilę (znaczniki z własnym widokiem)
  usePeakScene.ts           – podpisy szczytów: raz czyta dane z pliku zdjęcia (readPhotoFileMeta → pitch/roll itd.),
                              liczy scenę (analyzeScene) po narysowaniu ekranu; nowa scena po obrocie > 15°
  PeaksLayer.tsx            – warstwa na zdjęciu: podpisy, „Dopasuj” (PanResponder: w bok = kierunek, w pionie =
                              pochylenie, zapis w photo.view), „Przywróć”, pasek z komunikatem
  PeakOverlay.tsx           – linia horyzontu (react-native-svg) + kropki i nazwy; od DOTS_FROM (5) szczytów same
                              kropki, nazwa po dotknięciu
src/data/
  overpass-query.json       – zapytanie Overpass + obszar Tatr (wspólne dla aplikacji i skryptu)
  tatry-osm.json            – punkty wbudowane w aplikację; generuje `npm.cmd run pois` (scripts/fetch-pois.mjs)
  tatry-dem.json            – model terenu (siatka ok. 90 m, int16 w base64, ok. 3,5 MB); generuje `npm.cmd run dem`
                              (scripts/fetch-dem.mjs, biblioteka geotiff tylko w devDependencies). Wczytuje go
                              lib/terrain.ts dopiero przy pierwszych podpisach szczytów (require, nie import).
src/lib/
  exif.ts                   – GPS, data i kierunek z EXIF (czyste funkcje; różnice iOS/Android opisane w pliku)
  dem.ts                    – model terenu: parseDem, elevationAt (interpolacja), observerHeight (teren + 1,7 m,
                              wysokość szczytu, gdy stoimy na nim; GPS tylko wyraźnie wyżej) – czyste funkcje
  horizon.ts                – panorama horyzontu (computeHorizon, 3600 promieni), visiblePeaks (zasłonięte /
                              na linii nieba), bearing; krzywizna Ziemi i refrakcja – czyste funkcje
  exifFile.ts               – EXIF prosto z pliku JPEG/HEIC (bez bibliotek): wektor grawitacji z MakerNote Apple
                              (tag 8) → tiltFromGravity (pitch/roll; znak obrotu sprawdzony na zdjęciach), kierunek,
                              ogniskowa 35 mm, orientacja – czyste funkcje, `read(offset, length)` z zewnątrz
  peakLabels.ts             – podpisy szczytów: horizontalFov, trueHeading (deklinacja 5,5° dla "M"), project
                              (kamera otworkowa z pitch/roll), analyzeScene (wycinek kadr ± 25°), layoutLabels
                              (najpierw linia nieba, potem wysokość; odstęp), horizonLine (bez terenu < 1,5 km)
  terrain.ts                – loadDem(): leniwe wczytanie src/data/tatry-dem.json
  places.ts                 – grupowanie zdjęć w miejsca (PLACE_RADIUS_M = 40 m), odległość (czyste funkcje)
  pois.ts                   – punkty z OSM: zapytanie Overpass, parseOverpass, poiName (pl), visiblePois (czyste)
  poiStore.tsx              – PoisProvider / usePois(): kolejno plik w telefonie (pois-v1.json) → plik wbudowany
                              (src/data/tatry-osm.json) → Overpass API (kilka serwerów); errorDetail przy błędzie
  trip.ts                   – Trip { start?, via[], end? }: setStart/setEnd/insertVia/movePoint/reverse, statystyki,
                              czas przejścia (DIN 33466) – czyste funkcje
  routing.ts                – trasa po szlakach z BRouter (brouter.de, profil hiking-mountain), parseBrouter
  tripStore.tsx             – TripProvider / useTrip(): wycieczka + trasa (liczona sama po zmianie, z opóźnieniem;
                              bez sieci – linie proste, exact: false)
  photoModel.ts             – typ Photo, photoFromAsset, parsePhotos, sortowanie (czyste funkcje)
  photos.tsx                – PhotosProvider / usePhotos(): importAssets, setLocation, updatePhoto, removePhoto,
                              places, unlocated
  photoFiles.ts             – pliki zdjęć w Paths.document/photos (expo-file-system, nowe API File/Directory);
                              readPhotoFileMeta czyta fragmenty pliku przez File.open() (FileHandle)
  mapConfig.ts              – region Tatr, adresy kafelków, czas trzymania kafelków w telefonie
  params.ts                 – parseIds (parametry ekranów)
  dates.ts                  – formatowanie dat zdjęć
  settings.tsx              – ustawienia (język, motyw, mapLayer), useT
  i18n/                     – en.ts (wzorzec, typ Dict), pl.ts, index.ts, system.ts
  theme.ts                  – motywy (jak w DailyPlanner)
```

## Model danych i zasady
- `Photo`: `{ id, file, width, height, latitude?, longitude?, takenAt?, direction?, directionRef?, altitude?, gpsError?, focal35?, focal?, orientation?, make?, model?, lens?, pitch?, roll?, fileMetaRead?, view?, source?, importedAt }`.
  Pola od `directionRef` do `lens` (PLAN.md 7.1) zapisujemy tylko, gdy są w EXIF; starsze zdjęcia ich nie mają.
  `pitch`/`roll` (iPhone) i brakujące `direction`/`focal35`/`orientation` uzupełnia przy pierwszym „Pokaż szczyty”
  odczyt pliku (`fileMetaRead: true`). `view` = ręczna poprawka `{ heading, pitch }` z ekranu podpisów.
  `file` to **sama nazwa pliku** w `Paths.document/photos` (pełny adres liczy `photoUri`) – na iOS ścieżka katalogu
  aplikacji zmienia się po aktualizacji. `latitude`/`longitude` – oba albo żadne (`hasLocation`).
  Daty jako tekst `"RRRR-MM-DDTGG:MM:SS"` (czas lokalny), bez obiektów `Date` w danych.
  `source` rozpoznaje duplikaty (`asset:<id z galerii>` albo `file:<nazwa>|<data>`).
- Klucz AsyncStorage: `mountainmap.photos.v1`, ustawienia: `mountainmap.settings.v1`. Zmiany modelu **wstecznie zgodne**.
- Zmiany zdjęć tylko przez `usePhotos()`; usunięcie zdjęcia usuwa też jego plik (oryginał w galerii zostaje).
- Miejsca liczy `groupIntoPlaces` – nie zapisujemy ich; znacznik ma `key` z id miejsca i liczbą zdjęć, bo
  react-native-maps nie odświeża sam widoku znacznika (`tracksViewChanges` wyłączamy po wczytaniu miniatury).
- **Planowana trasa**: `Trip { start?, via: TripPoint[], end? }` – punkt może być na trasie tylko raz (ustawienie go
  w innej roli przenosi go). Zmiany tylko przez `useTrip()`. Klucze AsyncStorage: `mountainmap.trip.v1`,
  ostatnia trasa po szlakach `mountainmap.route.v1` (z kluczem `tripKey`, żeby nie pytać serwera o to samo).
- **Punkty charakterystyczne**: rodzaje `peak | saddle | hut | trailhead | lake | junction`; na mapie dopiero
  od `POI_MAX_DELTA` (rozdroża od `CLOSE_MAX_DELTA`), maks. `MAX_VISIBLE` naraz. Kolory: `POI_COLORS` w `theme.ts`
  (wspólne dla motywów – wyjątek od zasady kolorów z `useColors()`, bo mapa wygląda tak samo w każdym motywie).
- Kafelki mapy: serwery społecznościowe (OpenTopoMap, Waymarked Trails) – podpis autorów zawsze widoczny na mapie.
  Przed publikacją w sklepach trzeba przejść na własne kafelki albo płatnego dostawcę.
- Podpisy szczytów na zdjęciu: kolory `PHOTO_OVERLAY` w `theme.ts` (wspólne dla motywów – leżą na zdjęciu).
  Źródło modelu terenu (Copernicus) jest w Menu → Dane mapy – nie usuwać (wymóg licencji).

## Interfejs i styl
Tak jak w DailyPlanner: żadnych tekstów na sztywno (słownik, `useT()` / `T()`, polska odmiana w `pl.ts`),
kolory tylko z `useColors()` / `useTheme()`, czcionka Sora przez `fonts.*` (bez `fontWeight`), ikony Ionicons,
obszary dotyku ≥ 44 pt, `accessibilityLabel` przy przyciskach bez tekstu, usuwanie z potwierdzeniem,
komentarze w kodzie po polsku.

## Sprawdzanie zmian
1. `npx.cmd tsc --noEmit` bez błędów.
2. `expo export` dla iOS i Androida przechodzi.
3. Logikę bez Reacta (`exif.ts`, `places.ts`, `photoModel.ts`, `pois.ts`, `trip.ts`, `routing.ts`, `dem.ts`, `horizon.ts`, `exifFile.ts`, `peakLabels.ts`) testuj na przykładach (kompilacja `tsc` do JS + `node`).
4. Napisz użytkownikowi wprost, czego nie sprawdzono na telefonie.
