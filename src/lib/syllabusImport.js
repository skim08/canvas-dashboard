// K5: finds exams, quizzes, deadlines, class meetings, days off and topics in a
// syllabus's text, by pattern. Pure: no DOM, no storage. Everything it finds keeps the
// line it came from, and nothing is saved until you review it (K6).

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const validDay = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const addDays = (key, n) => new Date(Date.parse(`${key}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// The year that puts a month/day closest to the middle of the term (or a few weeks from now).
function pickYear(m, d, ctx) {
  if (ctx.year) return ctx.year;
  const mid = ctx.termStart && ctx.termEnd ? addDays(ctx.termStart, Math.round(daysBetween(ctx.termStart, ctx.termEnd) / 2)) : addDays(ctx.today, 45);
  const y0 = Number(mid.slice(0, 4));
  return [y0 - 1, y0, y0 + 1].filter((y) => validDay(y, m, d)).sort((a, b) => Math.abs(daysBetween(mid, keyOf(a, m, d))) - Math.abs(daysBetween(mid, keyOf(b, m, d))))[0];
}

// Every date in a line: [{ day, index, length }], with "Nov 26–27" giving both days.
export function findDates(line, ctx) {
  const out = [];
  const named = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[-–—]\\s*(\\d{1,2})(?!:))?(?:,?\\s+(\\d{4}))?\\b`, 'gi');
  for (const m of line.matchAll(named)) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const d = Number(m[2]);
    const y = m[4] ? Number(m[4]) : pickYear(mo, d, ctx);
    if (!y || !validDay(y, mo, d)) continue;
    out.push({ day: keyOf(y, mo, d), index: m.index, length: m[0].length });
    const to = m[3] ? Number(m[3]) : null;
    if (to && to > d && to - d <= 9) for (let k = d + 1; k <= to; k++) if (validDay(y, mo, k)) out.push({ day: keyOf(y, mo, k), index: m.index, length: m[0].length, range: true });
  }
  // 5/14, 05/14/2027, 5/14/27 (not fractions like "1/2 page" or chapters "3/4": day must look real and not be followed by more digits)
  for (const m of line.matchAll(/(?<![\d/.])(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])(?:\/(\d{4}|\d{2}))?(?![\d/])/g)) {
    if (out.some((o) => m.index >= o.index && m.index < o.index + o.length)) continue;
    const mo = Number(m[1]);
    const d = Number(m[2]);
    if (!m[3] && /\b(ch|chapter|ch\.|pp?|pages?|section|§)\s*$/i.test(line.slice(0, m.index))) continue;
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : pickYear(mo, d, ctx);
    if (!validDay(y, mo, d)) continue;
    out.push({ day: keyOf(y, mo, d), index: m.index, length: m[0].length });
  }
  return out.sort((a, b) => a.index - b.index);
}

// "10:30-11:20 AM", "8:30–10:20 am", "2 pm", "11:59 pm" → { start, end } (24-hour "HH:MM")
export function findTimes(line) {
  const t = '(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?|noon)?';
  const range = line.match(new RegExp(`\\b${t}\\s*(?:[-–—]|to)\\s*${t}(?![\\d])`, 'i'));
  const toH = (h, mm, ap, fallbackAp) => {
    let H = Number(h);
    const a = (ap || fallbackAp || '').toLowerCase().replace(/\./g, '');
    if (a === 'noon') H = 12;
    else if (a.startsWith('p') && H < 12) H += 12;
    else if (a.startsWith('a') && H === 12) H = 0;
    else if (!a && H >= 1 && H <= 6) H += 12; // classes rarely start 1–6 AM
    if (H > 23 || Number(mm || 0) > 59) return null;
    return `${pad(H)}:${pad(Number(mm || 0))}`;
  };
  if (range && (range[2] || range[5] || range[3] || range[6])) {
    const endAp = range[6];
    let start = toH(range[1], range[2], range[3], range[3] ? null : endAp);
    const end = toH(range[4], range[5], endAp, range[3]);
    // "11:30-12:20 PM": the start is still morning.
    if (start && end && start > end && !range[3]) start = toH(range[1], range[2], 'am');
    if (start && end) return { start, end };
  }
  const one = line.match(/\b(\d{1,2})(?::(\d{2}))\s*(a\.?m\.?|p\.?m\.?)|\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i);
  if (one) {
    const start = one[1] ? toH(one[1], one[2], one[3]) : toH(one[4], 0, one[5]);
    return start ? { start, end: null } : null;
  }
  return null;
}

