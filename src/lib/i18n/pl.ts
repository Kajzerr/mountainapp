// Słownik polski.
import type { Dict } from './en';

/** Polska liczba mnoga: 1 zdjęcie, 2–4 zdjęcia (ale 12–14 zdjęć), 5+ zdjęć. */
const plural = (n: number, one: string, few: string, many: string) => {
  const n10 = n % 10;
  const n100 = n % 100;
  const word = n === 1 ? one : n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14) ? few : many;
  return `${n} ${word}`;
};
const photos = (n: number) => plural(n, 'zdjęcie', 'zdjęcia', 'zdjęć');

// W dacie miesiąc w dopełniaczu: „12 sierpnia”
const MONTHS_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];
const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export const pl: Dict = {
  langName: 'Polski',

  common: {
    cancel: 'Anuluj',
    delete: 'Usuń',
    back: 'Wstecz',
    later: 'Później',
    somethingWrong: 'Coś poszło nie tak',
  },

  dates: {
    shortDate: (day, month, year) => `${day} ${MONTHS_SHORT[month]} ${year}`,
    dateTime: (day, month, year, time) => `${day} ${MONTHS_GENITIVE[month]} ${year}, ${time}`,
  },

  tabs: {
    map: 'Mapa',
    photos: 'Zdjęcia',
    menu: 'Menu',
  },

  screens: {
    photo: 'Zdjęcie',
    trip: 'Planowana trasa',
    locate: 'Ustaw miejsce',
    theme: 'Motyw',
    language: 'Język',
  },

  photos: {
    count: photos,
    add: 'Dodaj zdjęcia',
    adding: 'Dodaję zdjęcia…',
    empty: 'Nie ma jeszcze zdjęć',
    emptyHint: 'Dodaj zdjęcia z galerii – każde pojawi się na mapie w miejscu, w którym je zrobiono.',
    all: 'WSZYSTKIE ZDJĘCIA',
    noLocationTitle: (n) => `${photos(n)} bez lokalizacji`,
    noLocationHint: 'Te pliki nie mają danych GPS. Wskaż miejsce na mapie samodzielnie.',
    setOnMap: 'Ustaw na mapie',
    open: (date) => `Zdjęcie z ${date}`,
    openUndated: 'Zdjęcie bez daty',
  },

  import: {
    title: 'Dodano zdjęcia',
    summary: (added, located) =>
      added === located
        ? `Dodano na mapę: ${photos(added)}.`
        : `Dodano: ${photos(added)}, z lokalizacją: ${located}.`,
    duplicates: (n) => `Już były w aplikacji: ${photos(n)}.`,
    noLocation: (n) =>
      `Bez lokalizacji: ${photos(n)}. Możesz ustawić miejsce na mapie teraz albo później w zakładce Zdjęcia.`,
    nothingNew: 'Te zdjęcia już są w aplikacji.',
    failed: (n) => `Nie udało się skopiować: ${photos(n)}.`,
  },

  map: {
    myLocation: 'Pokaż moją pozycję',
    showAll: 'Pokaż wszystkie zdjęcia',
    layer: 'Zmień rodzaj mapy',
    locationDeniedTitle: 'Lokalizacja wyłączona',
    locationDeniedText: 'Zezwól aplikacji Mountain Map na lokalizację w ustawieniach telefonu, żeby zobaczyć swoją pozycję.',
    openSettings: 'Otwórz ustawienia',
    placeA11y: (n, date) => `${photos(n)}${date ? `, ${date}` : ''}`,
    attribution: '© autorzy OpenStreetMap · OpenTopoMap (CC-BY-SA) · waymarkedtrails.org',
  },

  place: {
    title: photos,
    gone: 'Te zdjęcia zostały usunięte.',
  },

  photo: {
    noDate: 'Zdjęcie bez daty',
    noLocation: 'Brak lokalizacji',
    changeLocation: 'Zmień miejsce',
    setLocation: 'Ustaw miejsce',
    deleteTitle: 'Usunąć zdjęcie?',
    deleteText: 'Zdjęcie zniknie z Mountain Map. Oryginał w galerii telefonu zostaje.',
    gone: 'To zdjęcie zostało usunięte.',
  },

  peaks: {
    show: 'Pokaż szczyty',
    hide: 'Ukryj szczyty',
    loading: 'Szukam szczytów…',
    none: 'W tym kierunku nie ma nazwanych szczytów.',
    noLocation: 'Do podpisów szczytów potrzebne jest miejsce zrobienia zdjęcia.',
    noDirection: 'Zdjęcie nie ma zapisanego kierunku, więc nie da się jeszcze ustawić podpisów szczytów.',
    outside: 'Zdjęcie zrobiono poza obszarem modelu terenu Tatr.',
    poisLoading: 'Szczyty jeszcze się wczytują. Spróbuj za chwilę.',
    adjust: 'Dopasuj',
    done: 'Gotowe',
    reset: 'Przywróć',
    adjustHint: 'Przesuń palcem, aż czerwona linia pokryje się z górami.',
    tapHint: 'Dotknij kropki, aby pokazać lub ukryć nazwę szczytu.',
    estimated: 'Położenie szczytów jest wyliczone z GPS, kompasu i nachylenia telefonu.',
    aligning: 'Dopasowuję podpisy do gór na zdjęciu…',
    autoAligned: 'Podpisy dopasowane do linii gór na zdjęciu. Jeśli coś się nie zgadza, użyj „Dopasuj”.',
    save: 'Zapisz zdjęcie z nazwami szczytów',
    saving: 'Zapisuję zdjęcie z nazwami szczytów…',
    saved: 'Zapisano w galerii zdjęć.',
    saveFailed: 'Nie udało się zapisać zdjęcia.',
    dotA11y: (name) => `Szczyt ${name}`,
    meta: (ele, km) => (ele ? `${ele} m · ${km} km` : `${km} km`),
  },

  locate: {
    hint: 'Przesuń mapę tak, żeby pinezka wskazywała miejsce zrobienia zdjęć.',
    hintOne: 'Przesuń mapę tak, żeby pinezka wskazywała miejsce zrobienia zdjęcia.',
    confirm: 'Ustaw miejsce tutaj',
  },

  poi: {
    kinds: {
      peak: 'Szczyt', saddle: 'Przełęcz', hut: 'Schronisko', trailhead: 'Początek szlaku', lake: 'Jezioro', junction: 'Rozdroże',
    },
    ele: (m) => `${m} m n.p.m.`,
    close: 'Zamknij',
    setStart: 'Początek',
    setEnd: 'Koniec',
    addVia: 'Punkt trasy',
    viaPosition: 'Wybierz jego miejsce na trasie:',
    viaN: (n) => `${n}.`,
    remove: 'Usuń z trasy',
    inTrip: (role) => `Na Twojej trasie: ${role}`,
    loading: 'Wczytuję szczyty, przełęcze i schroniska…',
    error: 'Nie udało się wczytać szczytów i schronisk. Sprawdź połączenie z internetem.',
    retry: 'Ponów',
    zoomIn: 'Przybliż mapę, żeby zobaczyć szczyty, przełęcze i schroniska',
  },

  trip: {
    start: 'Początek',
    end: 'Koniec',
    via: (n) => `Punkt ${n}`,
    km: (m) => `${(m / 1000).toFixed(1).replace('.', ',')} km`,
    up: (m) => `↑ ${m} m`,
    down: (m) => `↓ ${m} m`,
    time: (t) => `ok. ${t} h`,
    computing: 'Wyznaczam trasę po szlakach…',
    approx: 'Brak połączenia z planerem tras – linie proste między punktami.',
    needMore: 'Dodaj jeszcze jeden punkt, żeby zobaczyć trasę.',
    open: 'Szczegóły trasy',
    show: 'Pokaż trasę',
    reverse: 'Odwróć trasę',
    clear: 'Wyczyść trasę',
    clearTitle: 'Wyczyścić trasę?',
    clearText: 'Wszystkie punkty zostaną usunięte z planowanej trasy.',
    moveUp: (name) => `Przesuń ${name} wcześniej`,
    moveDown: (name) => `Przesuń ${name} później`,
    removePoint: (name) => `Usuń ${name}`,
    empty: 'Nie ma jeszcze trasy',
    emptyHint: 'Przybliż mapę, dotknij szczytu, przełęczy, schroniska albo początku szlaku i dodaj go jako początek, koniec lub punkt trasy.',
    timeNote: 'Czas przejścia bez postojów, szacowany z długości i przewyższeń (podobnie jak na tabliczkach). Trasa: BRouter, © autorzy OpenStreetMap.',
    retry: 'Spróbuj ponownie',
  },

  menu: {
    settings: 'USTAWIENIA',
    about: 'INFORMACJE',
    language: 'Język',
    theme: 'Motyw',
    mapLayer: 'Rodzaj mapy',
    layerTopo: 'Topograficzna',
    layerStandard: 'Zwykła',
    sources: 'Dane mapy',
    refreshPois: 'Odśwież szczyty i schroniska',
    refreshPoisSub: (n) => `${plural(n, 'punkt', 'punkty', 'punktów')} z OpenStreetMap`,
    sourcesText:
      'Mapa i szlaki: © autorzy OpenStreetMap (ODbL). Mapa topograficzna: OpenTopoMap (CC-BY-SA). ' +
      'Znakowane szlaki: waymarkedtrails.org (CC-BY-SA). Szczyty, przełęcze i schroniska: OpenStreetMap. ' +
      'Wyznaczanie tras: BRouter (brouter.de). Podpisy szczytów na zdjęciach: model terenu Copernicus DEM GLO-30 ' +
      '(© DLR e.V. 2010-2014 i © Airbus Defence and Space GmbH 2014-2018, udostępniony w ramach programu ' +
      'COPERNICUS przez Unię Europejską i ESA). Obejrzane fragmenty mapy zostają w telefonie.',
  },

  theme: {
    names: { system: 'Systemowy', dark: 'Ciemny', light: 'Jasny', black: 'Czarny', ocean: 'Ocean', paper: 'Papier' },
    desc: {
      system: 'Ciemny albo jasny, jak w telefonie',
      dark: 'Głęboka szarość z bursztynem – oryginał',
      light: 'Jasny i czysty',
      black: 'Czysta czerń, oszczędza ekrany OLED',
      ocean: 'Nocny granat z błękitnym akcentem',
      paper: 'Ciepły papier z terakotą',
    },
    systemNow: (name) => `(teraz ${name})`,
    a11y: (name) => `Motyw ${name}`,
  },

  language: {
    system: 'Systemowy',
    systemDesc: (name) => `Język telefonu – teraz ${name}`,
    systemFallback: 'Języka telefonu jeszcze nie ma – używamy angielskiego',
    a11y: (name) => `Język: ${name}`,
  },
};
