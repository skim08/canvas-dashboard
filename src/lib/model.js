// Derived views over cached Canvas data + the owner's personal data.
// Pure functions (no DOM, no storage) so they can be unit tested.

import { dayKey, addDays, dayDiff, weekOf, DEFAULT_TZ, instantAt, weekdayOfKey, userTz } from './time.js';
import { findProfile } from './profiles.js';
import { expandEvents } from './events.js';
import { COURSE_COLORS } from './defaults.js';
import { looksLikeClass } from './normalize.js';
import { syllabusSchedule } from './syllabus.js';

export const TYPES = ['assignment', 'quiz', 'exam', 'discussion', 'reading', 'event', 'todo'];
export const TYPE_LABEL = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  exam: 'Exam',
  discussion: 'Discussion',
  reading: 'Reading',
  event: 'Event',
  todo: 'To-do',
};

const EXAM_RE = /\b(midterms?|exams?)\b|\bfinal\b(?!\s*(project|paper|report|essay|draft|presentation|portfolio|reflection))/i;
const NOT_EXAM_EVENT_RE = /\b(review|session|office hours?|study|prep|q&a)\b/i;
// C15: optional sessions (office hours and the like), kept off your to-do list.
const OFFICE_HOURS_RE = /\boffice hours?\b|\bstudent hours\b|\bdrop[- ]in hours\b/i;
export function isOfficeHours(item) {
  const t = item.title || '';
  return item.kind === 'event' && (OFFICE_HOURS_RE.test(t) || /\bOH\b/.test(t)); // "OH" only in capitals
}

const READING_RE = /\b(readings?|read)\b|\bch(apter|\.)\s*\d/i;

// C5: type detection from Canvas data, names and assignment groups.
export function detectType(item) {
  const name = item.title || '';
  const group = item.groupName || '';
  if (item.kind === 'todo') return item.type || 'todo';
  if (item.syllabusType) return item.syllabusType; // G10: the syllabus says it's a quiz or an exam
  if (item.ownType) return item.ownType; // G12: what you said your event is
  if (item.kind === 'event') return EXAM_RE.test(name) && !NOT_EXAM_EVENT_RE.test(name) ? 'exam' : 'event';
  if (EXAM_RE.test(name) || /\bexams?\b|midterm/i.test(group)) return 'exam';
  // Homework set up as a Canvas quiz (auto-graded) is still homework.
  if (/homework|\bhw\b|problem\s*set|worksheet/i.test(name) && !/^quiz\b/i.test(name)) return 'assignment';
  if (item.isQuiz || item.kind === 'quiz' || /\bquiz(zes)?\b/i.test(name) && !/quiz\s*section/i.test(name)) {
    // A quiz you take online on your own time (like a syllabus quiz) is work like any assignment;
    // only quizzes given at a set time and place are tests.
    return item.expectsSubmission ? 'assignment' : 'quiz';
  }
  if (item.isDiscussion || item.kind === 'discussion') return 'discussion';
  // "Chapter 4 Homework" is homework, not a reading.
  if (/homework|\bhw\b|assignment|problem\s*set|worksheet|writing|paper|project|lab\b/i.test(name) && !/^reading/i.test(name)) return 'assignment';
  if (item.kind === 'page' || READING_RE.test(name) || /reading/i.test(group)) return 'reading';
  if (item.kind === 'note') return 'todo';
  return 'assignment';
}

export function typeOf(item, ud) {
  return ud.types[item.id] || detectType(item);
}

// D1
export function statusOf(item) {
  if (item.kind === 'todo') return item.done ? 'done' : 'not_submitted';
  return item.sub?.state || 'not_submitted';
}

export const STATUS_LABEL = {
  not_submitted: 'Not submitted',
  submitted: 'Submitted',
  graded: 'Graded',
  excused: 'Excused',
  done: 'Done',
};

// D2: the owner's checkbox. Defaults to Canvas status, but can be overridden.
export function isDone(item, ud) {
  if (item.kind === 'todo') return !!item.done;
  if (ud.done[item.id] !== undefined) return ud.done[item.id];
  if (item.plannerDone) return true;
  return ['submitted', 'graded', 'excused'].includes(statusOf(item));
}

// C2: past due, not done, and something was actually expected of you.
export function isOverdue(item, ud, now) {
  if (!item.dueAt || new Date(item.dueAt).getTime() >= now) return false;
  if (isDone(item, ud)) return false;
  if (item.kind === 'todo') return true;
  if (item.sub?.missing) return true;
  return item.kind === 'assignment' && item.expectsSubmission;
}

