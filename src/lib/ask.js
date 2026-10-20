// J4: Ask Mochi, built-in answers. Understands common questions about your schedule,
// classes and grades and answers straight from your data: exact, instant, private.
// Returns { text, list? } or null when it doesn't understand (J5's on-device AI may then try).

import { gradeLabel } from './grades.js';
import { capital } from './term.js';
import { dayKey, addDays, dayDiff, formatTime, DEFAULT_TZ } from './time.js';
import { listable } from './model.js';
import { weekKeys, nextUp } from './planning.js';
import { completedItems } from './progress.js';

// ---------- understanding the question ----------

const DEPT_WORDS = {
  ACCTG: ['accounting', 'acct', 'acctg'],
  ACCT: ['accounting', 'acct', 'acctg'],
  STAT: ['stats', 'statistics', 'stat'],
  'R E': ['real estate', 'r e', 'r.e.'],
  CSE: ['computer science', 'programming', 'cse', 'cs'],
  MATH: ['math', 'calc', 'calculus'],
  PSYCH: ['psychology', 'psych'],
  ENGL: ['english', 'engl'],
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (q, re) => re.test(q);

export function normalize(q) {
  return ` ${String(q || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[?!,]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

// The class a question is about, by nickname ("stat 311"), subject code or common words ("accounting").
export function findCourse(q, courses) {
  let best = null;
  for (const c of courses) {
    const nick = (c.nick || c.code || '').toLowerCase();
    const dept = nick.replace(/\s*\d+.*$/, '').trim(); // "r e 101" → "r e"
    const aliases = new Set([nick, nick.replace(/\s+/g, ''), dept.length > 2 ? dept : null, ...(DEPT_WORDS[dept.toUpperCase()] || [])].filter(Boolean));
    for (const a of aliases) {
      const m = q.match(new RegExp(`(^|[^a-z0-9])${esc(a)}(?![a-z0-9])`));
      if (m && (!best || a.length > best.len)) best = { course: c, len: a.length };
    }
  }
  return best?.course || null;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHORT = { mon: 0, tue: 1, tues: 1, wed: 2, thu: 3, thur: 3, thurs: 3, fri: 4, sat: 5, sun: 6 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const keyLabel = (key) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00Z`));

// { from, to, label } in day keys, or null if the question names no time.
export function findRange(q, now, tz = DEFAULT_TZ) {
  const today = dayKey(now, tz);
  const week = weekKeys(today);
  const one = (k, label) => ({ from: k, to: k, label: label || keyLabel(k) });
  if (has(q, /\b(today|tonight)\b/)) return one(today, 'today');
  if (has(q, /\btomorrow\b/)) return one(addDays(today, 1), 'tomorrow');
  if (has(q, /\byesterday\b/)) return one(addDays(today, -1), 'yesterday');
  const day = q.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b/);
  const dayIdx = day ? (DAYS.indexOf(day[1]) >= 0 ? DAYS.indexOf(day[1]) : SHORT[day[1]]) : -1;
  if (has(q, /\bnext week\b/)) {
    const nw = weekKeys(addDays(week[0], 7));
    if (dayIdx >= 0) return one(nw[dayIdx]); // "next week on wednesday"
    return { from: nw[0], to: nw[6], label: 'next week' };
  }
  if (has(q, /\bthis week\b/) && dayIdx >= 0) return one(week[dayIdx]);
  if (has(q, /\bthis weekend\b|\bthe weekend\b/)) return { from: week[5], to: week[6], label: 'this weekend' };
  if (has(q, /\bthis week\b/)) return { from: today, to: week[6], label: 'this week' };
  const wd = q.match(/\b(next |this )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b/);
  if (wd) {
    const idx = DAYS.indexOf(wd[2]) >= 0 ? DAYS.indexOf(wd[2]) : SHORT[wd[2]];
    if (wd[1] === 'next ') return one(weekKeys(addDays(week[0], 7))[idx]);
    const todayIdx = DAYS.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(now)).toLowerCase());
    return one(addDays(today, (idx - todayIdx + 7) % 7));
  }
  const year = Number(today.slice(0, 4));
  const pick = (m, d) => {
    let k = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dayDiff(today, k) < -60) k = `${year + 1}${k.slice(4)}`; // "1/12" in October means next January
    return one(k);
  };
  const md = q.match(/\b(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])\b/);
  if (md) return pick(Number(md[1]), Number(md[2]));
  const mon = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (3[01]|[12]\d|0?[1-9])(st|nd|rd|th)?\b/);
  if (mon) return pick(MONTHS.indexOf(mon[1]) + 1, Number(mon[2]));
  return null;
}

