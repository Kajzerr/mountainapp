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

  locate: {
    hint: 'Przesuń mapę tak, żeby pinezka wskazywała miejsce zrobienia zdjęć.',
    hintOne: 'Przesuń mapę tak, żeby pinezka wskazywała miejsce zrobienia zdjęcia.',
    confirm: 'Ustaw miejsce tutaj',
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
    sourcesText:
      'Mapa i szlaki: © autorzy OpenStreetMap (ODbL). Mapa topograficzna: OpenTopoMap (CC-BY-SA). ' +
      'Znakowane szlaki: waymarkedtrails.org (CC-BY-SA). Obejrzane fragmenty mapy zostają w telefonie.',
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
