// D8: everything you've finished. D9: your daily streak.
// Pure functions over decorated items (model.allItems) and userdata.

import { dayKey, addDays, instantAt, DEFAULT_TZ } from './time.js';
import { listable } from './model.js';

const ms = (t) => (t == null ? null : new Date(t).getTime()); // ISO strings from Canvas, numbers from here

// When you finished it: Canvas's submit time, else when you checked it off here.
export function completedAt(item, ud) {
  return item.sub?.submittedAt || ud.doneAt?.[item.id] || item.doneAt || item.sub?.gradedAt || null;
}

export function completionLabel(item) {
  const s = item.sub || {};
  if (s.state === 'excused') return 'Excused';
  if (s.state === 'graded') return s.score != null && item.points != null ? `Graded · ${s.score}/${item.points}` : 'Graded';
  if (s.state === 'submitted') return s.late ? 'Turned in late' : 'Turned in';
  return 'Checked off';
}

// D8: finished work (not events), newest first. Items with no known time sort by due date.
export function completedItems(items, ud) {
  return listable(items)
    .filter((i) => i.done && i.kind !== 'event')
    .map((i) => ({ item: i, at: completedAt(i, ud) || i.dueAt || null }))
    .sort((a, b) => (ms(b.at) || 0) - (ms(a.at) || 0));
}

// ---------- D9 ----------

// A task is something you have to do by a deadline: not an event, class meeting or
// in-person exam (those happen; you don't check them off).
export function isTask(i) {
  if (i.kind === 'event' || i.classMeeting || i.area !== 'main' || !i.dueAt) return false;
  if (i.kind === 'assignment' && i.type === 'exam' && !i.expectsSubmission) return false;
  if (i.kind === 'assignment' && !i.expectsSubmission && !i.done) return false; // nothing to turn in, not checked off
  return true;
}

// Finished on time: done, and not late by Canvas or by when you checked it off.
export function finishedOnTime(i, ud, tz = DEFAULT_TZ) {
  if (!i.done) return false;
  if (i.sub?.state === 'excused') return true;
  if (i.sub?.late) return false;
  const at = completedAt(i, ud);
  if (!at) return true; // done, time unknown (e.g. checked off before times were recorded)
  return ms(at) <= ms(instantAt(addDays(dayKey(i.dueAt, tz), 1), 0, 0, tz));
}

// 'none' (nothing due), 'done' (all finished on time), 'missed', or 'open' (today, not all done yet).
export function dayStatus(tasks, ud, key, today, tz = DEFAULT_TZ) {
  const due = tasks.filter((i) => dayKey(i.dueAt, tz) === key);
  if (!due.length) return { key, state: 'none', total: 0, done: 0 };
  const done = due.filter((i) => finishedOnTime(i, ud, tz)).length;
  const state = done === due.length ? 'done' : key === today ? 'open' : 'missed';
  return { key, state, total: due.length, done };
}

// Days with nothing due don't count and don't break the streak. Today counts once it's
// all done, and never breaks it while it's still in progress.
export function streak(items, ud, now, tz = DEFAULT_TZ, { lookback = 180, show = 35 } = {}) {
  const tasks = listable(items).filter(isTask);
  const today = dayKey(now, tz);
  const first = tasks.reduce((m, i) => {
    const k = dayKey(i.dueAt, tz);
    return k < m ? k : m;
  }, today);
  const start = first < addDays(today, -lookback) ? addDays(today, -lookback) : first;
  const days = [];
  for (let k = start; k <= today; k = addDays(k, 1)) days.push(dayStatus(tasks, ud, k, today, tz));
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (d.state === 'done') best = Math.max(best, ++run);
    else if (d.state === 'missed') run = 0;
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.state === 'done') current++;
    else if (d.state === 'missed') break;
  }
  const todayStatus = days[days.length - 1];
  const recent = [];
  for (let k = addDays(today, -(show - 1)); k <= today; k = addDays(k, 1)) recent.push(days.find((d) => d.key === k) || { key: k, state: 'none', total: 0, done: 0 });
  return { current, best, today: todayStatus, recent };
}
