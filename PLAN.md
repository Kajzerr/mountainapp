# MountainApp: plan aplikacji tatrzańskiej

Stan (2026-10-14): zrobiona pierwsza wersja kroków 1–2 – mapa ze szlakami (online, kafelki zapamiętywane w telefonie), zdjęcia z GPS na mapie, galeria miejsca, ręczne ustawianie miejsca zdjęć bez GPS. Pierwsza wersja kroku 5 – planowanie trasy z punktów charakterystycznych (OSM przez Overpass API, pobierane raz do telefonu) i trasa po szlakach z BRouter (brouter.de).

**Przed publikacją w sklepach** (zależności od darmowych serwerów): kafelki mapy (OpenTopoMap, Waymarked Trails), punkty (Overpass API – zastąpić plikiem dołączonym do aplikacji), wyznaczanie tras (brouter.de – własny serwer BRouter albo routing offline). Zamknięcia szlaków TANAP (1 XI – 15 VI) i TPN jeszcze nie są uwzględniane.

## 1. Rozpoznawanie szczytów ze zdjęcia: czy to wykonalne?

**Tak, i to bez sztucznej inteligencji jako rdzenia.** Sprawdzonym podejściem (tak działa PeakFinder) jest geometria, a nie rozpoznawanie obrazu:

1. Bierzemy pozycję (GPS), kierunek patrzenia (kompas) i kąt widzenia aparatu.
2. Z numerycznego modelu terenu (DEM) liczymy linię horyzontu widoczną z tego punktu: dla każdego azymutu idziemy promieniem w przód i zapamiętujemy największy kąt elewacji (z poprawką na krzywiznę Ziemi i refrakcję).
3. Dla każdego szczytu z bazy sprawdzamy, czy nie jest zasłonięty przez teren bliżej obserwatora.
4. Widoczne szczyty rysujemy jako etykiety nad horyzontem w miejscu wynikającym z azymutu i kąta widzenia.

Tatry to mały obszar (ok. 60 × 40 km plus bufor na widok z Gorców, Pienin czy Babiej Góry), więc DEM w rozdzielczości 30 m to kilka MB. Można go dołączyć do aplikacji i liczyć wszystko **offline na telefonie**, w ułamku sekundy.

### Dwa tryby, od łatwiejszego

| Tryb | Skąd dane | Trudność |
|---|---|---|
| **Na żywo z kamery** | GPS + kompas + żyroskop telefonu w danej chwili | Łatwy, to klasyczny PeakFinder |
| **Z gotowego zdjęcia** | EXIF: współrzędne, kierunek (`GPSImgDirection`), ogniskowa | Średni: kierunek z EXIF bywa niedokładny lub go brak |

Problem trybu „ze zdjęcia”: kompas w telefonie myli się często o 5–15°, a Android wiele zdjęć zapisuje bez kierunku. Rozwiązania, w kolejności wdrażania:

- **Ręczne dopasowanie**: użytkownik przesuwa palcem nałożoną linię horyzontu, aż pokryje się z grzbietami na zdjęciu. Proste i niezawodne.
- **Automatyczne dopasowanie**: wykrywamy linię nieba na zdjęciu (detekcja krawędzi albo mały model segmentacji niebo/teren, np. w TFLite/CoreML) i szukamy przesunięcia/obrotu, przy którym najlepiej pokrywa się z horyzontem z DEM. To poprawia kompas automatycznie.

**Czyste uczenie maszynowe** („sieć, która patrzy na zdjęcie i mówi: to Giewont”) odradzam: brak gotowych danych treningowych, ten sam szczyt wygląda zupełnie inaczej z każdej strony, a wynik nie da się wyjaśnić. ML ma sens tylko jako pomocnik do wykrywania linii nieba.

**Wniosek:** funkcja jest realna. Tryb na żywo i tryb ze zdjęcia z ręczną korektą da się zrobić w pierwszych wersjach; automatyczne dopasowanie to późniejsze ulepszenie.

## 2. Stack (taki jak w DailyPlanner)

Android i iOS z jednego kodu, te same technologie co DailyPlanner:

- **React Native + Expo SDK 57 + Expo Router + TypeScript (strict)**, ta sama struktura `src/app`, `src/components`, `src/lib`.
- Te same konwencje: słowniki `i18n` (pl/en), motywy z `useColors()`, czcionka Sora, Ionicons, polskie komentarze, angielskie opisy commitów.
- Identyfikator aplikacji: **`com.massifmobile.mountainmap`** (iOS i Android), budowanie przez EAS jak w DailyPlanner.
- Testowanie w **Expo Go na iPhonie** (Windows, bez Maca).

