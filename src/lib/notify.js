// Phase 4 notifications (H1, H3–H7). Pure: given what was seen before and
// what's true now, returns the notifications to show and the new state.
// Nothing fires on the very first run; it only learns what already exists.

import { gradeLabel } from './grades.js';
import { dayKey, DEFAULT_TZ, formatDate, formatTime, zoned } from './time.js';
import { listable } from './model.js';

const minutesOfDay = (now, tz) => {
  const z = zoned(now, tz);
  return z.h * 60 + z.min;
};
const hm = (s) => {
  const [h, m] = String(s || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

export function inQuietHours(now, start, end, tz = DEFAULT_TZ) {
  if (!start || !end || start === end) return false;
  const m = minutesOfDay(now, tz);
  const s = hm(start);
  const e = hm(end);
  return s < e ? m >= s && m < e : m >= s || m < e; // overnight window
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const on = (settings, id) => settings.features?.[id] !== false;

/**
 * prev: previous notify state (or {}); cache: Canvas data; items: allItems(...);
 * summary: gradeSummary.summarize(...) (real grades); settings: withDefaults(...)
 */
export function evaluate({ prev = {}, cache, items, summary, settings, now, tz = DEFAULT_TZ, nickOf = (id) => id }) {
  const notes = [];
  const n = settings.notify || {};
  const quiet = inQuietHours(now, n.quietStart, n.quietEnd, tz);
  const classIds = new Set((summary?.courses || []).map((c) => c.course.id));
  const first = !prev.initialized;
  const next = {
    initialized: true,
    seenAssignments: { ...(prev.seenAssignments || {}) },
    seenAnnouncements: { ...(prev.seenAnnouncements || {}) },
    grades: { ...(prev.grades || {}) },
    coursePct: { ...(prev.coursePct || {}) },
    atRisk: { ...(prev.atRisk || {}) },
    sent: { ...(prev.sent || {}) },
    morning: prev.morning || null,
    targets: { ...(prev.targets || {}) },
  };
  const push = (key, title, message, target) => {
    notes.push({ key, title, message, target });
    next.targets[key] = target;
  };

  const assignments = (cache?.items || []).filter((i) => i.source === 'canvas' && i.kind === 'assignment' && classIds.has(i.courseId));

  // H4: new assignments
  const fresh = assignments.filter((i) => !next.seenAssignments[i.id]);
  for (const i of fresh) next.seenAssignments[i.id] = now;
  if (!first && fresh.length && on(settings, 'assignmentAlerts')) {
    const due = (i) => (i.dueAt ? ` · due ${formatDate(i.dueAt, tz)}` : '');
    if (fresh.length === 1) push(`new:${fresh[0].id}`, `New assignment · ${nickOf(fresh[0].courseId)}`, `${fresh[0].title}${due(fresh[0])}`, `#/open/item/${fresh[0].id}`);
    else push(`new:${now}`, `${plural(fresh.length, 'new assignment')}`, fresh.slice(0, 3).map((i) => `${nickOf(i.courseId)}: ${i.title}`).join('\n') + (fresh.length > 3 ? '\n…' : ''), '#/home');
  }

  // H5: new announcements (your classes, minus courses you muted)
  const muted = n.mutedAnnouncementCourses || {};
  const anns = (cache?.announcements || []).filter((a) => classIds.has(a.courseId));
  const newAnns = anns.filter((a) => !next.seenAnnouncements[a.id]);
  for (const a of newAnns) next.seenAnnouncements[a.id] = now;
  const notifyAnns = newAnns.filter((a) => !muted[a.courseId] && !a.read);
  if (!first && notifyAnns.length && on(settings, 'announcementAlerts')) {
    if (notifyAnns.length <= 2) for (const a of notifyAnns) push(`ann:${a.id}`, `Announcement · ${nickOf(a.courseId)}`, a.title, `#/open/announcement/${a.id}`);
    else push(`ann:${now}`, `${notifyAnns.length} new announcements`, notifyAnns.slice(0, 3).map((a) => `${nickOf(a.courseId)}: ${a.title}`).join('\n'), '#/announcements');
  }

  // H6: new or changed grades, with how the class grade moved
  const byCourse = Object.fromEntries((summary?.courses || []).map((c) => [c.course.id, c]));
  const changed = [];
  // Still learning your grades (first run, or memory from before grades were keyed by class): no alerts.
  const learningGrades = first || !prev.gradesV2;
  for (const i of assignments) {
    const key = `${i.courseId}:${i.id}`; // class + assignment, so a repeated id can't look like a change
    const score = i.sub?.state === 'graded' ? i.sub.score : null;
    const before = next.grades[key];
    if (score != null && before !== score && !learningGrades) changed.push({ i, before });
    next.grades[key] = score;
  }
  next.gradesV2 = true;
  if (!first && changed.length && on(settings, 'gradeAlerts')) {
    const line = ({ i }) => {
      if (n.hideScores) return `${i.title}`;
      const pct = i.points ? ` (${Math.round((i.sub.score / i.points) * 100)}%)` : '';
      return `${i.title}: ${i.sub.score}${i.points ? ` / ${i.points}` : ''}${pct}`;
    };
    const courseLine = (courseId) => {
      const c = byCourse[courseId];
      const was = prev.coursePct?.[courseId];
      if (!c || c.pct == null || n.hideScores) return '';
      return was != null && Math.abs(was - c.pct) >= 0.05 ? `\nClass grade ${was.toFixed(1)}% → ${c.pct.toFixed(1)}%` : `\nClass grade ${c.pct.toFixed(1)}%`;
    };
    if (changed.length <= 2) {
      for (const ch of changed) push(`grade:${ch.i.id}:${ch.i.sub.score}`, `${n.hideScores ? 'New grade' : 'Grade posted'} · ${nickOf(ch.i.courseId)}`, line(ch) + courseLine(ch.i.courseId), `#/open/item/${ch.i.id}`);
    } else {
      push(`grades:${now}`, `${changed.length} new grades`, changed.slice(0, 3).map((ch) => `${nickOf(ch.i.courseId)}: ${line(ch)}`).join('\n'), '#/grades');
    }
  }
  for (const c of summary?.courses || []) if (c.pct != null) next.coursePct[c.course.id] = c.pct;

  // H7: a class newly at risk (fires once per change)
  const riskNow = Object.fromEntries((summary?.atRisk || []).map((c) => [c.course.id, true]));
  if (!first && on(settings, 'riskAlerts')) {
    for (const c of summary?.atRisk || []) {
      if (prev.atRisk?.[c.course.id]) continue;
      const below = c.gp != null ? (c.target - c.gp).toFixed(1) : null;
      const need = c.required?.status === 'needed' ? ` You need ${c.required.need.toFixed(1)}% on what’s left for a ${c.target.toFixed(1)}.` : c.required?.status === 'unreachable' ? ` A ${c.target.toFixed(1)} is out of reach now.` : '';
      push(`risk:${c.course.id}:${now}`, `${nickOf(c.course.id)} is at risk`, `${c.gp != null ? `${gradeLabel(c.gp, summary?.system)}, ${below} below your ${c.target.toFixed(1)} target.` : 'Below your target.'}${need}`, `#/open/grade/${c.course.id}`);
    }
  }
  next.atRisk = riskNow;

  // H1: deadline reminders, once per item per reminder time, never in quiet hours.
  const hours = [...(n.reminderHours || [])].sort((a, b) => b - a);
  if (on(settings, 'deadlineReminders') && hours.length) {
    const upcoming = listable(items).filter((i) => i.area === 'main' && !i.done && i.kind !== 'event' && i.dueAt && new Date(i.dueAt).getTime() > now);
    for (const i of upcoming) {
      const due = new Date(i.dueAt).getTime();
      const passed = hours.filter((h) => now >= due - h * 3600000 && !next.sent[`due:${i.id}:${h}`]);
      if (!passed.length) continue;
      if (quiet) continue; // try again after quiet hours, if it's still before the deadline
      for (const h of passed) next.sent[`due:${i.id}:${h}`] = now; // only the closest one fires
      if (first) continue;
      const left = due - now;
      const inText = left < 3600000 ? `${Math.max(1, Math.round(left / 60000))}m` : left < 86400000 ? `${Math.round(left / 3600000)}h` : `${Math.round(left / 86400000)} days`;
      push(`due:${i.id}:${passed[passed.length - 1]}`, `Due in ${inText}${i.nick ? ` · ${i.nick}` : ''}`, `${i.title} · ${formatTime(i.dueAt, tz)}`, `#/open/item/${i.id}`);
    }
  }

  // H3: morning summary, once a day, at your time (or the next time Chrome opens that morning).
  const today = dayKey(now, tz);
  const m = minutesOfDay(now, tz);
  if (on(settings, 'morningSummary') && next.morning !== today && m >= hm(n.morningTime || '08:00') && m < 12 * 60 && !quiet) {
    next.morning = today;
    {
      const work = listable(items).filter((i) => i.area === 'main' && i.kind !== 'event');
      const dueToday = work.filter((i) => !i.done && !i.overdue && i.dueAt && dayKey(i.dueAt, tz) === today);
      const overdue = work.filter((i) => i.overdue);
      const risk = summary?.atRisk || [];
      const parts = [];
      parts.push(dueToday.length ? `${plural(dueToday.length, 'thing')} due today: ${dueToday.slice(0, 3).map((i) => i.title).join(', ')}${dueToday.length > 3 ? '…' : ''}` : 'Nothing due today.');
      if (overdue.length) parts.push(`${overdue.length} overdue.`);
      if (risk.length) parts.push(`At risk: ${risk.map((c) => nickOf(c.course.id)).join(', ')}.`);
      push(`morning:${today}`, 'Good morning', parts.join(' '), '#/home');
    }
  }

  // Keep state small: forget reminders for things long past, and old click targets.
  const cutoff = now - 30 * 86400000;
  for (const [k, t] of Object.entries(next.sent)) if (t < cutoff) delete next.sent[k];
  const tKeys = Object.keys(next.targets);
  for (const k of tKeys.slice(0, Math.max(0, tKeys.length - 60))) delete next.targets[k];

  return { notes, next };
}