// C2: is late work still accepted?
export function lateAcceptance(item, now) {
  if (!item.dueAt || new Date(item.dueAt).getTime() >= now) return null;
  if (item.lockAt && new Date(item.lockAt).getTime() <= now) return { closed: true };
  if (item.lockAt) return { closed: false, until: item.lockAt };
  return { closed: false, until: null };
}

export function courseColor(courseId, courses, settings) {
  const own = settings.courses[courseId]?.color;
  if (own) return own;
  const idx = courses.findIndex((c) => c.id === courseId);
  return COURSE_COLORS[(idx < 0 ? 0 : idx) % COURSE_COLORS.length];
}

export function courseNick(courseId, courses, settings) {
  if (!courseId) return '';
  const own = settings.courses[courseId]?.nickname;
  if (own) return own;
  return courses.find((c) => c.id === courseId)?.autoNick || 'Course';
}

// B12: 'core' (a class you're taking) or 'other' (orgs, workshops, advising…).
// Your choice in Settings wins; otherwise it's guessed from the course code.
export function courseRole(course, settings) {
  const own = settings.courses[course.id]?.role;
  if (own) return own;
  const isClass = course.isClass ?? looksLikeClass({ course_code: course.code, name: course.name });
  return isClass ? 'core' : 'other';
}

function separateOther(settings) {
  return settings.features?.otherTab !== false;
}

export function visibleCourses(courses, settings, role = null) {
  return courses.filter((c) => {
    if (settings.courses[c.id]?.hidden || c.unavailable) return false;
    if (!role || !separateOther(settings)) return true;
    return courseRole(c, settings) === role;
  });
}

// F10: office-hour slots for a class: built in from your syllabus, plus your own.
export function officeHourSlots(course, ud) {
  const profile = findProfile(course);
  const builtIn = (profile?.officeHours || []).filter((s) => !ud.ohHidden?.[s.id]).map((s) => ({ ...s, source: 'syllabus' }));
  const own = (ud.officeHours?.[course.id] || []).map((s) => ({ ...s, source: 'yours' }));
  return [...builtIn, ...own];
}

// F10 → C15: weekly slots become real sessions for the next two weeks, so they
// show in the Office hours section and can be added to your calendar.
// Built-in slots are skipped for a class whose Canvas calendar already lists office hours.
export function officeHourSessions(courses, ud, canvasItems, now, tz = DEFAULT_TZ, days = 14) {
  const today = dayKey(now, tz);
  const out = [];
  for (const course of courses) {
    const canvasHasOH = canvasItems.some((i) => i.courseId === course.id && isOfficeHours(i));
    for (const s of officeHourSlots(course, ud)) {
      if (s.source === 'syllabus' && canvasHasOH) continue;
      if (!s.days?.length || !s.start) continue;
      const [sh, sm] = s.start.split(':').map(Number);
      const [eh, em] = (s.end || s.start).split(':').map(Number);
      for (let d = 0; d < days; d++) {
        const key = addDays(today, d);
        if (!s.days.includes(weekdayOfKey(key))) continue;
        if ((s.from && key < s.from) || (s.until && key > s.until)) continue;
        const start = instantAt(key, sh, sm, tz);
        const end = instantAt(key, eh, em, tz);
        if (new Date(end).getTime() < now) continue;
        out.push({
          id: `oh:${course.id}:${s.id}:${key}`,
          source: 'own',
          kind: 'event',
          courseId: course.id,
          title: `Office hours · ${s.person}`,
          dueAt: start,
          endAt: end,
          location: s.where || null,
          url: null,
          sub: null,
          expectsSubmission: false,
          submissionTypes: [],
          descriptionHtml: '',
          rubric: [],
          slot: s,
        });
      }
    }
  }
  return out;
}