Wszystkie potrzebne moduły są w zestawie Expo SDK 57, więc działają w Expo Go (sprawdzone w `bundledNativeModules.json` DailyPlannera):

| Potrzeba | Moduł |
|---|---|
| Mapa | `react-native-maps` (z nakładką kafelków OSM/topo przez `UrlTile`) |
| Pozycja i ślad | `expo-location` |
| Kompas, żyroskop | `expo-sensors` |
| Kamera (szczyty na żywo) | `expo-camera` |
| Zdjęcia z galerii + EXIF | `expo-image-picker` (`exif: true`), `expo-media-library` |
| Dane lokalne | `expo-sqlite` (zdjęcia, ślady, szczyty; więcej danych niż w AsyncStorage) |
| Model terenu (DEM) | `expo-asset` + `expo-file-system` (plik dołączony do aplikacji) |
| Etykiety szczytów | `react-native-svg` (już używany w DailyPlanner) |

Obliczanie horyzontu to czysty TypeScript w `src/lib/` (bez Reacta, testowalny jak `subtasks.ts`).

**Jedno ograniczenie Expo Go:** pełna mapa offline (MapLibre z własnymi kafelkami) wymaga własnego buildu natywnego, a nie da się go uruchomić w Expo Go. Dlatego:
- Na start mapa przez `react-native-maps` z kafelkami z internetu (działa w Expo Go).
- Mapę offline dodajemy później przez development build w EAS. Na Androida to zwykły APK (profil `preview`), ale na iPhone'a wymaga płatnego konta Apple Developer (99 USD/rok). To decyzja na później.

Backend na start niepotrzebny, dane tylko lokalnie, jak w DailyPlanner.

## 3. Źródła danych

| Co | Źródło | Uwagi |
|---|---|---|
| Szlaki PL i SK | OpenStreetMap (`route=hiking`, kolory w `osmc:symbol`) | Dobra jakość w Tatrach; licencja ODbL wymaga atrybucji |
| Szczyty | OSM `natural=peak` z `name`, `name:pl`, `name:sk`, `ele` | Polskie i słowackie nazwy w jednym miejscu |
| DEM do horyzontu | Copernicus GLO-30 (30 m) | Darmowy, cała Europa, wystarczy do linii horyzontu |
| DEM dokładny (opcja) | GUGiK NMT (PL, 1 m, lidar) i ZBGIS DMR 5.0 (SK, 1 m) | Otwarte dane, do cieniowania mapy i profili tras |
| Zamknięcia szlaków | TPN (tpn.pl) i TANAP (tanap.sk) | TANAP: szlaki powyżej schronisk zamknięte od 1 XI do 15 VI; brak publicznego API, trzeba utrzymywać ręcznie lub parsować komunikaty |
| Lawiny / warunki | TOPR (PL), HZS (SK) | Komunikaty lawinowe, do pokazywania w aplikacji |
| Routing pieszy | GraphHopper lub BRouter (profil pieszy/górski) | Na OSM, możliwe offline; czasy przejść jak na tabliczkach PTTK trzeba skalibrować |

## 4. Znaczniki zdjęć na mapie: na co uważać

- Współrzędne bierzemy z EXIF. Na Androidzie aplikacja musi mieć uprawnienie `ACCESS_MEDIA_LOCATION`, inaczej system usuwa lokalizację ze zdjęć.
- Gdy zdjęcie nie ma GPS (np. z aparatu), dopasowujemy je po czasie do śladu GPS nagranego podczas wycieczki.
- Zdjęcia robione z poziomu aplikacji mogą od razu zapisywać pozycję i kierunek kompasu, co ułatwia później rozpoznawanie szczytów.

## 5. Kolejność MVP

1. **Mapa Tatr** ze szlakami w kolorach znakowania i pozycją GPS (najpierw online w Expo Go, offline później).
2. **Zdjęcia na mapie:** import z galerii (EXIF), nagrywanie śladu wycieczki, dopasowanie zdjęć bez GPS po czasie, galeria wycieczki.
3. **Szczyty na żywo z kamery:** horyzont z DEM, etykiety PL/SK.
4. **Szczyty na gotowym zdjęciu:** EXIF + ręczne przesuwanie horyzontu; potem automatyczne dopasowanie linii nieba.
5. **Planowanie trasy:** routing po szlakach, czas przejścia, przewyższenia, profil, ostrzeżenia o zamkniętych szlakach.