// "quiz section" | "lecture" | "class" (any meeting) | null
export function meetingKind(q) {
  if (has(q, /\b(quiz ?sections?|sections?|labs?|discussion sections?)\b/)) return 'quiz section';
  if (has(q, /\blectures?\b/)) return 'lecture';
  if (has(q, /\bclass(es)?\b/)) return 'class';
  return null;
}

// ---------- answering ----------

const fmtWhen = (iso, tz, allDay) => `${keyLabel(dayKey(iso, tz))}${allDay ? '' : `, ${formatTime(iso, tz)}`}`;
const inRange = (iso, r, tz) => {
  const k = dayKey(iso, tz);
  return k >= r.from && k <= r.to;
};
const listOf = (items, tz, sub) => items.map((i) => ({ id: i.id, title: i.title, sub: sub(i) }));
const isWork = (i) => i.kind !== 'event' && !i.classMeeting && !(i.kind === 'assignment' && i.type === 'exam' && !i.expectsSubmission);
const isTest = (i) => (i.type === 'exam' || i.type === 'quiz') && !i.classMeeting;
// Sat in a room (not an online quiz or homework due that day).
const inPersonTest = (i) => isTest(i) && (i.kind === 'event' || (i.kind === 'assignment' && !i.expectsSubmission));
const meetingMatches = (m, kind) => !kind || kind === 'class' || (m.meeting || '').toLowerCase() === kind;
const notInPerson = (m) => m.cancelled || /^no |no in-person|asynchronous|videos/i.test(m.title);
const forCourse = (course) => (i) => !course || i.courseId === course.id;
// "No class · Thanksgiving" → "Thanksgiving"; "Quiz section cancelled (day after Exam 1)" → "day after Exam 1".
export function reasonOf(m) {
  if (/videos/i.test(m.title)) return 'videos instead of an in-person lecture';
  if (/asynchronous/i.test(m.title)) return m.title.replace(/^no class · /i, '');
  return m.title.match(/·\s*(.+)$/)?.[1] || m.title.match(/\(([^)]+)\)/)?.[1] || m.title;
}
const plural = (what, n = 2) => (n === 1 ? what : what === 'class' ? 'classes' : `${what}s`);

export const EXAMPLES = ['What’s due tomorrow?', 'When’s my next exam?', 'How am I doing in my classes?', 'What should I work on next?'];