// All items (Canvas + own to-dos) with derived fields attached.
export function allItems(cache, ud, settings, now) {
  const courses = cache?.courses || [];
  const hiddenCourses = new Set(courses.filter((c) => settings.courses[c.id]?.hidden).map((c) => c.id));
  const todos = (ud.todos || []).map((t) => ({
    ...t,
    source: 'own',
    kind: 'todo',
    url: null,
    sub: null,
    expectsSubmission: false,
  }));
  const tz = userTz(cache?.profile?.timeZone);
  const visible = courses.filter((c) => !hiddenCourses.has(c.id) && !c.unavailable);
  const sessions = ud.officeHours || courses.some((c) => findProfile(c)?.officeHours) ? officeHourSessions(visible, ud, cache?.items || [], now, tz) : [];
  // G10, G11: exams, deadlines and class meetings from your syllabi.
  const syl = syllabusSchedule(visible, cache?.items || [], { tz, dates: settings.features?.syllabusDates !== false, classes: settings.features?.classSchedule !== false });
  const canvas = (cache?.items || []).map((i) => (syl.patch[i.id] ? { ...i, ...syl.patch[i.id] } : i));
  // G12: your own events, one item per occurrence.
  const own = settings.features?.customEvents !== false ? expandEvents(ud.events || [], { tz }) : [];
  const items = [...canvas, ...syl.add, ...todos, ...own, ...sessions].filter((i) => !i.courseId || !hiddenCourses.has(i.courseId));
  const otherCourses = new Set(separateOther(settings) ? courses.filter((c) => courseRole(c, settings) === 'other').map((c) => c.id) : []);
  const promoted = ud.promoted || {};
  const separateOH = settings.features?.officeHours !== false;
  return items.map((i) => {
    const fromOther = !!i.courseId && otherCourses.has(i.courseId);
    const officeHours = separateOH && !fromOther && isOfficeHours(i);
    // B11/C13/C15: Other-course items and office hours stay off the main views until you add them.
    let area = 'main';
    // G11: lectures and sections only show in the calendar's Day and Week views.
    if (!promoted[i.id]) area = fromOther ? 'other' : officeHours ? 'officeHours' : i.classMeeting ? 'classes' : 'main';
    return decorate(i, { fromOther, officeHours, promoted: !!promoted[i.id], area });
  });

  function decorate(i, extra) {
    return {
    ...i,
    ...extra,
    type: typeOf(i, ud),
    status: statusOf(i),
    done: isDone(i, ud),
    overdue: isOverdue(i, ud, now),
    pinned: !!ud.pins[i.id],
    hidden: !!ud.hidden[i.id],
    snoozedUntil: ud.snoozed[i.id] && new Date(ud.snoozed[i.id]).getTime() > now ? ud.snoozed[i.id] : null,
    color: i.courseId ? courseColor(i.courseId, courses, settings) : null,
    nick: courseNick(i.courseId, courses, settings),
    };
  }
}

// Items that should appear in normal lists (C11: hidden/snoozed are removed).
export function listable(items) {
  return items.filter((i) => !i.hidden && !i.snoozedUntil);
}

const SORTERS = {
  due: (a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity),
  course: (a, b) => (a.nick || '').localeCompare(b.nick || ''),
  points: (a, b) => (b.points ?? -1) - (a.points ?? -1),
  type: (a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type),
};

export function sortItems(items, sort = 'due') {
  const primary = SORTERS[sort] || SORTERS.due;
  return [...items].sort((a, b) => primary(a, b) || SORTERS.due(a, b) || a.title.localeCompare(b.title));
}

export function applyFilter(items, filterCourses) {
  if (!filterCourses?.length) return items;
  const set = new Set(filterCourses);
  return items.filter((i) => i.courseId && set.has(i.courseId));
}

// C1, C2, C10: Pinned / Overdue / Today / This week / Later / No due date / Done.
export function groupItems(items, { now, tz = DEFAULT_TZ, sort = 'due', unpinOnSubmit = false, pinsEnabled = true }) {
  const today = dayKey(now, tz);
  const weekEnd = addDays(today, 7);
  const recentDoneFrom = addDays(today, -7);
  const g = { pinned: [], overdue: [], today: [], week: [], later: [], nodate: [], done: [] };

  for (const i of listable(items)) {
    const key = i.dueAt ? dayKey(i.dueAt, tz) : null;
    const pinned = pinsEnabled && i.pinned && !(unpinOnSubmit && i.done);
    if (pinned) {
      g.pinned.push(i);
      continue;
    }
    if (i.overdue) {
      g.overdue.push(i);
      continue;
    }
    if (i.done) {
      if (!key || key >= recentDoneFrom) g.done.push(i);
      continue;
    }
    if (!key) {
      g.nodate.push(i);
      continue;
    }
    if (new Date(i.dueAt).getTime() < now) continue; // past and not expected (e.g. a lecture)
    if (key === today) g.today.push(i);
    else if (key <= weekEnd) g.week.push(i);
    else g.later.push(i);
  }
  for (const k of Object.keys(g)) g[k] = sortItems(g[k], k === 'done' ? 'due' : sort);
  g.done.reverse();
  return g;
}

