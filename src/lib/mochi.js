// J3: Mochi's daily greeting and mood, written from your own data (no AI, nothing sent anywhere).
// Pure: give it your items, class meetings, grades and streak; get back a mood and a few lines.

import { dayKey, addDays, dayDiff, zoned, formatTime, formatWeekday, DEFAULT_TZ } from './time.js';
import { listable } from './model.js';

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const listTitles = (xs, max = 2) => xs.slice(0, max).map((i) => i.title).join(', ') + (xs.length > max ? `, and ${xs.length - max} more` : '');

export function partOfDay(now, tz = DEFAULT_TZ) {
  const h = zoned(now, tz).h;
  if (h >= 22 || h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const HELLO = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Still up' };

// items: main-area items (Home's). classes: class meetings. atRisk: course nicks. streak: lib/progress streak().
export function greeting({ items, classes = [], atRisk = [], streak = null, name = '', now, tz = DEFAULT_TZ }) {
  const today = dayKey(now, tz);
  const part = partOfDay(now, tz);
  const live = listable(items);
  const isWork = (i) => i.kind !== 'event' && !(i.kind === 'assignment' && i.type === 'exam' && !i.expectsSubmission);
  const overdue = live.filter((i) => i.overdue);
  const dueToday = live.filter((i) => isWork(i) && i.dueAt && dayKey(i.dueAt, tz) === today);
  const leftToday = dueToday.filter((i) => !i.done && !i.overdue).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)); // overdue ones have their own line
  const tests = live
    // In-person quizzes and exams only; online quizzes are in the due-today line.
    .filter((i) => (i.type === 'exam' || i.type === 'quiz') && (i.kind === 'event' || (i.kind === 'assignment' && !i.expectsSubmission)) && !i.done && i.dueAt && new Date(i.dueAt).getTime() >= now - 3600000 && dayDiff(today, dayKey(i.dueAt, tz)) <= 3)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const meetings = listable(classes)
    .filter((c) => !c.cancelled && c.dueAt && !c.allDay && new Date(c.endAt || c.dueAt).getTime() > now)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const nextClassToday = meetings.find((c) => dayKey(c.dueAt, tz) === today);
  const firstTomorrow = meetings.find((c) => dayKey(c.dueAt, tz) === addDays(today, 1));

  const lines = [];
  if (overdue.length) lines.push(`${plural(overdue.length, 'thing')} overdue: ${listTitles(overdue)}.`);
  const t = tests[0];
  if (t) {
    const d = dayDiff(today, dayKey(t.dueAt, tz));
    const when = d === 0 ? `today at ${formatTime(t.dueAt, tz)}` : d === 1 ? `tomorrow at ${formatTime(t.dueAt, tz)}` : `${formatWeekday(t.dueAt, tz, true)}`;
    lines.push(`${t.title}${t.nick ? ` (${t.nick})` : ''} is ${when}${t.location ? ` in ${t.location}` : ''}.`);
  }
  if (dueToday.length && !leftToday.length) lines.push(`Everything due today is done. Nice work!`);
  else if (leftToday.length) lines.push(`${plural(leftToday.length, 'thing')} due today. First up: ${leftToday[0].title} at ${formatTime(leftToday[0].dueAt, tz)}.`);
  else if (!overdue.length) lines.push(part === 'evening' || part === 'night' ? 'Nothing else due today.' : 'Nothing due today.');
  const cls = part === 'evening' || part === 'night' ? firstTomorrow : nextClassToday;
  if (cls && lines.length < 3) lines.push(`${cls === firstTomorrow ? 'Tomorrow: ' : 'Next class: '}${cls.nick} ${cls.title.split(' · ')[0]} at ${formatTime(cls.dueAt, tz)}${cls.location ? ` in ${cls.location}` : ''}.`);
  if (streak && lines.length < 3) {
    if (streak.current && streak.today?.state === 'open') lines.push(`You’re on a ${streak.current}-day streak. Finish today to make it ${streak.current + 1}.`);
    else if (streak.current) lines.push(`You’re on a ${streak.current}-day streak.`);
  }
  if (atRisk.length && lines.length < 3) lines.push(`${atRisk.join(' and ')} could use some attention.`);

  const allDone = dueToday.length > 0 && !leftToday.length;
  const testSoon = t && dayDiff(today, dayKey(t.dueAt, tz)) <= 1;
  const mood = part === 'night' && !overdue.length ? 'sleepy' : overdue.length || testSoon ? 'worried' : allDone ? 'celebrate' : streak?.current ? 'happy' : 'neutral';
  const first = name ? name.split(' ')[0] : '';
  return { mood, title: `${HELLO[part]}${first ? `, ${first}` : ''}${part === 'night' ? '?' : '!'}`, lines: lines.slice(0, 3) };
}
