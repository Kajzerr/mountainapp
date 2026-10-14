# MountainApp: plan aplikacji tatrzańskiej

Stan (2026-10-14): zrobiona pierwsza wersja kroków 1–2 – mapa ze szlakami (online, kafelki zapamiętywane w telefonie), zdjęcia z GPS na mapie, galeria miejsca, ręczne ustawianie miejsca zdjęć bez GPS.

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
- Od którego kroku zaczynamy.
