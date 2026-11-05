// G12: your own events (pre-class readings, slides to make, study sessions). Saved in
// userdata.events and turned into calendar items here, one per occurrence. Pure: no DOM.
//
// An event: { id, title, courseId, day: 'YYYY-MM-DD', start: 'HH:MM' | null (all day),
//   end: 'HH:MM' | null, repeat: { days: ['Mon', …], until: 'YYYY-MM-DD' } | null,
//   note, type: 'event' | 'reading' | 'assignment' | 'todo', skip: ['YYYY-MM-DD', …] }

import { addDays, instantAt, weekdayOfKey, DEFAULT_TZ } from './time.js';

const MAX = 400; // occurrences per event, so a typo in "until" can't run away
const hm = (t) => t.split(':').map(Number);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The days an event happens on.
export function occurrences(ev) {
  if (!ev?.day) return [];
  const skip = new Set(ev.skip || []);
  const days = ev.repeat?.days?.length ? ev.repeat.days : null;
  if (!days) return skip.has(ev.day) ? [] : [ev.day];
  const until = ev.repeat.until && ev.repeat.until >= ev.day ? ev.repeat.until : addDays(ev.day, 7 * 16);
  const out = [];
  for (let k = ev.day; k <= until && out.length < MAX; k = addDays(k, 1)) {
    if (days.includes(weekdayOfKey(k)) && !skip.has(k)) out.push(k); // weekdayOfKey gives 'Mon', 'Tue', …
  }
  return out;
}

export const occurrenceId = (ev, day) => `ev:${ev.id}:${day}`;
export const eventIdOf = (itemId) => (String(itemId).startsWith('ev:') ? String(itemId).split(':')[1] : null);

// Every occurrence as an item the calendar, lists and Ask Neko already understand.
export function expandEvents(events, { tz = DEFAULT_TZ } = {}) {
  const out = [];
  for (const ev of events || []) {
    if (!ev?.title) continue;
    for (const day of occurrences(ev)) {
      const timed = !!ev.start;
      out.push({
        id: occurrenceId(ev, day),
        eventId: ev.id,
        source: 'own',
        kind: 'event',
        ownType: ev.type && ev.type !== 'event' ? ev.type : null,
        title: ev.title,
        courseId: ev.courseId || null,
        dueAt: timed ? instantAt(day, ...hm(ev.start), tz) : instantAt(day, 23, 59, tz),
        endAt: timed && ev.end && ev.end > ev.start ? instantAt(day, ...hm(ev.end), tz) : null,
        allDay: !timed,
        day,
        location: ev.where || null,
        repeats: !!ev.repeat?.days?.length,
        descriptionHtml: ev.note ? `<p>${esc(ev.note)}</p>` : '',
        url: null,
        sub: null,
        points: null,
        expectsSubmission: false,
        submissionTypes: [],
        rubric: [],
      });
    }
  }
  return out;
}
