// Phase 4 planning logic (G3–G6, G1/G2/G9, C7). Pure functions.

import { dayKey, addDays, dayDiff, weekOf, DEFAULT_TZ, formatWeekday, formatDate } from './time.js';
import { listable, lateAcceptance } from './model.js';

// G3
export const estimateOf = (item, ud) => ud.estimates?.[item.id] ?? null;
export const plansFor = (ud, itemId) => (ud.plans || []).filter((p) => p.itemId === itemId);
export const spentOf = (item, ud) => ud.focusLog?.[item.id] ?? 0;

export function formatMinutes(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Work you still need to do (not events, not office hours, not done).
export function workItems(items) {
  return listable(items).filter((i) => !i.done && i.kind !== 'event' && i.area === 'main');
}

// C16: exams (any) and in-person quizzes coming up, soonest first, with days to go.
export function upcomingTests(items, now, tz = DEFAULT_TZ, { days = 60, limit = 5 } = {}) {
  const today = dayKey(now, tz);
  return listable(items)
    .filter((i) => !i.classMeeting && !i.done && i.dueAt && (i.type === 'exam' || (i.type === 'quiz' && (i.kind === 'event' || (i.kind === 'assignment' && !i.expectsSubmission)))))
    .filter((i) => new Date(i.endAt || i.dueAt).getTime() >= now)
    .map((i) => ({ item: i, days: dayDiff(today, dayKey(i.dueAt, tz)) }))
    .filter((x) => x.days <= days)
    .sort((a, b) => new Date(a.item.dueAt) - new Date(b.item.dueAt))
    .slice(0, limit);
}

// G6: can you do it ahead of time? Not quizzes or exams you sit in a room for (they
// happen at a set time); online quizzes you take on your own time, yes.
export function plannableAhead(i) {
  return !((i.type === 'quiz' || i.type === 'exam') && (i.kind === 'event' || (i.kind === 'assignment' && !i.expectsSubmission)));
}

// G4: minutes of work per day. Items with plan blocks count on the planned days;
// items without plans count on the day they're due.
export function workloadByDay(items, ud, tz = DEFAULT_TZ) {
  const out = {};
  const add = (key, min) => (out[key] = (out[key] || 0) + min);
  const work = workItems(items);
  const byId = new Set(work.map((i) => i.id));
  for (const p of ud.plans || []) if (byId.has(p.itemId)) add(p.day, p.minutes || 0);
  for (const i of work) {
    if (plansFor(ud, i.id).length) continue;
    const est = estimateOf(i, ud);
    if (est && i.dueAt) add(dayKey(i.dueAt, tz), est);
  }
  return out;
}

// G5: what to work on next. Pinned first, then overdue work you can still turn in,
// then by slack (hours left minus hours needed), then by grade impact.
export function nextUp(items, ud, { now, tz = DEFAULT_TZ, impact = {}, limit = 7 } = {}) {
  const pinned = ud.nextPinned || {};
  const skipped = ud.nextSkipped || {};
  const list = workItems(items)
    .filter((i) => (i.dueAt || pinned[i.id]) && !(skipped[i.id] > now))
    .filter((i) => !(i.overdue && lateAcceptance(i, now)?.closed)) // closed: can't be turned in, nothing to work on
    .filter((i) => i.overdue || !i.dueAt || new Date(i.dueAt).getTime() >= now) // past and not overdue (an exam that happened): nothing left to do
    .map((i) => {
      const est = estimateOf(i, ud);
      const hoursLeft = i.dueAt ? (new Date(i.dueAt).getTime() - now) / 3600000 : Infinity;
      const slack = hoursLeft - (est ?? 60) / 60;
      return { item: i, est, hoursLeft, slack, impact: impact[i.id] || 0, pinned: !!pinned[i.id], reason: reasonFor(i, est, impact[i.id], now, tz) };
    });
  list.sort(
    (a, b) =>
      (b.pinned - a.pinned) ||
      (a.pinned && b.pinned ? pinned[a.item.id] - pinned[b.item.id] : 0) ||
      (Number(b.item.overdue) - Number(a.item.overdue)) ||
      a.slack - b.slack ||
      b.impact - a.impact
  );
  return list.slice(0, limit);
}

export function reasonFor(item, est, impactShare, now, tz = DEFAULT_TZ) {
  const parts = [];
  if (item.overdue) parts.push('Overdue');
  else if (item.dueAt) {
    const d = dayDiff(dayKey(now, tz), dayKey(item.dueAt, tz));
    parts.push(d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : d < 7 ? `Due ${formatWeekday(item.dueAt, tz)}` : `Due ${formatDate(item.dueAt, tz)}`);
  }
  parts.push(est ? `~${formatMinutes(est)}` : 'no estimate');
  if (impactShare >= 0.01) parts.push(`worth ${(impactShare * 100).toFixed(1)}% of the grade`);
  return parts.join(' · ');
}

// G1: Monday-first week containing `key`.
export function weekKeys(key) {
  const start = weekOf(new Date(`${key}T12:00:00Z`), 'UTC').start;
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// G2: 6 rows × 7 days, Monday-first, covering the month of `key`.
export function monthKeys(key) {
  const first = `${key.slice(0, 7)}-01`;
  const start = weekKeys(first)[0];
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function itemsOnDay(items, key, tz = DEFAULT_TZ) {
  return listable(items)
    .filter((i) => i.dueAt && dayKey(i.dueAt, tz) === key)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

// C7: Monday-start weeks spanning the quarter.
export function quarterWeeks(courses, items, now, tz = DEFAULT_TZ) {
  const today = dayKey(now, tz);
  const keys = listable(items).filter((i) => i.dueAt).map((i) => dayKey(i.dueAt, tz));
  const ends = courses.map((c) => c.termEnd && dayKey(c.termEnd, tz)).filter(Boolean);
  let start = keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : addDays(today, -21);
  let end = [...keys, ...ends].reduce((a, b) => (a > b ? a : b), addDays(today, 42));
  if (dayDiff(start, today) > 84) start = addDays(today, -84);
  if (dayDiff(today, end) > 120) end = addDays(today, 120);
  const first = weekKeys(start)[0];
  const weeks = [];
  for (let k = first; k <= end; k = addDays(k, 7)) weeks.push(k);
  return { weeks, start: first, end: addDays(weeks[weeks.length - 1], 6), today };
}

// G6
export function newPlan(itemId, day, { start = null, minutes = 60 } = {}) {
  return { id: Math.random().toString(36).slice(2, 10), itemId, day, start, minutes };
}

// H2: what the extension icon shows.
export function badgeFor(items, now, tz = DEFAULT_TZ) {
  const today = dayKey(now, tz);
  const work = listable(items).filter((i) => i.kind !== 'event' && i.area === 'main');
  const dueToday = work.filter((i) => !i.done && !i.overdue && i.dueAt && dayKey(i.dueAt, tz) === today && new Date(i.dueAt).getTime() >= now).length;
  const overdue = work.filter((i) => i.overdue).length;
  if (dueToday) return { text: String(dueToday), color: overdue ? 'red' : 'accent', title: `${dueToday} due today${overdue ? `, ${overdue} overdue` : ''}` };
  if (overdue) return { text: String(overdue), color: 'red', title: `${overdue} overdue` };
  return { text: '', color: 'accent', title: 'Nothing due today' };
}