Kroki 1–2 to użyteczna aplikacja; krok 3 to najlepszy test wykonalności rozpoznawania szczytów (można go też zrobić najpierw jako szybki prototyp).

## 6. Do ustalenia

- ~~Platformy i framework~~: ustalone, Android + iOS, stack jak w DailyPlanner.
- ~~Folder i identyfikator~~: ustalone, `C:\Users\User\Desktop\Projekty\MountainApp`, `com.massifmobile.mountainmap`; commity i push robisz Ty.
- ~~Od którego kroku zaczynamy~~: ustalone, mapa ze szlakami i zdjęciami, potem planowanie trasy.

## 7. Podpisy szczytów na zaimportowanych zdjęciach (szczegółowy plan, 2026-10-15)

Pomysł: aplikacja sama dopisuje do zdjęcia nazwy widocznych szczytów. Etap 1 to geometria (miejsce, wysokość, kierunek), etap 2 to wygląd (dopasowanie tego, co widać na zdjęciu). Ta kolejność jest właściwa: etap 1 daje „co *może* być widać i mniej więcej gdzie”, a etap 2 koryguje błędy kompasu i potwierdza, co faktycznie jest na kadrze.

### 7.1. Dane ze zdjęcia: zacząć zapisywać już teraz

Obecnie przy imporcie zapisujemy pozycję, datę i kierunek (`direction`). Warto od razu dopisać do modelu `Photo` (pola opcjonalne, zgodne wstecz):

| Pole EXIF | Po co | Uwagi |
|---|---|---|
| `GPSAltitude` (+ `GPSAltitudeRef`) | wysokość obserwatora | GPS myli się o 10–50 m – patrz 7.2 |
| `GPSImgDirectionRef` | czy kierunek jest geograficzny (`T`) czy magnetyczny (`M`) | dla `M` dodać deklinację (w Tatrach ok. +6° na wschód) |
| `FocalLengthIn35mmFilm` (albo `FocalLength` + typ aparatu) | kąt widzenia kadru | 26 mm ≈ 69° w poziomie; bez tego zgadujemy z modelu telefonu |
| `PixelXDimension` / `PixelYDimension`, orientacja | pion/poziom, proporcje | już mamy szerokość i wysokość |
| `GPSHPositioningError` | dokładność pozycji | do oceny pewności wyniku |
| `Make` / `Model` / `LensModel` | ogniskowa, gdy jej brak; teleobiektyw vs szeroki kąt | iPhone ma kilka obiektywów |

Bez tych danych każde zdjęcie zaimportowane dziś trzeba by później wczytać ponownie.

### 7.2. Etap 1: geometria (to sedno funkcji)

1. **Model terenu (DEM):** Copernicus GLO-30 dla obszaru ok. 49.0–49.6° N, 19.4–20.6° E (z buforem, żeby widzieć Babią Górę, Pieniny, Niżne Tatry). Przycięty i zapisany jako 16-bitowa siatka to kilka MB, do dołączenia do aplikacji (jak plik punktów). Dane są darmowe także komercyjnie, z podpisem źródła.
2. **Wysokość obserwatora:** brać wysokość terenu z DEM w miejscu zdjęcia + ok. 1,7 m. Wysokość z GPS tylko wtedy, gdy jest wyraźnie wyżej (np. wieża widokowa). GPS w pionie jest za mało dokładny.
3. **Panorama horyzontu:** dla każdego azymutu co 0,1° promień przez DEM (z krzywizną Ziemi i refrakcją) → kąt horyzontu i odległość. W TypeScript to ułamek sekundy do 1–2 s na telefonie. Czysta funkcja w `src/lib/`, testowalna w Node, jak `trip.ts`.
4. **Widoczne szczyty:** szczyt z bazy (mamy je już z OSM, z wysokościami) jest widoczny, jeśli jego kąt elewacji ≥ horyzont na tym azymucie bliżej obserwatora. Odrzucać szczyty „wtopione” w grzbiet (różnica < 0,2°) i bardzo dalekie, mało wybitne.
5. **Kadr:** z kierunku i kąta widzenia wybieramy szczyty w kadrze i liczymy ich pozycję x na zdjęciu. Wysokość (y) z kąta elewacji; nachylenie telefonu w EXIF zwykle nie jest zapisane, więc y dopasowujemy w etapie 2 albo ręcznie.
6. **Brak kierunku w EXIF** (częste na Androidzie): pokazujemy panoramę 360° z listą „widocznych stąd szczytów” i od razu prosimy o wskazanie jednego szczytu na zdjęciu albo przesunięcie panoramy. Etap 2 może wtedy szukać dopasowania w pełnych 360°.

