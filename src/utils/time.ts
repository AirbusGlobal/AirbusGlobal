/**
 * UTC storage -> Africa/Nairobi (EAT) presentation helpers.
 */

export const EAT_TIMEZONE = 'Africa/Nairobi';

export function formatEATDateTime(ts?: number | string | null): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return (
      new Intl.DateTimeFormat('en-KE', {
        timeZone: EAT_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d) + ' EAT'
    );
  } catch {
    return d.toISOString();
  }
}

export function formatEATDate(ts?: number | string | null): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: EAT_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export interface EATDateParts {
  year: number;
  month: string; // '01'..'12'
  day: string; // '01'..'31'
  hour: string; // '00'..'23'
  yearKey: string; // YYYY
  monthKey: string; // YYYY-MM
  dayKey: string; // YYYY-MM-DD
  hourKey: string; // YYYY-MM-DD HH:00
}

export function getEATParts(ts: number): EATDateParts {
  const d = new Date(ts);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: EAT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (type: string, fallback: string) =>
      parts.find(p => p.type === type)?.value || fallback;
    const yearStr = get('year', String(d.getUTCFullYear()));
    const monthStr = get('month', String(d.getUTCMonth() + 1).padStart(2, '0'));
    const dayStr = get('day', String(d.getUTCDate()).padStart(2, '0'));
    let hourStr = get('hour', String(d.getUTCHours()).padStart(2, '0'));
    if (hourStr === '24') hourStr = '00';
    return {
      year: Number(yearStr) || d.getUTCFullYear(),
      month: monthStr,
      day: dayStr,
      hour: hourStr,
      yearKey: yearStr,
      monthKey: `${yearStr}-${monthStr}`,
      dayKey: `${yearStr}-${monthStr}-${dayStr}`,
      hourKey: `${yearStr}-${monthStr}-${dayStr} ${hourStr}:00`,
    };
  } catch {
    const eat = new Date(ts + 3 * 3600 * 1000);
    const yearStr = String(eat.getUTCFullYear());
    const monthStr = String(eat.getUTCMonth() + 1).padStart(2, '0');
    const dayStr = String(eat.getUTCDate()).padStart(2, '0');
    const hourStr = String(eat.getUTCHours()).padStart(2, '0');
    return {
      year: eat.getUTCFullYear(),
      month: monthStr,
      day: dayStr,
      hour: hourStr,
      yearKey: yearStr,
      monthKey: `${yearStr}-${monthStr}`,
      dayKey: `${yearStr}-${monthStr}-${dayStr}`,
      hourKey: `${yearStr}-${monthStr}-${dayStr} ${hourStr}:00`,
    };
  }
}

