// Sample data: a realistic (made-up) student's quarter, shaped exactly like Canvas API
// responses. Dates are relative to "now" so the sample always looks current. Used in
// test mode (dev server) and demo mode (K16). Never used with real Canvas, never sends
// anything anywhere.

import { AuthError, OfflineError, HttpError } from './canvas.js';
import { CANVAS_ORIGIN, isDev, isDemo } from './env.js';

// Extra sample classes for test mode (E29–E33, G10, G11): the owner's own (owner-data/,
// on the owner's computer only), or their renamed copy in src/tests/sample/ (always used
// by the tests, and by test mode anywhere else). Never published; never in demo mode.
const EXTRA = { announcements: [], assignments: [] };
import { dayKey, addDays, zoned } from './time.js';

const TZ = 'America/Los_Angeles';

// ISO time for `days` from today at hh:mm Pacific.
function at(days, hh = 23, mm = 59) {
  const key = addDays(dayKey(Date.now(), TZ), days);
  const [y, m, d] = key.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm) + 7 * 3600000;
  const z = zoned(guess, TZ);
  guess -= ((z.h - hh) * 60 + (z.min - mm)) * 60000;
  return new Date(guess).toISOString();
}
const hoursFromNow = (h) => new Date(Date.now() + h * 3600000).toISOString();

// K4: the current UW quarter (Canvas names it like this).
const AU26 = { name: 'Autumn 2026', start_at: '2026-09-24T07:00:00Z', end_at: '2026-12-19T08:00:00Z' };

const COURSES = [
  { id: 1001, name: 'CSE 143 A Au 26: Computer Programming II', course_code: 'CSE 143 A', term: AU26, score: 96.67, grade: null },
  { id: 1002, name: 'MATH 126 C Au 26: Calculus With Analytic Geometry III', course_code: 'MATH 126 C', term: AU26, score: 86.53, grade: null },
  { id: 1003, name: 'PSYCH 101 A Au 26: Introduction To Psychology', course_code: 'PSYCH 101 A', term: AU26, score: 93.33, grade: null },
  { id: 1004, name: 'ENGL 131 F Au 26: Composition: Exposition', course_code: 'ENGL 131 F', term: AU26, score: null, grade: null, hide: true },
  // I1: last quarter's class, still listed by Canvas after its term ended. Goes to the archive.
  { id: 1010, name: 'MATH 125 B Su 26: Calculus With Analytic Geometry II', course_code: 'MATH 125 B', score: 90.83, grade: null, term: { name: 'Summer 2026', end_at: '2026-08-21T07:00:00Z' } },
  // Non-class course (B11): events, workshops. Should land on the Other tab.
  { id: 1006, name: 'Foster Undergraduates', course_code: 'Foster Undergraduates', score: null, grade: null },
  // Mirrors a real case: a cross-listed course on another Canvas server whose assignments return 403.
  { id: '283480000000000350', name: 'UW Health Sciences Orientation', course_code: 'HS ORIENT', score: null, grade: null },
];

const GROUPS = {
  1001: [{ id: 11, name: 'Programming Assignments', group_weight: 40 }, { id: 12, name: 'Quizzes', group_weight: 15, rules: { drop_lowest: 1 } }, { id: 13, name: 'Exams', group_weight: 40 }, { id: 14, name: 'Pre-class Work', group_weight: 5 }],
  1002: [{ id: 21, name: 'WebWork', group_weight: 15, rules: { drop_lowest: 2 } }, { id: 22, name: 'Written Homework', group_weight: 25 }, { id: 23, name: 'Quiz Section', group_weight: 20 }, { id: 24, name: 'Midterms', group_weight: 40 }],
  1003: [{ id: 31, name: 'Discussions', group_weight: 0 }, { id: 32, name: 'Exams', group_weight: 0 }, { id: 33, name: 'Papers', group_weight: 0 }, { id: 34, name: 'Participation', group_weight: 0 }],
  1004: [{ id: 41, name: 'Papers', group_weight: 60 }, { id: 42, name: 'Reading Responses', group_weight: 20 }, { id: 43, name: 'Peer Review', group_weight: 20 }],
};

GROUPS[1010] = [{ id: 101, name: 'Homework' }, { id: 102, name: 'Exams' }];

// Course details (E1, E3): weighting, syllabus text, grading standard.
const DETAILS = {
  1001: {
    apply_assignment_group_weights: true,
    grading_standard_id: null,
    syllabus_body: `<h2>CSE 143 Syllabus</h2><p>Grades are weighted: programming assignments 40%, quizzes 15% (lowest dropped), exams 40%, pre-class work 5%.</p><h3>Grading scale</h3><table><tr><td>95–100%</td><td>4.0</td></tr><tr><td>94%</td><td>3.9</td></tr><tr><td>93%</td><td>3.8</td></tr><tr><td>92%</td><td>3.7</td></tr><tr><td>91%</td><td>3.6</td></tr><tr><td>90%</td><td>3.5</td></tr><tr><td>89%</td><td>3.4</td></tr><tr><td>88%</td><td>3.3</td></tr><tr><td>87%</td><td>3.2</td></tr><tr><td>86%</td><td>3.1</td></tr><tr><td>85%</td><td>3.0</td></tr></table><p>Below 85% continues down 0.1 per percent.</p>`,
  },
  1002: { apply_assignment_group_weights: true, grading_standard_id: 501, syllabus_body: '<p>See the PDF syllabus on the course website.</p>' },
  1003: { apply_assignment_group_weights: false, grading_standard_id: null, syllabus_body: '' },
  1004: { apply_assignment_group_weights: true, grading_standard_id: null, syllabus_body: '<p>Portfolio-based course. See the syllabus PDF.</p>' },
};
const STANDARDS = {
  501: { id: 501, title: 'MATH 126 scale', grading_scheme: Array.from({ length: 34 }, (_, i) => ({ name: (4.0 - i * 0.1).toFixed(1), value: (96 - i) / 100 })) },
};

// Extra submission data (E24 comments, E25 rubric scores).
const SUBMISSIONS = {
  1001: [
    { assignment_id: 3, submission_comments: [{ author_name: 'Prof. Stuart', comment: 'Nice work. Watch your method comments: two were missing pre/post conditions.', created_at: at(-2, 10, 0) }], rubric_assessment: { r1: { points: 12, rating_id: null }, r2: { points: 4 }, r3: { points: 3, comments: 'Missing method comments in two places.' } } },
  ],
  1002: [{ assignment_id: 28, submission_comments: [{ author_name: 'TA Priya', comment: 'Problem 3: sign error in the second integral.', created_at: at(-3, 16, 0) }] }],
};

const RUBRIC = [
  { id: 'r1', description: 'Behavior', long_description: 'Program produces correct output for all provided tests.', points: 12, ratings: [{ description: 'Full marks', points: 12 }, { description: 'Minor issues', points: 8 }, { description: 'Major issues', points: 4 }, { description: 'No submission', points: 0 }] },
  { id: 'r2', description: 'Internal correctness', long_description: 'Uses appropriate data structures; no redundant code.', points: 4, ratings: [{ description: 'Full marks', points: 4 }, { description: 'Some issues', points: 2 }, { description: 'Missing', points: 0 }] },
  { id: 'r3', description: 'Code quality', long_description: 'Comments, naming, and style follow the course guide.', points: 4, ratings: [{ description: 'Full marks', points: 4 }, { description: 'Some issues', points: 2 }, { description: 'Missing', points: 0 }] },
];

