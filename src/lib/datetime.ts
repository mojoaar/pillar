/**
 * Format a Date object or timestamp string to the user's preferred local timezone and format.
 */
export type DateFormatPreference = 'EU' | 'US' | 'ISO';

interface FormatOptions {
  timezone?: string; // IANA string e.g., 'Europe/Oslo' or 'America/New_York'
  hour12?: boolean;  // 12-hour (true) or 24-hour (false)
  dateFormat?: DateFormatPreference;
}

/**
 * Returns a fallback timezone (e.g. system default) if none is configured.
 */
export function getDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Formats a Date into a string containing both the date and time.
 * Example (EU 24h): "21/06/2026 15:30:22"
 */
export function formatDateTime(
  date: Date | string | number,
  options: FormatOptions = {}
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  const tz = options.timezone || getDefaultTimezone();
  const h12 = options.hour12 !== undefined ? options.hour12 : false;
  const pref = options.dateFormat || 'EU';

  // Format Date portion
  let dateStr = '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';

  if (pref === 'EU') {
    dateStr = `${day}/${month}/${year}`;
  } else if (pref === 'US') {
    dateStr = `${month}/${day}/${year}`;
  } else {
    // ISO format
    dateStr = `${year}-${month}-${day}`;
  }

  // Format Time portion
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: h12,
  }).format(d);

  return `${dateStr} ${timeStr}`;
}

/**
 * Formats a Date to date-only.
 * Example (ISO): "2026-06-21"
 */
export function formatDateOnly(
  date: Date | string | number,
  options: FormatOptions = {}
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  const tz = options.timezone || getDefaultTimezone();
  const pref = options.dateFormat || 'EU';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';

  if (pref === 'EU') return `${day}/${month}/${year}`;
  if (pref === 'US') return `${month}/${day}/${year}`;
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date to time-only.
 * Example: "15:30:22" or "03:30:22 PM"
 */
export function formatTimeOnly(
  date: Date | string | number,
  options: FormatOptions = {}
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Time';

  const tz = options.timezone || getDefaultTimezone();
  const h12 = options.hour12 !== undefined ? options.hour12 : false;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: h12,
  }).format(d);
}
