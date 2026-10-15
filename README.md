# Mountain Map

Mapa Tatr ze znakowanymi szlakami i zdjęciami z wycieczek: każde zdjęcie pojawia się na mapie w miejscu,
w którym je zrobiono. Dotknięcie znacznika pokazuje zdjęcia z tego miejsca.

React Native + Expo SDK 57 + Expo Router + TypeScript. Działa w Expo Go (iOS i Android).

## Uruchomienie
```powershell
npm.cmd install
npx.cmd expo start
```
Zeskanuj kod QR w Expo Go.

## Co jest
- Mapa topograficzna (OpenTopoMap) albo zwykła + nakładka ze szlakami w kolorach znakowania (Waymarked Trails).
- Moja pozycja na mapie.
- Dodawanie zdjęć z galerii: lokalizacja i data z EXIF, zdjęcia z jednego miejsca (do 40 m) w jednym znaczniku.
- Zdjęcia bez GPS: ręczne wskazanie miejsca na mapie.
- Galeria miejsca, podgląd zdjęcia, zmiana miejsca, usuwanie.
- Planowanie trasy: dotknij szczytu, przełęczy, schroniska, jeziora albo początku szlaku i ustaw go jako początek,
  koniec albo punkt trasy na wybranym miejscu. Trasa liczy się po szlakach (BRouter) z długością, przewyższeniami
  i czasem przejścia; kolejność punktów zmienisz na ekranie trasy.
- Polski i angielski, motywy jak w DailyPlanner.

Dalsze kroki: `PLAN.md`.

## Dane mapy
© autorzy OpenStreetMap (ODbL) · OpenTopoMap (CC-BY-SA) · waymarkedtrails.org (CC-BY-SA)