const DESC_PA2 = `
<h3>Overview</h3>
<p>Implement <strong>merge sort</strong> and <em>quick sort</em> for the <code>SortableList</code> class. Read the full spec before starting.</p>
<ul><li>Use the starter code linked below.</li><li>Run the provided tests before submitting.</li></ul>
<p>Starter code: <a href="/courses/1001/files/55501/download?wrap=1" class="instructure_file_link">pa2-starter.zip</a><br>
Spec: <a href="/courses/1001/files/55502">PA2 Specification.pdf</a></p>
<p style="color:red" onclick="alert(1)">Late work: up to 2 days with a 10% penalty per day.</p>
<script>alert('this must never run')</script>
<iframe src="https://www.youtube.com/embed/xyz"></iframe>
<table><tr><th>Part</th><th>Points</th></tr><tr><td>Merge sort</td><td>10</td></tr><tr><td>Quick sort</td><td>10</td></tr></table>`;

function sub(s = {}) {
  return { workflow_state: 'unsubmitted', submitted_at: null, score: null, grade: null, missing: false, late: false, excused: false, attempt: null, ...s };
}

function A(courseId, id, name, groupId, dueAt, extra = {}) {
  return {
    id,
    course_id: courseId,
    name,
    assignment_group_id: groupId,
    due_at: dueAt,
    unlock_at: extra.unlock_at || null,
    lock_at: extra.lock_at || null,
    points_possible: extra.points ?? 10,
    submission_types: extra.types || ['online_upload'],
    html_url: `${CANVAS_ORIGIN}/courses/${courseId}/assignments/${id}`,
    description: extra.description ?? `<p>Instructions for ${name}.</p>`,
    rubric: extra.rubric,
    is_quiz_assignment: !!extra.quiz_id,
    quiz_id: extra.quiz_id,
    discussion_topic: extra.discussion ? { id: id + 9000 } : undefined,
    score_statistics: extra.stats,
    omit_from_final_grade: !!extra.omit,
    published: true,
    submission: sub({ graded_at: extra.sub?.workflow_state === 'graded' ? extra.sub.graded_at || extra.sub.submitted_at || at(-1, 12, 0) : null, ...(extra.sub || {}) }),
  };
}

function assignments() {
  const out = {
    1001: [
      A(1001, 1, 'Programming Assignment 2: Sorting', 11, at(0), { points: 20, description: DESC_PA2, rubric: RUBRIC, unlock_at: at(-7, 9, 0), lock_at: at(2) }),
      A(1001, 2, 'Quiz 3', 12, hoursFromNow(2.5), { points: 5, quiz_id: 301, types: ['online_quiz'] }),
      A(1001, 3, 'Programming Assignment 1: Warm-up', 11, at(-6), { points: 20, rubric: RUBRIC, sub: { workflow_state: 'graded', submitted_at: at(-6, 20, 10), score: 19, grade: '19', attempt: 1, graded_at: at(-2, 9, 0) }, stats: { mean: 17.2, min: 8, max: 20 } }),
      A(1001, 4, 'Section Worksheet 4', 14, at(-1, 22, 0), { points: 2, lock_at: at(2), sub: { missing: true } }),
      A(1001, 5, 'Midterm Exam', 13, at(9, 14, 30), { points: 100, types: ['on_paper'], description: '<p>In class. Bring your Husky Card. One page of notes allowed.</p>' }),
      A(1001, 6, 'Programming Assignment 3: Recursion', 11, at(12), { points: 20 }),
      A(1001, 7, 'Creative Project 1', 11, at(-2), { points: 10, sub: { workflow_state: 'submitted', submitted_at: at(-2, 21, 30), attempt: 1 } }),
      A(1001, 8, 'Pre-class Work: Recursion', 14, null, { points: 1, types: ['online_text_entry'] }),
      A(1001, 9, 'Quiz 1', 12, at(-12, 13, 30), { points: 5, quiz_id: 304, types: ['online_quiz'], sub: { workflow_state: 'graded', submitted_at: at(-12, 13, 20), score: 3, graded_at: at(-11, 9, 0) }, stats: { mean: 3.9, min: 1, max: 5 } }),
      A(1001, 10, 'Quiz 2', 12, at(-5, 13, 30), { points: 5, quiz_id: 305, types: ['online_quiz'], sub: { workflow_state: 'graded', submitted_at: at(-5, 13, 20), score: 5, graded_at: at(-4, 9, 0) }, stats: { mean: 4.1, min: 2, max: 5 } }),
      A(1001, 11, 'Pre-class Work: Lists', 14, at(-8, 9, 0), { points: 1, types: ['online_text_entry'], sub: { workflow_state: 'graded', submitted_at: at(-8, 8, 0), score: 1 } }),
    ],
    1002: [
      A(1002, 21, 'WebWork 5', 21, at(1, 23, 0), { points: 10, types: ['external_tool'] }),
      A(1002, 22, 'WebWork 4', 21, at(-3, 23, 0), { points: 10, types: ['external_tool'], sub: { workflow_state: 'graded', submitted_at: at(-3, 18, 0), score: 8.5, grade: '8.5' } }),
      A(1002, 23, 'Written Homework 3', 22, at(-2, 23, 59), { points: 15, lock_at: at(-1, 23, 59), sub: { missing: true } }),
      A(1002, 24, 'Quiz Section Quiz 2', 23, at(3, 9, 30), { points: 10, quiz_id: 302, types: ['online_quiz'] }),
      A(1002, 25, 'Midterm 1', 24, at(6, 9, 30), { points: 100, types: ['on_paper'] }),
      A(1002, 26, 'WebWork 6', 21, at(8, 23, 0), { points: 10, types: ['external_tool'] }),
      A(1002, 27, 'Written Homework 4', 22, at(5), { points: 15 }),
      A(1002, 28, 'Written Homework 2', 22, at(-9), { points: 15, sub: { workflow_state: 'graded', submitted_at: at(-8, 2, 0), score: 12, late: true, points_deducted: 1.5, graded_at: at(-3, 15, 0) }, stats: { mean: 12.8, min: 6, max: 15 } }),
      A(1002, 29, 'Written Homework 1', 22, at(-16), { points: 15, sub: { workflow_state: 'graded', submitted_at: at(-16, 20, 0), score: 14, graded_at: at(-12, 15, 0) } }),
      A(1002, 230, 'WebWork 1', 21, at(-24, 23, 0), { points: 10, types: ['external_tool'], sub: { workflow_state: 'graded', score: 10 } }),
      A(1002, 231, 'WebWork 2', 21, at(-17, 23, 0), { points: 10, types: ['external_tool'], sub: { workflow_state: 'graded', score: 6 } }),
      A(1002, 232, 'WebWork 3', 21, at(-10, 23, 0), { points: 10, types: ['external_tool'], sub: { workflow_state: 'graded', score: 9 } }),
      A(1002, 233, 'Quiz Section Quiz 1', 23, at(-11, 9, 30), { points: 10, quiz_id: 306, types: ['online_quiz'], sub: { workflow_state: 'graded', submitted_at: at(-11, 9, 20), score: 8, graded_at: at(-9, 10, 0) }, stats: { mean: 7.4, min: 3, max: 10 } }),
    ],
    1003: [
      A(1003, 31, 'Discussion: Week 2 Prompt', 31, at(4), { points: 5, types: ['discussion_topic'], discussion: true }),
      A(1003, 32, 'Discussion: Week 1 Prompt', 31, at(-5), { points: 5, types: ['discussion_topic'], discussion: true, sub: { workflow_state: 'graded', submitted_at: at(-5, 15, 0), score: 5, grade: '5', graded_at: at(-1, 11, 0) } }),
      A(1003, 36, 'Reading Quiz 1', 32, at(-9, 23, 59), { points: 10, quiz_id: 307, types: ['online_quiz'], sub: { workflow_state: 'graded', submitted_at: at(-9, 20, 0), score: 9, graded_at: at(-9, 21, 0) } }),
      A(1003, 33, 'Research Participation', 34, null, { points: 10, types: ['none'], sub: { excused: true } }),
      A(1003, 34, 'Exam 1', 32, at(10, 12, 0), { points: 50, quiz_id: 303, types: ['online_quiz'] }),
      A(1003, 35, 'Reflection Paper', 33, at(-4), { points: 20, sub: { workflow_state: 'submitted', submitted_at: at(-3, 1, 15), late: true, attempt: 1 } }),
    ],
    1010: [
      ...[1, 2, 3, 4].map((n) => A(1010, 1100 + n, `Homework ${n}`, 101, `2026-07-${String(n * 7).padStart(2, '0')}T06:59:00Z`, { points: 10, sub: { workflow_state: 'graded', submitted_at: `2026-07-${String(n * 7 - 1).padStart(2, '0')}T20:00:00Z`, score: n === 3 ? 8 : 10 } })),
      A(1010, 1111, 'Midterm', 102, '2026-07-24T18:00:00Z', { points: 100, types: ['on_paper'], sub: { workflow_state: 'graded', score: 88 } }),
      A(1010, 1112, 'Final Exam', 102, '2026-08-20T18:00:00Z', { points: 100, types: ['on_paper'], sub: { workflow_state: 'graded', score: 92 } }),
    ],
    1004: [
      A(1004, 41, 'Short Paper 1 Draft', 41, at(4, 10, 0), { points: 10, types: ['online_text_entry', 'online_upload'] }),
      A(1004, 42, 'Peer Review 1', 43, at(6), { points: 5, types: ['online_text_entry'] }),
      A(1004, 43, 'Major Paper 1', 41, at(20), { points: 100 }),
      A(1004, 44, 'Ch. 2 Reading Response', 42, at(3, 9, 0), { points: 5, types: ['online_text_entry'] }),
      A(1004, 45, 'Ch. 1 Reading Response', 42, at(-4, 9, 0), { points: 5, types: ['online_text_entry'], sub: { workflow_state: 'graded', submitted_at: at(-5, 22, 0), score: 5, graded_at: at(-2, 12, 0) } }),
    ],
  };
  for (const f of EXTRA.assignments) Object.assign(out, f());
  return out;
}

