// Default settings and personal data, plus the feature registry used by
// Settings → Features (B7). Every optional feature must be listed here.

export const SCHEMA_VERSION = 1;

// Course colors are only ever used as small dots, thin bars and chart lines (B4, B10).
// They're theme-aware slots (--c1..--c8 in tokens.css), validated for
// colorblind separation in both light and dark mode. Order matters: adjacent
// slots are the most distinct.
export const COURSE_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];

// Optional features (B7). Turning one off removes it completely.
export const FEATURES = [
  { id: 'popup', label: 'Toolbar popup', desc: 'Quick look when you click the extension icon. When off, the icon opens the dashboard.' },
  { id: 'countdowns', label: 'Countdowns', desc: '"Due in 3h" instead of plain dates.' },
  { id: 'typeLabels', label: 'Type labels', desc: 'Assignment, Quiz, Exam, Discussion and Reading tags.' },
  { id: 'progress', label: 'Weekly progress bar', desc: '"5 of 8 done" for this week.' },
  { id: 'checklist', label: 'Checkboxes and to-dos', desc: 'Tick things off and add your own to-dos.' },
  { id: 'pins', label: 'Pinning', desc: 'Keep important items at the top.' },
  { id: 'hideSnooze', label: 'Hide and snooze', desc: 'Remove items from lists, for good or for a while.' },
  { id: 'subtasks', label: 'Subtasks', desc: 'Break assignments into smaller steps.' },
  { id: 'notes', label: 'Notes', desc: 'Your own notes on any item.' },
  { id: 'waiting', label: 'Waiting for a grade', desc: 'Work you turned in that hasn’t been graded.' },
  { id: 'officeHours', label: 'Keep office hours separate', desc: 'Office hours stay in their own section on the Courses page until you add them to your calendar and to-dos.' },
  { id: 'announcementsFeed', label: 'Announcements', desc: 'All your classes’ announcements in one feed, with unread ones on Home.' },
  { id: 'inbox', label: 'Inbox', desc: 'Your Canvas messages in their own tab, with unread ones on Home. Star, archive and filter them by class.' },
  { id: 'sendMessages', label: 'Send messages', desc: 'Write to your instructors, TAs and classmates, and reply, from the Inbox tab. Messages go through Canvas. Press C to write one.' },
  { id: 'groups', label: 'Canvas groups', desc: 'Your project teams and study groups from Canvas, each with its own page for announcements, discussions, pages, files and members.' },
  { id: 'quickLinks', label: 'Quick links', desc: 'Zoom, syllabus, files and your own links on each class page.' },
  { id: 'people', label: 'Instructors and TAs', desc: 'Who teaches each class, with their office hours.' },
  { id: 'studyGroups', label: 'Study groups', desc: 'Your study group for each class.' },
  { id: 'otherTab', label: 'Separate “Other” tab', desc: 'Keep events and non-class courses (orgs, workshops) on their own page instead of mixed in with your classes.' },
  { id: 'whatIf', label: 'What-if mode', desc: 'Try hypothetical scores and see your grades and GPA change.' },
  { id: 'gradeImpact', label: 'Biggest-impact work', desc: 'Upcoming assignments ranked by how much they can move your GPA.' },
  { id: 'recentGrades', label: 'Recently graded', desc: 'New grades with instructor comments.' },
  { id: 'pointsLost', label: 'Points lost', desc: 'Where you lost points, sorted by what it cost.' },
  { id: 'classStats', label: 'Class statistics', desc: 'Your score next to the class mean, high and low.' },
  { id: 'regrades', label: 'Regrade checklist', desc: 'Flag scores you want to ask about.' },
  { id: 'gradeTrends', label: 'Grade trends', desc: 'Charts of your grades over time.' },
  { id: 'gpaHistory', label: 'GPA history', desc: 'Past terms, cumulative GPA, credits and subjects.' },
  { id: 'timeline', label: 'Term timeline', desc: 'The whole quarter or semester at a glance on the Calendar page.' },
  { id: 'estimates', label: 'Time estimates', desc: 'How long you think each item will take.' },
  { id: 'workload', label: 'Daily workload', desc: 'Total planned hours per day in the week view.' },
  { id: 'nextUp', label: 'Next up', desc: 'A suggested order to work in, on Home.' },
  { id: 'planning', label: 'Plan blocks', desc: 'Drag work onto the days you’ll do it.' },
  { id: 'focus', label: 'Focus timer', desc: 'A Pomodoro timer tied to an assignment.' },
  { id: 'syllabusDates', label: 'Dates from your syllabi', desc: 'Exams and deadlines from your syllabi, when Canvas doesn’t list them.' },
  { id: 'classSchedule', label: 'Class meetings', desc: 'Lectures and quiz sections, with each week’s topics, in the calendar’s Day and Week views.' },
  { id: 'roundedType', label: 'Rounded headings', desc: 'Your Mac’s rounded font for titles and big numbers.' },
  { id: 'mochi', label: 'Mascot', desc: 'Neko (or your theme’s mascot) on Home with a summary of your day.' },
  { id: 'askMochi', label: 'Ask your mascot', desc: 'Ask questions about your schedule and grades. Answers stay on your computer.' },
  { id: 'customEvents', label: 'Your own events', desc: 'Add events to the calendar for things Canvas doesn’t list, like pre-class readings or study sessions. Press E to add one.' },
  { id: 'feedbackPrompt', label: 'Feedback request', desc: 'After a week of use, one “How’s it going?” card with links to give feedback or a rating. Counted on this computer only.' },
  { id: 'celebrations', label: 'Celebrations', desc: 'A little pop when you check things off, and confetti when your day is done.' },
  { id: 'examCountdown', label: 'Exam countdown', desc: 'Your next exams and in-person quizzes, with days to go, on Home.' },
  { id: 'completedList', label: 'Completed', desc: 'One page with everything you’ve turned in or checked off.' },
  { id: 'streak', label: 'Daily streak', desc: 'Days in a row you finished everything due, on Home.' },
  { id: 'submit', label: 'Submit from the dashboard', desc: 'Turn in file uploads and text answers without opening Canvas.', writes: true },
  { id: 'discussionReplies', label: 'Reply to discussions', desc: 'Post discussion replies from the dashboard.', writes: true },
  { id: 'archive', label: 'Past term archive', desc: 'Finished quarters or semesters are saved and can be browsed on Grades → History.' },
  { id: 'calendarExport', label: 'Calendar export', desc: 'Download due dates for Google or Apple Calendar.' },
  { id: 'deadlineReminders', label: 'Deadline reminders', desc: 'Notifications before things are due.', group: 'notifications' },
  { id: 'badge', label: 'Icon badge', desc: 'How many things are due today, on the extension icon.', group: 'notifications' },
  { id: 'morningSummary', label: 'Morning summary', desc: 'A daily notification with today’s plan.', group: 'notifications' },
  { id: 'assignmentAlerts', label: 'New assignment alerts', desc: 'A notification when assignments are posted.', group: 'notifications' },
  { id: 'announcementAlerts', label: 'New announcement alerts', desc: 'A notification when your instructors post.', group: 'notifications' },
  { id: 'gradeAlerts', label: 'New grade alerts', desc: 'A notification when a grade is posted.', group: 'notifications' },
  { id: 'riskAlerts', label: 'At-risk alerts', desc: 'A notification when a class drops below your target.', group: 'notifications' },
  { id: 'filters', label: 'Course filter and sort', desc: 'Filter chips and sort menu above lists.' },
  { id: 'shortcuts', label: 'Keyboard shortcuts', desc: 'Press ? to see them.' },
];