// C6: any 7-day window (in the next 4 weeks) with more than `threshold`
// unfinished items, or 2+ exams. Overlapping windows are merged to the busiest.
export function busyWeeks(items, { now, tz = DEFAULT_TZ, threshold = 6 }) {
  const today = dayKey(now, tz);
  const upcoming = listable(items).filter((i) => i.dueAt && !i.done && new Date(i.dueAt).getTime() >= now);
  const keyed = upcoming.map((i) => ({ i, key: dayKey(i.dueAt, tz) }));
  const windows = [];
  for (let s = 0; s < 28; s++) {
    const start = addDays(today, s);
    const end = addDays(start, 6);
    const inWin = keyed.filter((x) => x.key >= start && x.key <= end).map((x) => x.i);
    const exams = inWin.filter((i) => i.type === 'exam').length;
    if (inWin.length > threshold || exams >= 2) windows.push({ start, end, count: inWin.length, exams, items: inWin });
  }
  const chosen = [];
  for (const w of [...windows].sort((a, b) => b.count + b.exams * 2 - (a.count + a.exams * 2) || a.start.localeCompare(b.start))) {
    if (chosen.every((c) => w.end < c.start || w.start > c.end)) chosen.push(w);
  }
  return chosen.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
}

// D4: done vs. total for items due this week (Mon–Sun).
export function weekProgress(items, { now, tz = DEFAULT_TZ }) {
  const { start, end } = weekOf(now, tz);
  const inWeek = listable(items).filter((i) => {
    if (!i.dueAt) return false;
    const k = dayKey(i.dueAt, tz);
    return k >= start && k <= end && (i.kind !== 'event' || i.type === 'exam');
  });
  return { done: inWeek.filter((i) => i.done).length, total: inWeek.length, start, end };
}

// D7: submitted, not graded yet.
export function waitingForGrade(items, now) {
  return items
    .filter((i) => i.source === 'canvas' && i.status === 'submitted')
    .map((i) => ({ ...i, waitingDays: i.sub?.submittedAt ? Math.max(0, Math.floor((now - new Date(i.sub.submittedAt).getTime()) / 86400000)) : null }))
    .sort((a, b) => (b.waitingDays ?? 0) - (a.waitingDays ?? 0));
}

// D3 + B2: the "Needs attention" list. Actionable things only.
export function attention(items, { auth, atRisk = [] }) {
  const out = [];
  if (auth?.state === 'expired') out.push({ kind: 'auth' });
  if (atRisk.length) out.push({ kind: 'risk', courses: atRisk }); // E15
  const visible = listable(items);
  const overdue = visible.filter((i) => i.overdue);
  const missing = visible.filter((i) => i.sub?.missing && !i.done);
  if (overdue.length) out.push({ kind: 'overdue', items: overdue });
  const missingNotOverdue = missing.filter((i) => !i.overdue);
  if (missingNotOverdue.length) out.push({ kind: 'missing', items: missingNotOverdue });
  return out;
}

// C12: name search across all items.
export function searchItems(items, query, limit = 20) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const scored = [];
  for (const i of items) {
    const hay = `${i.title} ${i.nick} ${TYPE_LABEL[i.type] || ''}`.toLowerCase();
    if (!tokens.every((t) => hay.includes(t))) continue;
    const title = i.title.toLowerCase();
    const score = (title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2) + (i.done ? 0.5 : 0);
    scored.push({ i, score });
  }
  scored.sort((a, b) => a.score - b.score || SORTERS.due(a.i, b.i));
  return scored.slice(0, limit).map((x) => x.i);
}

export function dayGroups(items, { now, tz = DEFAULT_TZ, days = 60 }) {
  const today = dayKey(now, tz);
  const last = addDays(today, days);
  const map = new Map();
  for (const i of sortItems(listable(items), 'due')) {
    if (!i.dueAt) continue;
    const k = dayKey(i.dueAt, tz);
    if (k < today || k > last) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  return [...map.entries()].map(([key, list]) => ({ key, diff: dayDiff(today, key), items: list }));
}