const QUIZZES = {
  1001: [{ id: 301, title: 'Quiz 3', time_limit: 20, allowed_attempts: 2, question_count: 8 }],
  1002: [{ id: 302, title: 'Quiz Section Quiz 2', time_limit: 30, allowed_attempts: 1, question_count: 5 }],
  1003: [{ id: 303, title: 'Exam 1', time_limit: 75, allowed_attempts: 1, question_count: 50 }],
};

function planner() {
  return [
    { plannable_type: 'calendar_event', plannable_id: 7001, course_id: 1001, plannable_date: at(8, 17, 0), html_url: '/calendar?event_id=7001', plannable: { title: 'Midterm Review Session', start_at: at(8, 17, 0), end_at: at(8, 18, 30), location_name: 'Gates G20' } },
    { plannable_type: 'wiki_page', plannable_id: 7002, course_id: 1003, plannable_date: at(2, 9, 0), html_url: '/courses/1003/pages/week-3-readings', plannable: { title: 'Week 3 Readings', todo_date: at(2, 9, 0) } },
    { plannable_type: 'planner_note', plannable_id: 7003, course_id: null, plannable_date: at(1, 13, 0), html_url: '/api/v1/planner_notes/7003', plannable: { title: 'Advising appointment', todo_date: at(1, 13, 0), details: 'Bring your degree audit.' } },
    { plannable_type: 'calendar_event', plannable_id: 7201, course_id: 1001, plannable_date: at(1, 14, 30), html_url: '/calendar?event_id=7201', plannable: { title: 'Office Hours (Prof. Stuart)', start_at: at(1, 14, 30), end_at: at(1, 15, 30), location_name: 'CSE2 151' } },
    { plannable_type: 'calendar_event', plannable_id: 7202, course_id: 1001, plannable_date: at(4, 14, 30), html_url: '/calendar?event_id=7202', plannable: { title: 'Office Hours (Prof. Stuart)', start_at: at(4, 14, 30), end_at: at(4, 15, 30), location_name: 'CSE2 151' } },
    { plannable_type: 'calendar_event', plannable_id: 7203, course_id: 1001, plannable_date: at(2, 10, 0), html_url: '/calendar?event_id=7203', plannable: { title: 'TA OH – Section AB', start_at: at(2, 10, 0), end_at: at(2, 11, 0) } },
    { plannable_type: 'calendar_event', plannable_id: 7204, course_id: 1002, plannable_date: at(3, 15, 0), html_url: '/calendar?event_id=7204', plannable: { title: 'Math Study Center drop-in hours', start_at: at(3, 15, 0), end_at: at(3, 17, 0), location_name: 'CMU B014' } },
    { plannable_type: 'calendar_event', plannable_id: 7101, course_id: 1006, plannable_date: hoursFromNow(0.3), html_url: '/calendar?event_id=7101', plannable: { title: '[WOW] Drop-in Resume Reviews with EY', start_at: hoursFromNow(0.3), end_at: hoursFromNow(1.3) } },
    { plannable_type: 'calendar_event', plannable_id: 7102, course_id: 1006, plannable_date: hoursFromNow(5), html_url: '/calendar?event_id=7102', plannable: { title: '[WOW] Freshman Direct Speed Networking with EY', start_at: hoursFromNow(5), end_at: hoursFromNow(6.5), location_name: 'PACCAR 192' } },
    { plannable_type: 'calendar_event', plannable_id: 7103, course_id: 1006, plannable_date: at(3, 12, 30), html_url: '/calendar?event_id=7103', plannable: { title: 'Foster Study Abroad 101', start_at: at(3, 12, 30), end_at: at(3, 13, 30) } },
    // Graded items also show up in the planner; they must be de-duplicated.
    { plannable_type: 'quiz', plannable_id: 301, course_id: 1001, plannable_date: hoursFromNow(2.5), html_url: '/courses/1001/quizzes/301', plannable: { title: 'Quiz 3', assignment_id: 2 } },
  ];
}

