// Słownik angielski – wzorzec dla pozostałych języków (typ Dict wynika z tego pliku).
// Teksty ze zmiennymi to funkcje, żeby każdy język mógł ułożyć zdanie po swojemu (szyk, odmiana, liczba mnoga).

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const en = {
  langName: 'English',

  common: {
    cancel: 'Cancel',
    delete: 'Delete',
    back: 'Back',
    later: 'Later',
    somethingWrong: 'Something went wrong',
  },

  dates: {
    /** "Aug 12, 2026" */
    shortDate: (day: number, month: number, year: number) => `${MONTHS_SHORT[month]} ${day}, ${year}`,
    /** "August 12, 2026, 10:31" */
    dateTime: (day: number, month: number, year: number, time: string) => `${MONTHS[month]} ${day}, ${year}, ${time}`,
  },

  tabs: {
    map: 'Map',
    photos: 'Photos',
    menu: 'Menu',
  },

  screens: {
    photo: 'Photo',
    trip: 'Planned route',
    locate: 'Set location',
    theme: 'Theme',
    language: 'Language',
  },

  photos: {
    count: (n: number) => plural(n, 'photo', 'photos'),
    add: 'Add photos',
    adding: 'Adding photos…',
    empty: 'No photos yet',
    emptyHint: 'Add photos from your gallery – each one appears on the map where it was taken.',
    all: 'ALL PHOTOS',
    noLocationTitle: (n: number) => `${plural(n, 'photo', 'photos')} without a location`,
    noLocationHint: 'Their files have no GPS data. Point to the place on the map yourself.',
    setOnMap: 'Set on map',
    open: (date: string) => `Photo from ${date}`,
    openUndated: 'Photo without a date',
  },

  import: {
    title: 'Photos added',
    summary: (added: number, located: number) =>
      added === located
        ? `${plural(added, 'photo', 'photos')} added to the map.`
        : `${plural(added, 'photo', 'photos')} added, ${located} with a location.`,
    duplicates: (n: number) => `${plural(n, 'photo was', 'photos were')} already in the app.`,
    noLocation: (n: number) =>
      `${plural(n, 'photo has', 'photos have')} no location. You can set it on the map now or later in Photos.`,
    nothingNew: 'These photos are already in the app.',
    failed: (n: number) => `${plural(n, 'photo', 'photos')} could not be copied.`,
  },

  map: {
    myLocation: 'Show my location',
    showAll: 'Show all photos',
    layer: 'Switch map type',
    locationDeniedTitle: 'Location is off',
    locationDeniedText: 'Allow location for Mountain Map in your phone settings to see where you are.',
    openSettings: 'Open settings',
    placeA11y: (n: number, date?: string) => `${plural(n, 'photo', 'photos')}${date ? `, ${date}` : ''}`,
    attribution: '© OpenStreetMap contributors · OpenTopoMap (CC-BY-SA) · waymarkedtrails.org',
  },

  place: {
    title: (n: number) => plural(n, 'photo', 'photos'),
    gone: 'These photos were deleted.',
  },

  photo: {
    noDate: 'No date in the photo',
    noLocation: 'No location',
    changeLocation: 'Change location',
    setLocation: 'Set location',
    deleteTitle: 'Delete photo?',
    deleteText: 'The photo is removed from Mountain Map. The original in your gallery stays.',
    gone: 'This photo was deleted.',
  },

  locate: {
    hint: 'Move the map so the pin points to where the photos were taken.',
    hintOne: 'Move the map so the pin points to where the photo was taken.',
    confirm: 'Set location here',
  },

  poi: {
    kinds: {
      peak: 'Peak', saddle: 'Pass', hut: 'Mountain hut', trailhead: 'Trailhead', lake: 'Lake', junction: 'Trail junction',
    },
    ele: (m: number) => `${m} m`,
    close: 'Close',
    setStart: 'Start',
    setEnd: 'Finish',
    addVia: 'Waypoint',
    viaPosition: 'Choose its place on the route:',
    viaN: (n: number) => `${n}.`,
    remove: 'Remove from route',
    inTrip: (role: string) => `On your route: ${role}`,
    loading: 'Loading peaks, passes and huts…',
    error: 'Could not load peaks and huts. Check the internet connection.',
    retry: 'Retry',
    zoomIn: 'Zoom in to see peaks, passes and huts',
  },

  trip: {
    start: 'Start',
    end: 'Finish',
    via: (n: number) => `Waypoint ${n}`,
    km: (m: number) => `${(m / 1000).toFixed(1)} km`,
    up: (m: number) => `↑ ${m} m`,
    down: (m: number) => `↓ ${m} m`,
    time: (t: string) => `~${t} h`,
    computing: 'Planning route along trails…',
    approx: 'No connection to the route planner – straight lines between points.',
    needMore: 'Add one more point to see the route.',
    open: 'Route details',
    show: 'Show route',
    reverse: 'Reverse route',
    clear: 'Clear route',
    clearTitle: 'Clear the route?',
    clearText: 'All points will be removed from the planned route.',
    moveUp: (name: string) => `Move ${name} earlier`,
    moveDown: (name: string) => `Move ${name} later`,
    removePoint: (name: string) => `Remove ${name}`,
    empty: 'No route yet',
    emptyHint: 'Zoom in on the map, tap a peak, pass, hut or trailhead and add it as the start, finish or a waypoint.',
    timeNote: 'Walking time without breaks, estimated from distance and climb (like trail signs). Routing: BRouter, © OpenStreetMap contributors.',
    retry: 'Try again',
  },

  menu: {
    settings: 'SETTINGS',
    about: 'ABOUT',
    language: 'Language',
    theme: 'Theme',
    mapLayer: 'Map type',
    layerTopo: 'Topographic',
    layerStandard: 'Standard',
    sources: 'Map data',
    refreshPois: 'Refresh peaks and huts',
    refreshPoisSub: (n: number) => `${n} points from OpenStreetMap`,
    sourcesText:
      'Map and trails: © OpenStreetMap contributors (ODbL). Topographic map: OpenTopoMap (CC-BY-SA). ' +
      'Marked trails: waymarkedtrails.org (CC-BY-SA). Peaks, passes and huts: OpenStreetMap. ' +
      'Route planning: BRouter (brouter.de). Map tiles you have viewed are kept on the phone.',
  },

  theme: {
    names: { system: 'System', dark: 'Dark', light: 'Light', black: 'Black', ocean: 'Ocean', paper: 'Paper' },
    desc: {
      system: 'Dark or Light, following your phone',
      dark: 'Deep grey with amber – the original',
      light: 'Bright and clean',
      black: 'Pure black, easy on OLED screens',
      ocean: 'Night blue with a cyan accent',
      paper: 'Warm paper tones with terracotta',
    },
    systemNow: (name: string) => `(now ${name})`,
    a11y: (name: string) => `${name} theme`,
  },

  language: {
    system: 'System',
    systemDesc: (name: string) => `Phone language – now ${name}`,
    systemFallback: 'Your phone language isn’t available yet – English is used',
    a11y: (name: string) => `Language: ${name}`,
  },
};

export type Dict = typeof en;
