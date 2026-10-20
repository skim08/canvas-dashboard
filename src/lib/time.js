// Date helpers that work in your time zone (K2: your computer's).
// Calendar-day math uses "day keys" (YYYY-MM-DD) to avoid DST pitfalls.

// Only a fallback for pure functions called without a zone (tests pin their own).
export const DEFAULT_TZ = 'America/Los_Angeles';

// K2: the time zone your computer is set to; Canvas's profile zone if the computer
// doesn't say; Pacific as a last resort.
export function userTz(canvasTz = null) {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {
    /* fall through */
  }
  return canvasTz || DEFAULT_TZ;
}

const partsCache = new Map();
function partsFormatter(tz) {
  if (!partsCache.has(tz)) {
    partsCache.set(
      tz,
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      })
    );
  }
  return partsCache.get(tz);
}

export function zoned(date, tz = DEFAULT_TZ) {
  const p = {};
  for (const { type, value } of partsFormatter(tz).formatToParts(new Date(date))) p[type] = value;
  return {
    y: +p.year,
    m: +p.month,
    d: +p.day,
    h: +p.hour,
    min: +p.minute,
    weekday: p.weekday, // Mon, Tue, ...
  };
}

export function dayKey(date, tz = DEFAULT_TZ) {
  const z = zoned(date, tz);
  return `${z.y}-${String(z.m).padStart(2, '0')}-${String(z.d).padStart(2, '0')}`;
}

function keyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(key, n) {
  const t = new Date(keyToUTC(key) + n * 86400000);
  return t.toISOString().slice(0, 10);
}

export function dayDiff(fromKey, toKey) {
  return Math.round((keyToUTC(toKey) - keyToUTC(fromKey)) / 86400000);
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Monday-based week containing `date`: { start, end } day keys.
export function weekOf(date, tz = DEFAULT_TZ) {
  const key = dayKey(date, tz);
  const idx = WEEKDAYS.indexOf(zoned(date, tz).weekday);
  const start = addDays(key, -idx);
  return { start, end: addDays(start, 6) };
}

export function formatTime(date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

export function formatDate(date, tz = DEFAULT_TZ, opts = {}) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', ...opts }).format(new Date(date));
}

export function formatWeekday(date, tz = DEFAULT_TZ, long = false) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: long ? 'long' : 'short' }).format(new Date(date));
}

export function formatDateTime(date, tz = DEFAULT_TZ) {
  return `${formatWeekday(date, tz)}, ${formatDate(date, tz)} · ${formatTime(date, tz)}`;
}

export function formatDayHeading(key, todayKey) {
  const diff = dayDiff(todayKey, key);
  const d = new Date(keyToUTC(key) + 12 * 3600000);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(d);
  if (diff === 0) return `Today · ${label}`;
  if (diff === 1) return `Tomorrow · ${label}`;
  return label;
}

export function formatKeyRange(startKey, endKey) {
  const f = (k) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(keyToUTC(k) + 12 * 3600000));
  return `${f(startKey)} – ${f(endKey)}`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Plain-language due text (C3). Events use verb "starts" instead of "due" (C14).
export function formatDue(dueAt, now = Date.now(), tz = DEFAULT_TZ, verb = 'due') {
  if (!dueAt) return verb === 'due' ? 'No due date' : 'No time set';
  const due = new Date(dueAt).getTime();
  const diff = due - now;
  const dDays = dayDiff(dayKey(now, tz), dayKey(due, tz));
  const time = formatTime(due, tz);

  if (diff < 0) {
    const ago = -diff;
    const span = ago < 3600000 ? `${Math.max(1, Math.floor(ago / 60000))}m` : ago < 86400000 ? `${Math.floor(ago / 3600000)}h` : plural(Math.floor(ago / 86400000), 'day');
    return verb === 'due' ? `overdue by ${span}` : `started ${span} ago`;
  }
  if (diff < 3600000) return `${verb} in ${Math.max(1, Math.floor(diff / 60000))}m`;
  if (diff < 86400000) return `${verb} in ${Math.floor(diff / 3600000)}h`;
  if (dDays === 1) return `${verb} tomorrow ${time}`;
  if (dDays <= 6) return `${verb} ${formatWeekday(due, tz)} ${time}`;
  return `${verb} ${formatDate(due, tz)}`;
}

// Same, without countdown wording, for when countdowns are turned off.
export function formatDuePlain(dueAt, tz = DEFAULT_TZ) {
  if (!dueAt) return 'No due date';
  return `${formatWeekday(dueAt, tz)} ${formatDate(dueAt, tz)}, ${formatTime(dueAt, tz)}`;
}

export function urgency(dueAt, now = Date.now()) {
  if (!dueAt) return 'none';
  const diff = new Date(dueAt).getTime() - now;
  if (diff < 0) return 'overdue';
  if (diff < 86400000) return 'soon';
  return 'normal';
}

export function relativeAgo(at, now = Date.now()) {
  const s = Math.floor((now - new Date(at).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return plural(Math.floor(s / 86400), 'day') + ' ago';
}

// The instant for hh:mm on a calendar day in a time zone (DST-safe).
export function instantAt(key, hh, mm, tz = DEFAULT_TZ) {
  const [y, m, d] = key.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const z = zoned(guess, tz);
    const shownMin = Date.UTC(z.y, z.m - 1, z.d, z.h, z.min);
    guess -= shownMin - Date.UTC(y, m - 1, d, hh, mm);
  }
  return new Date(guess).toISOString();
}

export function weekdayOfKey(key) {
  return WEEKDAYS[(new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7];
}