function course(c) {
  return {
    id: c.id,
    name: c.name,
    course_code: c.course_code,
    hide_final_grades: !!c.hide,
    term: c.term || { name: 'Autumn 2026', end_at: at(75) },
    enrollments: [{ type: 'student', computed_current_score: c.hide ? null : c.score, computed_current_grade: c.grade }],
    sections: c.sections || [{ id: c.id * 10, name: c.course_code }],
  };
}


// ---------- Phase 3 content ----------

const TABS = (ids, tools = []) => [
  ...ids.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), type: 'internal', html_url: `/courses/x/${id}` })),
  ...tools.map(([n, label]) => ({ id: `context_external_tool_${n}`, label, type: 'external', html_url: `/courses/x/external_tools/${n}` })),
];
const ALL_TABS = ['home', 'announcements', 'assignments', 'discussions', 'grades', 'people', 'pages', 'files', 'syllabus', 'modules'];
const COURSE_TABS = {
  1001: TABS(ALL_TABS, [[11, 'Zoom'], [12, 'Gradescope']]),
};
const person = (id, name, type) => ({ id, name, enrollments: [{ type }] });
const STAFF = {
  1001: [person(501, 'Brett Stuart', 'TeacherEnrollment'), person(502, 'Ana Ortiz', 'TaEnrollment')],
};
const annRead = new Set();
function announcements() {
  const a = (id, course, title, days, author, message, read = false) => ({ id, title, message, context_code: `course_${course}`, posted_at: at(-days, 9, 15), author: { display_name: author }, read_state: read || annRead.has(String(id)) ? 'read' : 'unread', html_url: `/courses/${course}/discussion_topics/${id}` });
  return [
    a(6005, 1001, 'PA2 spec clarification', 2, 'Brett Stuart', '<p>For PA2, your <code>sort</code> must be stable. See the updated spec in <a href="/courses/1001/files/55502">PA2 Specification.pdf</a>.</p>'),
    a(6006, 1006, 'Career fair next week', 4, 'Foster Undergraduate Programs', '<p>Bring your resume to the Foster career fair.</p>'),
    a(6007, 1002, 'Midterm 1 room change', 1, 'Prof. Okafor', '<p>Midterm 1 is in <strong>KNE 130</strong>, not our usual room. Bring a calculator and one page of notes.</p>'),
    a(6008, 1003, 'Exam 1 study guide posted', 3, 'Dr. Reyes', '<p>The study guide for Exam 1 is on the Pages tab.</p>', true),
    ...EXTRA.announcements.flatMap((f) => f(a)),
  ];
}
// A made-up inbox for the sample student.
const CONVERSATIONS = [
  { id: 8201, subject: 'Extension on PA2?', workflow_state: 'unread', last_message: 'Yes, you have until Sunday night. Good luck!', last_message_at: at(0, 8, 40), participants: [{ id: 1, name: 'Test Student' }, { id: 501, name: 'Brett Stuart' }], audience: [501], context_name: 'CSE 143 A Au 26', context_code: 'course_1001', message_count: 2 },
  { id: 8202, subject: 'Study group for Midterm 1', workflow_state: 'read', last_message: 'Thursday at 6 in the library works for me.', last_message_at: at(-2, 19, 0), participants: [{ id: 1, name: 'Test Student' }, { id: 77, name: 'Jordan Lee' }], audience: [77], context_name: 'MATH 126 C Au 26', context_code: 'course_1002', message_count: 2 },
];
const CONVERSATION_DETAIL = {
  8201: { ...CONVERSATIONS[0], messages: [{ id: 12, author_id: 501, body: 'Yes, you have until Sunday night. Good luck!', created_at: at(0, 8, 40), attachments: [] }, { id: 11, author_id: 1, body: 'Hi Professor, could I have one extra day for PA2? I was sick this week.', created_at: at(-1, 21, 5), attachments: [] }] },
  8202: { ...CONVERSATIONS[1], messages: [{ id: 14, author_id: 77, body: 'Thursday at 6 in the library works for me.', created_at: at(-2, 19, 0), attachments: [{ display_name: 'practice-problems.pdf', url: '/files/1/download' }] }, { id: 13, author_id: 1, body: 'Want to study for Midterm 1 together?', created_at: at(-2, 15, 0), attachments: [] }] },
};
let nextConversationId = 8300;
// F17: which conversations each inbox view shows.
function conversationsIn(scope) {
  if (scope === 'unread') return CONVERSATIONS.filter((c) => c.workflow_state === 'unread');
  if (scope === 'starred') return CONVERSATIONS.filter((c) => c.starred);
  if (scope === 'archived') return CONVERSATIONS.filter((c) => c.workflow_state === 'archived');
  if (scope === 'sent') return CONVERSATIONS.filter((c) => c.sent || (CONVERSATION_DETAIL[c.id]?.messages || []).some((x) => x.author_id === 1));
  return CONVERSATIONS.filter((c) => c.workflow_state !== 'archived');
}
function updateConversation(id, body) {
  const c = CONVERSATIONS.find((x) => String(x.id) === String(id));
  if (!c) throw new HttpError(404, `/api/v1/conversations/${id}`);
  const state = field(body, 'conversation[workflow_state]');
  const star = field(body, 'conversation[starred]');
  if (state) c.workflow_state = state;
  if (star != null) c.starred = star === 'true';
  return c;
}
const contextName = (code) => CONVERSATIONS.find((c) => c.context_code === code)?.context_name || SAMPLE_GROUPS.find((g) => `group_${g.id}` === code)?.name || '';
// F18: who you can message in a class or group (Canvas's /search/recipients).
function recipients(context, search) {
  const people = [
    { id: '501', name: 'Brett Stuart', ctx: 'course_1001', role: 'TeacherEnrollment' },
    { id: '502', name: 'Ana Ortiz', ctx: 'course_1001', role: 'TaEnrollment' },
    { id: '77', name: 'Jordan Lee', ctx: 'course_1001', role: 'StudentEnrollment', groups: ['group_4401'] },
    { id: '78', name: 'Priya Shah', ctx: 'course_1001', role: 'StudentEnrollment', groups: ['group_4401'] },
    { id: '79', name: 'Diego Ramos', ctx: 'course_1001', role: 'StudentEnrollment', groups: ['group_4401'] },
    { id: '601', name: 'Prof. Okafor', ctx: 'course_1002', role: 'TeacherEnrollment' },
    { id: '602', name: 'Priya (TA)', ctx: 'course_1002', role: 'TaEnrollment' },
  ];
  const contexts = [
    { id: 'course_1001_teachers', name: 'CSE 143: Instructors', user_count: 1, ctx: 'course_1001' },
    { id: 'course_1001_tas', name: 'CSE 143: TAs', user_count: 1, ctx: 'course_1001' },
    { id: 'group_4401', name: 'PA Team 4 (everyone)', user_count: 4, ctx: 'group_4401' },
    { id: 'course_1002_teachers', name: 'MATH 126: Instructors', user_count: 1, ctx: 'course_1002' },
    { id: 'course_1002_tas', name: 'MATH 126: TAs', user_count: 1, ctx: 'course_1002' },
  ];
  const q = search.toLowerCase();
  const inCtx = (x) => !context || x.ctx === context || (x.groups || []).includes(context);
  return [
    ...contexts.filter((c) => inCtx(c) && (!q || c.name.toLowerCase().includes(q))).map((c) => ({ id: c.id, name: c.name, type: 'context', user_count: c.user_count })),
    ...people.filter((x) => inCtx(x) && (!q || x.name.toLowerCase().includes(q))).map((x) => ({ id: x.id, name: x.name, type: 'user', common_courses: { [x.ctx.slice(7)]: [x.role] } })),
  ];
}
// F16: the sample student's Canvas group, with its own discussions, pages and files.
const SAMPLE_GROUPS = [
  {
    id: 4401,
    name: 'PA Team 4',
    course_id: 1001,
    members_count: 4,
    description: 'Programming assignment team for CSE 143.',
    members: [[1, 'Test Student'], [77, 'Jordan Lee'], [78, 'Priya Shah'], [79, 'Diego Ramos']],
    announcements: [{ id: 9601, title: 'Meeting moved to Thursday', message: '<p>Let’s meet Thursday at 6 in the library instead.</p>', author: { display_name: 'Jordan Lee' }, posted_at: at(-1, 18, 0), discussion_subentry_count: 0, unread_count: 0, read_state: 'unread', html_url: '/groups/4401/discussion_topics/9601' }],
    topics: [
      { id: 9602, title: 'Who’s doing which part of PA3?', message: '<p>I can take the recursion part. Anyone want testing?</p>', author: { display_name: 'Priya Shah' }, posted_at: at(-2, 20, 0), last_reply_at: at(0, 9, 0), discussion_subentry_count: 3, unread_count: 1, read_state: 'read', html_url: '/groups/4401/discussion_topics/9602' },
    ],
    pages: [{ url: 'team-plan', title: 'Team plan', front_page: true, updated_at: at(-3), body: '<h2>PA3 plan</h2><ul><li>Jordan: merge sort</li><li>Priya: recursion</li><li>Diego + you: tests</li></ul>' }],
    files: [{ id: 64401, display_name: 'PA3 notes.pdf', size: 120000, 'content-type': 'application/pdf', mime_class: 'pdf', folder_id: 44010, updated_at: at(-2), url: '/files/64401/download' }],
  },
];

