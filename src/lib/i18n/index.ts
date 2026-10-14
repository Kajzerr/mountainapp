// Tłumaczenia: wybór języka i dostęp do słownika.
// Ekrany biorą słownik z useT() (lib/settings.tsx), funkcje w lib/* – z T(). Oba wskazują ten sam, aktualny język:
// SettingsProvider ustawia go (setLanguage) zanim wyrenderuje resztę aplikacji.
import { type Dict, en } from './en';
import { pl } from './pl';

export type { Dict };
export type Lang = 'en' | 'pl';
export type LanguageSetting = 'system' | Lang;

/** Języki dostępne w aplikacji (wybór w ustawieniach i dopasowanie do języka telefonu). */
export const LANGS: Lang[] = ['en', 'pl'];
export const DICTS: Record<Lang, Dict> = { en, pl };

let currentLang: Lang = 'en';

/** Słownik aktualnego języka – dla funkcji poza komponentami. */
export function T(): Dict {
  return DICTS[currentLang];
}

export function currentLanguage(): Lang {
  return currentLang;
}

export function setLanguage(lang: Lang) {
  currentLang = lang;
}

/** Kod języka telefonu (np. "pl", "de-AT") → obsługiwany język albo angielski. */
export function supportedLanguage(code: string | null | undefined): Lang {
  const base = (code ?? '').toLowerCase().split(/[-_]/)[0];
  return (LANGS as string[]).includes(base) ? (base as Lang) : 'en';
}

/** Czy język telefonu jest wśród obsługiwanych (do opisu opcji „System”). */
export function isSupported(code: string | null | undefined): boolean {
  const base = (code ?? '').toLowerCase().split(/[-_]/)[0];
  return (LANGS as string[]).includes(base);
}

/** Ustawienie użytkownika + język telefonu → język aplikacji. */
export function resolveLanguage(setting: LanguageSetting, systemCode: string | null | undefined): Lang {
  if (setting !== 'system' && LANGS.includes(setting)) return setting;
  return supportedLanguage(systemCode);
}
