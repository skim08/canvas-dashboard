// Sample Canvas classes for tests (and test mode on a computer without owner-data/):
// a renamed copy of the owner's classes with made-up course codes, people and rooms.
// src/lib/fixtures.js adds them in test mode. Never published, never used in demo mode.

export default function addOwnerClasses({ COURSES, GROUPS, DETAILS, COURSE_TABS, STAFF, MODULES, PAGES, FOLDERS, FILES, CONVERSATIONS, CONVERSATION_DETAIL, EXTRA, A, at, person, TABS }) {
  const AU26 = COURSES.find((c) => c.id === 1001).term;
  COURSES.splice(4, 0,
  { id: 1007, name: 'ACCT 210 A Au 26: Principles Of Accounting', course_code: 'ACCT 210 A', term: AU26, score: null, grade: null, hide: true, sections: [{ id: 10071, name: 'ACCT 210 A' }, { id: 10072, name: 'ACCT 210 AC' }] },
  { id: 1008, name: 'STAT 220 A Au 26: Introduction To Statistics', course_code: 'STAT 220 A', term: AU26, score: 97.4, grade: null, sections: [{ id: 10081, name: 'STAT 220 A' }, { id: 10082, name: 'STAT 220 AF' }] },
  { id: 1009, name: 'R E 150 A Au 26: Real Estate Basics', course_code: 'R E 150 A', term: AU26, score: 94.12, grade: null },
  );
GROUPS[1007] = [{ id: 71, name: 'Homework', group_weight: 10 }, { id: 72, name: 'Quizzes', group_weight: 15 }, { id: 73, name: 'Exams', group_weight: 70 }, { id: 74, name: 'Other', group_weight: 0 }];
GROUPS[1008] = [{ id: 81, name: 'Lecture Participation', group_weight: 0 }, { id: 82, name: 'Quiz Section', group_weight: 0 }, { id: 83, name: 'Homework', group_weight: 0 }, { id: 84, name: 'Exams', group_weight: 0 }];
GROUPS[1009] = [{ id: 91, name: 'Course Orientation' }, { id: 92, name: 'Quizzes' }, { id: 93, name: 'Writing Assignments' }, { id: 94, name: 'Course Evaluation' }];
  Object.assign(DETAILS, {
  1007: { apply_assignment_group_weights: true, grading_standard_id: null, syllabus_body: '<p>See the syllabus file.</p>' },
  1008: { apply_assignment_group_weights: false, grading_standard_id: null, syllabus_body: '' },
  1009: { apply_assignment_group_weights: false, grading_standard_id: null, syllabus_body: '' },
  });
  EXTRA.assignments.push(() => ({
    1007: [
      A(1007, 701, 'Chapter 1 Homework', 71, at(-15), { points: 10, sub: { workflow_state: 'graded', submitted_at: at(-16), score: 9 } }),
      A(1007, 702, 'Chapter 2 Homework', 71, at(-8), { points: 10, sub: { workflow_state: 'graded', submitted_at: at(-9), score: 10 } }),
      A(1007, 703, 'Chapter 3 Homework', 71, at(-1), { points: 10, sub: { workflow_state: 'graded', submitted_at: at(-2), score: 6 } }),
      A(1007, 704, 'Chapter 4 Homework', 71, at(6), { points: 10 }),
      A(1007, 705, 'Quiz 1', 72, at(-6, 10, 30), { points: 20, types: ['on_paper'], sub: { workflow_state: 'graded', score: 18 } }),
      A(1007, 706, 'Quiz 2', 72, at(13, 10, 30), { points: 20, types: ['on_paper'] }),
      A(1007, 707, 'Quiz 3 (Optional)', 72, at(40, 10, 30), { points: 20, types: ['on_paper'] }),
      A(1007, 708, 'Midterm 1', 73, at(-3, 8, 30), { points: 100, types: ['on_paper'], sub: { workflow_state: 'graded', score: 85 } }),
      A(1007, 709, 'Midterm 2', 73, at(27, 8, 30), { points: 100, types: ['on_paper'] }),
      A(1007, 710, 'Final Exam', 73, at(70, 8, 30), { points: 150, types: ['on_paper'] }),
      A(1007, 711, 'Getting Started Survey', 74, at(-20), { points: 1, sub: { workflow_state: 'graded', submitted_at: at(-21), score: 1 } }),
    ],
    1008: [
      ...[1, 2, 3, 4].map((n) => A(1008, 800 + n, `Lecture ${n} Notes`, 81, at(-14 + n * 3), { points: 1, sub: { workflow_state: 'graded', submitted_at: at(-14 + n * 3), score: n === 4 ? 0 : 1 } })),
      A(1008, 805, 'Lecture 5 Notes', 81, at(2), { points: 1 }),
      ...[1, 2, 3].map((n) => A(1008, 810 + n, `Quiz Section ${n}`, 82, at(-12 + n * 3), { points: 2, sub: { workflow_state: 'graded', submitted_at: at(-12 + n * 3), score: 2 } })),
      A(1008, 814, 'Quiz Section 4', 82, at(1), { points: 2 }),
      A(1008, 821, 'Homework 1', 83, at(-4, 15, 30), { points: 10, types: ['on_paper'], sub: { workflow_state: 'graded', score: 10 } }),
      A(1008, 822, 'Homework 2', 83, at(3, 15, 30), { points: 10, types: ['on_paper'] }),
      A(1008, 831, 'Exam 1', 84, at(29, 15, 30), { points: 50, types: ['on_paper'] }),
      A(1008, 832, 'Exam 2', 84, at(50, 15, 30), { points: 50, types: ['on_paper'] }),
      A(1008, 833, 'Final Exam', 84, at(77, 14, 30), { points: 100, types: ['on_paper'] }),
    ],
    1009: [
      A(1009, 901, 'Course Orientation Quiz', 91, at(3), { points: 10, sub: { workflow_state: 'graded', submitted_at: at(-2), score: 10 } }),
      ...Array.from({ length: 45 }, (_, k) => {
        const ch = Math.floor(k / 5) + 1;
        const done = ch === 1;
        return A(1009, 910 + k, `Chapter ${ch} Quiz ${(k % 5) + 1}`, 92, at(15 + (ch - 1) * 7), { points: 5, sub: done ? { workflow_state: 'graded', submitted_at: at(-1), score: k === 2 ? 4 : 5 } : undefined });
      }),
      ...Array.from({ length: 9 }, (_, k) => A(1009, 960 + k, `Chapter ${k + 1} Writing Assignment`, 93, at(15 + k * 7), { points: 50, types: ['online_text_entry'], sub: k === 0 ? { workflow_state: 'graded', submitted_at: at(-1), score: 46 } : undefined })),
      A(1009, 970, 'Course Evaluation', 94, at(71), { points: 15 }),
    ],
  }));
  Object.assign(COURSE_TABS, {
  1007: TABS(['home', 'announcements', 'assignments', 'grades', 'people', 'files', 'syllabus', 'modules']),
  1008: TABS(['home', 'announcements', 'assignments', 'grades', 'people', 'pages', 'modules'], [[21, 'Ed Discussion'], [22, 'Zoom']]),
  1009: TABS(['home', 'announcements', 'assignments', 'grades', 'modules']), // Files hidden
  });
  Object.assign(STAFF, {
  1007: [person(711, 'Dana Morgan', 'TeacherEnrollment'), person(712, 'Taylor Shaw', 'TaEnrollment'), person(713, 'Jordan West', 'TaEnrollment'), person(714, 'Max Avery', 'TaEnrollment'), person(715, 'Priya Kapoor', 'TaEnrollment')],
  1008: [person(811, 'Alex Warren', 'TeacherEnrollment'), person(812, 'Tina Lu', 'TaEnrollment'), person(813, 'Gabe Allison', 'TaEnrollment')],
  1009: [person(911, 'Rachel Waters', 'TeacherEnrollment'), person(912, 'Vera Wong', 'TaEnrollment')],
  });
  EXTRA.announcements.push((a) => [
    a(6001, 1007, 'Midterm 1 grades posted', 1, 'Dana Morgan', '<p>Midterm 1 scores are on Canvas. The median was 81%. Regrade requests are due within 7 days, by email to me and your quiz section instructor.</p>'),
    a(6002, 1007, 'Welcome to ACCT 210', 12, 'Dana Morgan', '<p>Welcome! Please read the <a href="/courses/1007/assignments/syllabus">syllabus</a> before Thursday.</p>', true),
    a(6003, 1008, 'No in-person lecture on 10/9', 0, 'Alex Warren', '<p>Lecture on Friday 10/9 will be videos instead. See <a href="/courses/1008/pages/week-2-videos">Week 2 videos</a>.</p>'),
    a(6004, 1009, 'Chapter 1 deadline reminder', 3, 'Rachel Waters', '<p>Chapter 1 quizzes and writing are due Friday at 11:59 PM. No late work is accepted.</p>', true),
  ]);
  Object.assign(MODULES, {
  1007: [
    { id: 71, name: 'Week 1: The Balance Sheet', position: 1, state: 'completed', items: [
      { id: 7101, type: 'SubHeader', title: 'Before lecture' },
      { id: 7102, type: 'File', title: 'Chapter 1 slides', content_id: 77001, html_url: '/courses/1007/files/77001', completion_requirement: { type: 'must_view', completed: true } },
      { id: 7103, type: 'Assignment', title: 'Chapter 1 Homework', content_id: 701, html_url: '/courses/1007/assignments/701', completion_requirement: { type: 'must_submit', completed: true }, content_details: { due_at: at(-15), points_possible: 10 } },
    ] },
    { id: 72, name: 'Week 2: The Income Statement', position: 2, state: 'started', items: [
      { id: 7201, type: 'File', title: 'Chapter 2 slides', content_id: 77002, html_url: '/courses/1007/files/77002', completion_requirement: { type: 'must_view', completed: true } },
      { id: 7202, type: 'Assignment', title: 'Chapter 4 Homework', content_id: 704, html_url: '/courses/1007/assignments/704', completion_requirement: { type: 'must_submit', completed: false }, content_details: { due_at: at(6), points_possible: 10 } },
      { id: 7203, type: 'ExternalUrl', title: 'FIT tutoring sign-up', external_url: 'https://canvas.uw.edu/courses/1007/pages/tutoring', html_url: '/courses/1007/modules/items/7203' },
    ] },
    { id: 73, name: 'Week 3: Cash Flows', position: 3, state: 'locked', unlock_at: at(5, 8, 0), items: [
      { id: 7301, type: 'File', title: 'Chapter 3 slides', content_id: 77003, html_url: '/courses/1007/files/77003', content_details: { locked_for_user: true, unlock_at: at(5, 8, 0) } },
    ] },
  ],
  1008: [
    { id: 81, name: 'Week 1: Intro to Data', position: 1, state: 'started', items: [
      { id: 8111, type: 'Page', title: 'Week 1 overview', page_url: 'week-1-overview', html_url: '/courses/1008/pages/week-1-overview', completion_requirement: { type: 'must_view', completed: true } },
      { id: 8112, type: 'Assignment', title: 'Quiz Section 4', content_id: 814, html_url: '/courses/1008/assignments/814', completion_requirement: { type: 'must_submit', completed: false }, content_details: { due_at: at(1), points_possible: 2 } },
    ] },
    { id: 82, name: 'Week 2: Sourcing Data', position: 2, state: 'unlocked', items: [{ id: 8121, type: 'Page', title: 'Week 2 videos', page_url: 'week-2-videos', html_url: '/courses/1008/pages/week-2-videos' }] },
  ],
  1009: [
    { id: 91, name: 'Course Orientation', position: 1, state: 'completed', items: [{ id: 9101, type: 'Assignment', title: 'Course Orientation Quiz', content_id: 901, html_url: '/courses/1009/assignments/901', completion_requirement: { type: 'min_score', completed: true } }] },
    { id: 92, name: 'Chapter 1: Overview of Homeownership', position: 2, state: 'started', items: [{ id: 9201, type: 'Assignment', title: 'Chapter 1 Writing Assignment', content_id: 960, html_url: '/courses/1009/assignments/960', completion_requirement: { type: 'must_submit', completed: true } }, { id: 9202, type: 'Assignment', title: 'Chapter 2 Writing Assignment', content_id: 961, html_url: '/courses/1009/assignments/961', completion_requirement: { type: 'must_submit', completed: false }, content_details: { due_at: at(22) } }] },
    ],
  });
  Object.assign(PAGES, {
  1008: [
    { url: 'week-1-overview', title: 'Week 1 overview', front_page: true, updated_at: at(-6), body: '<h2>Week 1</h2><p>Read Chapter 1 of <em>Introduction to Modern Statistics</em>. Then do <a href="/courses/1008/assignments/814">Quiz Section 4</a> and watch the <a href="/courses/1008/pages/week-2-videos">Week 2 videos</a> early if you can.</p>' },
    { url: 'week-2-videos', title: 'Week 2 videos', updated_at: at(-1), body: '<p>Videos for 10/9 (no in-person lecture):</p><ul><li>Basics of probability, part 1</li><li>Basics of probability, part 2</li></ul><p><a href="/courses/1008/pages/week-1-overview">Back to Week 1</a></p>' },
    { url: 'office-hours', title: 'Office Hours', updated_at: at(-3), body: '<p>Office hours this week: Tue 2–3 PM (SOC 234), Thu 10–11 AM (Zoom).</p>' },
    ],
  });
  Object.assign(FOLDERS, {
  1007: [{ id: 7700, name: 'course files', full_name: 'course files', parent_folder_id: null }, { id: 7701, name: 'Slides', full_name: 'course files/Slides', parent_folder_id: 7700 }, { id: 7702, name: 'Practice Exams', full_name: 'course files/Practice Exams', parent_folder_id: 7700 }],
  });
  Object.assign(FILES, {
  1007: [
    { id: 77001, display_name: 'Chapter 1 slides.pdf', size: 2400000, 'content-type': 'application/pdf', mime_class: 'pdf', folder_id: 7701, updated_at: at(-14), url: '/files/77001/download' },
    { id: 77002, display_name: 'Chapter 2 slides.pdf', size: 2900000, 'content-type': 'application/pdf', mime_class: 'pdf', folder_id: 7701, updated_at: at(-7), url: '/files/77002/download' },
    { id: 77010, display_name: 'Midterm 1 practice exam.pdf', size: 410000, 'content-type': 'application/pdf', mime_class: 'pdf', folder_id: 7702, updated_at: at(-10), url: '/files/77010/download' },
    { id: 77011, display_name: 'Midterm 1 practice solutions.xlsx', size: 18000, 'content-type': 'application/vnd.ms-excel', mime_class: 'xls', folder_id: 7702, updated_at: at(-10), url: '/files/77011/download' },
    { id: 77020, display_name: 'Syllabus ACCT 210.docx', size: 64000, 'content-type': 'application/msword', mime_class: 'doc', folder_id: 7700, updated_at: at(-20), url: '/files/77020/download' },
    ],
  });
  const C1 = { id: 8101, subject: 'Quiz section swap', workflow_state: 'unread', last_message: 'Yes, you can attend AC this week. Just let Jordan know.', last_message_at: at(0, 8, 40), participants: [{ id: 1, name: 'Test Student' }, { id: 711, name: 'Dana Morgan' }], context_name: 'ACCT 210 A Au 26', context_code: 'course_1007', message_count: 2 };
  const C2 = { id: 8102, subject: 'Office hours Zoom link', workflow_state: 'read', last_message: 'The link is on the Canvas home page.', last_message_at: at(-4, 16, 0), participants: [{ id: 1, name: 'Test Student' }, { id: 912, name: 'Vera Wong' }], context_name: 'R E 150 A Au 26', context_code: 'course_1009', message_count: 2 };
  CONVERSATIONS.push(C1, C2);
  Object.assign(CONVERSATION_DETAIL, { 8101: { ...C1, messages: [{ id: 2, author_id: 711, body: 'Yes, you can attend AC this week. Just let Jordan know.', created_at: at(0, 8, 40), attachments: [] }, { id: 1, author_id: 1, body: 'Hi Professor, could I attend a different quiz section this week? I have a conflict on Thursday.', created_at: at(-1, 21, 5), attachments: [] }] }, 8102: { ...C2, messages: [{ id: 4, author_id: 912, body: 'The link is on the Canvas home page.', created_at: at(-4, 16, 0), attachments: [{ display_name: 'office-hours.pdf', url: '/files/1/download' }] }, { id: 3, author_id: 1, body: 'Where is the office hours Zoom link?', created_at: at(-4, 11, 0), attachments: [] }] } });
}