const MODULES = {
  1001: [
    { id: 11, name: 'Week 1: Review of Java', position: 1, state: 'completed', items: [
      { id: 1101, type: 'SubHeader', title: 'Before lecture' },
      { id: 1102, type: 'Page', title: 'Course info', page_url: 'course-info', html_url: '/courses/1001/pages/course-info', completion_requirement: { type: 'must_view', completed: true } },
      { id: 1103, type: 'Assignment', title: 'Programming Assignment 1: Warm-up', content_id: 3, html_url: '/courses/1001/assignments/3', completion_requirement: { type: 'must_submit', completed: true } },
    ] },
    { id: 12, name: 'Week 2: Sorting', position: 2, state: 'started', items: [
      { id: 1201, type: 'File', title: 'PA2 Specification', content_id: 55502, html_url: '/courses/1001/files/55502', completion_requirement: { type: 'must_view', completed: true } },
      { id: 1202, type: 'Assignment', title: 'Programming Assignment 2: Sorting', content_id: 1, html_url: '/courses/1001/assignments/1', completion_requirement: { type: 'must_submit', completed: false }, content_details: { due_at: at(0), points_possible: 20 } },
    ] },
    { id: 13, name: 'Week 3: Recursion', position: 3, state: 'locked', unlock_at: at(5, 8, 0), items: [{ id: 1301, type: 'Page', title: 'Recursion notes', page_url: 'recursion-notes', html_url: '/courses/1001/pages/recursion-notes', content_details: { locked_for_user: true, unlock_at: at(5, 8, 0) } }] },
  ],
};
const PAGES = {
  1001: [{ url: 'course-info', title: 'Course info', front_page: true, updated_at: at(-10), body: '<p>Welcome to CSE 143.</p>' }],
};
const FOLDERS = {
  1001: [{ id: 5500, name: 'course files', full_name: 'course files', parent_folder_id: null }, { id: 5501, name: 'Assignments', full_name: 'course files/Assignments', parent_folder_id: 5500 }],
};
const FILES = {
  1001: [{ id: 55501, display_name: 'pa2-starter.zip', size: 48213, 'content-type': 'application/zip', folder_id: 5501, updated_at: at(-7), url: '/files/55501/download' }, { id: 55502, display_name: 'PA2 Specification.pdf', size: 230411, 'content-type': 'application/pdf', mime_class: 'pdf', folder_id: 5501, updated_at: at(-2), url: '/files/55502/download' }],
};
const TOPICS = {
  1001: [
    { id: 9301, title: 'PA2 questions', message: '<p>Ask PA2 questions here.</p>', author: { display_name: 'Ana Ortiz' }, posted_at: at(-6), last_reply_at: at(0, 7, 0), discussion_subentry_count: 4, unread_count: 2, read_state: 'read', html_url: '/courses/1001/discussion_topics/9301', pinned: true },
    { id: 9302, title: 'Find a study partner', message: '<p>Introduce yourself.</p>', author: { display_name: 'Brett Stuart' }, posted_at: at(-14), last_reply_at: at(-9), discussion_subentry_count: 12, unread_count: 0, read_state: 'read', html_url: '/courses/1001/discussion_topics/9302' },
  ],
};
const VIEWS = {
  9301: { participants: [{ id: 1, display_name: 'Test Student' }, { id: 502, display_name: 'Ana Ortiz' }, { id: 77, display_name: 'Jordan Lee' }], unread_entries: [3, 4], view: [
    { id: 1, user_id: 77, message: '<p>Does quick sort need to be in place?</p>', created_at: at(-2, 14, 0), replies: [{ id: 2, user_id: 502, message: '<p>Yes, in place. Merge sort can use extra space.</p>', created_at: at(-2, 16, 0) }] },
    { id: 3, user_id: 77, message: '<p>Is recursion allowed in merge sort?</p>', created_at: at(0, 6, 30), replies: [{ id: 4, user_id: 502, message: '<p>Yes.</p>', created_at: at(0, 7, 0) }] },
  ] },
  9302: { participants: [], unread_entries: [], view: [] },
  // F16: PA Team 4's discussion
  9602: { participants: [{ id: 1, display_name: 'Test Student' }, { id: 77, display_name: 'Jordan Lee' }, { id: 79, display_name: 'Diego Ramos' }], unread_entries: [9613], view: [
    { id: 9611, user_id: 77, message: '<p>I’ll do merge sort.</p>', created_at: at(-1, 10, 0), replies: [] },
    { id: 9612, user_id: 79, message: '<p>I can do testing with whoever’s free.</p>', created_at: at(-1, 12, 0), replies: [{ id: 9613, user_id: 77, message: '<p>Sounds good. Let’s finish by Sunday.</p>', created_at: at(0, 9, 0) }] },
  ] },
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// F13, F14: what you submit or post in test mode, kept until the page reloads.
// Test hooks: text containing "FAIL" is refused; a file named "instfs…" goes to
// Instructure's file storage like on UW's real Canvas (allowed, F13); a file named
// "offsite…" is sent to some other server, which the dashboard must refuse to contact.
const posted = {};
let nextFileId = 7000;
let nextEntryId = 500;
const uploadedNames = {};
const field = (body, k) => (body?.get ? body.get(k) : null);
function fixturePost(p, body, u, opts) {
  let m;
  if (u.hostname.endsWith('.inscloudgate.net')) {
    if (!opts.external) throw new Error('inst-fs upload sent like a Canvas request');
    const id = ++nextFileId;
    uploadedNames[id] = body?.get?.('file')?.name;
    return { json: { location: `${CANVAS_ORIGIN}/api/v1/files/${id}?include%5B%5D=enhanced_preview_url`, uuid: `sample-${id}` } };
  }
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments\/(\d+)\/submissions\/self\/files$/))) {
    const name = field(body, 'name') || '';
    const upload_url = /^offsite/i.test(name) ? 'https://example.com/inst-fs/upload' : /^instfs/i.test(name) ? 'https://inst-fs-pdx-prod.inscloudgate.net/files?token=sample' : `${CANVAS_ORIGIN}/files_api/upload/${++nextFileId}`;
    return { json: { upload_url, upload_params: { filename: name, content_type: field(body, 'content_type') } } };
  }
  if ((m = p.match(/^\/files_api\/upload\/(\d+)$/))) return { json: { id: Number(m[1]), display_name: body?.get?.('file')?.name || 'file' } };
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments\/(\d+)\/submissions$/))) {
    if (/FAIL/.test(field(body, 'submission[body]') || '')) throw new HttpError(400, p, 'This assignment is not accepting submissions');
    const id = Number(m[2]);
    posted[id] = { at: new Date().toISOString(), attempt: (posted[id]?.attempt || 0) + 1 };
    return { json: { id: 90000 + id, assignment_id: id, submitted_at: posted[id].at, attempt: posted[id].attempt, workflow_state: 'submitted', submission_type: field(body, 'submission[submission_type]') } };
  }
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/discussion_topics\/(\d+)\/entries(?:\/(\d+)\/replies)?$/))) {
    const message = field(body, 'message') || '';
    if (/FAIL/.test(message)) throw new HttpError(403, p, 'Posting is closed for this discussion');
    const view = (VIEWS[m[2]] ||= { participants: [], unread_entries: [], view: [] });
    if (!view.participants.some((x) => x.id === 1)) view.participants.push({ id: 1, display_name: 'Test Student' });
    const entry = { id: ++nextEntryId, user_id: 1, message, created_at: new Date().toISOString(), replies: [] };
    const find = (list, id) => list.reduce((hit, e) => hit || (String(e.id) === id ? e : find(e.replies || [], id)), null);
    if (m[3]) {
      const parent = find(view.view, m[3]);
      if (!parent) throw new HttpError(404, p);
      (parent.replies ||= []).push(entry);
    } else view.view.push(entry);
    return { json: entry };
  }
  // F18: new messages and replies, kept until the page reloads. "FAIL" in the text is refused.
  if (p === '/api/v1/conversations') {
    const text = field(body, 'body') || '';
    if (/FAIL/.test(text)) throw new HttpError(400, p, 'Message could not be sent');
    const to = body?.getAll ? body.getAll('recipients[]') : [];
    const id = ++nextConversationId;
    const names = to.map((r) => recipients('', '').find((x) => String(x.id) === r)?.name || r);
    const c = { id, subject: field(body, 'subject') || '(no subject)', workflow_state: 'read', last_message: text, last_message_at: new Date().toISOString(), participants: [{ id: 1, name: 'Test Student' }, ...names.map((n, k) => ({ id: 9000 + k, name: n }))], audience: names.map((_, k) => 9000 + k), context_name: contextName(field(body, 'context_code')), context_code: field(body, 'context_code') || null, message_count: 1, starred: false, sent: true };
    CONVERSATIONS.unshift(c);
    CONVERSATION_DETAIL[id] = { ...c, messages: [{ id: ++nextEntryId, author_id: 1, body: text, created_at: c.last_message_at, attachments: [] }] };
    return { json: [c] };
  }
  if ((m = p.match(/^\/api\/v1\/conversations\/(\d+)\/add_message$/))) {
    const text = field(body, 'body') || '';
    if (/FAIL/.test(text)) throw new HttpError(400, p, 'Message could not be sent');
    const d = CONVERSATION_DETAIL[m[1]];
    if (!d) throw new HttpError(404, p);
    const msg = { id: ++nextEntryId, author_id: 1, body: text, created_at: new Date().toISOString(), attachments: [] };
    d.messages = [msg, ...d.messages];
    const c = CONVERSATIONS.find((x) => String(x.id) === m[1]);
    Object.assign(c, { last_message: text, last_message_at: msg.created_at, message_count: (c.message_count || 1) + 1, sent: true });
    Object.assign(d, c, { messages: d.messages });
    return { json: d };
  }
  throw new Error(`No fixture for POST ${p}`);
}

