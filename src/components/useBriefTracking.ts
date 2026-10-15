import { useEffect, useState } from 'react';

/**
 * Znacznik z własnym widokiem (react-native-maps) rysuje się poprawnie tylko z tracksViewChanges = true,
 * ale stałe śledzenie spowalnia mapę. Włączamy je na chwilę po pojawieniu się i po każdej zmianie wyglądu.
 */
export function useBriefTracking(deps: unknown[], ms = 500): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return tracking;
}
