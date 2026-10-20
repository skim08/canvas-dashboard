// I1: past quarter archive. When a quarter's end date passes, each of its courses is
// saved here (final grade, assignments, your notes, grade trend) and taken off the
// current lists. While Canvas still lists the course, every refresh updates the saved
// copy, so late final grades are caught. Pure functions; sync.js stores the result.

import { detectType } from './model.js';

const DAY = 86400000;

// A day of grace, so a course doesn't vanish on the last day of finals.
export function hasEnded(course, now) {
  return !!course.termEnd && Date.parse(course.termEnd) + DAY < now;
}

export const termOf = (course) => course.term || `Ended ${String(course.termEnd || '').slice(0, 10)}`;

// Current data without the ended courses (their items, announcements and messages go too).
export function withoutCourses(data, ids) {
  if (!ids.size) return data;
  const keep = (x) => !x.courseId || !ids.has(x.courseId);
  return {
    ...data,
    courses: data.courses.filter((c) => !ids.has(c.id)),
    items: (data.items || []).filter(keep),
    announcements: (data.announcements || []).filter(keep),
    conversations: data.conversations || [],
  };
}

export function archiveCourse(course, { items = [], summary = null, userdata = {}, snapshots = [], nick = null, now = Date.now() }) {
  const mine = items.filter((i) => i.courseId === course.id && i.source === 'canvas' && i.kind === 'assignment');
  const notes = mine.filter((i) => userdata.notes?.[i.id]).map((i) => ({ title: i.title, text: userdata.notes[i.id] }));
  const courseNote = userdata.notes?.[`course:${course.id}`] || null;
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    nick: nick || course.autoNick || course.code,
    isClass: course.isClass !== false,
    term: termOf(course),
    termEnd: course.termEnd || null,
    credits: summary?.credits ?? null,
    finalPct: summary?.pct ?? course.score ?? null,
    finalGp: summary?.gp ?? null,
    canvasScore: course.score ?? null,
    canvasGrade: course.grade ?? null,
    assignments: mine
      .map((i) => ({
        id: i.id,
        title: i.title,
        dueAt: i.dueAt,
        points: i.points,
        score: i.sub?.score ?? null,
        status: i.sub?.state || 'not_submitted',
        excused: i.sub?.state === 'excused',
        type: detectType(i),
        group: i.groupName || null,
      }))
      .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || '')),
    notes,
    courseNote,
    trend: snapshots
      .map((s) => ({ date: s.date, pct: s.courses?.[course.id]?.pct ?? s.courses?.[course.id]?.score ?? null, gp: s.courses?.[course.id]?.gp ?? null }))
      .filter((p) => p.pct != null),
    savedAt: now,
  };
}

// archive: { [term]: { term, termEnd, courses: { [courseId]: entry } } }
// Saves ended courses from this refresh, and any course from the last refresh that
// Canvas stopped listing after its term ended. Dropped classes (term not over) aren't saved.
export function updateArchive(archive, { data, prevCache = null, summaryById = {}, userdata = {}, snapshots = [], nickOf = () => null, now = Date.now() }) {
  const out = structuredClone(archive || {});
  const save = (course, items) => {
    const term = termOf(course);
    out[term] ||= { term, termEnd: course.termEnd || null, courses: {} };
    out[term].courses[course.id] = archiveCourse(course, { items, summary: summaryById[course.id], userdata, snapshots, nick: nickOf(course.id), now });
  };
  for (const c of data.courses) if (hasEnded(c, now)) save(c, data.items || []);
  const listed = new Set(data.courses.map((c) => c.id));
  for (const c of prevCache?.courses || []) {
    if (listed.has(c.id) || !hasEnded(c, now)) continue;
    if (out[termOf(c)]?.courses?.[c.id]) continue; // already saved while it was listed
    save(c, prevCache.items || []);
  }
  return out;
}

// Newest quarter first.
export function archivedTerms(archive) {
  return Object.values(archive || {}).sort((a, b) => (b.termEnd || '').localeCompare(a.termEnd || ''));
}

// I1 → E5: a past-quarter entry for GPA history, from an archived quarter's classes.
export function toPastQuarter(term, uid) {
  return {
    id: uid,
    name: term.term,
    fromArchive: term.term,
    courses: Object.values(term.courses)
      .filter((c) => c.isClass && typeof c.finalGp === 'number')
      .map((c) => ({ id: `${uid}-${c.id}`, name: c.nick, credits: c.credits ?? 5, grade: Math.round(c.finalGp * 10) / 10, counts: true })),
  };
}
