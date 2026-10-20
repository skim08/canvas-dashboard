// Turns raw Canvas API responses into the app's own course and item shapes.
// Pure functions: no DOM, no storage, so they're testable and usable in the
// background service worker.

import { CANVAS_ORIGIN } from './env.js';

export function abs(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : CANVAS_ORIGIN + url;
}

// A class code: department + course number. UW's "CSE 142" and "B BIO 180", and (K10)
// other schools' "BIO 1510", "MATH-1210", "CS101", "ENGL 1101H" or "COMPSCI 61A".
export const CLASS_RE = /\b([A-Z][A-Z&]*(?: [A-Z&]+)*)[\s-]?(\d{3,4}[A-Z]{0,2}|\d{1,2}[A-Z]{1,2})\b/;
const NOT_DEPT = /^(FALL|SPRING|SUMMER|WINTER|AUTUMN|TERM|SEM|SEMESTER|QUARTER|YEAR|CLASS|ROOM|SECTION|SEC|GROUP|TEAM|WEEK|UNIT)$/;

function classCode(src) {
  for (const m of src.matchAll(new RegExp(CLASS_RE.source, 'g'))) if (!NOT_DEPT.test(m[1])) return m;
  return null;
}

// B12: real classes have a class code; orgs, workshops and advising sites don't.
export function looksLikeClass(course) {
  return !!classCode(`${course.course_code || ''} ${course.name || ''}`);
}

// "CSE 142 A Au 25: Computer Programming I" -> "CSE 142" (B10)
export function autoNickname(course) {
  const src = `${course.course_code || ''} ${course.name || ''}`;
  const m = classCode(src);
  if (m) return `${m[1]} ${m[2]}`;
  return (course.course_code || course.name || 'Course').slice(0, 24);
}

export function normalizeCourse(c) {
  const enr = (c.enrollments || []).find((e) => e.type === 'student') || (c.enrollments || [])[0] || {};
  return {
    id: String(c.id),
    name: c.name || c.course_code || 'Untitled course',
    code: c.course_code || '',
    term: c.term?.name || null,
    termStart: c.term?.start_at || c.start_at || null, // K4: quarter or semester?
    termEnd: c.term?.end_at || c.end_at || null,
    autoNick: autoNickname(c),
    isClass: looksLikeClass(c),
    score: enr.computed_current_score ?? null,
    grade: enr.computed_current_grade ?? null,
    hideTotals: !!c.hide_final_grades,
    weighted: !!c.apply_assignment_group_weights,
    groups: [], // filled in by sync (E3, E4)
    syllabusHtml: c.syllabus_body || '',
    sections: (c.sections || []).map((x) => x.name).filter(Boolean), // G11: your lecture and quiz sections
    canvasScale: null, // instructor's grading scheme, when Canvas shares it (E1)
    url: `${CANVAS_ORIGIN}/courses/${c.id}`,
  };
}

export function normalizeGroup(g) {
  const r = g.rules || {};
  return {
    id: String(g.id),
    name: g.name || 'Untitled',
    weight: g.group_weight ?? 0,
    rules: { dropLowest: r.drop_lowest || 0, dropHighest: r.drop_highest || 0, neverDrop: (r.never_drop || []).map(String) },
  };
}

function submissionOf(raw) {
  const s = raw || {};
  let state = 'not_submitted';
  if (s.excused) state = 'excused';
  else if (s.workflow_state === 'graded' && (s.score != null || s.grade != null)) state = 'graded';
  else if (s.submitted_at || s.workflow_state === 'submitted' || s.workflow_state === 'pending_review') state = 'submitted';
  return {
    state,
    submittedAt: s.submitted_at || null,
    gradedAt: s.graded_at || null,
    score: s.score ?? null,
    grade: s.grade ?? null,
    missing: !!s.missing,
    late: !!s.late,
    attempt: s.attempt ?? null,
    secondsLate: s.seconds_late || 0,
    pointsDeducted: s.points_deducted ?? null,
    comments: (s.submission_comments || []).map((c) => ({ author: c.author_name || c.author?.display_name || 'Instructor', text: c.comment || '', at: c.created_at || null })),
    rubric: s.rubric_assessment || null, // { criterionId: { points, rating_id, comments } }
  };
}

