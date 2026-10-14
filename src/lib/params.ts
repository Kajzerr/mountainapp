// Parametry ekranów (Expo Router).

/** Wartość parametru "a,b,c" → lista id. */
export function parseIds(value: string | string[] | undefined): string[] {
  const text = Array.isArray(value) ? value.join(',') : (value ?? '');
  return text.split(',').filter(Boolean);
}