// K10: a semester school set up differently from UW: letter grades, a hidden course
// total, a class with no assignment categories, a quiz in an outside tool (Top Hat),
// a combined (cross-listed) class and one with no syllabus. ?scenario=otherschool
const FALL26 = { name: 'Fall 2026', start_at: '2026-08-24T05:00:00Z', end_at: '2026-12-12T06:00:00Z' };
const OTHER = {
  courses: [
    { id: 2001, name: 'BIO 1510 01: Biology for Majors I', course_code: 'BIO 1510', term: FALL26, hide_final_grades: true, enrollments: [{ type: 'student', computed_current_score: null, computed_current_grade: null }] },
    { id: 2002, name: 'HIST 2010 02: Survey of US History', course_code: 'HIST 2010', term: FALL26, enrollments: [{ type: 'student', computed_current_score: 90, computed_current_grade: 'A-' }] },
    { id: 2003, name: 'CHEM 1210 03: General Chemistry I', course_code: 'CHEM 1210', term: FALL26, enrollments: [{ type: 'student', computed_current_score: 91, computed_current_grade: 'A-' }] },
    { id: 2004, name: 'ECON 2105/2106: Principles of Macroeconomics (combined)', course_code: 'ECON 2105', term: FALL26, sections: [{ id: 20041, name: 'ECON 2105 01' }, { id: 20042, name: 'ECON 2106 01' }], enrollments: [{ type: 'student', computed_current_score: 79.5, computed_current_grade: 'C+' }] },
    { id: 2005, name: 'FYS 1000 12: First-Year Seminar', course_code: 'FYS 1000', term: FALL26, enrollments: [{ type: 'student' }] },
  ],
  groups: { 2001: [{ id: 31, name: 'Labs', group_weight: 40 }, { id: 32, name: 'Exams', group_weight: 60 }], 2003: [{ id: 33, name: 'Homework', group_weight: 30 }, { id: 34, name: 'Quizzes', group_weight: 20 }, { id: 35, name: 'Exams', group_weight: 50 }], 2004: [{ id: 36, name: 'Assignments', group_weight: 100 }] },
  details: {
    2001: { apply_assignment_group_weights: true, hide_final_grades: true, syllabus_body: '<p>Lecture: MWF 9:05-9:55 AM, LSC 101</p><p>Exam 1: September 25, in class</p>' },
    2002: { apply_assignment_group_weights: false, syllabus_body: '<p>Readings are on the course site.</p>' },
    2003: { apply_assignment_group_weights: true, grading_standard_id: 601, syllabus_body: '' },
    2004: { apply_assignment_group_weights: true, syllabus_body: '<p>Combined section syllabus.</p>' },
    2005: { syllabus_body: '' },
  },
  standards: { 601: { id: 601, title: 'Letter grades', grading_scheme: [['A', 0.93], ['A-', 0.9], ['B+', 0.87], ['B', 0.83], ['B-', 0.8], ['C+', 0.77], ['C', 0.73], ['C-', 0.7], ['D', 0.6], ['F', 0]].map(([name, value]) => ({ name, value })) } },
  assignments: () => ({
    2001: [A(2001, 50, 'Lab 1: Microscopy', 31, at(-30, 23, 59), { points: 20, sub: { workflow_state: 'graded', score: 18, grade: '18' } }), A(2001, 51, 'Exam 1', 32, at(-25, 9, 5), { points: 100, types: ['on_paper'], sub: { workflow_state: 'graded', score: 84, grade: '84' } }), A(2001, 52, 'Lab 5: Genetics', 31, at(3, 23, 59), { points: 20 })],
    2002: [A(2002, 60, 'Response Paper 1', null, at(-20, 23, 59), { points: 50, sub: { workflow_state: 'graded', score: 45, grade: '45' } }), A(2002, 61, 'Response Paper 2', null, at(5, 23, 59), { points: 50 })],
    2003: [A(2003, 70, 'Homework 3', 33, at(-6, 23, 59), { points: 10, sub: { workflow_state: 'graded', score: 9, grade: '9' } }), A(2003, 71, 'Quiz 4 (in Top Hat)', 34, at(2, 10, 0), { points: 10, types: ['external_tool'] }), A(2003, 72, 'Midterm', 35, at(-10, 10, 0), { points: 100, types: ['on_paper'], sub: { workflow_state: 'graded', score: 90, grade: '90' } })],
    2004: [A(2004, 80, 'Problem Set 4', 36, at(-2, 23, 59), { points: 25, sub: { workflow_state: 'graded', score: 20, grade: '20' } }), A(2004, 81, 'Problem Set 5', 36, at(6, 23, 59), { points: 25 })],
    2005: [],
  }),
};

