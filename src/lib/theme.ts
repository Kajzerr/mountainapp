// Motywy kolorów i czcionki (te same co w DailyPlanner). Wybrany motyw pochodzi z ustawień (Menu → Motyw).
import { useColorScheme } from 'react-native';
import { T } from './i18n';
import { useSettings } from './settings';

export type Colors = {
  background: string;
  card: string;
  cardRaised: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  accent: string;
  accentText: string; // tekst/ikona na tle w kolorze akcentu
  success: string;
  danger: string;
  progressTrack: string;
  accentSoft: string; // stonowane tło akcentu
};

export type ThemeId = 'system' | 'dark' | 'light' | 'black' | 'ocean' | 'paper';

type Palette = { name: string; dark: boolean; colors: Colors };

/** Gotowe motywy. „system” nie ma własnych kolorów – wybiera Dark albo Light jak telefon. */
export const PALETTES: Record<Exclude<ThemeId, 'system'>, Palette> = {
  // Domyślny: koncepcja B „Teraz” – ciemne tło, bursztynowy akcent
  dark: {
    name: 'Dark',
    dark: true,
    colors: {
      background: '#0D0F12', card: '#1A1D22', cardRaised: '#22262C',
      text: '#F2F2F0', textSecondary: '#B4B8BF', textTertiary: '#7C828C', border: '#2E333B',
      accent: '#F5B83D', accentText: '#1A1306', success: '#F5B83D', danger: '#FF6B5E', progressTrack: '#2A2E35',
      accentSoft: '#3A2E14',
    },
  },
  light: {
    name: 'Light',
    dark: false,
    colors: {
      background: '#F6F5F2', card: '#FFFFFF', cardRaised: '#EEECE7',
      text: '#1B1C1F', textSecondary: '#5C6068', textTertiary: '#767A82', border: '#E0DED8',
      // Ciemniejszy bursztyn – jasny #F5B83D byłby nieczytelny na białym
      accent: '#985E08', accentText: '#FFFFFF', success: '#985E08', danger: '#D3392B', progressTrack: '#E6E3DC',
      accentSoft: '#F3E3C2',
    },
  },
  black: {
    name: 'Black',
    dark: true,
    colors: {
      background: '#000000', card: '#111214', cardRaised: '#1B1C1F',
      text: '#F2F2F0', textSecondary: '#B4B8BF', textTertiary: '#7A7F88', border: '#26292E',
      accent: '#F5B83D', accentText: '#1A1306', success: '#F5B83D', danger: '#FF6B5E', progressTrack: '#222428',
      accentSoft: '#2E2410',
    },
  },
  ocean: {
    name: 'Ocean',
    dark: true,
    colors: {
      background: '#0B1220', card: '#131C2E', cardRaised: '#1B2740',
      text: '#EAF0F8', textSecondary: '#A9B6C8', textTertiary: '#6F7E94', border: '#26324A',
      accent: '#5CC8E8', accentText: '#06202A', success: '#5CC8E8', danger: '#FF6B6B', progressTrack: '#1E2A40',
      accentSoft: '#163A48',
    },
  },
  paper: {
    name: 'Paper',
    dark: false,
    colors: {
      background: '#F3ECDF', card: '#FBF7EF', cardRaised: '#EDE4D3',
      text: '#2B241B', textSecondary: '#6B5F4E', textTertiary: '#82745F', border: '#E0D5C1',
      accent: '#B3541E', accentText: '#FFFFFF', success: '#B3541E', danger: '#C0392B', progressTrack: '#E5DAC6',
      accentSoft: '#F0D9C8',
    },
  },
};

/** Kolejność na ekranie wyboru motywu. */
export const THEME_ORDER: ThemeId[] = ['system', 'dark', 'light', 'black', 'ocean', 'paper'];

/** Nazwa motywu w języku aplikacji */
export function themeName(id: ThemeId): string {
  return T().theme.names[id];
}

/** Który motyw faktycznie obowiązuje (dla „system” – zależnie od ustawienia telefonu). */
export function resolveTheme(id: ThemeId, scheme: string | null | undefined): Palette {
  if (id === 'system') return scheme === 'light' ? PALETTES.light : PALETTES.dark;
  return PALETTES[id] ?? PALETTES.dark;
}

/** Aktualny motyw: kolory + czy jest ciemny (pasek stanu, klawiatura, wybierak godziny). */
export function useTheme(): { colors: Colors; dark: boolean } {
  const { settings } = useSettings();
  const scheme = useColorScheme();
  const palette = resolveTheme(settings.theme, scheme);
  return { colors: palette.colors, dark: palette.dark };
}

/** Kolory aktualnego motywu. */
export function useColors(): Colors {
  return useTheme().colors;
}

/** Nazwy czcionek – ładowane w src/app/_layout.tsx. */
export const fonts = {
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
};