### 7.3. Etap 2: „wygląd” = dopasowanie linii nieba, nie rozpoznawanie szczytów przez AI

Zamiast sieci, która „zna” wygląd Giewontu (brak danych treningowych, każdy szczyt wygląda inaczej z każdej strony), porównujemy **kształt linii horyzontu**:

1. Na zdjęciu zmniejszonym do ok. 512 px szerokości wyznaczamy linię nieba: dla każdej kolumny najwyższy punkt, gdzie kończy się niebo. Na start wystarczy jasność i kolor nieba oraz krawędzie (czysty JS, działa w Expo Go: `expo-image-manipulator` do zmniejszenia + dekodowanie JPEG w JS). Później lepszy model segmentacji nieba (TFLite/CoreML), ale on wymaga własnego buildu natywnego.
2. Szukamy przesunięcia azymutu (±20° wokół kompasu, albo 360° bez kompasu), skali (kąt widzenia ±10%), przesunięcia w pionie i lekkiego obrotu, przy których linia ze zdjęcia najlepiej pokrywa się z linią z DEM (korelacja 1D).
3. Wynik ma **miarę pewności**. Przy słabym dopasowaniu (chmury, mgła, las na pierwszym planie, zdjęcie w dolinie) nie zgadujemy, tylko prosimy o ręczne dopasowanie.

### 7.4. Interfejs

- Na zdjęciu etykiety: nazwa, wysokość, odległość („Gerlach 2655 m · 18 km”), kreska do wierzchołka.
- **Ręczne dopasowanie zawsze dostępne:** przesuwanie i rozciąganie nałożonej linii palcem; to pewny wynik niezależnie od jakości danych.
- Po zatwierdzeniu zapisujemy przy zdjęciu listę szczytów (id z OSM + pozycja na zdjęciu), plus korektę kierunku. Dzięki temu można później szukać zdjęć „z widokiem na Lodowy” i pokazać na mapie, skąd widać dany szczyt.

### 7.5. Ryzyka i wskazówki

- **Najpierw zestaw testowy:** 20–30 własnych zdjęć z różnych miejsc, z ręcznie wpisanymi szczytami. Każdą zmianę algorytmu mierzymy na nim (ile szczytów trafionych, o ile stopni błąd). Bez tego trudno ocenić, czy coś działa.
- Kompas w telefonie: typowo 5–15° błędu, czasem więcej przy metalowych przedmiotach. Przy kącie widzenia ok. 70° to przesunięcie etykiet nawet o 1/5 kadru, dlatego etap 2 albo ręczna korekta są konieczne.
- Zdjęcia z zoomem, przycięte albo panoramiczne: kąt widzenia z EXIF nie pasuje do kadru → szukać skali w etapie 2 albo pytać.
- Bliskie obiekty (drzewa, ludzie, schronisko) zasłaniają horyzont: dopasowanie linii nieba musi umieć pominąć fragmenty.
- Wydajność: horyzont liczyć raz dla miejsca zdjęcia i zapisywać; zdjęcia z jednego miejsca dzielą wynik.

### 7.6. Kolejność prac

1. ✅ Zapis dodatkowych pól EXIF przy imporcie (mała zmiana, od razu).
2. ✅ Skrypt przygotowania DEM Tatr (`npm.cmd run dem`) + panorama horyzontu i widoczność szczytów w `src/lib/` (`dem.ts`, `horizon.ts`) z testami na sztucznym terenie. Do zrobienia: test na prawdziwych zdjęciach z Tatr.
3. Ekran zdjęcia: etykiety szczytów z EXIF + ręczne dopasowanie; zapis wyniku.
4. Automatyczne dopasowanie linii nieba (JS), z miarą pewności.
5. Tryb na żywo z kamery (ten sam silnik, kierunek z czujników).
6. Wyszukiwanie zdjęć po szczytach, „skąd widać ten szczyt” na mapie.