function otherSchool(p) {
  let m;
  if (p === '/api/v1/courses') return { json: OTHER.courses.map((c) => ({ ...c, sections: c.sections || [{ id: c.id * 10, name: c.course_code }] })) };
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments$/))) return { json: OTHER.assignments()[m[1]] || [] };
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignment_groups$/))) return { json: OTHER.groups[m[1]] || [] };
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/grading_standards\/(\d+)$/))) return { json: OTHER.standards[m[2]] };
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)$/))) return { json: { id: m[1], ...(OTHER.details[m[1]] || {}) } };
  if (p === '/api/v1/planner/items' || /\/(quizzes|students\/submissions|users|modules|pages|files|folders|discussion_topics)$/.test(p) || p === '/api/v1/announcements' || p === '/api/v1/conversations' || p === '/api/v1/users/self/groups') return { json: [] };
  return null;
}

export function fixtureTransport(scenario) {
  return async (url, opts = {}) => {
    await delay(250);
    const u = new URL(url);
    if (scenario === 'otherschool') {
      const r = otherSchool(u.pathname);
      if (r) return r;
    }
    if (scenario === 'expired') throw new AuthError();
    if (scenario === 'offline') throw new OfflineError();
    if (scenario === 'error' && u.pathname === '/api/v1/courses') throw new HttpError(500, u.pathname);
    const p = u.pathname;
    const page = Number(u.searchParams.get('page') || 1);
    let m;
    if (p === '/api/v1/users/self/profile') return { json: { id: 1, name: 'Test Student', short_name: 'Test', time_zone: TZ, calendar: { ics: `${CANVAS_ORIGIN}/feeds/calendars/user_sampleFeedToken.ics` } } };
    if (p === '/api/v1/courses') return { json: scenario === 'empty' ? [] : COURSES.map(course) };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments$/))) {
      if (m[1] === '283480000000000350') throw new HttpError(403, p);
      const list = (assignments()[m[1]] || []).map((a) => (posted[a.id] ? { ...a, submission: sub({ workflow_state: 'submitted', submitted_at: posted[a.id].at, attempt: posted[a.id].attempt }) } : a));
      // Two pages for the first course, to exercise pagination.
      if (m[1] === '1001') {
        const half = Math.ceil(list.length / 2);
        if (page === 1) {
          const next = new URL(url);
          next.searchParams.set('page', '2');
          return { json: list.slice(0, half), link: `<${next}>; rel="next"` };
        }
        return { json: list.slice(half) };
      }
      return { json: list };
    }
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignment_groups$/))) return { json: GROUPS[m[1]] || [] };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)$/))) return { json: { id: m[1], ...(DETAILS[m[1]] || {}) } };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/grading_standards\/(\d+)$/))) {
      if (!STANDARDS[m[2]]) throw new HttpError(404, p);
      return { json: STANDARDS[m[2]] };
    }
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/students\/submissions$/))) return { json: SUBMISSIONS[m[1]] || [] };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/quizzes$/))) {
      if (m[1] === '1004') throw Object.assign(new Error('403'), { status: 403 }); // quizzes tab hidden
      return { json: QUIZZES[m[1]] || [] };
    }
    if (p === '/api/v1/planner/items') return { json: scenario === 'empty' ? [] : planner() };
    if (opts.method === 'POST') return fixturePost(p, opts.body, u, opts);
    if ((m = p.match(/^\/api\/v1\/files\/(\d+)$/))) return { json: { id: Number(m[1]), display_name: uploadedNames[m[1]] || 'file' } }; // F13 upload confirmation
    // Phase 3 content
    if (opts.method === 'PUT') {
      if ((m = p.match(/discussion_topics\/(\d+)\/read$/))) annRead.add(m[1]);
      if ((m = p.match(/^\/api\/v1\/conversations\/(\d+)$/))) return { json: updateConversation(m[1], opts.body) }; // F17
      return { json: null };
    }
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/tabs$/))) return { json: COURSE_TABS[m[1]] || TABS(ALL_TABS) };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/users$/))) return { json: STAFF[m[1]] || [] };
    if (p === '/api/v1/announcements') {
      const codes = u.searchParams.getAll('context_codes[]');
      return { json: announcements().filter((a) => codes.includes(a.context_code)) };
    }
    if (p === '/api/v1/conversations') return { json: conversationsIn(u.searchParams.get('scope') || 'inbox') }; // F17
    if ((m = p.match(/^\/api\/v1\/conversations\/(\d+)$/))) {
      const c = CONVERSATIONS.find((x) => String(x.id) === m[1]);
      if (c && c.workflow_state === 'unread') c.workflow_state = 'read'; // opening a message reads it, like Canvas
      return { json: { ...(CONVERSATION_DETAIL[m[1]] || {}), ...(c || {}) } };
    }
    if (p === '/api/v1/search/recipients') return { json: recipients(u.searchParams.get('context') || '', u.searchParams.get('search') || '') }; // F18
    if (p === '/api/v1/users/self/groups') return { json: SAMPLE_GROUPS.map(({ id, name, course_id, members_count }) => ({ id, name, course_id, members_count })) };
    // F16: a group's own pages
    if ((m = p.match(/^\/api\/v1\/groups\/(\d+)(\/[a-z_]+)?$/))) {
      const g = SAMPLE_GROUPS.find((x) => String(x.id) === m[1]);
      if (!g) throw new HttpError(404, p);
      const what = m[2] || '';
      if (!what) return { json: { id: g.id, name: g.name, course_id: g.course_id, members_count: g.members.length, description: g.description, html_url: `/groups/${g.id}` } };
      if (what === '/users') return { json: g.members.map(([id, name]) => ({ id, name })) };
      if (what === '/discussion_topics') return { json: u.searchParams.get('only_announcements') ? g.announcements : g.topics };
      if (what === '/pages') return { json: g.pages.map(({ body, ...rest }) => rest) };
      if (what === '/files') return { json: g.files };
      if (what === '/folders') return { json: [{ id: g.id * 10, name: 'group files', full_name: 'group files', parent_folder_id: null }] };
      return { json: [] };
    }
    if ((m = p.match(/^\/api\/v1\/groups\/(\d+)\/pages\/([^/]+)$/))) {
      const page = SAMPLE_GROUPS.find((x) => String(x.id) === m[1])?.pages.find((x) => x.url === decodeURIComponent(m[2]));
      if (!page) throw new HttpError(404, p);
      return { json: { ...page, html_url: `/groups/${m[1]}/pages/${page.url}` } };
    }
    if ((m = p.match(/^\/api\/v1\/groups\/(\d+)\/discussion_topics\/(\d+)\/view$/))) return { json: VIEWS[m[2]] || { participants: [], unread_entries: [], view: [] } };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/modules$/))) return { json: MODULES[m[1]] || [] };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/pages$/))) {
      if (m[1] === '1009') throw new HttpError(404, p);
      return { json: (PAGES[m[1]] || []).map(({ body, ...rest }) => rest) };
    }
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/pages\/([^/]+)$/))) {
      const page = (PAGES[m[1]] || []).find((x) => x.url === decodeURIComponent(m[2]));
      if (!page) throw new HttpError(404, p);
      return { json: { ...page, html_url: `/courses/${m[1]}/pages/${page.url}` } };
    }
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/folders$/))) {
      if (m[1] === '1009') throw new HttpError(403, p); // instructor hid Files
      return { json: FOLDERS[m[1]] || [{ id: Number(m[1]) * 10, name: 'course files', full_name: 'course files', parent_folder_id: null }] };
    }
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/files$/))) {
      if (m[1] === '1009') throw new HttpError(403, p);
      return { json: FILES[m[1]] || [] };
    }
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/discussion_topics$/))) return { json: TOPICS[m[1]] || [] };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/discussion_topics\/(\d+)\/view$/))) return { json: VIEWS[m[2]] || { participants: [], unread_entries: [], view: [] } };
    if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/discussion_topics\/(\d+)$/))) {
      const t = (TOPICS[m[1]] || []).find((x) => String(x.id) === m[2]);
      if (!t) throw new HttpError(404, p);
      return { json: t };
    }
    throw new Error(`No fixture for ${p}`);
  };
}