const monthDay = (key) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00Z`));

// Example questions that fit right now, most useful first (each one is answerable).
export function suggestQuestions(data, n = 3) {
  const { now, tz = DEFAULT_TZ } = data;
  const today = dayKey(now, tz);
  const items = listable(data.items || []);
  const classes = listable(data.classes || []);
  const soon = (iso, days) => {
    const d = dayDiff(today, dayKey(iso, tz));
    return d >= 0 && d <= days;
  };
  const byTime = (a, b) => new Date(a.dueAt) - new Date(b.dueAt);
  const out = [];
  const off = classes.filter((m) => m.dueAt && m.cancelled && soon(m.dueAt, 14)).sort(byTime)[0];
  if (off) out.push(`Why is there no ${off.nick} ${(off.meeting || 'class').toLowerCase()} on ${monthDay(dayKey(off.dueAt, tz))}?`);
  const test = items.filter((i) => inPersonTest(i) && !i.done && i.dueAt && soon(i.dueAt, 21)).sort(byTime)[0];
  if (test) out.push(`When is ${test.nick} ${test.title}?`);
  if (items.some((i) => i.overdue)) out.push('What’s overdue?');
  const tomorrow = addDays(today, 1);
  out.push(items.some((i) => isWork(i) && !i.done && i.dueAt && dayKey(i.dueAt, tz) === tomorrow) ? 'What’s due tomorrow?' : 'What’s due this week?');
  const nickOf = (id) => (data.courses || []).find((c) => c.id === id)?.nick;
  const lowest = (data.grades?.courses || []).filter((c) => c.pct != null && nickOf(c.course.id)).sort((a, b) => a.pct - b.pct)[0];
  if (lowest) out.push(`How am I doing in ${nickOf(lowest.course.id)}?`);
  out.push('What should I work on next?');
  return out.slice(0, n);
}

export function answer(question, data) {
  const { now, tz = DEFAULT_TZ } = data;
  const q = normalize(question);
  const course = findCourse(q, data.courses || []);
  const range = findRange(q, now, tz);
  const kind = meetingKind(q);
  const noSection = q.replace(/quiz ?sections?/g, ' ');
  const items = listable(data.items || []);
  const classes = listable(data.classes || []);
  const label = course ? `${course.nick} ` : '';

  if (has(q, /^ (hi|hey|hello|help|yo)\b|what can (you|i) (do|ask)|how do (you|i) use/)) {
    return { text: 'Hi! I know your due dates, exams, class meetings, grades and streak. Try asking:', list: suggestQuestions(data, 5).map((e) => ({ title: e, ask: true })) };
  }

  // "Why don't I have a quiz section next week?"
  if (has(q, /\bwhy\b/) && has(q, /\b(no|not|don't|dont|doesn't|isn't|aren't|cancel+ed|off|skip)\b/) && (kind || has(noSection, /\b(exam|quiz|midterm|final)\b/))) {
    const r = range || { from: dayKey(now, tz), to: addDays(dayKey(now, tz), 6), label: 'the next 7 days' };
    const what = kind && kind !== 'class' ? kind : 'class';
    const all = classes.filter(forCourse(course)).filter((m) => meetingMatches(m, kind));
    if (!all.length) {
      return { text: `I don’t have ${label}${what} times. ${kind === 'quiz section' ? 'Canvas didn’t say which quiz section you’re in, or it isn’t in your syllabus.' : 'They aren’t in your built-in syllabi.'}` };
    }
    const within = all.filter((m) => inRange(m.dueAt, r, tz));
    const off = within.filter(notInPerson);
    const on = within.filter((m) => !notInPerson(m));
    const dayOf = (iso) => dayKey(iso, tz);
    const wd = (k) => new Date(`${k}T12:00:00Z`).getUTCDay();
    const usualDays = [...new Set(all.map((m) => wd(dayOf(m.dueAt))))].sort();
    const meetsOn = (k) => on.some((m) => dayOf(m.dueAt) === k);
    // A quiz or exam on a usual meeting day with no regular meeting takes that meeting's place
    // (ACCTG quizzes are given in quiz section; STAT exams are given in lecture).
    const tests = items
      .filter(forCourse(course))
      .filter((i) => inPersonTest(i) && i.dueAt && inRange(i.dueAt, r, tz) && usualDays.includes(wd(dayOf(i.dueAt))) && !meetsOn(dayOf(i.dueAt)))
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    const parts = [
      ...off.map((m) => `${m.cancelled ? 'No' : 'No in-person'} ${label}${what} on ${keyLabel(dayOf(m.dueAt))} (${reasonOf(m)}).`),
      ...tests.map((t) => `On ${keyLabel(dayOf(t.dueAt))}, your ${what} is ${t.title}${course ? '' : ` (${t.nick})`}: same ${t.allDay ? 'place' : `time (${formatTime(t.dueAt, tz)}) and place`}${t.location && !/^your /i.test(t.location) ? `, ${t.location}` : ''}, but you’re taking the ${t.type === 'quiz' ? 'quiz' : 'exam'}.`),
    ];
    const list = listOf([...off, ...tests].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)), tz, (i) => `${i.nick} · ${fmtWhen(i.dueAt, tz, i.allDay)}`);
    // Asked about one day that isn't a meeting day at all.
    if (r.from === r.to && !within.length && !tests.length && usualDays.length && !usualDays.includes(wd(r.from))) {
      const names = usualDays.map((d) => ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][d]);
      parts.push(`${label}${plural(what)} meet on ${names.join(' and ')}, so there isn’t one on ${keyLabel(r.from)}.`);
    }
    if (on.length) parts.push(`${parts.length ? 'You still have' : 'You do have'} ${on.length} ${plural(what, on.length)} ${r.label}: ${on.map((m) => `${keyLabel(dayOf(m.dueAt))}${m.allDay ? '' : ` at ${formatTime(m.dueAt, tz)}`}`).join(', ')}.`);
    if (!within.length && !tests.length && !parts.length) {
      const last = all.map((m) => dayOf(m.dueAt)).sort().pop();
      parts.push(last < r.from ? `${label}${plural(what)} are over for the ${data.grades?.termWord || 'term'} (the last one was ${keyLabel(last)}).` : `I don’t see any ${label}${what} ${r.label}, and nothing in your syllabus says why.`);
    }
    return { text: parts.join(' '), list };
  }

  if (has(q, /\bstreak\b/)) {
    const s = data.streak;
    if (!s) return { text: 'Your streak is turned off in Settings → Features.' };
    const t = s.today;
    return { text: `You’re on a ${s.current}-day streak (best: ${s.best}). ${t.state === 'open' ? `Today: ${t.done} of ${t.total} done.` : t.state === 'done' ? 'Everything due today is done.' : 'Nothing’s due today.'}` };
  }

  if (has(q, /\b(grades?|doing|score|percent|gpa|standing|passing|failing)\b/)) {
    const gs = data.grades?.courses || [];
    const fmt = (c) => `${c.pct != null ? `${c.pct.toFixed(1)}%` : 'no grades yet'}${c.gp != null ? ` (${gradeLabel(c.gp, data.grades?.system)})` : ''}${c.atRisk ? ' · at risk' : ''}`;
    if (course) {
      const g = gs.find((c) => c.course.id === course.id);
      if (!g) return { text: `I don’t have a grade for ${course.nick} yet.` };
      return { text: `${course.nick}: ${fmt(g)}.${g.atRisk ? ` That’s below your ${g.target?.toFixed?.(1) ?? 'target'}.` : g.gp != null && g.target != null && g.gp >= g.target - 1e-9 ? ` On track for your ${g.target.toFixed(1)}.` : ''}` };
    }
    const gpa = data.grades?.quarter?.gpa;
    return { text: `${gpa != null ? `${capital(data.grades?.termWord || 'term')} GPA so far: ${gpa.toFixed(2)}.` : 'Here’s where your classes stand:'}`, list: gs.map((c) => ({ title: c.course.nick || c.course.code, sub: fmt(c) })) };
  }

  if (has(q, /\b(overdue|missing|missed|behind|late)\b/)) {
    const list = items.filter(forCourse(course)).filter((i) => i.overdue);
    return list.length ? { text: `${list.length} ${label}overdue:`, list: listOf(list, tz, (i) => `${i.nick} · was due ${fmtWhen(i.dueAt, tz)}`) } : { text: `Nothing ${label}overdue. You’re caught up.` };
  }

  if (has(q, /\boffice hours?\b|\boh\b/)) {
    const oh = listable(data.officeHours || []).filter(forCourse(course)).filter((i) => new Date(i.endAt || i.dueAt).getTime() > now && (!range || inRange(i.dueAt, range, tz)));
    return oh.length ? { text: `Upcoming ${label}office hours:`, list: listOf(oh.slice(0, 6), tz, (i) => `${fmtWhen(i.dueAt, tz)}${i.location ? ` · ${i.location}` : ''}`) } : { text: `I don’t see ${label}office hours${range ? ` ${range.label}` : ' coming up'}.` };
  }

  // Class meetings (asked before exams so "quiz section" isn't read as "quiz").
  if (kind && !has(noSection, /\b(exam|midterm|final)\b/)) {
    const all = classes.filter(forCourse(course)).filter((m) => meetingMatches(m, kind));
    const what = kind === 'class' ? 'class' : kind;
    if (!all.length) return { text: `I don’t have ${label}${what} times${kind === 'quiz section' ? ' (Canvas didn’t say which quiz section you’re in)' : ''}.` };
    const upcoming = all.filter((m) => new Date(m.endAt || m.dueAt).getTime() > now);
    const list = range ? all.filter((m) => inRange(m.dueAt, range, tz)) : upcoming.slice(0, 3);
    if (!list.length) return { text: `No ${label}${what} ${range ? range.label : 'coming up'}.` };
    return {
      text: range ? `${label}${plural(what, list.length)} ${range.label}:` : `Your next ${label}${plural(what, list.length)}:`,
      list: listOf(list, tz, (m) => `${fmtWhen(m.dueAt, tz, m.allDay)}${m.location ? ` · ${m.location}` : ''}${m.cancelled ? ' · cancelled' : ''}`),
    };
  }

  if (has(noSection, /\b(exams?|midterms?|finals?|quiz|quizzes|tests?)\b/)) {
    const want = has(noSection, /\b(quiz|quizzes)\b/) && !has(noSection, /\b(exams?|midterms?|finals?|tests?)\b/) ? 'quiz' : has(noSection, /\btests?\b/) ? null : 'exam';
    const list = items
      .filter(forCourse(course))
      .filter(isTest)
      .filter((i) => !want || i.type === want)
      .filter((i) => i.dueAt && (range ? inRange(i.dueAt, range, tz) : new Date(i.dueAt).getTime() > now - 3600000))
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    const noun = want === 'quiz' ? 'quiz' : want === 'exam' ? 'exam' : 'test';
    if (!list.length) return { text: `No ${label}${noun}${noun === 'quiz' ? 'zes' : 's'} ${range ? range.label : 'coming up'}.` };
    const shown = range ? list : list.slice(0, 3);
    return { text: range ? `${label}${noun}${shown.length === 1 ? '' : noun === 'quiz' ? 'zes' : 's'} ${range.label}:` : `Your next ${label}${noun}${shown.length === 1 ? '' : noun === 'quiz' ? 'zes' : 's'}:`, list: listOf(shown, tz, (i) => `${i.nick} · ${fmtWhen(i.dueAt, tz, i.allDay)}${i.location ? ` · ${i.location}` : ''}`) };
  }

  if (has(q, /\b(work on|should i (do|start|work)|what next|do next|focus on|prioriti[sz]e|start with)\b/)) {
    const list = nextUp(items.filter(forCourse(course)), data.ud || {}, { now, tz, limit: 3 });
    return list.length ? { text: 'I’d start with:', list: list.map((x) => ({ id: x.item.id, title: x.item.title, sub: `${x.item.nick} · ${x.reason}` })) } : { text: 'Nothing left to work on. Nice.' };
  }

  if (has(q, /\b(finished|completed|turned in|submitted|did i (do|finish|submit))\b/)) {
    const r = range || { from: weekKeys(dayKey(now, tz))[0], to: dayKey(now, tz), label: 'this week' };
    const list = completedItems(items.filter(forCourse(course)), data.ud || {}).filter((x) => x.at && inRange(new Date(x.at).toISOString(), r, tz));
    return list.length ? { text: `You finished ${list.length} ${label}${list.length === 1 ? 'thing' : 'things'} ${r.label}:`, list: listOf(list.map((x) => x.item), tz, (i) => i.nick || 'Personal') } : { text: `Nothing ${label}finished ${r.label} yet.` };
  }

  const dueWords = has(q, /\b(due|deadlines?|assignments?|homework|hw|to ?dos?|tasks?|have to do|need to do|busy|free|plans?|schedule)\b/);
  if (dueWords || range) {
    const r = range || { from: dayKey(now, tz), to: addDays(dayKey(now, tz), 6), label: 'in the next 7 days' };
    const work = items.filter(forCourse(course)).filter(isWork).filter((i) => i.dueAt && inRange(i.dueAt, r, tz)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    const meet = dueWords ? [] : classes.filter(forCourse(course)).filter((m) => !m.cancelled && inRange(m.dueAt, r, tz));
    const tests = items.filter(forCourse(course)).filter((i) => isTest(i) && !isWork(i) && i.dueAt && inRange(i.dueAt, r, tz));
    const all = [...work, ...tests, ...meet].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    if (!all.length) return { text: `Nothing ${label}due ${r.label}.` };
    const done = work.filter((i) => i.done).length;
    return {
      text: `${work.length ? `${work.length} ${label}${work.length === 1 ? 'thing' : 'things'} due ${r.label}${done ? ` (${done} done)` : ''}` : `${label}${r.label}`}:`,
      list: listOf(all, tz, (i) => `${i.nick || 'Personal'} · ${i.classMeeting || isTest(i) ? fmtWhen(i.dueAt, tz, i.allDay) : `due ${fmtWhen(i.dueAt, tz)}`}${i.done ? ' · done' : ''}`),
    };
  }

  return null;
}
