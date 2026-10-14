// Daty zdjęć na ekranie. W danych data to tekst "RRRR-MM-DDTGG:MM:SS" (czas lokalny) – bez obiektów Date.
import { T } from './i18n';

/** "12 sierpnia 2026, 10:31" / "Aug 12, 2026, 10:31"; undefined → undefined */
export function formatTakenAt(takenAt: string | undefined): string | undefined {
  if (!takenAt) return undefined;
  const m = takenAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return undefined;
  return T().dates.dateTime(Number(m[3]), Number(m[2]) - 1, Number(m[1]), `${m[4]}:${m[5]}`);
}

/** Sam dzień: "12 sie 2026" / "Aug 12, 2026" */
export function formatDay(takenAt: string | undefined): string | undefined {
  if (!takenAt) return undefined;
  const m = takenAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return T().dates.shortDate(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

/** Teraz jako "RRRR-MM-DDTGG:MM:SS" w czasie lokalnym (moment dodania zdjęcia). */
export function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