// K16: the sample student's syllabi (class times, weekly topics, finals, a day off), so
// demo mode shows the full calendar. Dates follow today like the rest of the sample.
export function demoSyllabi() {
  const day = (n) => dayKey(at(n, 12, 0), TZ);
  const monday = (weeks) => {
    const today = dayKey(Date.now(), TZ);
    const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    return addDays(today, weeks * 7 - wd);
  };
  const from = monday(-5);
  const until = addDays(monday(6), 4);
  const weeks = (list) => list.map((topics, i) => ({ start: monday(i - 2), label: `Week ${i + 4}`, topics }));
  return [
    {
      id: 'demo-1001',
      courseId: '1001',
      code: 'CSE 143',
      source: 'Sample syllabus',
      schedule: {
        classes: [
          { id: 'lec', name: 'Lecture', days: ['Mon', 'Wed', 'Fri'], start: '13:30', end: '14:20', where: 'KNE 120', from, until },
          { id: 'qs', name: 'Quiz section', days: ['Thu'], start: '10:30', end: '11:20', where: 'MGH 241', from, until },
        ],
        weeks: weeks([[['Linked lists', 'Ch. 16']], [['Sorting', 'Ch. 13']], [['Recursion', 'Ch. 12']], [['Recursive backtracking', 'Ch. 12.5']], [['Binary trees', 'Ch. 17']], [['Hashing', 'Ch. 18']]]),
        noClass: [{ day: addDays(monday(3), 2), title: 'No class · Campus holiday' }],
        exams: [{ id: 'final', title: 'Final exam', day: addDays(monday(7), 1), start: '08:30', end: '10:20', where: 'KNE 120', match: '\\bfinal\\b' }],
      },
    },
    {
      id: 'demo-1002',
      courseId: '1002',
      code: 'MATH 126',
      source: 'Sample syllabus',
      schedule: {
        classes: [
          { id: 'lec', name: 'Lecture', days: ['Mon', 'Wed', 'Fri'], start: '09:30', end: '10:20', where: 'GUG 220', from, until },
          { id: 'qs', name: 'Quiz section', days: ['Tue', 'Thu'], start: '09:30', end: '10:20', where: 'THO 101', from, until },
        ],
        weeks: weeks([[['Taylor polynomials', '§11.10']], [['Vectors and the dot product', '§12.1–12.3']], [['Lines and planes', '§12.5']], [['Partial derivatives', '§14.3']], [['Double integrals', '§15.1–15.2']], [['Review', '']]]),
        noClass: [{ day: addDays(monday(3), 2), title: 'No class · Campus holiday' }],
        exams: [{ id: 'final', title: 'Final exam', day: addDays(monday(7), 2), start: '14:30', end: '16:20', where: 'KNE 130', match: '\\bfinal\\b' }],
      },
    },
    {
      id: 'demo-1003',
      courseId: '1003',
      code: 'PSYCH 101',
      source: 'Sample syllabus',
      schedule: {
        classes: [{ id: 'lec', name: 'Lecture', days: ['Tue', 'Thu'], start: '12:00', end: '13:20', where: 'KNE 130', from, until }],
        weeks: weeks([[['Memory', 'Ch. 7']], [['Learning', 'Ch. 6']], [['Development', 'Ch. 9']], [['Personality', 'Ch. 12']], [['Disorders', 'Ch. 14']], [['Therapy', 'Ch. 15']]]),
        noClass: [],
        exams: [{ id: 'final', title: 'Final exam', day: addDays(monday(7), 3), start: '10:30', end: '12:20', where: 'KNE 130', match: '\\bfinal\\b' }],
      },
    },
  ];
}

if (isDev && !isDemo()) {
  const forTests = typeof location !== 'undefined' && location.pathname.includes('/src/tests/');
  const load = (url) => import(url).then((m) => m.default);
  try {
    const add = forTests ? await load('../tests/sample/classes.js') : await load('../../owner-data/fixtures.js').catch(() => load('../tests/sample/classes.js'));
    add({ COURSES, GROUPS, DETAILS, COURSE_TABS, STAFF, MODULES, PAGES, FOLDERS, FILES, CONVERSATIONS, CONVERSATION_DETAIL, EXTRA, A, at, person, TABS });
  } catch {
    /* not the owner's computer: the made-up student only */
  }
}