// "MWF", "TTh", "TuTh", "Tuesdays", "Mon/Wed", "Mondays and Wednesdays" → ['Mon', 'Wed', 'Fri']
export function findDays(line) {
  const full = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const words = [...line.matchAll(/\b(mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?s?\b\.?/gi)].map((m) => full[m[1].slice(0, 3).toLowerCase()]);
  if (words.length) return [...new Set(words)];
  for (const m of line.matchAll(/(?:^|[\s:(,])((?:M|Tu|Th|T|W|R|F|Sa|Su)(?:\/?(?:M|Tu|Th|T|W|R|F|Sa|Su)){0,6})(?=[\s,:]+\d)/g)) {
    const toks = m[1].replace(/\//g, '').match(/Th|Tu|Sa|Su|M|T|W|R|F/g);
    if (!toks) continue;
    const map = { M: 'Mon', T: 'Tue', Tu: 'Tue', W: 'Wed', R: 'Thu', Th: 'Thu', F: 'Fri', Sa: 'Sat', Su: 'Sun' };
    return [...new Set(toks.map((x) => map[x]))];
  }
  return [];
}

const ROOM_RE = /\b(?:in|at|room|location:?|@)\s+([A-Z][A-Za-z&.']*(?:\s+[A-Z][A-Za-z&.']*)?\s+\d{1,4}[A-Z]?)\b|,\s*([A-Z]{2,6}\s+\d{1,4}[A-Z]?)\b/;
export const findRoom = (line) => {
  const m = line.match(ROOM_RE);
  return m ? (m[1] || m[2]).trim() : null;
};

const MEETING_RE = /\b(lecture|lab(?:oratory)?|quiz section|discussion(?: section)?|section|seminar|recitation|studio|class(?:es)? meet|class)\b/i;
const NO_CLASS_RE = /\b(no (?:class|classes|lecture|lab|section|quiz section|school|meeting)|holiday|cancell?ed|campus closed|(?:spring|fall|winter|thanksgiving|reading) break|day off)\b/i;
const EXAM_RE = /\b(final exam(?:ination)?|final|mid-?term(?:\s+exam)?(?:\s*#?\s*\d+)?|exam(?:ination)?\s*#?\s*\d+|exam\b|test\s*#?\s*\d+|test\b)/i;
const NOT_EXAM_RE = /\b(review|practice|study guide|prep|final (?:project|paper|report|essay|draft|presentation|portfolio|reflection))\b|exam (?:review|prep)/i;
const QUIZ_RE = /\bquiz(?:zes)?\s*#?\s*\d*/i;
const NOT_QUIZ_RE = /quiz\s*section|online quiz|canvas quiz|pre-?class quiz|reading quiz/i;
const DUE_RE = /\b(due|submit(?:ted)?|turn in|deadline)\b/i;
const WORK_RE = /\b(homework|hw\s*\d*|problem set|pset|assignment|paper|essay|project|lab report|report|draft|reflection|response|proposal|presentation|worksheet|portfolio)\b/i;

const titleCase = (s) => s.replace(/\s+/g, ' ').trim().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bHw\b/, 'HW');
const stripDates = (s, ctx) => {
  let out = s;
  for (const d of findDates(s, ctx).reverse()) out = out.slice(0, d.index) + out.slice(d.index + d.length);
  return out
    .replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?\b,?/gi, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(?:[-–—]|to)\s*\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/gi, '')
    .replace(/\b(by|at|before)?\s*\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,:;|–—-]+|[\s,:;|–—-]+$/g, '');
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';

// → { exams, deadlines, classes, noClass, topics }, each item with `line` (its source).
export function extractSyllabus(text, ctx = {}) {
  const c = { today: ctx.today || new Date().toISOString().slice(0, 10), termStart: ctx.termStart || null, termEnd: ctx.termEnd || null, year: ctx.year || null };
  const found = { exams: [], deadlines: [], classes: [], noClass: [], topics: [] };
  const seen = new Set();
  const add = (list, item) => {
    const k = `${list}|${item.day || ''}|${(item.title || item.name || '').toLowerCase()}`;
    if (seen.has(k)) return;
    seen.add(k);
    found[list].push(item);
  };
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (const line of lines) {
    const dates = findDates(line, c);
    // Class meetings: days + a time range, no particular date ("Lecture: MWF 10:30-11:20 AM, HUB 130").
    if (!dates.length && !NO_CLASS_RE.test(line) && !EXAM_RE.test(line) && !/office hours?/i.test(line)) {
      const days = findDays(line);
      const time = findTimes(line);
      const kind = line.match(MEETING_RE);
      if (days.length && time?.end && (kind || /^[^a-z]*(?:M|T|W|R|F|Tu|Th|Mon|Tue|Wed|Thu|Fri)/i.test(line))) {
        const name = kind ? titleCase(kind[1].replace(/class(es)? meet/i, 'Class').replace(/^lab(oratory)?$/i, 'Lab').replace(/^discussion section$/i, 'Discussion')) : 'Class';
        add('classes', { id: slug(name), name, days, start: time.start, end: time.end, where: findRoom(line), line });
      }
      continue;
    }
    if (!dates.length) continue;
    const days = [...new Set(dates.map((d) => d.day))];
    const time = findTimes(line);
    // A table row splits into cells: the topic, what's due, an exam.
    const cells = line.includes('|') ? line.split(/\s*\|\s*/).map((x) => x.trim()).filter(Boolean) : [line];
    for (const day of days) {
      let used = false;
      if (NO_CLASS_RE.test(line)) {
        const why = stripDates(line, c).replace(/\(|\)/g, '').replace(/^no (class(es)?|lecture|school)\s*[-–—:·]?\s*/i, '').trim();
        add('noClass', { day, title: why ? `No class · ${titleCase(why)}` : 'No class', line });
        continue;
      }
      for (const cell of cells) {
        if (findDates(cell, c).length && cells.length > 1 && !EXAM_RE.test(cell) && !QUIZ_RE.test(cell) && !DUE_RE.test(cell)) continue; // the date cell itself
        if (/^\d{1,2}$|^week\s*\d+$/i.test(cell)) continue; // the week number
        const exam = !NOT_EXAM_RE.test(cell) && cell.match(EXAM_RE);
        const quiz = !exam && !NOT_QUIZ_RE.test(cell) && cell.match(QUIZ_RE);
        if (exam || quiz) {
          const raw = (exam || quiz)[0];
          const title = /^final$/i.test(raw.trim()) ? 'Final exam' : titleCase(raw.replace(/examination/i, 'exam').replace(/\bfinal exam\b/i, 'final exam'));
          const inClass = /\bin class\b|\bduring (?:class|lecture)\b|\bin lecture\b/i.test(line);
          add('exams', { id: slug(`${title}-${day}`), title: title.replace(/^Final Exam$/, 'Final exam'), type: exam ? 'exam' : 'quiz', day, start: time?.start || null, end: time?.end || null, where: inClass ? null : findRoom(line), inClass, line });
          used = true;
          continue;
        }
        if (DUE_RE.test(cell) || (cells.length > 1 && WORK_RE.test(cell) && /due/i.test(line))) {
          const what = stripDates(cell, c).replace(/\b(is |are )?(due|submit(ted)?|turn in|deadline)( by| at| on)?\b:?/gi, '').replace(/\s+/g, ' ').trim();
          if (what.length >= 3) {
            add('deadlines', { id: slug(`${what}-${day}`), title: titleCase(what), day, time: time?.start || null, line });
            used = true;
          }
          continue;
        }
        if (cells.length > 1 && cell.length > 2 && !findTimes(cell)) {
          add('topics', { day, text: cell, line });
          used = true;
        }
      }
      // A plain line with a date and a work word ("Paper draft 5/14") is a deadline.
      if (!used && cells.length === 1 && WORK_RE.test(line)) {
        const what = stripDates(line, c);
        if (what.length >= 3) add('deadlines', { id: slug(`${what}-${day}`), title: titleCase(what), day, time: time?.start || null, line });
      }
    }
  }
  for (const list of Object.values(found)) list.sort((a, b) => (a.day || '').localeCompare(b.day || ''));
  return found;
}

// Reviewed items → a syllabus entry (the format the calendar and grades use; see profiles.js).
export function toSyllabus({ courseId, code, name, source, termStart = null, termEnd = null }, found) {
  // Weekly meetings run from the term's first to last day (or the first and last dates found).
  const allDays = ['exams', 'deadlines', 'noClass', 'topics'].flatMap((k) => (found[k] || []).map((x) => x.day)).filter(Boolean).sort();
  const from = termStart || allDays[0] || null;
  const until = termEnd || allDays[allDays.length - 1] || null;
  const classes = (found.classes || []).map((x, i) => ({ id: x.id || `c${i}`, name: x.name, days: x.days, start: x.start, end: x.end || null, where: x.where || null, from: x.from || from, until: x.until || until }));
  const lectureLike = classes.find((x) => /lecture|class/i.test(x.name)) || classes[0];
  const meetsOn = (day) => {
    const wd = DAY_NAMES[new Date(`${day}T12:00:00Z`).getUTCDay()];
    return classes.find((x) => x.days.includes(wd));
  };
  return {
    id: `course-${courseId}`,
    courseId: String(courseId),
    code: code || null,
    source: source || `${name || code || 'Class'} syllabus`,
    imported: new Date().toISOString().slice(0, 10),
    schedule: {
      classes,
      exams: (found.exams || []).map((e) => {
        const holder = e.inClass && !e.start ? meetsOn(e.day) || lectureLike : null;
        return { id: e.id, title: e.title, type: e.type, day: e.day, start: e.start || null, end: e.end || null, where: e.where || null, ...(holder ? { in: holder.id } : {}), ...(e.inClass && holder ? { replaces: holder.id } : {}), match: examPattern(e.title) };
      }),
      deadlines: (found.deadlines || []).map((d) => ({ id: d.id, day: d.day, title: d.title, ...(d.time ? { time: d.time } : {}) })),
      deadlineTime: '23:59',
      noClass: (found.noClass || []).map((n) => ({ day: n.day, title: n.title })),
      // What each class covers that day (shown on its calendar block, G11).
      topics: (found.topics || []).map((t) => ({ day: t.day, in: meetsOn(t.day)?.id || null, text: t.text })),
    },
  };
}

// A saved syllabus → the editable lists (K7: edit what you saved).
export function fromSyllabus(entry) {
  const sc = entry?.schedule || {};
  return {
    classes: (sc.classes || []).filter((c) => c.days).map((c) => ({ id: c.id, name: c.name, days: [...c.days], start: c.start || '', end: c.end || '', where: c.where || '', from: c.from || null, until: c.until || null })),
    exams: (sc.exams || []).map((e) => ({ id: e.id, title: e.title, type: e.type || 'exam', day: e.day, start: e.start || null, end: e.end || null, where: e.where || null, inClass: !!e.in && !e.start })),
    deadlines: (sc.deadlines || []).map((d) => ({ id: d.id, title: d.title, day: d.day, time: d.time || null })),
    noClass: (sc.noClass || []).map((n) => ({ day: n.day, title: n.title })),
    topics: (sc.topics || []).map((t) => ({ day: t.day, text: t.text })),
  };
}

// "Midterm 1" → a pattern that also finds Canvas's "Midterm #1" or "Exam 1" (stored as text).
export function examPattern(title) {
  const n = title.match(/\d+/)?.[0];
  const words = { 1: 'one|i', 2: 'two|ii', 3: 'three|iii', 4: 'four|iv' };
  const num = n ? `\\s*(#\\s*)?(${n}${words[n] ? `|${words[n]}` : ''})\\b` : '';
  if (/final/i.test(title)) return '\\bfinal\\b(?!\\s*(project|paper|report|essay|draft|presentation|portfolio|reflection))';
  if (/quiz/i.test(title)) return `\\bquiz${num || '\\b'}`;
  return `\\b(exam|midterm|test)${num || '\\b'}`;
}