export const HOME_SECTIONS = [
  { id: 'attention', label: 'Alerts (login, unread announcements and messages)' },
  { id: 'due', label: 'Due soon' },
  { id: 'grades', label: 'Grades at a glance' },
  { id: 'exams', label: 'Exam countdown' },
];

export const DEFAULT_SETTINGS = {
  canvasOrigin: null, // K1: your school's Canvas origin, set in setup
  setupDone: false, // K9: finished (or skipped) the first-run steps
  termType: null, // K4: 'quarter' | 'semester' | 'trimester'; null = detect from Canvas
  seenVersion: null, // K20: the newest "What's new" you've seen
  nickname: null, // K24: what your mascot calls you (null = your Canvas first name)
  personalized: false, // K24: answered (or skipped) the Make Neko yours questions
  usage: null, // K18: { days, last, dismissed }: days you've opened the dashboard (this computer only)
  theme: 'system', // light | dark | system
  palette: 'pink', // J1: pink | classic
  detailsView: 'window', // B3: 'window' (large, centered) | 'side' (panel on the right)
  density: 'comfortable', // compact | comfortable
  newTab: true,
  refreshMinutes: 15,
  unpinOnSubmit: false,
  homeSections: HOME_SECTIONS.map((s) => ({ id: s.id, visible: true })),
  features: Object.fromEntries(FEATURES.map((f) => [f.id, true])),
  courses: {}, // courseId -> { nickname, color, hidden, role: 'core' | 'other' }
  filterCourses: [], // empty = all
  sort: 'due', // due | course | points | type
  calendarView: 'week', // G1/G2/G9/C7: day | week | month | quarter | list
  workloadLimit: 6, // G4: hours per day
  focusWork: 25, // G7 minutes
  focusBreak: 5,
  homeDueView: 'date', // G5: date | next
  notify: {
    reminderHours: [24, 2], // H1
    quietStart: '22:00',
    quietEnd: '08:00',
    morningTime: '08:00', // H3
    mutedAnnouncementCourses: {}, // H5: courseId -> true
    hideScores: false, // H6
  },
};