const NO_ONLINE = new Set(['none', 'on_paper', 'not_graded', 'wiki_page']);

export function normalizeAssignment(a, courseId, groupsById = {}, quizzesById = {}) {
  const quiz = a.quiz_id ? quizzesById[a.quiz_id] : null;
  const types = a.submission_types || [];
  return {
    id: `a:${a.id}`,
    source: 'canvas',
    kind: 'assignment',
    canvasId: String(a.id),
    courseId: String(courseId),
    title: a.name || 'Untitled',
    dueAt: a.due_at || null,
    unlockAt: a.unlock_at || null,
    lockAt: a.lock_at || null,
    points: a.points_possible ?? null,
    url: abs(a.html_url),
    submissionTypes: types,
    expectsSubmission: types.length > 0 && !types.every((t) => NO_ONLINE.has(t)),
    descriptionHtml: a.description || '',
    rubric: (a.rubric || []).map((r) => ({
      id: r.id,
      description: r.description,
      longDescription: r.long_description || '',
      points: r.points,
      ratings: (r.ratings || []).map((x) => ({ id: x.id, description: x.description, points: x.points })),
    })),
    groupName: groupsById[a.assignment_group_id]?.name || null,
    groupId: a.assignment_group_id != null ? String(a.assignment_group_id) : null,
    quizId: a.quiz_id != null ? String(a.quiz_id) : null,
    omit: !!a.omit_from_final_grade || a.grading_type === 'not_graded',
    gradingType: a.grading_type || 'points',
    stats: a.score_statistics ? { mean: a.score_statistics.mean, min: a.score_statistics.min, max: a.score_statistics.max } : null,
    isQuiz: !!(a.is_quiz_assignment || a.quiz_id || types.includes('online_quiz')),
    isDiscussion: !!(a.discussion_topic || types.includes('discussion_topic')),
    quiz: quiz
      ? {
          timeLimit: quiz.time_limit ?? null,
          attempts: quiz.allowed_attempts ?? null,
          questionCount: quiz.question_count ?? null,
        }
      : null,
    lockedForUser: !!a.locked_for_user,
    allowedAttempts: a.allowed_attempts ?? -1, // F13: -1 = unlimited
    allowedExtensions: a.allowed_extensions || [],
    sub: submissionOf(a.submission),
  };
}

const PLANNER_KIND = {
  calendar_event: 'event',
  wiki_page: 'page',
  planner_note: 'note',
  quiz: 'quiz',
  discussion_topic: 'discussion',
};

// Planner items cover things the assignments endpoint doesn't: calendar events,
// pages with to-do dates, ungraded quizzes/discussions, and Canvas to-do notes.
export function normalizePlannerItem(p) {
  const kind = PLANNER_KIND[p.plannable_type];
  if (!kind) return null;
  const pl = p.plannable || {};
  if (pl.assignment_id) return null; // Graded: already covered by assignments.
  return {
    id: `p:${p.plannable_type}:${p.plannable_id}`,
    source: 'canvas',
    kind,
    canvasId: String(p.plannable_id),
    courseId: p.course_id != null ? String(p.course_id) : null,
    title: pl.title || pl.name || 'Untitled',
    dueAt: p.plannable_date || pl.todo_date || pl.due_at || pl.start_at || null,
    endAt: pl.end_at || null,
    unlockAt: null,
    lockAt: null,
    points: pl.points_possible ?? null,
    url: abs(p.html_url),
    submissionTypes: [],
    expectsSubmission: false,
    descriptionHtml: pl.details || pl.description || '',
    rubric: [],
    groupName: null,
    isQuiz: kind === 'quiz',
    isDiscussion: kind === 'discussion',
    quiz: null,
    lockedForUser: false,
    location: pl.location_name || null,
    sub: submissionOf(null),
    plannerDone: !!p.planner_override?.marked_complete,
  };
}
