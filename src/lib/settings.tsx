// Ustawienia aplikacji (Menu → Ustawienia): język, motyw, rodzaj mapy.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DICTS, type Dict, type Lang, type LanguageSetting, LANGS, resolveLanguage, setLanguage } from './i18n';
import { systemLanguageCode } from './i18n/system';
import type { ThemeId } from './theme';

/** topo = OpenTopoMap z poziomicami, standard = systemowa mapa telefonu (Apple / Google) */
export type MapLayer = 'topo' | 'standard';

export type Settings = {
  language: LanguageSetting; // 'system' = język telefonu (gdy nieobsługiwany – angielski)
  theme: ThemeId;
  mapLayer: MapLayer;
};

export const DEFAULT_SETTINGS: Settings = { language: 'system', theme: 'dark', mapLayer: 'topo' };

const SETTINGS_KEY = 'mountainmap.settings.v1';

type SettingsContextValue = {
  settings: Settings;
  loaded: boolean;
  /** Język, którym aplikacja faktycznie mówi (po rozwinięciu „system”) */
  lang: Lang;
  /** Kod języka telefonu, np. "pl" (do opisu opcji „System”) */
  systemCode: string | null;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  lang: 'en',
  systemCode: null,
  setSetting: () => {},
});

/** Brakujące albo nieznane wartości (np. ze starszej wersji) zastępujemy domyślnymi. */
export function parseSettings(json: string | null): Settings {
  if (!json) return DEFAULT_SETTINGS;
  try {
    const raw = JSON.parse(json) as Partial<Settings>;
    const themes: ThemeId[] = ['system', 'dark', 'light', 'black', 'ocean', 'paper'];
    const languages: LanguageSetting[] = ['system', ...LANGS];
    return {
      language: raw.language && languages.includes(raw.language) ? raw.language : DEFAULT_SETTINGS.language,
      theme: raw.theme && themes.includes(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
      mapLayer: raw.mapLayer === 'standard' || raw.mapLayer === 'topo' ? raw.mapLayer : DEFAULT_SETTINGS.mapLayer,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((json) => setSettings(parseSettings(json)))
      .catch((e) => console.warn('Could not load settings', e))
      .finally(() => setLoaded(true));
  }, []);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch((e) => console.warn('Could not save settings', e));
      return next;
    });
  }, []);

  // Język telefonu czytamy raz – iOS i Android i tak uruchamiają aplikację od nowa po jego zmianie
  const [systemCode] = useState(systemLanguageCode);
  const lang = resolveLanguage(settings.language, systemCode);
  // Ustawiamy przed renderem dzieci – funkcje w lib/* (T()) od razu mówią właściwym językiem
  setLanguage(lang);

  const value = useMemo(
    () => ({ settings, loaded, setSetting, lang, systemCode }),
    [settings, loaded, setSetting, lang, systemCode],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

/**
 * Słownik aktualnego języka. Komponent, który go używa, przerysowuje się po zmianie języka –
 * dlatego każdy komponent pokazujący tekst powinien wołać useT() (także gdy tekst bierze z funkcji w lib/*).
 */
export function useT(): Dict {
  return DICTS[useContext(SettingsContext).lang];
}
