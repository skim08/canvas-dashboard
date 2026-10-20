// J5: a compact, plain-text picture of your schedule for Chrome's on-device AI.
// It stays on your computer: the model runs inside Chrome, offline.

import { gradeLabel } from './grades.js';
import { dayKey, addDays, formatTime, DEFAULT_TZ } from './time.js';
import { listable } from './model.js';

const keyLabel = (key) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00Z`));
const when = (iso, tz, allDay) => `${keyLabel(dayKey(iso, tz))}${allDay ? '' : ` ${formatTime(iso, tz)}`}`;

export const SYSTEM_PROMPT = [
  'You are Mochi, a friendly cat who helps a college student with their schedule.',
  'Answer ONLY from the schedule below. If the answer isn’t there, say you don’t know.',
  'Be brief: one to three short sentences. No markdown headings. Never invent dates, grades or assignments.',
].join(' ');

export function scheduleContext({ items, classes = [], courses = [], grades = null, streak = null, now, tz = DEFAULT_TZ, days = 14, maxChars = 6000 }) {
  const today = dayKey(now, tz);
  const end = addDays(today, days);
  const live = listable(items);
  const soon = (i) => i.dueAt && dayKey(i.dueAt, tz) >= addDays(today, -1) && dayKey(i.dueAt, tz) <= end;
  const out = [];
  out.push(`Today is ${keyLabel(today)}, ${new Date(now).getFullYear()}, ${formatTime(new Date(now).toISOString(), tz)} (time zone: ${tz}).`);
  if (courses.length) out.push(`Classes: ${courses.map((c) => `${c.nick}${c.name ? ` (${c.name})` : ''}`).join('; ')}.`);
  if (grades?.courses?.length) {
    out.push(`Grades: ${grades.courses.map((c) => `${c.course.nick || c.course.code} ${c.pct != null ? `${c.pct.toFixed(1)}%` : 'no grades yet'}${c.gp != null ? ` = ${gradeLabel(c.gp, grades.system)}` : ''}${c.atRisk ? ' (at risk)' : ''}`).join('; ')}.${grades.quarter?.gpa != null ? ` GPA this ${grades.termWord || 'term'} so far: ${grades.quarter.gpa.toFixed(2)}.` : ''}`);
  }
  if (streak) out.push(`Daily streak: ${streak.current} days (best ${streak.best}).`);
  const overdue = live.filter((i) => i.overdue);
  if (overdue.length) out.push(`Overdue: ${overdue.map((i) => `${i.title} (${i.nick}, was due ${when(i.dueAt, tz)})`).join('; ')}.`);
  const work = live.filter((i) => i.kind !== 'event' && soon(i)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  if (work.length) out.push(`Due in the next ${days} days:\n${work.map((i) => `- ${when(i.dueAt, tz, i.allDay)}: ${i.title} (${i.nick || 'personal'}, ${i.type})${i.done ? ' [done]' : ''}`).join('\n')}`);
  const events = live.filter((i) => i.kind === 'event' && soon(i)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  if (events.length) out.push(`Events and exams:\n${events.map((i) => `- ${when(i.dueAt, tz, i.allDay)}: ${i.title} (${i.nick || ''})${i.location ? ` at ${i.location}` : ''}`).join('\n')}`);
  const meet = listable(classes).filter(soon).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  if (meet.length) out.push(`Class meetings:\n${meet.map((m) => `- ${when(m.dueAt, tz, m.allDay)}: ${m.nick} ${m.title}${m.location ? ` at ${m.location}` : ''}${m.cancelled ? ' [CANCELLED]' : ''}`).join('\n')}`);
  let text = out.join('\n');
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}\n(more not shown)`;
  return text;
}
