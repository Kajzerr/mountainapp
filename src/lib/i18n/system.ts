// Język telefonu (osobny plik, bo expo-localization działa tylko w aplikacji, nie w testach w Node).
import { getLocales } from 'expo-localization';

/** Kod pierwszego języka z ustawień telefonu, np. "pl"; null, gdy nie da się go odczytać. */
export function systemLanguageCode(): string | null {
  try {
    return getLocales()[0]?.languageCode ?? null;
  } catch {
    return null;
  }
}
