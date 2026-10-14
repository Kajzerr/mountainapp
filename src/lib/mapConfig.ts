// Ustawienia mapy: obszar startowy i źródła kafelków.
// Kafelki z serwerów społecznościowych (OpenTopoMap, Waymarked Trails) – darmowe przy małym ruchu i z podpisem autorów.
// Przed publikacją w sklepach trzeba przejść na własne kafelki albo płatnego dostawcę (patrz PLAN.md).
import type { Region } from 'react-native-maps';

/** Tatry polskie i słowackie w całości. */
export const TATRY_REGION: Region = {
  latitude: 49.205,
  longitude: 20.0,
  latitudeDelta: 0.24,
  longitudeDelta: 0.42,
};

/** Mapa topograficzna (poziomice, cieniowanie, szlaki jako linie). */
export const TOPO_TILES = {
  url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
  maxNativeZoom: 17,
};

/** Przezroczysta nakładka ze szlakami w kolorach znakowania (czerwony, niebieski, zielony, żółty, czarny). */
export const TRAIL_TILES = {
  url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
  maxNativeZoom: 17,
};

/** Pobrane kafelki trzymamy w telefonie – raz obejrzany fragment mapy działa potem bez zasięgu (Android). */
export const TILE_CACHE_MAX_AGE_S = 60 * 60 * 24 * 30;
