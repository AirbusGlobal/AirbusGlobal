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
