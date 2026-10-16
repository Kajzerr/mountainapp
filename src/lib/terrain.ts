// Model terenu wbudowany w aplikację (src/data/tatry-dem.json, ok. 3,5 MB). Wczytywany dopiero przy pierwszych
// podpisach szczytów, a nie przy starcie aplikacji, i trzymany w pamięci do końca działania.
import { parseDem, type Dem } from './dem';

let cached: Dem | null | undefined;

export function loadDem(): Dem | null {
  if (cached === undefined) {
    try {
      // require zamiast import: plik ładuje się dopiero przy pierwszym użyciu
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = parseDem(require('../data/tatry-dem.json'));
    } catch (e) {
      console.warn('Could not load terrain model', e);
      cached = null;
    }
  }
  return cached;
}
