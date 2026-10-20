// G8: an .ics calendar file that Google Calendar and Apple Calendar can import.

import { APP_NAME } from './env.js';

const pad = (n) => String(n).padStart(2, '0');

export function icsDate(iso) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// RFC 5545: lines longer than 75 octets are folded with CRLF + space.
export function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * items: due items to include; plans: plan blocks [{ id, itemId, day, start, minutes }]
 * nickOf(courseId) → "BIO 180"; now: for DTSTAMP.
 */
const nextDay = (key) => new Date(Date.parse(`${key}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

export function buildIcs({ items, plans = [], nickOf = () => '', titleOf = () => '', now = Date.now() }) {
  const stamp = icsDate(new Date(now).toISOString());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${APP_NAME}//EN`, 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${APP_NAME}`];
  for (const i of items) {
    if (!i.dueAt) continue;
    const course = nickOf(i.courseId);
    const start = new Date(new Date(i.dueAt).getTime() - (i.endAt ? 0 : 15 * 60000)).toISOString();
    const end = i.endAt || i.dueAt;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(i.id)}@canvas-dashboard`,
      `DTSTAMP:${stamp}`,
      // G10: a syllabus date with no time is an all-day event.
      ...(i.allDay
        ? [`DTSTART;VALUE=DATE:${i.day.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(i.day).replace(/-/g, '')}`]
        : [`DTSTART:${icsDate(i.endAt ? i.dueAt : start)}`, `DTEND:${icsDate(end)}`]),
      `SUMMARY:${icsEscape(`${i.kind === 'event' ? '' : 'Due: '}${i.title}${course ? ` (${course})` : ''}`)}`,
      ...(i.url ? [`URL:${i.url}`] : []),
      ...(i.location ? [`LOCATION:${icsEscape(i.location)}`] : []),
      'END:VEVENT'
    );
  }
  for (const p of plans) {
    const title = `Work on: ${titleOf(p.itemId)}`;
    lines.push('BEGIN:VEVENT', `UID:plan-${icsEscape(p.id)}@canvas-dashboard`, `DTSTAMP:${stamp}`);
    if (p.start) {
      const [y, m, d] = p.day.split('-').map(Number);
      const [hh, mm] = p.start.split(':').map(Number);
      // Floating local time: imports at the same clock time in your calendar.
      lines.push(`DTSTART:${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`);
      const endMin = hh * 60 + mm + (p.minutes || 60);
      lines.push(`DTEND:${y}${pad(m)}${pad(d)}T${pad(Math.min(23, Math.floor(endMin / 60)))}${pad(endMin >= 24 * 60 ? 59 : endMin % 60)}00`);
    } else {
      const next = new Date(Date.UTC(...p.day.split('-').map((x, k) => (k === 1 ? Number(x) - 1 : Number(x)))) + 86400000);
      lines.push(`DTSTART;VALUE=DATE:${p.day.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${icsEscape(title)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