export const DEFAULT_USERDATA = {
  pins: {}, // itemId -> pinnedAt
  hidden: {}, // itemId -> hiddenAt
  snoozed: {}, // itemId -> until (ISO)
  done: {}, // itemId -> boolean (overrides Canvas status)
  doneAt: {}, // D8/D9: itemId -> when you checked it off (ms)
  todos: [], // { id, title, courseId, dueAt, type, done, createdAt }
  subtasks: {}, // itemId -> [{ id, text, done }]
  notes: {}, // itemId -> text
  types: {}, // itemId -> type override
  promoted: {}, // itemId -> addedAt: items from "Other" shown on Home (C13)
  links: {}, // F9: courseId -> [{ id, label, url }]
  officeHours: {}, // F10: courseId -> [{ id, person, role, days, start, end, where }]
  ohHidden: {}, // F10: built-in office-hour slot ids you've removed
  studyGroups: {}, // F11: courseId -> { members: [{ id, name, contact }], meets, notes }
  estimates: {}, // G3: itemId -> minutes
  plans: [], // G6: [{ id, itemId, day: 'YYYY-MM-DD', start: 'HH:MM' | null, minutes }]
  focusLog: {}, // G7: itemId -> seconds of focus time
  nextPinned: {}, // G5: itemId -> pinnedAt
  nextSkipped: {}, // G5: itemId -> skip until (ms)
  events: [], // G12: your own calendar events (see lib/events.js)
  classTimes: {}, // G13: courseId -> [{ id, name, days, start, end, where, from, until }]: class times you typed in
  syllabusSkip: {}, // K23: courseId -> true: no syllabus or class times needed (e.g. an online class)
  marks: {}, // I2: pins and hides on announcements, pages, files, discussions, messages, modules, classes: key -> { type, title, courseId, ref, pinned, hidden }
};

export function withDefaults(settings) {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  s.features = { ...DEFAULT_SETTINGS.features, ...(settings?.features || {}) };
  s.notify = { ...DEFAULT_SETTINGS.notify, ...(settings?.notify || {}) };
  // Keep section list complete even if new sections are added later.
  const known = new Set(s.homeSections.map((x) => x.id));
  s.homeSections = [
    ...s.homeSections.filter((x) => HOME_SECTIONS.some((h) => h.id === x.id)),
    ...HOME_SECTIONS.filter((h) => !known.has(h.id)).map((h) => ({ id: h.id, visible: true })),
  ];
  return s;
}

export function userWithDefaults(ud) {
  const out = { ...DEFAULT_USERDATA, ...(ud || {}) };
  for (const k of Object.keys(DEFAULT_USERDATA)) {
    if (out[k] == null) out[k] = structuredClone(DEFAULT_USERDATA[k]);
  }
  return out;
}
