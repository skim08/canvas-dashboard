// Automated tests for the logic behind Phase 1. Open src/tests/index.html
// on the dev server. Expected values are worked out by hand.

import * as time from '../lib/time.js';
import { normalizeAssignment, normalizePlannerItem, normalizeCourse, autoNickname } from '../lib/normalize.js';
import * as model from '../lib/model.js';
import { sanitizeHtml, webUrl } from '../lib/sanitize.js';
import { makeBackup, parseBackup, BACKUP_KEYS } from '../lib/backup.js';
import * as canvas from '../lib/canvas.js';
import * as write from '../lib/canvasWrite.js';
import * as env from '../lib/env.js';
import { normalizeSchool, checkCanvas, hostOf } from '../lib/school.js';
import { fixtureTransport } from '../lib/fixtures.js';
import { withDefaults, userWithDefaults, FEATURES } from '../lib/defaults.js';
import * as G from '../lib/grades.js';
import { findScale, fromCanvasScheme, parseScaleLine } from '../lib/scaleParse.js';

const results = [];
let currentGroup = '';
function group(name) {
  currentGroup = name;
}
function test(id, name, fn) {
  results.push({ group: currentGroup, id, name, fn });
}
function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} expected ${e}, got ${a}`);
}
function ok(cond, msg = 'expected true') {
  if (!cond) throw new Error(msg);
}
const norm = (s) => s.replace(/\s/g, ' ');

// Thu Oct 1 2026, 10:00 AM Pacific (PDT = UTC-7)
const NOW = Date.parse('2026-10-01T17:00:00Z');
const TZ = 'America/Los_Angeles';
const pdt = (s) => new Date(Date.parse(`${s}-07:00`)).toISOString(); // "2026-10-01T23:59"

// ---------- time ----------
group('Time and countdowns (C3)');
test('C3', 'under an hour shows minutes', () => eq(time.formatDue(NOW + 45 * 60000, NOW, TZ), 'due in 45m'));
test('C3', 'under 24h shows hours', () => eq(time.formatDue(pdt('2026-10-01T23:59'), NOW, TZ), 'due in 13h'));
test('C3', 'under 24h wins even if it is tomorrow', () => eq(time.formatDue(pdt('2026-10-02T09:00'), NOW, TZ), 'due in 23h'));
test('C3', 'tomorrow beyond 24h', () => eq(norm(time.formatDue(pdt('2026-10-02T23:59'), NOW, TZ)), 'due tomorrow 11:59 PM'));
test('C3', 'within a week shows weekday + time', () => eq(norm(time.formatDue(pdt('2026-10-06T17:00'), NOW, TZ)), 'due Tue 5:00 PM'));
test('C3', 'beyond a week shows the date', () => eq(time.formatDue(pdt('2026-10-14T23:59'), NOW, TZ), 'due Oct 14'));
test('C3', 'overdue by hours', () => eq(time.formatDue(NOW - 2 * 3600000 - 60000, NOW, TZ), 'overdue by 2h'));
test('C3', 'overdue by days', () => eq(time.formatDue(NOW - 3 * 86400000 - 1000, NOW, TZ), 'overdue by 3 days'));
test('C3', 'urgency tones', () => eq([time.urgency(NOW - 1, NOW), time.urgency(NOW + 3600000, NOW), time.urgency(NOW + 3 * 86400000, NOW)], ['overdue', 'soon', 'normal']));
test('C3', 'day keys use Pacific time, not UTC', () => eq(time.dayKey(Date.parse('2026-10-02T05:00:00Z'), TZ), '2026-10-01'));
test('D4', 'week is Monday–Sunday', () => eq(time.weekOf(NOW, TZ), { start: '2026-09-28', end: '2026-10-04' }));
test('C3', 'addDays crosses month ends', () => eq(time.addDays('2026-10-30', 3), '2026-11-02'));
test('C3', 'DST change does not shift day math', () => eq(time.dayDiff('2026-10-31', '2026-11-02'), 2));

// ---------- normalize ----------
group('Canvas data (A4, B10, D1)');
const rawA = (over = {}) => ({ id: 1, name: 'HW 1', due_at: pdt('2026-10-03T23:59'), points_possible: 10, submission_types: ['online_upload'], html_url: 'https://canvas.uw.edu/courses/5/assignments/1', assignment_group_id: 9, submission: { workflow_state: 'unsubmitted' }, ...over });
const A = (over, ud) => model.allItems({ courses: [{ id: '5', autoNick: 'CSE 143' }], items: [normalizeAssignment(rawA(over), 5, { 9: { name: 'Homework' } })] }, userWithDefaults(ud), withDefaults(null), NOW)[0];

test('B10', 'nicknames from UW course codes', () =>
  eq(
    [
      autoNickname({ course_code: 'CSE 143 A', name: 'CSE 143 A Au 26: Computer Programming II' }),
      autoNickname({ course_code: 'B BIO 180 A', name: '' }),
      autoNickname({ course_code: 'MATH 126 C', name: '' }),
      autoNickname({ course_code: 'Canvas Training', name: 'Canvas Training' }),
    ],
    ['CSE 143', 'B BIO 180', 'MATH 126', 'Canvas Training']
  ));
test('D1', 'not submitted', () => eq(A().status, 'not_submitted'));
test('D1', 'submitted', () => eq(A({ submission: { workflow_state: 'submitted', submitted_at: pdt('2026-09-30T10:00') } }).status, 'submitted'));
test('D1', 'graded', () => eq(A({ submission: { workflow_state: 'graded', score: 9, submitted_at: pdt('2026-09-30T10:00') } }).status, 'graded'));
test('D1', 'excused beats everything', () => eq(A({ submission: { workflow_state: 'graded', score: 0, excused: true } }).status, 'excused'));
test('D1', 'graded but score hidden by instructor stays submitted', () => eq(A({ submission: { workflow_state: 'graded', score: null, grade: null, submitted_at: pdt('2026-09-30T10:00') } }).status, 'submitted'));
test('A4', 'course score comes from the student enrollment', () => eq(normalizeCourse({ id: 5, name: 'X', enrollments: [{ type: 'student', computed_current_score: 93.5 }] }).score, 93.5));
test('A4', 'graded items in the planner are not duplicated', () => eq(normalizePlannerItem({ plannable_type: 'quiz', plannable_id: 3, plannable: { assignment_id: 2 } }), null));
test('A4', 'calendar events come from the planner', () => eq(normalizePlannerItem({ plannable_type: 'calendar_event', plannable_id: 3, course_id: 5, plannable_date: NOW, plannable: { title: 'Review' } }).kind, 'event'));
test('A4', 'Canvas "while(1);" JSON prefix is stripped', () => eq(canvas.parseCanvasJson('while(1);[{"id":1}]'), [{ id: 1 }]));

// ---------- types ----------
group('Type labels (C5)');
const T = (name, extra = {}) => model.detectType({ title: name, kind: 'assignment', ...extra });
test('C5', 'exam by name', () => eq([T('Midterm 1'), T('Final Exam'), T('Exam 2'), T('Final')], ['exam', 'exam', 'exam', 'exam']));
test('C5', '"Final Project" is not an exam', () => eq(T('Final Project'), 'assignment'));
test('C5', 'homework named after a chapter is still homework; quizzes by name', () =>
  eq([T('Chapter 4 Homework'), T('Chapter 2 Writing Assignment'), T('Quiz 2'), T('Chapter 1 Quiz 3'), T('Quiz Section 4'), T('Ch. 2 reading'), T('Reading: Ch 5')], ['assignment', 'assignment', 'quiz', 'quiz', 'assignment', 'reading', 'reading']));
test('C5', 'review sessions are events, not exams', () => eq([model.detectType({ title: 'Midterm Review Session', kind: 'event' }), model.detectType({ title: 'Final Exam', kind: 'event' })], ['event', 'exam']));
test('C5', 'quiz', () => eq(T('Quiz 3', { isQuiz: true }), 'quiz'));
test('C5', 'exam beats quiz when named as exam', () => eq(T('Exam 1', { isQuiz: true }), 'exam'));
test('C5', 'discussion', () => eq(T('Week 2 prompt', { isDiscussion: true }), 'discussion'));
test('C5', 'reading by name or group', () => eq([T('Reading: Ch 5'), T('Ch. 2 response'), T('Response', { groupName: 'Reading Responses' })], ['reading', 'reading', 'reading']));
test('C5', 'your correction wins', () => eq(A({}, { types: { 'a:1': 'exam' } }).type, 'exam'));

// ---------- done / overdue ----------
group('Checklist, overdue and late (C2, D2, D3)');
test('D2', 'submitted items are checked automatically', () => eq(A({ submission: { workflow_state: 'submitted', submitted_at: pdt('2026-09-30T10:00') } }).done, true));
test('D2', 'you can uncheck a submitted item', () => eq(A({ submission: { workflow_state: 'submitted', submitted_at: pdt('2026-09-30T10:00') } }, { done: { 'a:1': false } }).done, false));
test('D2', 'you can check an item Canvas does not track', () => eq(A({}, { done: { 'a:1': true } }).done, true));
test('C2', 'past due + not submitted = overdue', () => eq(A({ due_at: pdt('2026-09-30T23:59') }).overdue, true));
test('C2', 'submitted items are never overdue', () => eq(A({ due_at: pdt('2026-09-30T23:59'), submission: { workflow_state: 'submitted', submitted_at: pdt('2026-09-30T10:00') } }).overdue, false));
test('C2', 'in-class (on paper) items are not overdue', () => eq(A({ due_at: pdt('2026-09-30T23:59'), submission_types: ['on_paper'] }).overdue, false));
test('D3', 'Canvas "missing" makes it overdue even without online submission', () => eq(A({ due_at: pdt('2026-09-30T23:59'), submission_types: ['on_paper'], submission: { missing: true } }).overdue, true));
test('C2', 'late work still accepted until lock date', () => eq(model.lateAcceptance({ dueAt: pdt('2026-09-30T23:59'), lockAt: pdt('2026-10-02T23:59') }, NOW), { closed: false, until: pdt('2026-10-02T23:59') }));
test('C2', 'closed after lock date', () => eq(model.lateAcceptance({ dueAt: pdt('2026-09-28T23:59'), lockAt: pdt('2026-09-30T23:59') }, NOW), { closed: true }));
test('C2', 'no lock date: still accepting', () => eq(model.lateAcceptance({ dueAt: pdt('2026-09-30T23:59'), lockAt: null }, NOW), { closed: false, until: null }));

// ---------- grouping ----------
group('Groups, pins, hide and snooze (C1, C10, C11)');
function build(rawList, ud = {}, settings = null) {
  const items = rawList.map((r) => normalizeAssignment(rawA(r), 5));
  return model.allItems({ courses: [{ id: '5', autoNick: 'CSE 143' }], items }, userWithDefaults(ud), withDefaults(settings), NOW);
}
const list = [
  { id: 1, name: 'Overdue', due_at: pdt('2026-09-30T23:59') },
  { id: 2, name: 'Tonight', due_at: pdt('2026-10-01T23:59') },
  { id: 3, name: 'Saturday', due_at: pdt('2026-10-03T23:59') },
  { id: 4, name: 'Next Thursday', due_at: pdt('2026-10-08T23:59') },
  { id: 5, name: 'Next Friday', due_at: pdt('2026-10-09T09:00') },
  { id: 6, name: 'No date', due_at: null },
  { id: 7, name: 'Done', due_at: pdt('2026-10-02T23:59'), submission: { workflow_state: 'submitted', submitted_at: pdt('2026-09-30T10:00') } },
  { id: 8, name: 'Lecture (past, nothing expected)', due_at: pdt('2026-09-30T10:00'), submission_types: ['none'] },
];
const titles = (arr) => arr.map((i) => i.title);
test('C1', 'items land in the right groups', () => {
  const g = model.groupItems(build(list), { now: NOW, tz: TZ });
  eq(titles(g.overdue), ['Overdue'], 'overdue');
  eq(titles(g.today), ['Tonight'], 'today');
  eq(titles(g.week), ['Saturday', 'Next Thursday'], 'this week (next 7 days)');
  eq(titles(g.later), ['Next Friday'], 'later');
  eq(titles(g.nodate), ['No date'], 'no date');
  eq(titles(g.done), ['Done'], 'done');
});
test('C10', 'pinned items move to Pinned', () => {
  const g = model.groupItems(build(list, { pins: { 'a:4': 1 } }), { now: NOW, tz: TZ });
  eq(titles(g.pinned), ['Next Thursday']);
  eq(titles(g.week), ['Saturday']);
});
test('C10', '"Unpin after submitting" drops done pins back', () => {
  const g = model.groupItems(build(list, { pins: { 'a:7': 1 } }), { now: NOW, tz: TZ, unpinOnSubmit: true });
  eq(titles(g.pinned), []);
});
test('C11', 'hidden and snoozed items leave lists', () => {
  const g = model.groupItems(build(list, { hidden: { 'a:2': 1 }, snoozed: { 'a:3': pdt('2026-10-02T09:00') } }), { now: NOW, tz: TZ });
  eq(titles(g.today), []);
  eq(titles(g.week), ['Next Thursday']);
});
test('C11', 'snooze ends on time', () => {
  const g = model.groupItems(build(list, { snoozed: { 'a:3': pdt('2026-10-01T09:00') } }), { now: NOW, tz: TZ });
  eq(titles(g.week), ['Saturday', 'Next Thursday']);
});
test('C4', 'course filter', () => {
  const items = build(list);
  eq(model.applyFilter(items, ['999']).length, 0);
  eq(model.applyFilter(items, ['5']).length, items.length);
  eq(model.applyFilter(items, []).length, items.length);
});
test('C4', 'sort by points', () => {
  const items = build([{ id: 1, name: 'a', points_possible: 5 }, { id: 2, name: 'b', points_possible: 50 }, { id: 3, name: 'c', points_possible: 20 }]);
  eq(titles(model.sortItems(items, 'points')), ['b', 'c', 'a']);
});

// ---------- busy / progress / waiting / search ----------
group('Busy week, progress, waiting, search (C6, C12, D4, D7)');
test('C6', 'more than the threshold in 7 days triggers a warning', () => {
  const raws = Array.from({ length: 7 }, (_, i) => ({ id: 100 + i, name: `HW ${i}`, due_at: pdt(`2026-10-0${2 + (i % 5)}T23:59`) }));
  const w = model.busyWeeks(build(raws), { now: NOW, tz: TZ, threshold: 6 });
  eq(w.length, 1);
  eq(w[0].count, 7);
});
test('C6', 'exactly the threshold does not', () => {
  const raws = Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, name: `HW ${i}`, due_at: pdt(`2026-10-0${2 + (i % 5)}T23:59`) }));
  eq(model.busyWeeks(build(raws), { now: NOW, tz: TZ, threshold: 6 }).length, 0);
});
test('C6', 'two exams in a week trigger a warning', () => {
  const w = model.busyWeeks(build([{ id: 1, name: 'Midterm 1', due_at: pdt('2026-10-05T10:00') }, { id: 2, name: 'Exam 1', due_at: pdt('2026-10-07T10:00') }]), { now: NOW, tz: TZ, threshold: 6 });
  eq(w.length, 1);
  eq(w[0].exams, 2);
});
test('D4', 'weekly progress counts Mon–Sun, done vs total', () => {
  const p = model.weekProgress(build(list), { now: NOW, tz: TZ });
  // This week (Sep 28 – Oct 4): Overdue, Tonight, Saturday, Done, Lecture = 5; done = Done = 1
  eq([p.done, p.total], [1, 5]);
});
test('D7', 'waiting for a grade', () => {
  const items = build([{ id: 1, name: 'Waiting', submission: { workflow_state: 'submitted', submitted_at: pdt('2026-09-27T10:00') } }, { id: 2, name: 'Graded', submission: { workflow_state: 'graded', score: 3 } }]);
  const w = model.waitingForGrade(items, NOW);
  eq(titles(w), ['Waiting']);
  eq(w[0].waitingDays, 4);
});
test('C12', 'search matches title words in any order', () => {
  const items = build([{ id: 1, name: 'Programming Assignment 2: Sorting' }, { id: 2, name: 'Quiz 3' }]);
  eq(titles(model.searchItems(items, 'sorting prog')), ['Programming Assignment 2: Sorting']);
  eq(titles(model.searchItems(items, 'cse quiz')), ['Quiz 3']);
});
test('C12', 'search is fast on 500 items (< 100ms)', () => {
  const raws = Array.from({ length: 500 }, (_, i) => ({ id: i + 1, name: `Assignment number ${i}` }));
  const items = build(raws);
  const t0 = performance.now();
  model.searchItems(items, 'number 49');
  const ms = performance.now() - t0;
  ok(ms < 100, `took ${ms.toFixed(1)}ms`);
});
test('F4', 'images from other sites never load: they become a link', () => {
  const { fragment } = sanitizeHtml('<p><img src="https://tracker.example.com/p.gif" alt="chart"><img src="/courses/5/files/9/preview" alt="ok"><img src="javascript:alert(1)"></p>', { courseId: '5' });
  const div = document.createElement('div');
  div.append(fragment);
  const imgs = [...div.querySelectorAll('img')].map((i) => i.getAttribute('src'));
  const link = div.querySelector('a');
  eq([imgs, link?.textContent, link?.getAttribute('href')], [['https://canvas.uw.edu/courses/5/files/9/preview'], 'Image: chart (from tracker.example.com)', 'https://tracker.example.com/p.gif']);
});
test('F9', 'your links only keep ordinary web addresses', () => eq([webUrl('javascript:alert(1)'), webUrl('data:text/html,hi'), webUrl(' https://zoom.us/j/1 '), webUrl('not a url')], [null, null, 'https://zoom.us/j/1', null]));
test('D3', 'needs attention lists overdue and auth problems', () => {
  const a = model.attention(build(list), { auth: { state: 'expired' } });
  eq(a.map((x) => x.kind), ['auth', 'overdue']);
});

// ---------- sanitize ----------
group('Safe instructions (C9)');
const S = (html) => {
  const { fragment, files } = sanitizeHtml(html, { courseId: '5' });
  const div = document.createElement('div');
  div.append(fragment);
  return { html: div.innerHTML, files };
};
test('C9', 'scripts are removed', () => ok(!S('<p>a</p><script>alert(1)</script>').html.includes('script')));
test('C9', 'event handlers and styles are removed', () => eq(S('<p onclick="x()" style="color:red">a</p>').html, '<p>a</p>'));
test('C9', 'javascript: links are neutralized', () => ok(!S('<a href="javascript:alert(1)">x</a>').html.includes('javascript')));
test('C9', 'relative links point at canvas.uw.edu and open in a new tab', () => ok(S('<a href="/courses/5/pages/x">x</a>').html.includes('href="https://canvas.uw.edu/courses/5/pages/x" target="_blank"')));
test('C9', 'iframes become a plain link', () => eq(S('<iframe src="https://www.youtube.com/embed/x"></iframe>').html, '<a href="https://www.youtube.com/embed/x" target="_blank" rel="noopener noreferrer">Open embedded content</a>'));
test('C9', 'attached Canvas files are listed with download links', () =>
  eq(S('<a href="/courses/5/files/77/download?wrap=1">starter.zip</a> <a href="/courses/5/files/77">again</a>').files, [
    { id: '77', name: 'starter.zip', url: 'https://canvas.uw.edu/courses/5/files/77/download?download_frd=1', viewUrl: 'https://canvas.uw.edu/courses/5/files/77' },
  ]));

// ---------- quarters and semesters (K4) ----------
group('Quarters and semesters (K4)');
test('K4', 'detects the kind of term from Canvas names, then dates', async () => {
  const { detectTermType, termWord } = await import('../lib/term.js');
  const t = (term, termStart = null, termEnd = null) => ({ term, termStart, termEnd });
  eq(
    [
      detectTermType([t('Autumn 2026')]),
      detectTermType([t('Fall Semester 2026')]),
      detectTermType([t('Spring Trimester 2027')]),
      detectTermType([t('Fall 2026', '2026-08-24', '2026-12-11')]), // 109 days
      detectTermType([t('Fall 2026', '2026-09-28', '2026-12-12')]), // 75 days
      detectTermType([t('Fall 2026')]),
      termWord({ termType: 'semester' }, [t('Autumn 2026')]),
      termWord({}, []),
    ],
    ['quarter', 'semester', 'trimester', 'semester', 'quarter', null, 'semester', 'term']
  );
});

// ---------- read-only public build (K15) ----------
group('Public build is read-only (K15)');
const asPublic = async (fn) => {
  const { BUILD } = await import('../build.js');
  const was = BUILD.kind;
  BUILD.kind = 'public';
  try {
    return await fn();
  } finally {
    BUILD.kind = was;
  }
};
test('K15', 'owner build keeps submit and replies; public build has neither', async () => {
  const { feat } = await import('../ui/components.js');
  const owner = [feat('submit'), feat('discussionReplies'), feat('calendar')];
  const pub = await asPublic(() => [feat('submit'), feat('discussionReplies'), feat('calendar')]);
  eq([owner, pub], [[true, true, true], [false, false, true]]);
});
test('K15', 'public build refuses every write before anything is sent', async () => {
  let sent = 0;
  canvas.setTransport(async () => (sent++, { json: {} }));
  const tryIt = async (fn) => { try { await fn(); return 'sent'; } catch (e) { return e.name; } };
  try {
    const r = await asPublic(async () => [
      await tryIt(() => canvas.send('https://canvas.uw.edu/api/v1/courses/1/x', { method: 'POST' })),
      await tryIt(() => canvas.send('https://canvas.uw.edu/api/v1/courses/1/x', { method: 'PUT' })),
      await tryIt(() => canvas.get('/api/v1/courses')),
    ]);
    eq([r, sent], [['ReadOnlyError', 'ReadOnlyError', 'sent'], 1]);
  } finally {
    canvas.setTransport(fixtureTransport(null));
  }
});
test('K15', 'public build: opening an announcement marks it read here, without Canvas', async () => {
  const content = await import('../ui/content.js');
  let sent = 0;
  canvas.setTransport(async () => (sent++, { json: {} }));
  try {
    await asPublic(() => content.markAnnouncementRead({ read: false, canvasId: 'k15-ann', courseId: '1001' }));
    eq([content.isRead('ann', 'k15-ann'), sent], [true, 0]);
  } finally {
    canvas.setTransport(fixtureTransport(null));
  }
});

// ---------- demo mode (K16) ----------
group('Demo mode (K16)');
test('K16', 'demo data lives apart from real data, and clearing it leaves real data alone', async () => {
  const storage = await import('../lib/storage.js');
  const realBefore = localStorage.getItem('cd:k16probe');
  try {
    await storage.set({ k16probe: 'real' });
    env.setDemoFlag(true);
    const seenInDemo = (await storage.get(['k16probe'])).k16probe;
    await storage.set({ k16probe: 'demo' });
    const keysInDemo = Object.keys(await storage.getAll());
    await storage.clear();
    env.setDemoFlag(false);
    eq([seenInDemo, keysInDemo.includes('k16probe'), keysInDemo.some((k) => k.startsWith('demo:')), (await storage.get(['k16probe'])).k16probe, localStorage.getItem('cd:demo:k16probe')], [undefined, true, false, 'real', null]);
  } finally {
    env.setDemoFlag(false);
    await storage.remove(['k16probe']);
    if (realBefore != null) localStorage.setItem('cd:k16probe', realBefore);
  }
});
test('K16', 'the demo student has class times and finals, and none of the owner’s classes', async () => {
  const fx = await import('../lib/fixtures.js');
  const syl = fx.demoSyllabi();
  const text = JSON.stringify(syl);
  eq([syl.map((p) => p.code), syl.every((p) => p.schedule.classes.length && p.schedule.exams.length), (await privateWords()).filter((w) => text.includes(w))], [['CSE 143', 'MATH 126', 'PSYCH 101'], true, []]);
});
test('K16', 'demo mode points at a school that can’t exist', () => {
  const saved = env.CANVAS_ORIGIN;
  try {
    env.setDemoFlag(true);
    env.setCanvasOrigin('https://canvas.uw.edu');
    const inDemo = env.CANVAS_ORIGIN;
    env.setDemoFlag(false);
    eq([inDemo, env.usesSample()], ['https://canvas.example.edu', true]);
  } finally {
    env.setDemoFlag(false);
    env.setCanvasOrigin(saved);
  }
});

// ---------- your own events (G12) ----------
group('Your own events (G12)');
test('G12', 'weekly events: chosen weekdays until a date, minus skipped days', async () => {
  const EV = await import('../lib/events.js');
  const ev = { id: 'e1', title: 'Codon reading', day: '2026-11-02', start: '09:00', end: '09:45', repeat: { days: ['Mon', 'Wed'], until: '2026-11-16' }, skip: ['2026-11-11'] };
  eq(EV.occurrences(ev), ['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-16']);
  eq(EV.occurrences({ ...ev, repeat: null, skip: [] }), ['2026-11-02']);
  eq(EV.occurrences({ ...ev, repeat: { days: ['Fri'], until: '' }, skip: [] }).length, 16); // no end date: 16 weeks
});
test('G12', 'occurrences become calendar items at the right times (Pacific, across the time change)', async () => {
  const EV = await import('../lib/events.js');
  const items = EV.expandEvents([{ id: 'e1', title: 'Slides', day: '2026-10-30', start: '14:00', end: '15:30', repeat: { days: ['Fri'], until: '2026-11-06' }, type: 'assignment', courseId: '5' }, { id: 'e2', title: 'Study day', day: '2026-11-07', start: null }], { tz: TZ });
  eq(
    items.map((i) => [i.id, i.dueAt, i.endAt, i.allDay, i.kind, i.ownType, i.courseId]),
    [
      ['ev:e1:2026-10-30', '2026-10-30T21:00:00.000Z', '2026-10-30T22:30:00.000Z', false, 'event', 'assignment', '5'], // PDT
      ['ev:e1:2026-11-06', '2026-11-06T22:00:00.000Z', '2026-11-06T23:30:00.000Z', false, 'event', 'assignment', '5'], // PST
      ['ev:e2:2026-11-07', '2026-11-08T07:59:00.000Z', null, true, 'event', null, null],
    ]
  );
});
test('G12', 'events join your items (typed as you chose), can be checked off, and the switch turns them off', () => {
  const ud = userWithDefaults({ events: [{ id: 'e1', title: 'Pre-class reading', day: '2026-10-05', start: '08:00', end: '08:30', type: 'reading' }], done: { 'ev:e1:2026-10-05': true } });
  const on = model.allItems({ courses: [], items: [] }, ud, withDefaults(null), NOW).find((i) => i.id === 'ev:e1:2026-10-05');
  const off = model.allItems({ courses: [], items: [] }, ud, withDefaults({ features: { customEvents: false } }), NOW).some((i) => i.eventId);
  eq([on.type, on.done, on.area, off], ['reading', true, 'main', false]);
});
test('G12', 'events are in backups (they live in your data)', () => {
  const data = { userdata: { events: [{ id: 'e1', title: 'x', day: '2026-11-02' }] } };
  eq(parseBackup(JSON.stringify(makeBackup(data))).data.userdata.events[0].title, 'x');
});

// ---------- class times you type in (G13) ----------
group('Class times you type in (G13)');
test('G13', 'typed class times become weekly blocks, skipping the syllabus’s days off', async () => {
  const PR = await import('../lib/profiles.js');
  const { syllabusSchedule } = await import('../lib/syllabus.js');
  const before = PR.PROFILES;
  try {
    // A syllabus with dates but no class times, plus a day off.
    PR.setProfiles([{ id: 'p', courseId: '7', code: 'RE 150', source: 'x', schedule: { noClass: [{ day: '2026-11-26', title: 'No class · Thanksgiving' }] } }]);
    const classTimes = { 7: [{ id: 'a', name: 'Lecture', days: ['Tue', 'Thu'], start: '08:30', end: '09:50', where: 'ARC 147', from: '2026-11-17', until: '2026-11-27' }] };
    const { add } = syllabusSchedule([{ id: '7', code: 'RE 150', sections: [] }], [], { tz: TZ, classTimes });
    eq(
      add.map((i) => [i.title, i.dueAt, i.endAt, i.location, i.cancelled]),
      [
        ['Lecture', '2026-11-17T16:30:00.000Z', '2026-11-17T17:50:00.000Z', 'ARC 147', false],
        ['Lecture', '2026-11-19T16:30:00.000Z', '2026-11-19T17:50:00.000Z', 'ARC 147', false],
        ['Lecture', '2026-11-24T16:30:00.000Z', '2026-11-24T17:50:00.000Z', 'ARC 147', false],
        ['No class · Thanksgiving', '2026-11-26T16:30:00.000Z', '2026-11-26T17:50:00.000Z', null, true],
      ]
    );
    // No syllabus at all: typed times still work.
    PR.setProfiles([]);
    eq(syllabusSchedule([{ id: '7', code: 'RE 150', sections: [] }], [], { tz: TZ, classTimes }).add.length, 4);
  } finally {
    PR.setProfiles(before);
  }
});
test('G13', 'a class with typed times no longer needs setup; one with a syllabus but no times asks for times', async () => {
  const PR = await import('../lib/profiles.js');
  const { state } = await import('../ui/store.js');
  const { needsSyllabus, needsWhat } = await import('../ui/syllabusDrawer.js');
  const before = [PR.PROFILES, state.userdata];
  try {
    PR.setProfiles([{ id: 'b', courseId: '2', code: 'HIST 101', schedule: { deadlines: [] } }]);
    state.userdata = userWithDefaults({ classTimes: { 3: [{ id: 'x', name: 'Lab', days: ['Fri'], start: '13:00', from: '2026-09-01', until: '2026-12-01' }] } });
    const ctx = { courses: [{ id: '2', code: 'HIST 101' }, { id: '3', code: 'CHEM 142' }, { id: '4', code: 'BIO 180' }] };
    eq([needsSyllabus(ctx).map((c) => c.id), needsWhat(ctx.courses[0]), needsWhat(ctx.courses[2])], [['2', '4'], 'times', 'syllabus']);
  } finally {
    PR.setProfiles(before[0]);
    state.userdata = before[1];
  }
});

// ---------- syllabus setup comes first (K23) ----------
group('Syllabus setup comes first (K23)');
test('K23', 'classes without class times are listed until you add them or say they aren’t needed', async () => {
  const PR = await import('../lib/profiles.js');
  const { state } = await import('../ui/store.js');
  const { needsSyllabus } = await import('../ui/syllabusDrawer.js');
  const before = [PR.PROFILES, state.userdata];
  try {
    PR.setProfiles([
      { id: 'a', courseId: '1', code: 'BIO 180', schedule: { classes: [{ id: 'lec', name: 'Lecture', days: ['Mon'], start: '09:00', from: '2026-09-28', until: '2026-12-11' }] } },
      { id: 'c', courseId: '6', code: 'PHYS 121', schedule: { classes: [{ id: 'lec', name: 'Lecture', days: ['Tue'], start: '10:00' }] } }, // no dates: can't be placed, so it still asks
      { id: 'b', courseId: '2', code: 'HIST 101', schedule: { deadlines: [{ id: 'd', day: '2026-11-02', title: 'Essay' }] } }, // dates, but no class times
    ]);
    state.userdata = userWithDefaults({ syllabusSkip: { 4: true } });
    const ctx = { courses: [{ id: '1', code: 'BIO 180' }, { id: '2', code: 'HIST 101' }, { id: '3', code: 'CHEM 142' }, { id: '4', code: 'ONLINE 100' }, { id: '5', code: 'X 1', unavailable: '403' }, { id: '6', code: 'PHYS 121' }] };
    eq(needsSyllabus(ctx).map((c) => c.id), ['2', '3', '6']);
  } finally {
    PR.setProfiles(before[0]);
    state.userdata = before[1];
  }
});

// ---------- make Neko yours (K24) ----------
test('A10', 'restore preview counts your own events and typed class times', async () => {
  const { summarize } = await import('../lib/backup.js');
  const rows = Object.fromEntries(summarize({ userdata: { events: [{ id: 'a' }, { id: 'b' }], classTimes: { 1001: [{ id: 'x' }] } } }));
  eq([rows['Your own events'], rows['Classes with class times you typed in']], [2, 1]);
});
test('G12', 'deleting the last remaining day of a repeating event deletes the event', async () => {
  const { withoutOccurrence } = await import('../lib/events.js');
  const evs = [{ id: 'r', title: 'Reading', day: '2026-11-02', repeat: { days: ['Mon'], until: '2026-11-09' }, skip: [] }, { id: 'o', title: 'Other', day: '2026-11-03' }];
  const one = withoutOccurrence(evs, 'r', '2026-11-02');
  const two = withoutOccurrence(one, 'r', '2026-11-09');
  eq([one.map((e) => e.id), one[0].skip, two.map((e) => e.id)], [['r', 'o'], ['2026-11-02'], ['o']]);
});

group('Make Neko yours (K24)');
test('K24', 'six questions, in order; your chosen name is used in the greeting', async () => {
  const { PERSONALIZE_QUESTIONS } = await import('../ui/personalize.js');
  const { state } = await import('../ui/store.js');
  const { mochiGreeting } = await import('../ui/mochi.js');
  eq(PERSONALIZE_QUESTIONS, ['buddy', 'name', 'goal', 'workload', 'reminders', 'look']);
  const was = state.settings;
  try {
    state.settings = withDefaults({ nickname: 'Sam' });
    const g = mochiGreeting({ items: [], allItems: [], grades: { courses: [] }, now: NOW, tz: TZ, nickOf: (x) => x });
    ok(/Sam/.test(g.title), g.title);
  } finally {
    state.settings = was;
  }
});
test('K24', 'answers are ordinary settings, so they’re in backups', () => {
  const data = { settings: { nickname: 'Sam', workloadLimit: 4, palette: 'matcha', personalized: true, notify: { reminderHours: [48, 24], morningTime: '07:00' } } };
  const back = parseBackup(JSON.stringify(makeBackup(data))).data.settings;
  eq([back.nickname, back.workloadLimit, back.palette, back.notify.reminderHours], ['Sam', 4, 'matcha', [48, 24]]);
});

// ---------- themes tab (J8) ----------
group('Themes tab (J8)');
test('J8', 'five animal themes plus Classic, each with a named mascot in all five moods', async () => {
  const M = await import('../ui/mascots.js');
  const css = await (await fetch('../styles/tokens.css')).text();
  const boot = await (await fetch('../boot.js')).text();
  eq(M.THEMES.map((t) => t.title), ['Blush', 'Matcha', 'Ocean', 'Polar', 'Honey', 'Classic']);
  eq(M.THEMES.map((t) => [t.id, M.MASCOTS[t.mascot].name]), [['pink', 'Neko'], ['matcha', 'Kero'], ['ocean', 'Nami'], ['polar', 'Yumi'], ['honey', 'Hachi'], ['classic', 'Neko']]);
  for (const t of M.THEMES) {
    for (const mood of M.MASCOT_MOODS) ok(/^<svg[\s\S]*<\/svg>$/.test(M.mascotMarkup(t.mascot, mood, 40)), `${t.mascot} ${mood}`);
    if (t.id !== 'pink') {
      ok(css.includes(`:root[data-palette="${t.id}"] {`) && css.includes(`:root[data-palette="${t.id}"][data-theme="dark"]`), `${t.id} has light and dark colors`);
      ok(boot.includes(t.id), `${t.id} applies before first paint`);
    }
  }
  eq([M.themeOf('nope').id, M.themeOf('ocean').mascot], ['pink', 'shark']);
});
test('J8', 'Ask uses the theme’s mascot name and animal', async () => {
  const { systemPrompt } = await import('../lib/scheduleContext.js');
  ok(systemPrompt('Nami', 'shark').startsWith('You are Nami, a friendly shark'), 'prompt follows the mascot');
});

// ---------- what's new (K20) ----------
group('What’s new (K20)');
test('K20', 'version is the same in manifest.json, CHANGELOG.md and the app', async () => {
  const { VERSION } = await import('../lib/changelog.js');
  const manifest = await (await fetch('../../manifest.json')).json();
  const md = await (await fetch('../../CHANGELOG.md')).text();
  eq([VERSION, manifest.version, md.match(/^## (\S+)/m)[1]], [manifest.version, VERSION, VERSION]);
});
test('K20', 'notes show once per update, newest first', async () => {
  const { unseen, newer, VERSION, CHANGES } = await import('../lib/changelog.js');
  const previous = CHANGES[1].version;
  eq([unseen(previous).map((c) => c.version), unseen('0.1.0').map((c) => c.version), unseen(VERSION).length, newer('0.10.0', '0.9.1'), newer('0.2.0', '0.2.0')], [[VERSION], CHANGES.slice(0, -1).map((c) => c.version), 0, true, false]);
});

// ---------- feedback prompt (K18) ----------
group('Feedback prompt (K18)');
test('K18', 'counts different days only; shows once after 7, never after dismissing', async () => {
  const { countDay, feedbackDue } = await import('../lib/feedback.js');
  let u = null;
  const days = ['2026-10-01', '2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'];
  const seen = [];
  for (const d of days) {
    u = countDay(u, d) || u;
    seen.push(feedbackDue(u, { links: ['https://forms.example/x'] }));
  }
  eq(
    [u.days, seen, feedbackDue(u, { links: [null, null] }), feedbackDue(u, { enabled: false, links: ['x'] }), feedbackDue({ ...u, dismissed: true }, { links: ['x'] }), countDay(u, '2026-10-09')],
    [7, [false, false, false, false, false, false, false, true], false, false, false, null]
  );
});

// ---------- other schools' Canvas setups (K10) ----------
group('Other schools (K10)');
test('K10', 'a semester school with letter grades, hidden totals, no categories and outside-tool quizzes', async () => {
  canvas.setTransport(fixtureTransport('otherschool'));
  const { fetchEverything } = await import('../lib/sync.js');
  const { summarize } = await import('../lib/gradeSummary.js');
  const PR = await import('../lib/profiles.js');
  const owner = PR.PROFILES;
  try {
    PR.setProfiles([]); // a new student: no syllabi yet
    const data = await fetchEverything();
    const settings = withDefaults(null);
    const items = model.allItems(data, userWithDefaults(), settings, Date.now());
    const sum = summarize({ cache: data, items, settings, grades: { system: 'letterPM' }, now: Date.now() });
    const by = (code) => sum.courses.find((c) => c.course.code === code);
    const letter = (c) => G.letterOf(c.gp, 'letterPM');
    eq(
      {
        term: sum.termWord,
        courses: data.courses.map((c) => c.code),
        bio: [by('BIO 1510').course.hideTotals, by('BIO 1510').pct != null],
        hist: [by('HIST 2010').model.groups.length >= 0, Math.round(by('HIST 2010').pct), letter(by('HIST 2010'))],
        chem: [by('CHEM 1210').scaleSource, by('CHEM 1210').scale.rows[1].letter, items.find((i) => i.title.startsWith('Quiz 4'))?.submissionTypes],
        econ: data.courses.find((c) => c.code === 'ECON 2105').sections,
        fys: [by('FYS 1000').pct, by('FYS 1000').noGradesYet],
        credits: by('HIST 2010').credits,
      },
      {
        term: 'semester',
        courses: ['BIO 1510', 'HIST 2010', 'CHEM 1210', 'ECON 2105', 'FYS 1000'],
        bio: [true, true], // Canvas hides the total; the dashboard works it out from the assignments
        hist: [true, 90, 'A−'], // no categories: points, 45/50
        chem: ['canvas', 'A−', ['external_tool']],
        econ: ['ECON 2105 01', 'ECON 2106 01'],
        fys: [null, true],
        credits: 3,
      }
    );
  } finally {
    PR.setProfiles(owner);
    canvas.setTransport(fixtureTransport(null));
  }
});

// ---------- syllabus import (K5) ----------
group('Syllabus import (K5)');
const SYL_TEXT = [
  'BIO 180 Introductory Biology, Spring 2027',
  'Lecture: MWF 10:30-11:20 AM in HUB 130',
  'Lab: Tuesdays 2:30-4:20 PM, HCK 132',
  'Week | Date | Topic | Due',
  '1 | Mon, Mar 29 | Intro to evolution |',
  '2 | Wed, Apr 7 | Natural selection | Problem Set 1 due',
  '4 | Fri, Apr 23 | Midterm 1 (in class) |',
  'No class Monday, May 31 (Memorial Day)',
  'Paper draft due 5/14 by 11:59 pm',
  'Final Exam: Tuesday, June 8, 8:30-10:20 AM, HUB 130',
].join('\n');
test('K5', 'reads a Word syllabus, tables as rows', async () => {
  const { textFromDocx } = await import('../lib/fileText.js');
  eq(await textFromDocx(await (await fetch('files/sample-syllabus.docx')).arrayBuffer()), SYL_TEXT);
});
test('K5', 'reads a PDF syllabus (compressed, 2-byte font, object streams)', async () => {
  const { textFromPdf } = await import('../lib/fileText.js');
  eq(await textFromPdf(await (await fetch('files/sample-syllabus.pdf')).arrayBuffer()), SYL_TEXT);
});
test('K5', 'finds class meetings, exams, deadlines, days off and topics', async () => {
  const { extractSyllabus } = await import('../lib/syllabusImport.js');
  const f = extractSyllabus(SYL_TEXT, { today: '2027-03-01' });
  eq(
    {
      classes: f.classes.map((x) => [x.name, x.days.join(''), x.start, x.end, x.where]),
      exams: f.exams.map((x) => [x.title, x.type, x.day, x.start, x.end, x.where, x.inClass]),
      deadlines: f.deadlines.map((x) => [x.title, x.day, x.time]),
      noClass: f.noClass.map((x) => [x.day, x.title]),
      topics: f.topics.map((x) => [x.day, x.text]),
    },
    {
      classes: [['Lecture', 'MonWedFri', '10:30', '11:20', 'HUB 130'], ['Lab', 'Tue', '14:30', '16:20', 'HCK 132']],
      exams: [['Midterm 1', 'exam', '2027-04-23', null, null, null, true], ['Final exam', 'exam', '2027-06-08', '08:30', '10:20', 'HUB 130', false]],
      deadlines: [['Problem Set 1', '2027-04-07', null], ['Paper Draft', '2027-05-14', '23:59']],
      noClass: [['2027-05-31', 'No class · Memorial Day']],
      topics: [['2027-03-29', 'Intro to evolution'], ['2027-04-07', 'Natural selection']],
    }
  );
  ok(f.exams[0].line.includes('Midterm 1'), 'keeps the source line');
});
test('K5', 'dates and times in the usual syllabus spellings', async () => {
  const { findDates, findTimes, findDays } = await import('../lib/syllabusImport.js');
  const ctx = { today: '2026-09-20' };
  eq(
    [
      findDates('Exam on October 14th', ctx).map((d) => d.day),
      findDates('Thanksgiving Nov 26–27', ctx).map((d) => d.day),
      findDates('Due 12/4/26; read ch 3/4', ctx).map((d) => d.day),
      findDates('Jan 12, 2027', ctx).map((d) => d.day),
      findTimes('11:30-12:20 PM'),
      findTimes('2-3:20pm'),
      findTimes('due by 11:59 p.m.'),
      findDays('TTh 1:30-2:50'),
      findDays('Mon/Wed 9:00'),
      findDays('Tuesdays and Thursdays'),
    ],
    [['2026-10-14'], ['2026-11-26', '2026-11-27'], ['2026-12-04'], ['2027-01-12'], { start: '11:30', end: '12:20' }, { start: '14:00', end: '15:20' }, { start: '23:59', end: null }, ['Tue', 'Thu'], ['Mon', 'Wed'], ['Tue', 'Thu']]
  );
});
test('K5', 'imported syllabus shows on the calendar: meetings with topics, exam in class, deadline, day off', async () => {
  const { extractSyllabus, toSyllabus } = await import('../lib/syllabusImport.js');
  const PR = await import('../lib/profiles.js');
  const { syllabusSchedule } = await import('../lib/syllabus.js');
  const owner = PR.PROFILES;
  try {
    const entry = toSyllabus({ courseId: '55', code: 'BIO 180 A', termStart: '2027-03-29', termEnd: '2027-06-04' }, extractSyllabus(SYL_TEXT, { today: '2027-03-01' }));
    PR.setProfiles(PR.serializeProfiles([entry]));
    const { add } = syllabusSchedule([{ id: '55', code: 'BIO 180 A', sections: [] }], [], { tz: TZ });
    const on = (day) => add.filter((i) => i.id.includes(day)).map((i) => i.title);
    eq(
      [on('2027-03-29'), on('2027-04-07'), add.find((i) => i.title === 'Midterm 1')?.dueAt, add.find((i) => i.title === 'Final exam')?.location, add.find((i) => i.title.startsWith('Problem Set 1'))?.dueAt, on('2027-05-31')],
      [['Lecture · Intro to evolution'], ['Problem Set 1', 'Lecture · Natural selection'], '2027-04-23T17:30:00.000Z', 'HUB 130', '2027-04-08T06:59:00.000Z', ['No class · Memorial Day']]
    );
  } finally {
    PR.setProfiles(owner);
  }
});

// ---------- your syllabi are your data (K8) ----------
group('Your syllabi (K8)');
test('K8', 'syllabi save as plain data and come back with working patterns', async () => {
  const PR = await import('../lib/profiles.js');
  const owner = (await import('./sample/syllabi.js')).default;
  const saved = JSON.parse(JSON.stringify(PR.serializeProfiles(owner)));
  const before = PR.PROFILES;
  try {
    PR.setProfiles(saved);
    const acc = PR.findProfile({ code: 'ACCT 210 A' });
    eq([saved.length, typeof saved[0].model.categories[1].match, acc.model.categories[1].match.test('MIDTERM 1'), acc.schedule.exams[0].match.test('Quiz #1'), PR.findProfile({ code: 'HIST 101' })], [3, 'string', true, true, null]);
  } finally {
    PR.setProfiles(owner);
  }
});
test('K8', 'a syllabus saved for one course wins over a course-code match', async () => {
  const PR = await import('../lib/profiles.js');
  const owner = PR.PROFILES;
  try {
    PR.setProfiles([{ id: 'a', code: 'BIO 180' }, { id: 'b', code: 'BIO 180', courseId: '77' }]);
    eq([PR.findProfile({ id: '77', code: 'BIO 180 A' }).id, PR.findProfile({ id: '78', code: 'BIO 180 B' }).id], ['b', 'a']);
  } finally {
    PR.setProfiles(owner);
  }
});
// Words that must never ship: the sample classes' names, plus (on the owner's computer)
// the real ones in owner-data/private-words.txt, which isn't in git.
async function privateWords() {
  const own = await fetch('../../owner-data/private-words.txt').then((r) => (r.ok ? r.text() : '')).catch(() => '');
  return ['ACCT 210', 'STAT 220', 'R E 150', 'Dana Morgan', ...own.split('\n').map((w) => w.trim()).filter((w) => w && !w.startsWith('#'))];
}
test('K8', 'the published code has no one’s schedule built in', async () => {
  const src = await (await fetch('../lib/profiles.js')).text();
  const hits = (await privateWords()).filter((w) => src.includes(w));
  eq(hits.length, 0, 'profiles.js still contains owner data');
});

// ---------- your time zone (K2) ----------
group('Your time zone (K2)');
test('K2', 'Eastern time, across the November daylight-saving change', () => {
  const NY = 'America/New_York';
  eq(
    [time.instantAt('2026-10-30', 9, 0, NY), time.instantAt('2026-11-02', 9, 0, NY), time.dayKey('2026-11-01T03:30:00Z', NY), time.dayKey('2026-11-01T05:30:00Z', NY), time.formatTime('2026-11-02T14:00:00Z', NY)],
    ['2026-10-30T13:00:00.000Z', '2026-11-02T14:00:00.000Z', '2026-10-31', '2026-11-01', '9:00 AM']
  );
});
test('K2', 'uses the computer’s time zone', () => eq(time.userTz('Asia/Tokyo'), Intl.DateTimeFormat().resolvedOptions().timeZone));

// ---------- your school (K1) ----------
group('Your school (K1)');
test('K1', 'school addresses: typed, pasted or instructure.com, always https and just the site', () => {
  const o = (x) => normalizeSchool(x).origin || 'error';
  eq(
    [o('canvas.asu.edu'), o('  Canvas.ASU.edu/courses/12?x=1 '), o('https://myschool.instructure.com/'), o('http://canvas.asu.edu'), o(''), o('localhost'), o('10.0.0.1'), o('canvas'), o('https://canvas.asu.edu:8443')],
    ['https://canvas.asu.edu', 'https://canvas.asu.edu', 'https://myschool.instructure.com', 'error', 'error', 'error', 'error', 'error', 'error']
  );
});
test('K1', 'is it Canvas, and are you signed in?', async () => {
  const res = (status, body, url = 'https://canvas.x.edu/api/v1/users/self') => async () => ({ status, ok: status < 300, url, text: async () => body });
  eq(
    [
      await checkCanvas('https://canvas.x.edu', res(200, 'while(1);{"id":"12","name":"A"}')),
      await checkCanvas('https://canvas.x.edu', res(401, '{"status":"unauthenticated","errors":[{"message":"user authorization required"}]}')),
      await checkCanvas('https://canvas.x.edu', res(200, '<html>login</html>', 'https://canvas.x.edu/login/saml')),
      await checkCanvas('https://www.x.edu', res(200, '<html>home</html>', 'https://www.x.edu/')),
      await checkCanvas('https://www.x.edu', res(404, '{"error":"no"}')),
      await checkCanvas('https://nope.x.edu', async () => { throw new TypeError('Failed to fetch'); }),
    ],
    ['ok', 'login', 'login', 'not-canvas', 'not-canvas', 'offline']
  );
});
test('K1', 'requests only ever go to the school you chose', () => {
  const saved = env.CANVAS_ORIGIN;
  const err = (url) => { try { canvas.checkTarget(url); return 'ok'; } catch (e) { return e.name; } };
  try {
    env.setCanvasOrigin('https://canvas.asu.edu');
    const a = [err('https://canvas.asu.edu/api/v1/courses'), err('https://canvas.uw.edu/api/v1/courses'), err('https://canvas.asu.edu.evil.com/api'), hostOf(env.CANVAS_ORIGIN)];
    env.setCanvasOrigin(null);
    // test mode falls back to the sample school; the extension would have none
    eq(a, ['ok', 'ForeignHostError', 'ForeignHostError', 'canvas.asu.edu']);
  } finally {
    env.setCanvasOrigin(saved);
  }
});

// ---------- backup ----------
group('Backup and restore (A10)');
test('A10', 'backup includes your data but never Canvas data or login state', () => {
  const b = makeBackup({ settings: { theme: 'dark' }, userdata: { notes: { x: 'hi' } }, snapshots: [1], cache: { secret: 1 }, auth: { state: 'ok' }, syncState: {} });
  eq(Object.keys(b.data).sort(), ['settings', 'snapshots', 'userdata']);
});
test('A10', 'round trip restores the same data', () => {
  const data = { settings: { theme: 'dark' }, userdata: { notes: { x: 'hi' }, todos: [{ id: 't1' }] }, snapshots: [{ date: '2026-10-01' }] };
  eq(parseBackup(JSON.stringify(makeBackup(data))).data, data);
});
test('A10', 'rejects files that are not backups', () => {
  let msg = '';
  try {
    parseBackup('{"hello":1}');
  } catch (e) {
    msg = e.message;
  }
  ok(msg.includes('isn’t a Neko backup'), msg);
});
test('A10', 'restore leaves out damaged fields and never touches object prototypes', () => {
  const text = JSON.stringify({ app: 'canvas-dashboard', schema: 1, data: { settings: { theme: 'dark', refreshMinutes: 'soon', features: 5 }, userdata: { notes: { a: 'hi' }, todos: 'oops' }, snapshots: { not: 'a list' } } }).replace('"theme"', '"__proto__":{"polluted":true},"theme"');
  const r = parseBackup(text);
  eq([r.data.settings, r.data.userdata, 'snapshots' in r.data, r.dropped.sort(), ({}).polluted], [{ theme: 'dark' }, { notes: { a: 'hi' } }, false, ['settings.features', 'settings.refreshMinutes', 'snapshots', 'userdata.todos'], undefined]);
});
test('A10', 'restore refuses files over 25 MB', () => {
  let msg = '';
  try {
    parseBackup(' '.repeat(25 * 1024 * 1024 + 1));
  } catch (e) {
    msg = e.message;
  }
  ok(msg.includes('too large'), msg);
});
test('A10', 'backup covers every personal-data key', () => eq(BACKUP_KEYS, ['settings', 'userdata', 'grades', 'snapshots', 'archive', 'syllabi']));

// ---------- defaults / features ----------
group('Settings and features (A9, B7, B8)');
test('B7', 'every feature has a toggle that defaults on', () => ok(FEATURES.every((f) => withDefaults(null).features[f.id] === true)));
test('B8', 'saved section order is kept, new sections are appended', () => eq(withDefaults({ homeSections: [{ id: 'grades', visible: false }] }).homeSections.map((s) => s.id), ['grades', 'attention', 'due', 'exams']));

// ---------- canvas client ----------
group('Canvas client (A4, A5, A6)');
test('A6', 'pagination follows "next" links', async () => {
  canvas.setTransport(fixtureTransport(null));
  const all = await canvas.getAll('/api/v1/courses/1001/assignments');
  eq(all.length, 11); // sample CSE 143 assignments, split across two pages
});
test('A5', 'expired login raises AuthError', async () => {
  canvas.setTransport(fixtureTransport('expired'));
  let name = '';
  try {
    await canvas.get('/api/v1/users/self/profile');
  } catch (e) {
    name = e.name;
  }
  eq(name, 'AuthError');
});
test('A4', 'asks Canvas for string IDs so huge course IDs are not rounded', () => {
  eq(canvas.ACCEPT, 'application/json+canvas-string-ids');
  // What would happen without it: the last digits change.
  eq(String(JSON.parse('{"id":283480000000000347}').id) === '283480000000000347', false);
  eq(canvas.parseCanvasJson('while(1);{"id":"283480000000000347"}').id, '283480000000000347');
});
test('A4', 'one course refusing access does not block the others', async () => {
  canvas.setTransport(fixtureTransport(null));
  const { fetchEverything } = await import('../lib/sync.js');
  const data = await fetchEverything();
  const blocked = data.courses.find((c) => c.id === '283480000000000350');
  eq(blocked.unavailable, 'Canvas returned 403');
  eq(data.courses.filter((c) => !c.unavailable).length, 9); // 7 classes + last quarter's MATH 125 (archived by the refresh, I1) + Foster Undergraduates
  ok(data.items.some((i) => i.courseId === '1001'), 'other courses still load');
  eq(model.visibleCourses(data.courses, withDefaults(null)).map((c) => c.id).includes('283480000000000350'), false);
});
test('A6', 'pool limits concurrency', async () => {
  let live = 0;
  let peak = 0;
  await canvas.pool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async () => {
    live++;
    peak = Math.max(peak, live);
    await new Promise((r) => setTimeout(r, 5));
    live--;
  });
  eq(peak, 4);
});

// ---------- core vs other ----------
group('Classes vs Other (B11, B12, C13, C14)');
test('B12', 'real classes are detected by their course code', () =>
  eq(
    [
      { course_code: 'ACCT 210 A', name: 'ACCT 210 A Au 26: Principles Of Accounting' },
      { course_code: 'STAT 220 B', name: '' },
      { course_code: 'RE 150 A', name: '' },
      { course_code: 'Foster Undergraduates', name: 'Foster Undergraduates' },
      { course_code: 'Foster Excel for Business', name: 'Foster Excel for Business' },
      { course_code: 'Understanding Civil Rights', name: 'Understanding Civil Rights' },
    ].map((c) => model.courseRole({ id: 'x', code: c.course_code, name: c.name }, withDefaults(null))),
    ['core', 'core', 'core', 'other', 'other', 'other']
  ));
test('B12', 'your choice in Settings wins', () => eq(model.courseRole({ id: '9', code: 'RE 150', name: '' }, withDefaults({ courses: { 9: { role: 'other' } } })), 'other'));
const mixedCache = () => ({
  courses: [normalizeCourse({ id: 1, course_code: 'STAT 220 B', name: 'STAT 220', enrollments: [{ type: 'student' }] }), normalizeCourse({ id: 2, course_code: 'Foster Undergraduates', name: 'Foster Undergraduates', enrollments: [{ type: 'student' }] })],
  items: [normalizeAssignment(rawA({ id: 11, name: 'HW 2' }), 1), normalizePlannerItem({ plannable_type: 'calendar_event', plannable_id: 21, course_id: 2, plannable_date: pdt('2026-10-01T17:00'), plannable: { title: 'Resume reviews' } })],
});
const notSyl = (i) => i.source !== 'syllabus'; // G10/G11 items are tested on their own
test('B11', 'items from Other courses stay off the main views', () => {
  const items = model.allItems(mixedCache(), userWithDefaults({}), withDefaults(null), NOW);
  eq(items.filter(notSyl).map((i) => [i.title, i.area]), [['HW 2', 'main'], ['Resume reviews', 'other']]);
});
test('C13', 'adding an Other item to Home moves it to the main views', () => {
  const items = model.allItems(mixedCache(), userWithDefaults({ promoted: { 'p:calendar_event:21': 1 } }), withDefaults(null), NOW);
  eq(items.find((i) => i.title === 'Resume reviews').area, 'main');
});
test('B11', 'turning off the Other tab puts everything back on the main views', () => {
  const items = model.allItems(mixedCache(), userWithDefaults({}), withDefaults({ features: { otherTab: false } }), NOW);
  eq(items.filter(notSyl).every((i) => i.area === 'main'), true);
});
test('B11', 'main course lists only include classes', () => eq(model.visibleCourses(mixedCache().courses, withDefaults(null), 'core').map((c) => c.id), ['1']));
test('C14', 'events start, they are not due', () =>
  eq(
    [time.formatDue(NOW + 16 * 60000, NOW, TZ, 'starts'), norm(time.formatDue(pdt('2026-10-02T23:59'), NOW, TZ, 'starts')), time.formatDue(NOW - 20 * 60000, NOW, TZ, 'starts')],
    ['starts in 16m', 'starts tomorrow 11:59 PM', 'started 20m ago']
  ));

// ---------- office hours ----------
group('Office hours (C15)');
const ev = (title) => ({ kind: 'event', title });
test('C15', 'office hours are recognized', () =>
  eq(['Office Hours (Prof. Stuart)', 'TA OH – Section AB', 'Student hours', 'Math drop-in hours', 'Midterm Review Session', 'Oh no, room change', 'Lecture'].map((t) => model.isOfficeHours(ev(t))), [true, true, true, true, false, false, false]));
test('C15', 'only events count (an assignment named "office hours reflection" is still an assignment)', () => eq(model.isOfficeHours({ kind: 'assignment', title: 'Office hours reflection' }), false));
const ohCache = () => ({
  courses: [normalizeCourse({ id: 1, course_code: 'STAT 220 B', name: 'STAT 220', enrollments: [{ type: 'student' }] })],
  items: [normalizePlannerItem({ plannable_type: 'calendar_event', plannable_id: 31, course_id: 1, plannable_date: pdt('2026-10-02T14:30'), plannable: { title: 'Office Hours' } }), normalizePlannerItem({ plannable_type: 'calendar_event', plannable_id: 32, course_id: 1, plannable_date: pdt('2026-10-02T09:00'), plannable: { title: 'Midterm review' } })],
});
test('C15', 'office hours stay off the main views', () => eq(model.allItems(ohCache(), userWithDefaults({}), withDefaults(null), NOW).filter(notSyl).map((i) => i.area), ['officeHours', 'main']));
test('C15', 'adding a session puts it on your calendar and to-dos', () => eq(model.allItems(ohCache(), userWithDefaults({ promoted: { 'p:calendar_event:31': 1 } }), withDefaults(null), NOW)[0].area, 'main'));
test('C15', 'turning the feature off treats them like any event', () => eq(model.allItems(ohCache(), userWithDefaults({}), withDefaults({ features: { officeHours: false } }), NOW)[0].area, 'main'));


// ---------- grade engine (Phase 2) ----------
const near = (a, b, tol = 0.005, msg = '') => {
  if (a == null || Math.abs(a - b) > tol) throw new Error(`${msg} expected ${b}, got ${a}`);
};
// mk({ weighted, groups: [[id, weight, dropLowest?, dropHighest?, neverDrop?]], items: [[id, group, possible, score, state]] })
const mk = ({ weighted = false, groups, items }) => ({
  id: 'c',
  weighted,
  groups: groups.map(([id, weight = 0, dropLowest = 0, dropHighest = 0, never = []]) => ({ id, name: id, weight, dropLowest, dropHighest, neverDrop: new Set(never) })),
  items: items.map(([id, groupId, possible, score, state = score == null ? 'open' : 'graded']) => ({ id, groupId, possible, score, state })),
});
const T95 = G.uwTemplate();

group('Grading scale (E1)');
test('E1', 'template: 95% = 4.0, −0.1 per 1%', () => eq([100, 95, 94.99, 94, 90, 75.5, 62, 61.9, 0].map((p) => G.gradeFromPercent(T95, p)), [4, 4, 3.9, 3.9, 3.5, 2, 0.7, 0, 0]));
test('E1', 'rounding to whole % before converting', () => eq([G.gradeFromPercent({ ...T95, round: 'whole' }, 94.5), G.gradeFromPercent({ ...T95, round: 'whole' }, 94.49)], [4, 3.9]));
test('E1', 'rounding to tenths', () => eq(G.gradeFromPercent({ ...T95, round: 'tenth' }, 94.96), 4));
const LIN = { rows: [{ min: 100, gp: 4 }, { min: 90, gp: 3 }, { min: 60, gp: 0.7 }], mode: 'linear', round: 'none' };
test('E1', 'linear scale interpolates and rounds down to 0.1', () => eq([95, 92.5, 90, 75, 59].map((p) => G.gradeFromPercent(LIN, p)), [3.5, 3.2, 3, 1.8, 0]));
test('E1', 'below 0.7 is 0.0 (UW rule)', () => eq(G.gradeFromPercent({ rows: [{ min: 60, gp: 0.5 }], mode: 'step' }, 70), 0));
test('E1', 'lowest % for a grade', () => eq([G.percentForGrade(T95, 4), G.percentForGrade(T95, 3.9), G.percentForGrade(T95, 3.5), G.percentForGrade(LIN, 3.5), G.percentForGrade({ ...T95, round: 'whole' }, 4)], [95, 94, 90, 95, 94.5]));
test('E1', 'unreachable grade returns null', () => eq(G.percentForGrade({ rows: [{ min: 90, gp: 3.8 }], mode: 'step' }, 3.9), null));
test('E1', 'scale problems are caught', () => ok(G.scaleProblems({ rows: [{ min: 90, gp: 3.5 }, { min: 80, gp: 3.7 }] }).length === 1));
test('E1', 'finds a scale in syllabus text', () => {
  const r = findScale('Grading\n95-100%  4.0\n94% 3.9\n93% = 3.8\n≥ 92: 3.7\nLate work loses 10%.');
  eq(r.rows, [{ min: 95, gp: 4 }, { min: 94, gp: 3.9 }, { min: 93, gp: 3.8 }, { min: 92, gp: 3.7 }]);
});
test('E1', 'ignores text that is not a scale', () => eq(findScale('Midterm 1 is worth 20%.\nOffice hours 3.30 pm'), null));
test('E1', 'reads "4.0 = 95%" order too', () => eq(parseScaleLine('4.0 = 95%').min, 95));
test('E1', 'imports a Canvas scheme in UW grade points or letters (K3), nothing else', () => {
  eq(fromCanvasScheme({ grading_scheme: [{ name: '4.0', value: 0.95 }, { name: '3.9', value: 0.94 }, { name: '3.8', value: 0.93 }] }).rows[1], { min: 94, gp: 3.9 });
  eq(fromCanvasScheme({ grading_scheme: [{ name: 'A', value: 0.94 }, { name: 'A-', value: 0.9 }, { name: 'B+', value: 0.87 }] }).rows, [{ min: 94, gp: 4, letter: 'A' }, { min: 90, gp: 3.7, letter: 'A−' }, { min: 87, gp: 3.3, letter: 'B+' }]);
  eq(fromCanvasScheme({ grading_scheme: [{ name: 'Excellent', value: 0.9 }, { name: 'Good', value: 0.8 }, { name: 'Fair', value: 0.7 }] }), null);
});

group('Grading systems (K3)');
// Hand-calculated: A (4.0 × 3 cr) + B+ (3.3 × 4 cr) + C (2.0 × 3 cr) = 12 + 13.2 + 6 = 31.2 over 10 credits = 3.12.
test('K3', 'letter grades with + and −: cutoffs, letters and GPA', () => {
  const s = G.scaleTemplate('letterPM');
  const at = (p) => [G.gradeFromPercent(s, p), G.letterOf(G.gradeFromPercent(s, p), 'letterPM')];
  eq([at(93), at(92.99), at(87), at(80), at(70), at(60), at(59.99)], [[4, 'A'], [3.7, 'A−'], [3.3, 'B+'], [2.7, 'B−'], [1.7, 'C−'], [0.7, 'D−'], [0, 'F']]);
  near(G.gpaOf([{ gp: 4.0, credits: 3 }, { gp: 3.3, credits: 4 }, { gp: 2.0, credits: 3 }]), 3.12);
});
test('K3', 'letter grades without + or −', () => {
  const s = G.scaleTemplate('letter');
  eq([90, 89.9, 80, 75, 60, 59].map((p) => G.letterOf(G.gradeFromPercent(s, p), 'letter')), ['A', 'B', 'B', 'C', 'D', 'F']);
});
test('K3', 'UW decimal stays decimal; percent needed for a grade', () => {
  eq([G.letterOf(3.7, 'uw'), G.percentForGrade(G.scaleTemplate('letterPM'), 3.7), G.percentForGrade(G.scaleTemplate('uw'), 3.7)], [null, 90, 92]);
});
test('K3', 'usual credits and pass/fail', async () => {
  const { usualCredits } = await import('../lib/gradeSummary.js');
  eq([usualCredits({ system: 'letterPM' }), usualCredits({ system: 'uw' }), usualCredits({ system: 'letter', defaultCredits: 4 }), G.EARNS_CREDIT('P'), G.EARNS_CREDIT('NP'), G.gradeChoices('letterPM').length], [3, 5, 4, true, false, 12]);
});

group('Course grade math (E3, E4, E7)');
// Points: 8/10 + 15/20 graded, 10 still open. Current = 23/30 = 76.667%.
const pts = () => mk({ groups: [['A']], items: [['a1', 'A', 10, 8], ['a2', 'A', 20, 15], ['a3', 'A', 10, null]] });
test('E3', 'points-based course', () => near(G.current(pts()).pct, 76.6667));
// Weighted: HW 40% (9/10, 7/10 = 80%), Exams 60% (85/100; 100 open). Current = .4*80 + .6*85 = 83%.
const wtd = () => mk({ weighted: true, groups: [['HW', 40], ['EX', 60]], items: [['h1', 'HW', 10, 9], ['h2', 'HW', 10, 7], ['e1', 'EX', 100, 85], ['e2', 'EX', 100, null]] });
test('E3', 'weighted course', () => near(G.current(wtd()).pct, 83));
test('E3', 'categories with nothing graded are left out and weights rescale', () =>
  near(G.current(mk({ weighted: true, groups: [['HW', 40], ['EX', 60]], items: [['h1', 'HW', 10, 8], ['e1', 'EX', 100, null]] })).pct, 80));
// Quizzes, drop 1 lowest: 5/10, 9/10, 2/5. Dropping q1 → 11/15 = 73.33% (beats dropping q3 → 70%).
const qz = (drop, high = 0, never = []) => mk({ groups: [['Q', 0, drop, high, never]], items: [['q1', 'Q', 10, 5], ['q2', 'Q', 10, 9], ['q3', 'Q', 5, 2]] });
test('E4', 'drop lowest picks the drop that helps you most', () => near(G.current(qz(1)).pct, 73.3333));
test('E4', 'never-drop items are kept', () => near(G.current(qz(1, 0, ['q1'])).pct, 70));
test('E4', 'drop highest removes the one that lowers it most', () => near(G.current(qz(0, 1)).pct, 46.6667));
test('E4', 'extra credit (0 points possible) adds on top', () => near(G.current(mk({ groups: [['A']], items: [['a', 'A', 10, 10], ['x', 'A', 0, 2]] })).pct, 120));
test('E4', 'excused work is left out completely', () => near(G.current(mk({ groups: [['A']], items: [['a', 'A', 10, 9], ['b', 'A', 10, null, 'excused']] })).pct, 90));
test('E4', 'items you mark as extra credit add points but not possible points', () => {
  const course = { id: '5', groups: [{ id: 'g', name: 'g', weight: 0 }], weighted: false };
  const items = [{ source: 'canvas', kind: 'assignment', courseId: '5', canvasId: '1', groupId: 'g', points: 10, sub: { state: 'graded', score: 10 } }, { source: 'canvas', kind: 'assignment', courseId: '5', canvasId: '2', groupId: 'g', points: 10, sub: { state: 'graded', score: 5 } }];
  near(G.current(G.buildCourse(course, items, NOW, { extraCredit: { 2: true } })).pct, 150);
});
test('E3', 'your weights override Canvas', () => {
  const course = { id: '5', groups: [{ id: 'h', name: 'HW', weight: 50 }, { id: 'e', name: 'Ex', weight: 50 }], weighted: true };
  const items = [['1', 'h', 10, 10], ['2', 'e', 10, 5]].map(([canvasId, groupId, points, score]) => ({ source: 'canvas', kind: 'assignment', courseId: '5', canvasId, groupId, points, sub: { state: 'graded', score } }));
  near(G.current(G.buildCourse(course, items, NOW, { weights: { h: 20, e: 80 } })).pct, 60); // .2*100 + .8*50
});
test('E17', 'category contributions add up to the course %', () => {
  const r = G.current(wtd());
  near(r.groups.reduce((s, g) => s + g.contribution, 0), 83);
  near(r.groups.find((g) => g.id === 'HW').contribution, 32);
});

group('Projections (E11, E12, E13, E14, E18, E22)');
test('E12', 'best / worst / likely (points)', () => {
  const r = G.range(pts());
  near(r.best, 82.5); // 33/40
  near(r.worst, 57.5); // 23/40
  near(r.likely, 76.6667); // open work at your current 76.67%
});
test('E12', 'best / worst (weighted)', () => {
  const r = G.range(wtd());
  near(r.best, 87.5); // .4*80 + .6*(185/200)
  near(r.worst, 57.5); // .4*80 + .6*(85/200)
});
test('E11', 'needed average on remaining work', () => eq(G.required(pts(), 80), { status: 'needed', need: 90, openCount: 1, pending: 0 })); // (23+10x)/40 = .8 → x = .9
test('E11', 'weighted: need 91.7% for 85%', () => eq(G.required(wtd(), 85).need, 91.7)); // 57.5 + 30x = 85 → x = .9167
test('E11', 'not reachable reports the best possible', () => {
  const r = G.required(wtd(), 90);
  eq(r.status, 'unreachable');
  near(r.best, 87.5);
});
test('E11', 'already secured', () => eq(G.required(pts(), 50).status, 'secured'));
test('E11', 'no remaining work', () => eq(G.required(mk({ groups: [['A']], items: [['a', 'A', 10, 9]] }), 80).status, 'none'));
test('E11', 'closed, unsubmitted work counts as 0', () => near(G.range(mk({ groups: [['A']], items: [['a', 'A', 10, 10], ['b', 'A', 10, null, 'closed']] })).best, 50));
test('E16', 'what-if scores change the result and never touch real data', () => {
  const c = pts();
  near(G.current(c, { a3: 10 }).pct, 82.5);
  eq(c.items.find((e) => e.id === 'a3').score, null);
});
test('E14', 'share of the course grade per item', () => {
  const c = wtd();
  near(G.itemShare(c, c.items.find((e) => e.id === 'e2')), 0.3); // 60% × 100/200
  near(G.itemShare(c, c.items.find((e) => e.id === 'h1')), 0.2); // 40% × 10/20
});
test('E13', 'points still available', () => {
  const a = G.available(wtd());
  eq(a.points, 100);
  near(a.share, 0.3);
});
test('E18', 'points lost, sorted by what they cost your grade', () => {
  const lost = G.pointsLost(wtd());
  eq(lost.map((x) => x.e.id), ['h2', 'e1', 'h1']); // 6.0, 4.5, 2.0 points of course grade
  near(lost[0].cost, 6);
  near(lost[1].cost, 4.5);
});
test('E22', 'pending work and its share', () => {
  const c = mk({ groups: [['A']], items: [['a', 'A', 10, 9], ['b', 'A', 30, null, 'pending']] });
  near(G.pending(c).share, 0.75);
});
test('E22', 'an in-person exam that is past due waits for a score (pending)', () =>
  eq(G.engineItem({ source: 'canvas', kind: 'assignment', canvasId: '1', points: 100, dueAt: pdt('2026-09-30T10:00'), expectsSubmission: false, sub: { state: 'not_submitted' } }, NOW).state, 'pending'));

group('GPA (E8, E9, E10, E26, E27, E28)');
const cur = [{ credits: 5, gp: 3.9, name: 'ACCT 210' }, { credits: 5, gp: 3.7, name: 'STAT 220' }, { credits: 4, gp: 4.0, name: 'RE 150' }];
test('E8', 'quarter GPA, weighted by credits', () => near(G.gpaOf(cur), 54 / 14, 1e-9)); // (19.5+18.5+16)/14 = 3.857
test('E8', 'equal credits average evenly', () => near(G.gpaOf([{ credits: 5, gp: 4 }, { credits: 5, gp: 3.6 }]), 3.8, 1e-9));
test('E8', 'nothing to average gives null', () => eq(G.gpaOf([]), null));
const past = [{ name: 'Autumn 2025', courses: [{ name: 'CSE 142', credits: 5, grade: 3.8 }, { name: 'MATH 124', credits: 5, grade: 4.0 }, { name: 'GEN ST 199', credits: 3, grade: 'S' }, { name: 'CHEM 142', credits: 5, grade: 'W' }] }];
test('E9', 'cumulative: official and projected', () => {
  const c = G.cumulative(past, cur);
  near(c.official, 3.9, 1e-9); // (19+20)/10
  near(c.projected, 93 / 24, 1e-9); // (39+54)/24 = 3.875
});
test('E5', 'repeated attempts marked as not counting are left out', () => near(G.gpaOf(G.pastGpaEntries([{ courses: [{ credits: 5, grade: 2.0, counts: false }, { credits: 5, grade: 3.6 }] }])), 3.6, 1e-9));
test('E10', 'course costing the most GPA', () => eq(G.biggestDrag(cur, 3.9).name, 'STAT 220'));
test('E10', 'nothing below target means no drag', () => eq(G.biggestDrag([{ credits: 5, gp: 4 }], 3.9), null));
test('E26', 'GPA by quarter with running cumulative', () => {
  const h = G.quarterHistory(past, { name: 'Autumn 2026', entries: cur });
  near(h[0].gpa, 3.9, 1e-9);
  near(h[1].gpa, 54 / 14, 1e-9);
  near(h[1].cumulative, 93 / 24, 1e-9);
  eq(h[1].projected, true);
});
test('E27', 'credits completed, GPA credits, in progress', () => eq(G.credits(past, 14), { completed: 13, gpaCredits: 10, inProgress: 14 })); // S counts, W doesn't
test('E28', 'subjects by department, credit-weighted', () => {
  const s = G.subjects([{ name: 'CSE 142', credits: 5, gp: 4.0 }, { name: 'CSE 143', credits: 5, gp: 3.6 }, { name: 'MATH 124', credits: 5, gp: 3.5 }, { name: 'B BIO 180', credits: 5, gp: 3.9 }]);
  eq(s.map((x) => [x.dept, Math.round(x.gpa * 100) / 100, x.count]), [['B BIO', 3.9, 1], ['CSE', 3.8, 2], ['MATH', 3.5, 1]]);
});


group('Grade summary with sample Canvas data (E1, E2, E7, E8, E11, E15, E21, E24)');
let sampleData = null;
async function sampleSummary(grades, settings = null) {
  canvas.setTransport(fixtureTransport(null));
  const { fetchEverything } = await import('../lib/sync.js');
  const { summarize } = await import('../lib/gradeSummary.js');
  // Like a real refresh, last quarter's class goes to the archive first (I1).
  const { withoutCourses, hasEnded } = await import('../lib/archive.js');
  if (!sampleData) {
    const all = await fetchEverything();
    sampleData = withoutCourses(all, new Set(all.courses.filter((c) => hasEnded(c, Date.now())).map((c) => c.id)));
  }
  const data = structuredClone(sampleData);
  const s = withDefaults(settings);
  const now = Date.now();
  return { data, sum: summarize({ cache: data, items: model.allItems(data, userWithDefaults(null), s, now), settings: s, grades, now }) };
}
test('E7', 'computed % matches Canvas (weighted, drop-lowest, points)', async () => {
  const { sum } = await sampleSummary(null);
  for (const c of sum.courses.filter((c) => c.canvasPct != null && !c.profile)) near(c.realPct, c.canvasPct, 0.01, c.course.autoNick);
  eq(sum.courses.some((c) => c.mismatch), false);
});
test('E7', 'a difference over 0.5 points is flagged', async () => {
  const { data } = await sampleSummary(null);
  data.courses[0].score = 90;
  const { summarize } = await import('../lib/gradeSummary.js');
  const s = withDefaults(null);
  const sum = summarize({ cache: data, items: model.allItems(data, userWithDefaults(null), s, Date.now()), settings: s, grades: null, now: Date.now() });
  eq(sum.courses[0].mismatch, true);
});
test('E33', 'every class gets a scale automatically, with guesses labeled', async () => {
  const { sum } = await sampleSummary({ system: 'uw' }); // the sample school is UW
  eq(sum.courses.map((c) => [c.course.autoNick, c.scaleSource, c.excluded]), [
    ['CSE 143', 'syllabus-auto', null], // found in the Canvas syllabus
    ['MATH 126', 'canvas', null], // instructor's Canvas scheme
    ['PSYCH 101', 'estimate', null],
    ['ENGL 131', 'estimate', null],
    ['ACCT 210', 'profile', null], // built-in setup from your syllabus
    ['STAT 220', 'profile', null], // standard UW scale, confirmed by course staff
    ['R E 150', 'profile', null],
  ]);
  eq(sum.courses.find((c) => c.course.autoNick === 'PSYCH 101').estimates, ['Grading scale estimated', 'Credits assumed (5)']);
  eq(sum.courses.find((c) => c.course.autoNick === 'ACCT 210').credits, 5);
});
test('E8', 'quarter GPA once two classes are set up', async () => {
  const { sum } = await sampleSummary({ courses: { 1001: { scale: G.uwTemplate(), credits: 5 }, 1002: { credits: 5 } } }, { courses: { 1003: { hidden: true }, 1004: { hidden: true }, 1007: { hidden: true }, 1008: { hidden: true }, 1009: { hidden: true } } });
  // CSE 96.67% → 4.0 (template). MATH 86.53% on the instructor scale (96% = 4.0, −0.1/1%) → 86% row = 3.0.
  eq(sum.courses.slice(0, 2).map((c) => c.gp), [4, 3]);
  near(sum.quarter.gpa, 3.5, 1e-9);
  eq(sum.atRisk.map((c) => c.course.autoNick), ['MATH 126']); // E15: 3.0 < 3.9 target
  eq(sum.quarter.drag.id, '1002'); // E10
});
test('E2', 'S/NS classes stay out of GPA', async () => {
  const { sum } = await sampleSummary({ courses: { 1001: { scale: G.uwTemplate(), credits: 5 }, 1002: { credits: 5, grading: 'sn' } } }, { courses: { 1003: { hidden: true }, 1004: { hidden: true }, 1007: { hidden: true }, 1008: { hidden: true }, 1009: { hidden: true } } });
  eq(sum.quarter.entries.length, 1);
  eq(sum.courses[1].excluded, 'Graded S/NS');
});
test('E16', 'what-if changes GPA only while what-if is on', async () => {
  const cfg = { courses: { 1002: { credits: 5 } }, whatIf: { 28: 15, 29: 15, 233: 10 } };
  const off = (await sampleSummary(cfg)).sum.courses[1].pct;
  const on = (await sampleSummary({ ...cfg, whatIfOn: true })).sum.courses[1].pct;
  ok(on > off, `${on} should be above ${off}`);
});
test('E21', 'missing items show what they cost; late penalties show points', async () => {
  const { sum } = await sampleSummary(null);
  ok(sum.missing.some((m) => m.i.title === 'Written Homework 3' && m.cost > 0), 'missing HW 3 has a cost');
  eq(sum.late.find((l) => l.i.title === 'Written Homework 2').deducted, 1.5);
});
test('E24', 'recently graded, newest first, unseen until opened', async () => {
  const { sum } = await sampleSummary({ seen: { 32: null } });
  ok(sum.recent.length >= 4, 'has recent grades');
  ok(sum.recent.every((r, k) => k === 0 || new Date(sum.recent[k - 1].i.sub.gradedAt) >= new Date(r.i.sub.gradedAt)), 'sorted newest first');
  ok(sum.recent.every((r) => r.unseen), 'all unseen');
});


group('Your classes, exactly as the syllabi say (E29–E33)');
const sel = (cs) => ({
  id: 's',
  kind: 'selfWeighted',
  fallbackRate: 1,
  groups: [
    ['n', 'completion', 15], ['s', 'completion', 15], ['h', 'completion', 15],
    ['e1', 'exam', 0, 2], ['e2', 'exam', 0, 2], ['f', 'exam', 0, 3],
  ].map(([id, role, max, share]) => ({ id, name: id, role, max, share, weight: 0, dropLowest: 0, dropHighest: 0, neverDrop: new Set() })),
  items: cs.map(([id, groupId, possible, score]) => ({ id, groupId, possible, score, state: 'graded' })),
});
test('E31', 'syllabus example: notes + sections done, no homework → exams worth 20/20/30', () => {
  const r = G.current({ ...sel([['n1', 'n', 10, 10], ['s1', 's', 10, 10], ['h1', 'h', 10, 0], ['x1', 'e1', 100, 100], ['x2', 'e2', 100, 100], ['x3', 'f', 100, 100]]), kind: 'selfWeighted' });
  near(r.pct, 100); // homework doesn't hurt: its weight moved to the exams
  eq(r.groups.filter((g) => g.role === 'exam').map((g) => Math.round(g.weight * 100) / 100), [20, 20, 30]);
});
test('E31', 'syllabus example: homework only → exams worth about 24/24/36', () => {
  const r = G.scoreCourse(sel([['n1', 'n', 10, 0], ['s1', 's', 10, 0], ['h1', 'h', 10, 10], ['x1', 'e1', 100, 80], ['x2', 'e2', 100, 80], ['x3', 'f', 100, 80]]), (e) => e.score);
  eq(r.groups.filter((g) => g.role === 'exam').map((g) => Math.round(g.weight * 10) / 10), [24.3, 24.3, 36.4]);
  near(r.pct, 15 + 85 * 0.8); // 83
});
test('E31', 'everything completed, exams 80 / 90 / 85 → 91.75%', () => {
  near(G.scoreCourse(sel([['n1', 'n', 10, 10], ['s1', 's', 10, 10], ['h1', 'h', 10, 10], ['x1', 'e1', 50, 40], ['x2', 'e2', 50, 45], ['x3', 'f', 100, 85]]), (e) => e.score).pct, 91.75); // 45 + 55·(1.6+1.8+2.55)/7
});
test('E30', 'drop lowest only once 3 quizzes are graded', () => {
  const two = mk({ groups: [['Q', 0, 1]], items: [['q1', 'Q', 20, 18], ['q2', 'Q', 20, 10]] });
  two.groups[0].dropMinCount = 3;
  near(G.current(two).pct, 70); // (18+10)/40, nothing dropped
  const three = mk({ groups: [['Q', 0, 1]], items: [['q1', 'Q', 20, 18], ['q2', 'Q', 20, 10], ['q3', 'Q', 20, 20]] });
  three.groups[0].dropMinCount = 3;
  near(G.current(three).pct, 95); // 10 dropped → 38/40
});
const profileCase = async (code) => {
  const { sum } = await sampleSummary(null);
  return sum.courses.find((c) => c.course.autoNick === code);
};
test('E30', 'ACCT 210: professionalism counted, quiz not dropped yet, homework dropped → 90.0%', async () => {
  const c = await profileCase('ACCT 210');
  near(c.pct, 90); // (5·100 + 20·85 + 10·95 + 15·90) / 50
  eq(c.gp, 3.5);
  eq(c.pctSource, 'dashboard'); // Canvas hides this class's total
  eq(c.unmatched.map((e) => e.item.title), ['Getting Started Survey']); // shown, never silently dropped
});
test('E30', 'ACCT 210 best and worst case', async () => {
  const c = await profileCase('ACCT 210');
  near(c.range.best, 96.6667, 0.01); // 5 + 10·29/30 + 15·40/40 + 20·.85 + 20 + 30
  near(c.range.worst, 37.0833, 0.01); // 5 + 10·25/30 + 15·18/40 + 20·.85
});
test('E29', 'RE 150: graded out of 600 → need 77.8% on the rest for your 3.9', async () => {
  const c = await profileCase('R E 150');
  eq(c.course.score, 94.12); // what Canvas shows
  eq(c.required.need, 77.8); // 3.9 = 93% = 558 pts: (80 + 615x) ≥ 558 → x = 77.72% → 77.8
  eq(G.required(c.model, 94).need, 78.7); // and for a 4.0 (564 pts): x = 78.70%
  near(c.pct, 109.0196, 0.01); // on pace: (80 + 192 + 368 + 14.12) / 600
  eq(c.gp, 4);
  eq(c.paceBased, true);
});
// E34 + E35: a class out of 100 points that posts work late. Graded 16/20 (80% pace),
// 10 points posted and open, so 70 points aren't posted yet.
const lateClass = (cfg = { outOf: 100 }) => {
  const course = { id: '7', groups: [{ id: 'g', name: 'Work', weight: 0 }], weighted: false };
  const items = [
    { source: 'canvas', kind: 'assignment', courseId: '7', canvasId: 'a', groupId: 'g', points: 20, sub: { state: 'graded', score: 16 } },
    { source: 'canvas', kind: 'assignment', courseId: '7', canvasId: 'b', groupId: 'g', points: 10, dueAt: pdt('2026-10-09T23:59'), expectsSubmission: true, sub: { state: 'unsubmitted' } },
  ];
  return G.buildCourse(course, items, NOW, cfg);
};
test('E35', 'points not posted yet count at your pace, not as zeros', () => {
  const m = lateClass();
  near(G.current(m).pct, 80); // (16 + 10·.8 + 70·.8) / 100; was 24% when the 70 counted as zeros
  eq(m.unposted, 70);
});
test('E35', 'best, worst and what you need include the unposted points', () => {
  const m = lateClass();
  const r = G.range(m);
  near(r.best, 96); // 16 + 10 + 70
  near(r.worst, 16);
  eq(G.required(m, 90).need, 92.5); // 16 + 80x = 90 → x = 92.5%
});
test('E35', 'nothing changes once everything is posted, and big-impact lists skip the placeholder', () => {
  const m = lateClass({ outOf: 30 });
  eq([m.unposted, m.items.some((e) => e.unposted)], [undefined, false]);
  near(G.current(m).pct, 80); // (16 + 10·.8) / 30
});
test('E34', 'a class total you type in wins over Canvas’s own %', async () => {
  const { canvasReliable } = await import('../lib/gradeSummary.js');
  const course = { score: 24, hideTotals: false };
  eq([canvasReliable(course, {}, false), canvasReliable(course, { outOf: 1000 }, false)], [true, false]);
});
test('F18', 'before your id is known, only your exact full name is you', async () => {
  const { isMe } = await import('../ui/pages/inbox.js');
  const { state } = await import('../ui/store.js');
  const was = state.cache;
  state.cache = { ...(was || {}), profile: { name: 'Jordan', fullName: 'Jordan Park' } };
  try {
    eq([isMe('Jordan Park'), isMe('Jordan Lee'), isMe('Jordan')], [true, false, false]);
  } finally {
    state.cache = was;
  }
});
test('E34', 'a class total you type in turns a points class into “out of” grading', () => {
  eq([lateClass({}).kind, lateClass().kind, lateClass().outOf], ['standard', 'outOf', 100]);
});
test('E29', 'RE 150 scale is the syllabus table as written (94% = 4.0, 61% = 0.7)', async () => {
  const c = await profileCase('R E 150');
  eq([G.gradeFromPercent(c.scale, 94), G.gradeFromPercent(c.scale, 93.9), G.gradeFromPercent(c.scale, 61), G.gradeFromPercent(c.scale, 60.9)], [4, 3.9, 0.7, 0]);
});
test('E31', 'STAT 220 from Canvas data: on pace for 97.06%', async () => {
  const c = await profileCase('STAT 220');
  near(c.pct, 97.0625, 0.01); // 11.25 + 15 + 15 + 58.75 × 0.95 (exams at your 95% average so far)
  eq(c.scaleSource, 'profile'); // standard UW scale, confirmed by course staff
  eq([G.gradeFromPercent(c.scale, 95), G.gradeFromPercent(c.scale, 94.9), G.gradeFromPercent(c.scale, 62), G.gradeFromPercent(c.scale, 61.9)], [4, 3.9, 0.7, 0]);
});
test('E32', 'Canvas’s own % is used when reliable, never for syllabus-rule classes', async () => {
  const { sum } = await sampleSummary(null);
  const by = (n) => sum.courses.find((c) => c.course.autoNick === n);
  eq([by('CSE 143').pctSource, by('MATH 126').pctSource, by('STAT 220').pctSource, by('R E 150').pctSource], ['canvas', 'canvas', 'dashboard', 'dashboard']);
  const off = (await sampleSummary({ useCanvas: false })).sum;
  eq(off.courses.find((c) => c.course.autoNick === 'CSE 143').pctSource, 'dashboard');
});
test('E33', 'profiles match UW course codes with or without spaces', async () => {
  const { findProfile } = await import('../lib/profiles.js');
  eq([findProfile({ code: 'RE 150 A' })?.code, findProfile({ code: 'R E 150 A' })?.code, findProfile({ code: 'ACCT 210 B' })?.code, findProfile({ code: 'STAT 220 A' })?.code, findProfile({ code: 'STAT 390 A' })], ['R E 150', 'R E 150', 'ACCT 210', 'STAT 220', null]);
});
test('E33', 'you can turn the automatic setup off for a class', async () => {
  const { sum } = await sampleSummary({ courses: { 1009: { auto: false } } });
  const c = sum.courses.find((x) => x.course.autoNick === 'R E 150');
  eq([c.profile, c.paceBased], [null, false]);
});


// ---------- Phase 3: course content ----------
group('Course content (F1–F12)');
const CN = await import('../lib/contentNormalize.js');
test('F1', 'Canvas tabs → visible sections and external tools', () => {
  const r = CN.normalizeTabs([{ id: 'home' }, { id: 'files', hidden: true }, { id: 'modules' }, { id: 'context_external_tool_9', label: 'Zoom', type: 'external', html_url: '/courses/1/external_tools/9' }]);
  eq(r.sections, ['home', 'modules']);
  eq(r.tools.map((t) => [t.label, t.url]), [['Zoom', 'https://canvas.uw.edu/courses/1/external_tools/9']]);
});
test('F2', 'announcements: course, read state, author', () => {
  const a = CN.normalizeAnnouncement({ id: 5, title: 'Hi', context_code: 'course_1007', read_state: 'unread', author: { display_name: 'Prof' }, posted_at: '2026-10-01T16:00:00Z', message: '<p>x</p>' });
  eq([a.courseId, a.read, a.author, a.url], ['1007', false, 'Prof', 'https://canvas.uw.edu/courses/1007/discussion_topics/5']);
});
test('F3', 'modules keep order, completion and lock dates', () => {
  const m = CN.normalizeModules([{ id: 2, name: 'B', position: 2, items: [] }, { id: 1, name: 'A', position: 1, state: 'locked', unlock_at: '2026-10-06', items: [{ id: 9, type: 'Page', title: 'P', page_url: 'p', completion_requirement: { completed: true } }, { id: 10, type: 'File', title: 'F', content_details: { locked_for_user: true, unlock_at: '2026-10-06' } }] }]);
  eq(m.map((x) => x.name), ['A', 'B']);
  eq([m[0].items[0].kind, m[0].items[0].completed, m[0].items[1].locked, m[0].items[1].unlockAt], ['page', true, true, '2026-10-06']);
});
test('F5', 'files build a folder tree; types are recognized', () => {
  const { root, byId } = CN.folderTree([CN.normalizeFolder({ id: 1, name: 'course files' }), CN.normalizeFolder({ id: 2, name: 'Slides', parent_folder_id: 1 })], [CN.normalizeFile({ id: 7, display_name: 'b.pdf', folder_id: 2, mime_class: 'pdf' }), CN.normalizeFile({ id: 8, display_name: 'a.docx', folder_id: 1 })]);
  eq([root.folders.map((f) => f.name), root.files.map((f) => f.name), byId['2'].files.map((f) => f.name)], [['Slides'], ['a.docx'], ['b.pdf']]);
  eq([CN.fileKind({ name: 'x.pdf', mimeClass: 'pdf', type: '' }), CN.fileKind({ name: 'x.xlsx', mimeClass: '', type: '' }), CN.formatSize(2400000)], ['pdf', 'sheet', '2.3 MB']);
});
test('F7', 'discussion threads: authors, nesting, unread', () => {
  const t = CN.normalizeThread({ participants: [{ id: 1, display_name: 'Ana' }, { id: 2, display_name: 'Jo' }], unread_entries: [11], view: [{ id: 10, user_id: 1, message: 'a', replies: [{ id: 11, user_id: 2, message: 'b' }] }, { id: 12, deleted: true }] });
  eq([t.length, t[0].author, t[0].replies[0].author, t[0].replies[0].unread, t[0].unread], [1, 'Ana', 'Jo', true, false]);
});
test('F8', 'messages read oldest first with names', () => {
  const c = CN.normalizeConversationDetail({ id: 1, subject: 's', workflow_state: 'read', participants: [{ id: 5, name: 'Prof' }, { id: 6, name: 'Me' }], messages: [{ id: 2, author_id: 5, body: 'reply' }, { id: 1, author_id: 6, body: 'question' }] });
  eq(c.messages.map((m) => [m.author, m.body]), [['Me', 'question'], ['Prof', 'reply']]);
});
test('F4', 'Canvas links inside content open in the dashboard', () => {
  eq(
    [
      '/courses/1008/pages/week-2-videos',
      'https://canvas.uw.edu/courses/1008/assignments/814',
      '/courses/1001/discussion_topics/9301',
      '/courses/1007/assignments/syllabus',
      '/courses/1007/modules',
      'https://example.com/x',
    ].map((u) => CN.routeCanvasLink(u)?.type || null),
    ['page', 'assignment', 'discussion', 'tab', 'tab', null]
  );
});
test('F10', 'office hours become sessions on the right days and times (Pacific)', () => {
  const course = { id: '9', code: 'X 100', name: 'X' };
  const ud = userWithDefaults({ officeHours: { 9: [{ id: 's1', person: 'Prof', days: ['Tue', 'Thu'], start: '13:00', end: '14:00', where: 'BUS 520' }] } });
  // Thu Oct 1 2026, 10 AM: next 14 days → Thu 1, Tue 6, Thu 8, Tue 13
  const s = model.officeHourSessions([course], ud, [], NOW, TZ);
  eq(s.map((x) => x.id.split(':').pop()), ['2026-10-01', '2026-10-06', '2026-10-08', '2026-10-13']);
  eq(s[0].dueAt, '2026-10-01T20:00:00.000Z'); // 1 PM PDT
  eq(model.isOfficeHours(s[0]), true);
});
test('F10', 'sessions after daylight saving ends still start at 1 PM', () => {
  const course = { id: '9', code: 'X 100', name: 'X' };
  const ud = userWithDefaults({ officeHours: { 9: [{ id: 's1', person: 'Prof', days: ['Tue'], start: '13:00', end: '14:00' }] } });
  const s = model.officeHourSessions([course], ud, [], Date.parse('2026-10-31T17:00:00Z'), TZ);
  eq(s[0].dueAt, '2026-11-03T21:00:00.000Z'); // 1 PM PST (UTC-8)
});
test('F10', 'built-in syllabus office hours, and they step aside when Canvas lists its own', () => {
  const acct = { id: '7', code: 'ACCT 210 A', name: 'ACCT 210' };
  const ud = userWithDefaults({});
  ok(model.officeHourSessions([acct], ud, [], NOW, TZ).some((s) => s.title === 'Office hours · Dana Morgan'), 'Morgan from syllabus');
  const canvasOH = [{ courseId: '7', kind: 'event', title: 'Office Hours' }];
  eq(model.officeHourSessions([acct], ud, canvasOH, NOW, TZ).length, 0);
  const hidden = userWithDefaults({ ohHidden: { 'acct-matsumoto': 1 } });
  ok(!model.officeHourSessions([acct], hidden, [], NOW, TZ).some((s) => s.title.includes('Morgan')), 'removed ones stay removed');
});
test('F2', 'sync brings in announcements, inbox, staff, tools and a search index', async () => {
  canvas.setTransport(fixtureTransport(null));
  const sync = await import('../lib/sync.js');
  const data = await sync.fetchEverything();
  const idx = await sync.buildIndex(data.courses);
  const acct = data.courses.find((c) => c.id === '1007');
  eq([data.announcements[0].title, data.conversations.filter((c) => c.unread).length, acct.staff[0].name, acct.staff[0].role], ['No in-person lecture on 10/9', 2, 'Dana Morgan', 'Instructor']); // 2 unread: the sample student's and the owner's
  eq(data.courses.find((c) => c.id === '1001').nav.tools.map((t) => t.label), ['Zoom', 'Gradescope']);
  ok(idx.pages.some((p) => p.title === 'Week 2 videos'), 'pages indexed');
  ok(idx.files.some((f) => f.name === 'PA2 Specification.pdf'), 'files indexed');
  ok(!idx.files.some((f) => f.courseId === '1009'), 'hidden Files sections are skipped');
});


// ---------- Phase 4: planning and notifications ----------
group('Planning (C7, G1–G6, G9)');
const PL = await import('../lib/planning.js');
const NT = await import('../lib/notify.js');
const FO = await import('../lib/focus.js');
const ICS = await import('../lib/ics.js');
const cls = (raws, ud = {}, settings = null) =>
  model.allItems({ courses: [{ id: '5', autoNick: 'CSE 143', isClass: true }], items: raws.map((r) => normalizeAssignment(rawA(r), 5)) }, userWithDefaults(ud), withDefaults(settings), NOW);
test('G4', 'workload: estimates count on the due day; planned work counts on planned days', () => {
  const items = cls([{ id: 1, name: 'A', due_at: pdt('2026-10-03T23:59') }, { id: 2, name: 'B', due_at: pdt('2026-10-05T23:59') }]);
  const ud = userWithDefaults({ estimates: { 'a:1': 120, 'a:2': 180 }, plans: [{ id: 'p1', itemId: 'a:2', day: '2026-10-02', minutes: 90 }, { id: 'p2', itemId: 'a:2', day: '2026-10-04', minutes: 90 }] });
  eq(PL.workloadByDay(items, ud, TZ), { '2026-10-02': 90, '2026-10-04': 90, '2026-10-03': 120 });
});
test('G4', 'finished work doesn’t count', () => {
  const items = cls([{ id: 1, name: 'A', due_at: pdt('2026-10-03T23:59'), submission: { workflow_state: 'submitted', submitted_at: pdt('2026-10-01T09:00') } }]);
  eq(PL.workloadByDay(items, userWithDefaults({ estimates: { 'a:1': 60 } }), TZ), {});
});
test('C16', 'exam countdown: exams and in-person quizzes, soonest first, with days to go', () => {
  const all = model.allItems({ courses: [STAT, ACC], items: [normalizeAssignment(rawA({ id: 90, name: 'Syllabus Quiz', due_at: pdt('2026-10-09T23:59'), submission_types: ['online_quiz'], quiz_id: 20 }), '7')] }, userWithDefaults(), withDefaults(null), WED_OCT_7);
  const list = PL.upcomingTests(all.filter((i) => i.area === 'main'), WED_OCT_7, TZ);
  // Wed Oct 7: ACCT Quiz 1 Wed Oct 14 (7 days), ACCT Exam 1 Thu Oct 22 (15), STAT Exam 1 Fri Oct 30 (23), ACCT Quiz 2 Fri Nov 6 (30), ACCT Exam 2 Tue Nov 17 (41).
  eq(list.map((x) => [x.item.title, x.days]), [['Quiz 1', 7], ['Exam 1', 15], ['Exam 1', 23], ['Quiz 2', 30], ['Exam 2', 41]]);
  ok(!list.some((x) => x.item.title === 'Syllabus Quiz'), 'online quiz is a deadline, not an exam');
});
test('C16', 'R E 150 chapter deadlines (“quizzes and writing”) are deadlines, not exams', () => {
  const all = model.allItems({ courses: [RE], items: [] }, userWithDefaults(), withDefaults(null), WED_OCT_7);
  const ch1 = all.find((i) => i.id === 'syl:9:ch1');
  eq([ch1.type, PL.upcomingTests(all.filter((i) => i.area === 'main'), WED_OCT_7, TZ).length, PL.plannableAhead(ch1)], ['assignment', 0, true]);
});
test('C16', 'past and finished exams drop off', () => {
  const all = model.allItems({ courses: [STAT], items: [] }, userWithDefaults(), withDefaults(null), Date.parse('2026-10-31T09:00:00-07:00'));
  eq(PL.upcomingTests(all.filter((i) => i.area === 'main'), Date.parse('2026-10-31T09:00:00-07:00'), TZ).map((x) => x.item.title), ['Exam 2', 'Final exam']);
});
test('G6', 'Not planned yet: online quizzes yes, in-person quizzes and exams no', () => {
  const online = normalizeAssignment(rawA({ id: 80, name: 'Syllabus Quiz', submission_types: ['online_quiz'], quiz_id: 12 }), '7');
  const paper = normalizeAssignment(rawA({ id: 81, name: 'Quiz 1', submission_types: ['on_paper'] }), '7');
  const hw = normalizeAssignment(rawA({ id: 82, name: 'Chapter 2 Homework', submission_types: ['online_quiz'], quiz_id: 13 }), '7');
  const t = (i) => PL.plannableAhead({ ...i, type: model.detectType(i) });
  eq([t(online), t(paper), t(hw), PL.plannableAhead({ kind: 'event', type: 'exam' })], [true, false, true, false]);
});
test('G6', 'planned for today: listed under Today once, never twice', async () => {
  const { withPlannedToday } = await import('../ui/pages/home.js');
  const { state } = await import('../ui/store.js');
  const saved = state.userdata;
  state.userdata = userWithDefaults({ plans: [{ id: 'p1', itemId: 'later', day: '2026-10-01' }, { id: 'p2', itemId: 'dueToday', day: '2026-10-01' }, { id: 'p3', itemId: 'late', day: '2026-10-01' }] });
  try {
    const g = withPlannedToday({ pinned: [], overdue: [{ id: 'late' }], today: [{ id: 'dueToday' }], week: [{ id: 'later' }, { id: 'other' }], later: [], nodate: [], done: [] }, '2026-10-01');
    eq(g.today.map((i) => [i.id, !!i.plannedToday]), [['dueToday', true], ['later', true]]);
    eq([g.week.map((i) => i.id), g.overdue.map((i) => i.id)], [['other'], ['late']]); // moved, not copied; overdue stays where it is
  } finally {
    state.userdata = saved;
  }
});
test('G5', 'something that already happened (an in-person exam) isn’t suggested', () => {
  const items = cls([{ id: 6, name: 'Paper exam', due_at: pdt('2026-09-29T15:30'), submission_types: ['on_paper'] }, { id: 7, name: 'Today', due_at: pdt('2026-10-01T23:59') }]);
  eq(PL.nextUp(items, userWithDefaults(), { now: NOW, tz: TZ }).map((x) => x.item.title), ['Today']);
});
test('G5', 'next up: least slack first, overdue on top, pins above everything', () => {
  const items = cls([
    { id: 1, name: 'Big paper', due_at: pdt('2026-10-03T23:59') }, // 62h left − 10h = 52h slack
    { id: 2, name: 'Quick quiz', due_at: pdt('2026-10-02T23:59') }, // 38h − 0.5h = 37.5h
    { id: 3, name: 'Late worksheet', due_at: pdt('2026-09-30T23:59') }, // overdue
    { id: 4, name: 'Far project', due_at: pdt('2026-10-20T23:59') },
  ]);
  const ud = userWithDefaults({ estimates: { 'a:1': 600, 'a:2': 30 } });
  eq(PL.nextUp(items, ud, { now: NOW, tz: TZ }).map((x) => x.item.title), ['Late worksheet', 'Quick quiz', 'Big paper', 'Far project']);
  const pinned = userWithDefaults({ estimates: { 'a:1': 600 }, nextPinned: { 'a:4': 1 } });
  eq(PL.nextUp(items, pinned, { now: NOW, tz: TZ })[0].item.title, 'Far project');
});
test('G5', 'closed work (can’t be turned in) isn’t suggested', () => {
  const items = cls([{ id: 1, name: 'Closed HW', due_at: pdt('2026-09-29T23:59'), lock_at: pdt('2026-09-30T23:59') }, { id: 2, name: 'Late OK', due_at: pdt('2026-09-30T23:59'), lock_at: pdt('2026-10-03T23:59') }]);
  eq(PL.nextUp(items, userWithDefaults({}), { now: NOW, tz: TZ }).map((x) => x.item.title), ['Late OK']);
});
test('G5', 'reasons read in plain words; skipped items wait', () => {
  const items = cls([{ id: 2, name: 'Quick quiz', due_at: pdt('2026-10-02T23:59') }]);
  eq(PL.nextUp(items, userWithDefaults({ estimates: { 'a:2': 180 } }), { now: NOW, tz: TZ, impact: { 'a:2': 0.042 } })[0].reason, 'Due tomorrow · ~3h · worth 4.2% of the grade');
  eq(PL.nextUp(items, userWithDefaults({ nextSkipped: { 'a:2': NOW + 3600000 } }), { now: NOW, tz: TZ }).length, 0);
});
test('G1', 'weeks start Monday; months fill 6 rows', () => {
  eq(PL.weekKeys('2026-10-01'), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  const m = PL.monthKeys('2026-11-15');
  eq([m.length, m[0], m[41]], [42, '2026-10-26', '2026-12-06']); // Nov 1 2026 is a Sunday
});
test('G9', 'weeks across the daylight-saving change stay 7 days', () => eq(PL.weekKeys('2026-11-02'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']));
test('C7', 'quarter timeline spans the term in whole weeks from a Monday', () => {
  const items = cls([{ id: 1, name: 'A', due_at: pdt('2026-09-25T23:59') }, { id: 2, name: 'B', due_at: pdt('2026-12-10T23:59') }]);
  const q = PL.quarterWeeks([{ termEnd: pdt('2026-12-18T23:59') }], items, NOW, TZ);
  eq([q.weeks[0], q.weeks[q.weeks.length - 1], q.today], ['2026-09-21', '2026-12-14', '2026-10-01']);
});
test('H2', 'badge: due today; red when something is overdue', () => {
  const today = cls([{ id: 1, name: 'A', due_at: pdt('2026-10-01T23:59') }]);
  eq(PL.badgeFor(today, NOW, TZ), { text: '1', color: 'accent', title: '1 due today' });
  const both = cls([{ id: 1, name: 'A', due_at: pdt('2026-10-01T23:59') }, { id: 2, name: 'B', due_at: pdt('2026-09-30T23:59') }]);
  eq(PL.badgeFor(both, NOW, TZ).color, 'red');
  eq(PL.badgeFor(cls([{ id: 2, name: 'B', due_at: pdt('2026-09-30T23:59') }]), NOW, TZ), { text: '1', color: 'red', title: '1 overdue' });
  eq(PL.badgeFor(cls([]), NOW, TZ).text, '');
});

group('Notifications (H1, H3–H7)');
const sum5 = (pct, atRisk = []) => ({ courses: [{ course: { id: '5' }, pct }], atRisk });
const NS = (patch = {}) => withDefaults({ notify: { reminderHours: [24, 2], quietStart: '22:00', quietEnd: '08:00', morningTime: '08:00', ...patch } });
const cacheOf = (raws, anns = []) => ({ items: raws.map((r) => normalizeAssignment(rawA(r), 5)), announcements: anns, courses: [] });
const p4eval = (prev, raws, { anns = [], pct = 90, atRisk = [], now = NOW, settings = NS(), ud = {}, system } = {}) => {
  const cache = cacheOf(raws, anns);
  const items = model.allItems({ ...cache, courses: [{ id: '5', autoNick: 'CSE 143', isClass: true }] }, userWithDefaults(ud), settings, now);
  return NT.evaluate({ prev, cache, items, summary: { ...sum5(pct, atRisk), system }, settings, now, tz: TZ, nickOf: () => 'CSE 143' });
};
test('H4', 'nothing fires on the first run', () => {
  const r = p4eval({}, [{ id: 1, name: 'A', due_at: pdt('2026-10-01T12:00') }], { anns: [{ id: 'ann:1', courseId: '5', title: 'Hi' }] });
  eq(r.notes.filter((n) => !n.key.startsWith('morning')).length, 0);
});
test('H4', 'a new assignment gets one alert; several are grouped', () => {
  const first = p4eval({}, [{ id: 1, name: 'A' }]).next;
  const one = p4eval(first, [{ id: 1, name: 'A' }, { id: 2, name: 'PA3', due_at: pdt('2026-10-09T23:59') }]);
  eq(one.notes.filter((n) => n.key.startsWith('new')).map((n) => [n.title, n.message, n.target]), [['New assignment · CSE 143', 'PA3 · due Oct 9', '#/open/item/a:2']]);
  const many = p4eval(first, [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]);
  eq(many.notes.filter((n) => n.key.startsWith('new')).map((n) => n.title), ['2 new assignments']);
});
test('H5', 'new announcements alert, except for classes you muted', () => {
  const first = p4eval({}, [], { anns: [] }).next;
  const a = { id: 'ann:9', courseId: '5', title: 'Exam moved', read: false };
  eq(p4eval(first, [], { anns: [a] }).notes.filter((n) => n.key.startsWith('ann')).map((n) => n.title), ['Announcement · CSE 143']);
  eq(p4eval(first, [], { anns: [a], settings: NS({ mutedAnnouncementCourses: { 5: true } }) }).notes.filter((n) => n.key.startsWith('ann')).length, 0);
});
test('H6', 'a posted grade shows the score and how the class grade moved', () => {
  const first = p4eval({}, [{ id: 1, name: 'Quiz', points_possible: 20 }], { pct: 88 }).next;
  const r = p4eval(first, [{ id: 1, name: 'Quiz', points_possible: 20, submission: { workflow_state: 'graded', score: 18 } }], { pct: 89.5 });
  eq(r.notes.filter((n) => n.key.startsWith('grade')).map((n) => [n.title, n.message]), [['Grade posted · CSE 143', 'Quiz: 18 / 20 (90%)\nClass grade 88.0% → 89.5%']]);
  const hidden = p4eval(first, [{ id: 1, name: 'Quiz', points_possible: 20, submission: { workflow_state: 'graded', score: 18 } }], { settings: NS({ hideScores: true }) });
  eq(hidden.notes.filter((n) => n.key.startsWith('grade')).map((n) => [n.title, n.message]), [['New grade · CSE 143', 'Quiz']]);
});
test('H7', 'at-risk fires once when a class newly drops, again only after it recovers', () => {
  const risky = [{ course: { id: '5' }, gp: 3.5, target: 3.9, required: { status: 'needed', need: 96.1 } }];
  const s0 = p4eval({}, []).next;
  const r1 = p4eval(s0, [], { atRisk: risky, system: 'uw' });
  eq(r1.notes.filter((n) => n.key.startsWith('risk')).map((n) => n.message), ['3.5, 0.4 below your 3.9 target. You need 96.1% on what’s left for a 3.9.']);
  eq(p4eval(r1.next, [], { atRisk: risky }).notes.filter((n) => n.key.startsWith('risk')).length, 0);
  const recovered = p4eval(r1.next, [], { atRisk: [] }).next;
  eq(p4eval(recovered, [], { atRisk: risky }).notes.filter((n) => n.key.startsWith('risk')).length, 1);
});
test('H1', 'deadline reminder at 24h and at 2h, once each, not for submitted work', () => {
  const due = pdt('2026-10-02T09:00'); // 23h after NOW
  const s0 = p4eval({}, [{ id: 7, name: 'Lab' }], { now: NOW - 3 * 86400000 }).next; // seen days earlier
  const r24 = p4eval(s0, [{ id: 7, name: 'Lab', due_at: due }]);
  eq(r24.notes.filter((n) => n.key.startsWith('due')).map((n) => n.title), ['Due in 23h · CSE 143']);
  eq(p4eval(r24.next, [{ id: 7, name: 'Lab', due_at: due }], { now: NOW + 3600000 }).notes.filter((n) => n.key.startsWith('due')).length, 0);
  // 7:30 AM is inside quiet hours (10 PM–8 AM), so the 2h reminder waits until after 8.
  eq(p4eval(r24.next, [{ id: 7, name: 'Lab', due_at: due }], { now: Date.parse(due) - 90 * 60000 }).notes.filter((n) => n.key.startsWith('due')).length, 0);
  const r2 = p4eval(r24.next, [{ id: 7, name: 'Lab', due_at: due }], { now: Date.parse(due) - 30 * 60000 });
  eq(r2.notes.filter((n) => n.key.startsWith('due')).map((n) => n.title), ['Due in 30m · CSE 143']);
  const done = p4eval(s0, [{ id: 7, name: 'Lab', due_at: due, submission: { workflow_state: 'submitted', submitted_at: pdt('2026-10-01T09:00') } }]);
  eq(done.notes.filter((n) => n.key.startsWith('due')).length, 0);
});
test('H1', 'quiet hours hold reminders until they end', () => {
  const night = Date.parse('2026-10-02T06:00:00Z'); // 11 PM PDT
  const due = pdt('2026-10-02T09:00');
  const s0 = p4eval({}, [{ id: 7, name: 'Lab' }], { now: night - 86400000 * 3 }).next;
  const r = p4eval(s0, [{ id: 7, name: 'Lab', due_at: due }], { now: night });
  eq(r.notes.filter((n) => n.key.startsWith('due')).length, 0);
  eq(p4eval(r.next, [{ id: 7, name: 'Lab', due_at: due }], { now: Date.parse('2026-10-02T15:05:00Z') }).notes.filter((n) => n.key.startsWith('due')).length, 1); // 8:05 AM
  eq([NT.inQuietHours(night, '22:00', '08:00', TZ), NT.inQuietHours(NOW, '22:00', '08:00', TZ)], [true, false]);
});
test('H3', 'morning summary once a day, from your time until noon', () => {
  const at8 = Date.parse('2026-10-01T15:05:00Z'); // 8:05 AM PDT
  const r = p4eval({ initialized: true }, [{ id: 1, name: 'Essay', due_at: pdt('2026-10-01T23:59') }], { now: at8 });
  eq(r.notes.filter((n) => n.key.startsWith('morning')).map((n) => n.message), ['1 thing due today: Essay']);
  eq(p4eval(r.next, [], { now: at8 + 600000 }).notes.filter((n) => n.key.startsWith('morning')).length, 0);
  eq(p4eval({ initialized: true }, [], { now: Date.parse('2026-10-01T20:00:00Z') }).notes.filter((n) => n.key.startsWith('morning')).length, 0); // 1 PM: too late today
});

group('Focus timer and export (G7, G8)');
test('G7', 'work → break → work, logging only work time', () => {
  const f = FO.startFocus({ id: 'a:1', title: 'PA2' }, 0, { work: 25, brk: 5 });
  eq([f.phase, f.endsAt], ['work', 25 * 60000]);
  const a = FO.advance(f, 25 * 60000);
  eq([a.focus.phase, a.logged, a.note.title], ['break', 1500, 'Break time']);
  const b = FO.advance(a.focus, 30 * 60000);
  eq([b.focus.phase, b.logged, b.note.title], ['work', 0, 'Back to it']);
  eq(FO.advance(f, 10 * 60000).logged, 0); // not over yet
  eq(FO.stopFocus(f, 10 * 60000), 600); // stopping early still counts the 10 minutes
});
test('G8', 'calendar file: one event per due date, plans as work blocks, safe text', () => {
  const text = ICS.buildIcs({
    items: [{ id: 'a:1', title: 'PA2, sorting; part 1', dueAt: '2026-10-02T06:59:00Z', courseId: '5', url: 'https://canvas.uw.edu/courses/5/assignments/1' }],
    plans: [{ id: 'p1', itemId: 'a:1', day: '2026-10-01', start: '14:00', minutes: 90 }, { id: 'p2', itemId: 'a:1', day: '2026-10-02', start: null, minutes: 60 }],
    nickOf: () => 'CSE 143',
    titleOf: () => 'PA2',
    now: NOW,
  });
  ok(text.startsWith('BEGIN:VCALENDAR\r\n'), 'starts right');
  ok(text.includes('SUMMARY:Due: PA2\\, sorting\\; part 1 (CSE 143)'), 'escaped title');
  ok(text.includes('DTEND:20261002T065900Z'), 'ends at the due time');
  ok(text.includes('DTSTART:20261001T140000') && text.includes('DTEND:20261001T153000'), 'timed plan');
  ok(text.includes('DTSTART;VALUE=DATE:20261002') && text.includes('DTEND;VALUE=DATE:20261003'), 'all-day plan');
  eq(text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), true);
});

// ---------- run ----------
group('Dates from your syllabi (G10, G11)');
const SY = await import('../lib/syllabus.js');
const STAT = { id: '8', code: 'STAT 220 A', name: 'STAT 220 A Au 26: Introduction To Statistics', sections: ['STAT 220 A', 'STAT 220 AF'], autoNick: 'STAT 220', isClass: true };
const RE = { id: '9', code: 'R E 150 A', name: 'R E 150 A Au 26', sections: ['R E 150 A'], autoNick: 'R E 150', isClass: true };
const ACC = { id: '7', code: 'ACCT 210 A', name: 'ACCT 210 A Au 26', sections: ['ACCT 210 A', 'ACCT 210 AC'], autoNick: 'ACCT 210', isClass: true };
const sched = (courses, items = [], opts = {}) => SY.syllabusSchedule(courses, items, { tz: TZ, ...opts });
const byId = (list, id) => list.find((i) => i.id === id);
test('G10', 'STAT 220 exams at the syllabus times (PDT before Nov 1, PST after)', () => {
  const { add } = sched([STAT]);
  eq(byId(add, 'syl:8:e1').dueAt, '2026-10-30T22:30:00.000Z'); // Fri 3:30 PM PDT
  eq(byId(add, 'syl:8:e1').endAt, '2026-10-30T23:50:00.000Z'); // 4:50 PM
  eq(byId(add, 'syl:8:e2').dueAt, '2026-11-20T23:30:00.000Z'); // Fri 3:30 PM PST
  eq(byId(add, 'syl:8:final').dueAt, '2026-12-17T22:30:00.000Z'); // Thu 2:30 PM PST
  eq(byId(add, 'syl:8:final').location, 'SCI 260');
});
test('G10', 'exams are typed as exams and show on main views', () => {
  const items = model.allItems({ courses: [STAT], items: [] }, userWithDefaults(), withDefaults(null), NOW);
  const e1 = byId(items, 'syl:8:e1');
  eq([e1.type, e1.area, e1.kind], ['exam', 'main', 'event']);
});
test('G10', 'a Canvas exam on the same day: no duplicate', () => {
  const canvasExam = normalizeAssignment(rawA({ id: 31, name: 'Exam 1', due_at: pdt('2026-10-30T15:30') }), '8');
  const { add, patch } = sched([STAT], [canvasExam]);
  eq([!!byId(add, 'syl:8:e1'), patch['a:31']], [false, undefined]);
});
test('G10', 'a Canvas exam on another day: syllabus date kept, difference explained', () => {
  const canvasExam = normalizeAssignment(rawA({ id: 31, name: 'Exam 1', due_at: pdt('2026-11-04T15:30') }), '8');
  const e1 = byId(sched([STAT], [canvasExam]).add, 'syl:8:e1');
  eq([e1.dueAt, e1.canvasDate], ['2026-10-30T22:30:00.000Z', canvasExam.dueAt]);
  ok(/Canvas lists “Exam 1” on Nov 4/.test(e1.descriptionHtml), e1.descriptionHtml);
});
test('G10', 'an undated Canvas exam gets the syllabus date', () => {
  const undated = normalizeAssignment(rawA({ id: 32, name: 'Midterm 2', due_at: null }), '8');
  const items = model.allItems({ courses: [STAT], items: [undated] }, userWithDefaults(), withDefaults(null), NOW);
  const it = byId(items, 'a:32');
  eq([it.dueAt, it.dateFrom, !!byId(items, 'syl:8:e2')], ['2026-11-20T23:30:00.000Z', 'syllabus', false]);
});
test('G10', '"Final project" is not the final exam', () => {
  const proj = normalizeAssignment(rawA({ id: 33, name: 'Final Project', due_at: pdt('2026-12-10T23:59') }), '8');
  ok(byId(sched([STAT], [proj]).add, 'syl:8:final'), 'final exam still added');
});
test('G10', 'R E 150: 9 chapter deadlines at 11:59 PM, Chapter 7 on Monday 11/30', () => {
  const dl = sched([RE]).add.filter((i) => i.kind === 'note');
  eq(dl.length, 9);
  eq(byId(dl, 'syl:9:ch1').dueAt, '2026-10-17T06:59:00.000Z'); // Fri 10/16 11:59 PM PDT
  eq(byId(dl, 'syl:9:ch7').dueAt, '2026-12-01T07:59:00.000Z'); // Mon 11/30 11:59 PM PST
  eq(byId(dl, 'syl:9:ch9').title, 'Chapter 9: Real Estate Settlement · quizzes and writing');
});
test('G10', 'a deadline is skipped when Canvas has work due that day', () => {
  const q = normalizeAssignment(rawA({ id: 41, name: 'Chapter 1 Quiz 1', due_at: pdt('2026-10-16T23:59') }), '9');
  const dl = sched([RE], [q]).add;
  eq([dl.length, !!byId(dl, 'syl:9:ch1')], [8, false]);
});
test('G10', 'ACCT 210: quizzes in quiz section (12:30–1:20), midterms in lecture (10–11:20)', () => {
  const add = sched([ACC]).add;
  const q1 = byId(add, 'syl:7:q1');
  eq([q1.day, q1.allDay, q1.dueAt, q1.endAt, q1.syllabusType], ['2026-10-14', false, '2026-10-14T19:30:00.000Z', '2026-10-14T20:20:00.000Z', 'quiz']); // PDT
  eq(byId(add, 'syl:7:e1').dueAt, '2026-10-22T17:00:00.000Z'); // Thu 10 AM PDT
  eq(byId(add, 'syl:7:e2').dueAt, '2026-11-17T18:00:00.000Z'); // Tue 10 AM PST
  eq(byId(add, 'syl:7:e2').location, 'BUS 100 (Main Auditorium)');
  eq([byId(add, 'syl:7:e1').day, byId(add, 'syl:7:e2').day, byId(add, 'syl:7:q2').day, byId(add, 'syl:7:q3').day], ['2026-10-22', '2026-11-17', '2026-11-06', '2026-12-04']);
});
test('G10', 'ACCT 210 final: Sat 12/12, 8:30–10:20 AM', () => {
  const f = byId(sched([ACC]).add, 'syl:7:final');
  eq([f.allDay, f.dueAt, f.endAt], [false, '2026-12-12T16:30:00.000Z', '2026-12-12T18:20:00.000Z']); // PST
});
test('C5', 'homework set up as a Canvas quiz is still homework', () => {
  const hw = normalizeAssignment(rawA({ id: 73, name: 'Chapter 3 Homework', submission_types: ['online_quiz'], quiz_id: 10 }), '7');
  eq([hw.isQuiz, model.detectType(hw), model.detectType(normalizeAssignment(rawA({ id: 74, name: 'Quiz 2', submission_types: ['online_quiz'], quiz_id: 11 }), '7'))], [true, 'assignment', 'assignment']);
});
test('C5', 'quizzes you take online on your own time are assignments; quizzes given in class are quizzes', () => {
  const online = normalizeAssignment(rawA({ id: 75, name: 'Syllabus Quiz', submission_types: ['online_quiz'], quiz_id: 14 }), '7');
  const paper = normalizeAssignment(rawA({ id: 76, name: 'Quiz 1', submission_types: ['on_paper'] }), '7');
  eq([model.detectType(online), model.detectType(paper), model.detectType({ title: 'Quiz 1', kind: 'event', syllabusType: 'quiz' })], ['assignment', 'quiz', 'quiz']);
});
test('G10', 'a quiz given in quiz section: same time and room, said plainly', () => {
  const q1 = byId(sched([ACC]).add, 'syl:7:q1');
  eq(q1.location, 'Your quiz section room');
  ok(/Given during your quiz section \(AC\): same time and room as usual/.test(q1.descriptionHtml), q1.descriptionHtml);
});
test('C14', 'an in-person quiz starts at its time (a calendar block), like an in-person exam', async () => {
  const { startsRather } = await import('../ui/components.js');
  const paperQuiz = { kind: 'assignment', type: 'quiz', expectsSubmission: false };
  const onlineQuiz = { kind: 'assignment', type: 'quiz', expectsSubmission: true };
  eq([startsRather(paperQuiz), startsRather(onlineQuiz)], [true, false]);
});
test('G10', 'ACCT 210 quizzes are typed as quizzes', () => {
  const items = model.allItems({ courses: [ACC], items: [] }, userWithDefaults(), withDefaults(null), NOW);
  eq([byId(items, 'syl:7:q1').type, byId(items, 'syl:7:e1').type], ['quiz', 'exam']);
});
test('G10', 'ACCT 210: 12 Canvas homework deadlines, skipped on days Canvas lists', () => {
  const hw = sched([ACC]).add.filter((i) => i.kind === 'note');
  eq(hw.length, 12);
  eq([byId(hw, 'syl:7:hw-ch2').title, byId(hw, 'syl:7:hw-ch2').dueAt], ['Ch 2 homework (Canvas)', '2026-10-15T06:59:00.000Z']);
  const canvasHw = normalizeAssignment(rawA({ id: 51, name: 'Chapter 2 Homework', due_at: pdt('2026-10-14T23:59') }), '7');
  eq(sched([ACC], [canvasHw]).add.filter((i) => i.kind === 'note').length, 11);
});
test('G10', 'a quiz Canvas already graded isn’t added again', () => {
  const q = normalizeAssignment(rawA({ id: 53, name: 'Quiz 1', due_at: pdt('2026-09-30T10:30'), submission: { workflow_state: 'graded', score: 18 } }), '7');
  eq(!!byId(sched([ACC], [q]).add, 'syl:7:q1'), false);
});
test('G10', 'an undated Canvas "Quiz 1" gets the syllabus date', () => {
  const q = normalizeAssignment(rawA({ id: 52, name: 'Quiz 1', due_at: null }), '7');
  const { add, patch } = sched([ACC], [q]);
  eq([patch['a:52'].day, patch['a:52'].dueAt, !!byId(add, 'syl:7:q1')], ['2026-10-14', '2026-10-14T19:30:00.000Z', false]);
});
test('G11', 'ACCT 210: 19 lectures and 19 quiz sections, each with its topic', () => {
  const add = sched([ACC]).add;
  eq(add.filter((i) => i.id.startsWith('syl:7:lec:')).length, 19);
  eq(add.filter((i) => i.id.startsWith('syl:7:qs:')).length, 19);
  eq(byId(add, 'syl:7:lec:2026-10-06').title, 'Lecture A · Ch 2 – Financing and Investing Transactions');
  const qs = byId(add, 'syl:7:qs:2026-10-07');
  eq([qs.title, qs.allDay, qs.dueAt], ['Quiz section AC · Ch 2', false, '2026-10-07T19:30:00.000Z']);
  eq(byId(add, 'syl:7:lec:2026-10-06').endAt, '2026-10-06T18:20:00.000Z'); // 11:20 AM PDT
  ok(/With Jordan West/.test(qs.descriptionHtml), qs.descriptionHtml);
  eq([byId(add, 'syl:7:lec:2026-11-26').title, byId(add, 'syl:7:lec:2026-11-26').cancelled], ['No class · Thanksgiving', true]);
  ok(!byId(add, 'syl:7:lec:2026-10-22') && !byId(add, 'syl:7:qs:2026-10-14'), 'exam and quiz days have no regular meeting');
});
test('G8', 'a date with no time exports as an all-day event', () => {
  const q1 = { ...byId(sched([ACC]).add, 'syl:7:q1'), allDay: true };
  const ics = ICS.buildIcs({ items: [q1], plans: [], nickOf: () => 'ACCT 210', titleOf: () => '', now: NOW });
  ok(ics.includes('DTSTART;VALUE=DATE:20261014') && ics.includes('DTEND;VALUE=DATE:20261015'), ics);
});
test('G11', 'quiz section found from your Canvas sections', () => {
  const secs = { AA: {}, AF: {} };
  eq(SY.quizSectionOf({ sections: ['STAT 220 A', 'STAT 220 AF'] }, secs), 'AF');
  eq(SY.quizSectionOf({ sections: ['STAT 220 A AF Au 26'] }, secs), 'AF');
  eq(SY.quizSectionOf({ sections: ['STAT 220 A'] }, secs), null);
});
test('G11', 'lectures: Wed and Fri 9/30–12/11, 22 slots minus 2 exam days = 20', () => {
  const lec = sched([STAT]).add.filter((i) => i.id.startsWith('syl:8:lec:'));
  eq(lec.length, 20);
  ok(!byId(lec, 'syl:8:lec:2026-10-30') && !byId(lec, 'syl:8:lec:2026-11-20'), 'no lecture on exam days');
  const l = byId(lec, 'syl:8:lec:2026-10-07');
  eq([l.title, l.dueAt, l.location], ['Lecture · Sourcing Data + Basics of Probability', '2026-10-07T22:30:00.000Z', 'SCI 260']);
});
test('G11', 'no-class days and the 10/9 video lecture', () => {
  const add = sched([STAT]).add;
  const vet = byId(add, 'syl:8:lec:2026-11-11');
  eq([vet.title, vet.cancelled, vet.location], ['No class · Veterans Day', true, null]);
  const vid = byId(add, 'syl:8:lec:2026-10-09');
  eq([vid.title, vid.cancelled, vid.location], ['Lecture videos (no in-person lecture) · Sourcing Data + Basics of Probability', false, null]);
  eq(byId(add, 'syl:8:qs:2026-11-26').title, 'No class · Thanksgiving');
});
test('G11', 'quiz section AF: Tue and Thu 10/1–12/10 = 21, at 4:30 PM in SOC 234', () => {
  const qs = sched([STAT]).add.filter((i) => i.id.startsWith('syl:8:qs:'));
  eq(qs.length, 21);
  const q = byId(qs, 'syl:8:qs:2026-10-01');
  eq([q.title, q.dueAt, q.location], ['Quiz section AF · Intro to Data', '2026-10-01T23:30:00.000Z', 'SOC 234']);
});
test('G11', 'unknown section: no quiz section times are guessed', () => {
  const add = sched([{ ...STAT, sections: ['STAT 220 A'] }]).add;
  eq(add.filter((i) => i.id.startsWith('syl:8:qs:')).length, 0);
});
test('G11', 'class meetings stay off main views; both toggles turn things off', () => {
  const items = model.allItems({ courses: [STAT], items: [] }, userWithDefaults(), withDefaults(null), NOW);
  eq(byId(items, 'syl:8:lec:2026-10-07').area, 'classes');
  const off = model.allItems({ courses: [STAT], items: [] }, userWithDefaults(), withDefaults({ features: { syllabusDates: false, classSchedule: false } }), NOW);
  eq(off.filter((i) => i.source === 'syllabus').length, 0);
});
test('B7', 'both syllabus features have a Settings toggle', () => ok(['syllabusDates', 'classSchedule'].every((id) => FEATURES.some((f) => f.id === id))));

// ---------- Phase 5 ----------
group('Writing with formatting (F13, F14)');
const RT = await import('../lib/richtext.js');
test('F14', 'bold and italic', () => eq(RT.toHtml('Hello **bold** and *it*'), '<p>Hello <strong>bold</strong> and <em>it</em></p>'));
test('F14', 'lines and paragraphs', () => eq(RT.toHtml('line1\nline2\n\npara2'), '<p>line1<br>line2</p><p>para2</p>'));
test('F14', 'bulleted and numbered lists', () => eq(RT.toHtml('- a\n* b\n1. c'), '<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>'));
test('F14', 'markup you type is escaped, never run', () => eq(RT.toHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'));
test('F14', 'web addresses become links (trailing period left out)', () => eq(RT.toHtml('see https://canvas.uw.edu/x.'), '<p>see <a href="https://canvas.uw.edu/x">https://canvas.uw.edu/x</a>.</p>'));
test('F14', 'math with spaced asterisks stays as typed', () => eq(RT.toHtml('2 * 3 * 4'), '<p>2 * 3 * 4</p>'));
test('F14', 'blank text is blank', () => eq([RT.isBlank('  \n '), RT.isBlank('x')], [true, false]));

group('Submit from the dashboard (F13)');
const SB = await import('../lib/submit.js');
const asg = (over = {}, sub = undefined) => normalizeAssignment(rawA({ id: 77, name: 'Lab', due_at: pdt('2026-10-20T23:59'), ...over, ...(sub ? { submission: sub } : {}) }), '1004');
// Records every request, then answers with the sample data.
function recording() {
  const calls = [];
  const fx = fixtureTransport(null);
  canvas.setTransport(async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    return fx(url, opts);
  });
  return calls;
}
test('F13', 'file uploads and text entry can be submitted here', () => {
  eq(SB.submitOptions(asg(), NOW).modes, ['online_upload']);
  eq(SB.submitOptions(asg({ submission_types: ['online_text_entry', 'online_upload'] }), NOW).modes, ['online_upload', 'online_text_entry']);
});
test('F13', 'other online types link to Canvas; paper ones show nothing', () => {
  eq(SB.submitOptions(asg({ submission_types: ['online_url'] }), NOW), { modes: [], reason: 'other' });
  eq(SB.submitOptions(asg({ submission_types: ['on_paper'] }), NOW), null);
});
test('F13', 'closed, locked, not open yet, out of attempts', () => {
  eq(SB.submitOptions(asg({ lock_at: pdt('2026-09-30T23:59') }), NOW).reason, 'closed');
  eq(SB.submitOptions(asg({ locked_for_user: true }), NOW).reason, 'locked');
  eq(SB.submitOptions(asg({ unlock_at: pdt('2026-10-05T00:00') }), NOW).reason, 'notYet');
  eq(SB.submitOptions(asg({ allowed_attempts: 2 }, { workflow_state: 'submitted', submitted_at: pdt('2026-09-29T10:00'), attempt: 2 }), NOW).reason, 'noAttempts');
});
test('F13', 'resubmitting: 1 of 3 attempts used leaves 2', () => {
  const o = SB.submitOptions(asg({ allowed_attempts: 3 }, { workflow_state: 'submitted', submitted_at: pdt('2026-09-29T10:00'), attempt: 1 }), NOW);
  eq([o.reason, o.attemptsLeft, o.resubmit], [null, 2, true]);
});
test('F13', 'attempts and file types are kept from Canvas', () => {
  const a = asg({ allowed_attempts: 3, allowed_extensions: ['pdf', 'docx'] });
  eq([a.allowedAttempts, a.allowedExtensions, asg().allowedAttempts], [3, ['pdf', 'docx'], -1]);
});
test('F13', 'text entry: one request, with your formatting as HTML', async () => {
  const calls = recording();
  const res = await SB.submitText(asg({ id: 44, submission_types: ['online_text_entry'] }), 'My **answer**');
  const post = calls.filter((c) => c.method === 'POST');
  eq(post.length, 1);
  eq(new URL(post[0].url).pathname, '/api/v1/courses/1004/assignments/44/submissions');
  eq([post[0].body.get('submission[submission_type]'), post[0].body.get('submission[body]')], ['online_text_entry', '<p>My <strong>answer</strong></p>']);
  eq([res.workflow_state, typeof res.attempt], ['submitted', 'number']);
});
test('F13', 'files: ask where, upload each to canvas.uw.edu, then submit both ids', async () => {
  const calls = recording();
  const steps = [];
  const res = await SB.submitFiles(asg({ id: 45 }), [new File(['a'], 'a.pdf', { type: 'application/pdf' }), new File(['bb'], 'b.pdf', { type: 'application/pdf' })], (i, n) => steps.push(`${i}/${n}`));
  const post = calls.filter((c) => c.method === 'POST').map((c) => new URL(c.url));
  eq(post.map((u) => u.pathname.replace(/\d+$/, 'N')), ['/api/v1/courses/1004/assignments/45/submissions/self/files', '/files_api/upload/N', '/api/v1/courses/1004/assignments/45/submissions/self/files', '/files_api/upload/N', '/api/v1/courses/1004/assignments/45/submissions']);
  ok(post.every((u) => u.origin === 'https://canvas.uw.edu'), 'only canvas.uw.edu');
  const last = calls[calls.length - 1].body;
  eq([last.get('submission[submission_type]'), last.getAll('submission[file_ids][]').length, steps, res.workflow_state], ['online_upload', 2, ['1/2', '2/2'], 'submitted']);
});
test('F13', 'an upload server other than canvas.uw.edu is refused before anything is sent to it', async () => {
  const calls = recording();
  let err = null;
  try {
    await SB.submitFiles(asg({ id: 46 }), [new File(['x'], 'offsite.pdf', { type: 'application/pdf' })]);
  } catch (e) {
    err = e;
  }
  ok(err instanceof canvas.ForeignHostError, `expected ForeignHostError, got ${err}`);
  ok(!calls.some((c) => !c.url.startsWith('https://canvas.uw.edu')), 'no request left canvas.uw.edu');
  ok(!calls.some((c) => c.url.endsWith('/assignments/46/submissions')), 'nothing was submitted');
  ok(/Submit this one in Canvas/.test(SB.describeError(err)), SB.describeError(err));
});
test('F13', 'Instructure’s file storage is the only other upload host allowed', () => {
  const ok1 = (u) => canvas.isUploadHost(new URL(u));
  eq(
    ['https://inst-fs-pdx-prod.inscloudgate.net/files?token=x', 'https://inst-fs-iad-prod.inscloudgate.net/', 'http://inst-fs-pdx-prod.inscloudgate.net/', 'https://inscloudgate.net/', 'https://evil.inscloudgate.net/', 'https://inst-fs-pdx-prod.inscloudgate.net.evil.com/', 'https://example.com/'].map(ok1),
    [true, true, false, false, false, false, false]
  );
});
test('F13', 'uploads to Instructure: no Canvas login sent there, then confirmed on canvas.uw.edu', async () => {
  const calls = [];
  const fx = fixtureTransport(null);
  canvas.setTransport(async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', external: !!opts.external, body: opts.body });
    return fx(url, opts);
  });
  const res = await SB.submitFiles(asg({ id: 48 }), [new File(['%PDF'], 'instfs-essay.pdf', { type: 'application/pdf' })]);
  eq(calls.map((c) => [c.method, new URL(c.url).host, c.external]), [
    ['POST', 'canvas.uw.edu', false], // where should it go?
    ['POST', 'inst-fs-pdx-prod.inscloudgate.net', true], // the file, without cookies or the security token
    ['GET', 'canvas.uw.edu', false], // confirm the upload
    ['POST', 'canvas.uw.edu', false], // submit
  ]);
  const fileId = new URL(calls[2].url).pathname.split('/').pop();
  eq([calls[3].body.getAll('submission[file_ids][]'), res.workflow_state], [[fileId], 'submitted']);
});
test('F13', 'a confirmation link pointing anywhere but canvas.uw.edu is never followed', async () => {
  const calls = recording();
  eq(await SB.fileIdOf({ location: 'https://example.com/api/v1/files/5' }), null);
  eq(calls.length, 0);
});
test('F13', 'Canvas refusing shows Canvas’s reason', async () => {
  recording();
  let err = null;
  try {
    await SB.submitText(asg({ id: 47, submission_types: ['online_text_entry'] }), 'FAIL');
  } catch (e) {
    err = e;
  }
  eq(SB.describeError(err), 'Canvas refused the submission: This assignment is not accepting submissions.');
});
test('F13', 'the status updates to Submitted right away', () => {
  const s = SB.subFromResponse({ state: 'not_submitted', attempt: null, missing: true }, { submitted_at: '2026-10-06T20:00:00Z', attempt: 1 });
  eq([s.state, s.submittedAt, s.attempt, s.missing], ['submitted', '2026-10-06T20:00:00Z', 1, false]);
});

group('Reply to discussions (F14)');
test('F14', 'a reply posts to the topic and shows up in the thread', async () => {
  recording();
  await write.post('/api/v1/courses/1001/discussion_topics/9302/entries', { message: '<p>Count me in</p>' });
  const thread = CN.normalizeThread(await canvas.get('/api/v1/courses/1001/discussion_topics/9302/view'));
  const mine = thread.find((e) => e.html === '<p>Count me in</p>');
  eq(mine?.author, 'Test Student');
});
test('F14', 'a reply to someone’s post lands under that post', async () => {
  recording();
  await write.post('/api/v1/courses/1001/discussion_topics/9301/entries/3/replies', { message: '<p>Thanks!</p>' });
  const thread = CN.normalizeThread(await canvas.get('/api/v1/courses/1001/discussion_topics/9301/view'));
  ok(thread.find((e) => e.id === '3').replies.some((r) => r.html === '<p>Thanks!</p>'), 'nested under post 3');
});
test('F14', 'a refused post raises an error with Canvas’s reason', async () => {
  recording();
  let err = null;
  try {
    await write.post('/api/v1/courses/1001/discussion_topics/9301/entries', { message: 'FAIL' });
  } catch (e) {
    err = e;
  }
  eq([err?.status, err?.detail], [403, 'Posting is closed for this discussion']);
});

group('Past quarter archive (I1)');
const AR = await import('../lib/archive.js');
const DAY = 86400000;
test('I1', 'a quarter counts as ended a day after its end date', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  eq([AR.hasEnded({ termEnd: new Date(now - 12 * 3600000).toISOString() }, now), AR.hasEnded({ termEnd: new Date(now - 25 * 3600000).toISOString() }, now), AR.hasEnded({ termEnd: null }, now)], [false, true, false]);
});
test('I1', 'last quarter’s class is saved with its final grade and every assignment', async () => {
  canvas.setTransport(fixtureTransport(null));
  const { fetchEverything } = await import('../lib/sync.js');
  const data = await fetchEverything();
  const archive = AR.updateArchive(null, { data, summaryById: { 1010: { pct: 90.83, gp: 3.5, credits: 5 } }, userdata: userWithDefaults({ notes: { 'a:1111': 'study series', 'course:1010': 'great prof' } }), now: Date.parse('2026-10-06T12:00:00Z') });
  eq(Object.keys(archive), ['Summer 2026']); // Autumn 2026 hasn't ended
  const c = archive['Summer 2026'].courses['1010'];
  eq([c.finalPct, c.finalGp, c.credits, c.canvasScore], [90.83, 3.5, 5, 90.83]);
  // 10 + 10 + 8 + 10 + 88 + 92 = 218 of 240 points = 90.83%
  eq(c.assignments.map((a) => a.score), [10, 10, 8, 88, 10, 92]);
  eq(c.assignments.reduce((s, a) => s + a.score, 0) / c.assignments.reduce((s, a) => s + a.points, 0), 218 / 240);
  eq([c.notes, c.courseNote], [[{ title: 'Midterm', text: 'study series' }], 'great prof']);
});
test('I1', 'ended classes leave the current lists, with their items', () => {
  const data = { courses: [{ id: '1' }, { id: '2' }], items: [{ id: 'a', courseId: '1' }, { id: 'b', courseId: '2' }, { id: 'c', courseId: null }], announcements: [{ id: 'x', courseId: '1' }] };
  const out = AR.withoutCourses(data, new Set(['1']));
  eq([out.courses.map((c) => c.id), out.items.map((i) => i.id), out.announcements.length], [['2'], ['b', 'c'], 0]);
});
test('I1', 'a class Canvas stops listing after its term is saved from the last refresh; a dropped class isn’t', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  const ended = { id: '9', code: 'BIO 180', name: 'BIO 180 A Sp 26', term: 'Spring 2026', termEnd: '2026-06-12T07:00:00Z', score: 88, isClass: true };
  const dropped = { id: '8', code: 'CHEM 142', name: 'CHEM 142 A Au 26', term: 'Autumn 2026', termEnd: new Date(now + 60 * DAY).toISOString(), isClass: true };
  const archive = AR.updateArchive({}, { data: { courses: [], items: [] }, prevCache: { courses: [ended, dropped], items: [] }, now });
  eq([Object.keys(archive), Object.keys(archive['Spring 2026'].courses)], [['Spring 2026'], ['9']]);
});
test('I1', 'a saved quarter isn’t overwritten once Canvas stops listing it', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  const prev = { 'Spring 2026': { term: 'Spring 2026', courses: { 9: { id: '9', finalGp: 3.4, savedAt: 1 } } } };
  const a = AR.updateArchive(prev, { data: { courses: [], items: [] }, prevCache: { courses: [{ id: '9', term: 'Spring 2026', termEnd: '2026-06-12T07:00:00Z' }], items: [] }, now });
  eq(a['Spring 2026'].courses['9'].finalGp, 3.4);
});
test('I1', 'newest quarter first', () => eq(AR.archivedTerms({ a: { term: 'Spring 2026', termEnd: '2026-06-12' }, b: { term: 'Summer 2026', termEnd: '2026-08-21' } }).map((t) => t.term), ['Summer 2026', 'Spring 2026']));
test('I1', 'one click adds the quarter to GPA history: classes with a grade, rounded to 0.1, 5 credits if unknown', () => {
  const t = { term: 'Summer 2026', courses: { 1: { id: '1', nick: 'MATH 125', isClass: true, finalGp: 3.46, credits: null }, 2: { id: '2', nick: 'Club', isClass: false, finalGp: 4.0, credits: 1 }, 3: { id: '3', nick: 'HIST 101', isClass: true, finalGp: null, credits: 5 } } };
  const q = AR.toPastQuarter(t, 'q1');
  eq([q.name, q.fromArchive, q.courses.map((c) => [c.name, c.credits, c.grade, c.counts])], ['Summer 2026', 'Summer 2026', [['MATH 125', 5, 3.5, true]]]);
  near(G.gpaOf(G.pastGpaEntries([q])), 3.5);
});
test('I1', 'the archive is in backups', () => {
  const b = makeBackup({ archive: { 'Summer 2026': { term: 'Summer 2026', courses: {} } } });
  eq(Object.keys(b.data), ['archive']);
});

group('Pin, notes and hide everywhere (I2)');
const MK = await import('../lib/marks.js');
test('I2', 'keys for every kind; announcement ids aren’t double-prefixed', () =>
  eq([MK.MARK_KEY.announcement('ann:5'), MK.MARK_KEY.announcement('5'), MK.MARK_KEY.page('1', 'week-1'), MK.MARK_KEY.file('1', 9), MK.MARK_KEY.discussion('1', 3), MK.MARK_KEY.conversation(4), MK.MARK_KEY.module('1', 8), MK.MARK_KEY.course('1')], ['ann:5', 'ann:5', 'page:1|week-1', 'file:1|9', 'topic:1|3', 'conv:4', 'module:1|8', 'course:1']));
test('I2', 'unpinning and unhiding removes the mark entirely', () => {
  const m = {};
  MK.setMark(m, 'file:1|9', { type: 'file', title: 'Spec.pdf' }, { pinned: 5 });
  MK.setMark(m, 'file:1|9', {}, { hidden: 6 });
  eq(m['file:1|9'], { type: 'file', title: 'Spec.pdf', pinned: 5, hidden: 6 });
  MK.setMark(m, 'file:1|9', {}, { pinned: null });
  MK.setMark(m, 'file:1|9', {}, { hidden: null });
  eq(m, {});
});
test('I2', 'one Pinned list across every kind, newest first', () => {
  const ud = { pins: { 'a:1': 10 }, marks: { 'ann:2': { type: 'announcement', title: 'Exam room', pinned: 30 }, 'file:1|9': { type: 'file', title: 'Spec.pdf', pinned: 20 }, 'page:1|x': { type: 'page', title: 'Hidden page', hidden: 40 } } };
  eq(MK.pinnedEverything(ud, [{ id: 'a:1', title: 'HW 1', courseId: '1' }, { id: 'a:2', title: 'HW 2' }]).map((p) => [p.type, p.title]), [['announcement', 'Exam room'], ['file', 'Spec.pdf'], ['item', 'HW 1']]);
  eq(MK.hiddenMarks(ud).map((m) => m.key), ['page:1|x']);
});
test('I2', 'pins and hides on everything are in backups (they live in userdata)', () => ok(BACKUP_KEYS.includes('userdata'), 'userdata backed up'));
test('D6', 'a saved note shows when its box is drawn again', async () => {
  const { h } = await import('../ui/dom.js');
  eq(h('textarea', { value: 'remember this' }).value, 'remember this');
});
test('B7', 'Phase 5 features each have a Settings toggle', () => ok(['submit', 'discussionReplies', 'archive'].every((id) => FEATURES.some((f) => f.id === id))));

group('Completed and daily streak (D8, D9)');
const PR = await import('../lib/progress.js');
// NOW is Thu Oct 1, 10:00 AM PDT.
const done = (at, extra = {}) => ({ workflow_state: 'submitted', submitted_at: pdt(at), ...extra });
const week = () => [
  { id: 1, name: 'Late one', due_at: pdt('2026-09-25T23:59'), submission: done('2026-09-26T09:00', { late: true }) },
  { id: 2, name: 'Fri work', due_at: pdt('2026-09-26T23:59'), submission: done('2026-09-26T20:00') },
  { id: 3, name: 'Missed', due_at: pdt('2026-09-27T23:59'), submission: { workflow_state: 'unsubmitted', missing: true } },
  { id: 4, name: 'Mon work', due_at: pdt('2026-09-28T23:59'), submission: done('2026-09-28T21:00') },
  { id: 5, name: 'Tue work', due_at: pdt('2026-09-29T17:00'), submission: done('2026-09-29T16:00') },
  { id: 6, name: 'Paper exam', due_at: pdt('2026-09-29T15:30'), submission_types: ['on_paper'] }, // happens; not a task
  { id: 7, name: 'Today', due_at: pdt('2026-10-01T23:59') },
];
test('D9', 'streak: 2 days (Mon, Tue), Wed had nothing due, today still open; best 2', () => {
  const s = PR.streak(cls(week()), userWithDefaults(), NOW, TZ);
  eq([s.current, s.best, s.today.state, s.today.total], [2, 2, 'open', 1]);
  const st = Object.fromEntries(s.recent.filter((d) => d.key >= '2026-09-25').map((d) => [d.key, d.state]));
  eq(st, { '2026-09-25': 'missed', '2026-09-26': 'done', '2026-09-27': 'missed', '2026-09-28': 'done', '2026-09-29': 'done', '2026-09-30': 'none', '2026-10-01': 'open' });
});
test('D9', 'finishing today’s work extends the streak to 3', () => {
  const ud = userWithDefaults({ done: { 'a:7': true }, doneAt: { 'a:7': Date.parse(pdt('2026-10-01T09:30')) } });
  const s = PR.streak(cls(week(), ud), ud, NOW, TZ);
  eq([s.current, s.best, s.today.state], [3, 3, 'done']);
});
test('D9', 'checking something off after its day counts as late', () => {
  const ud = userWithDefaults({ done: { 'a:3': true }, doneAt: { 'a:3': Date.parse(pdt('2026-09-28T10:00')) } });
  const items = cls(week(), ud);
  eq(PR.finishedOnTime(items.find((i) => i.id === 'a:3'), ud, TZ), false);
  eq(PR.streak(items, ud, NOW, TZ).current, 2);
});
test('D9', 'checked off by midnight counts; excused counts', () => {
  const ud = userWithDefaults({ done: { 'a:3': true }, doneAt: { 'a:3': Date.parse(pdt('2026-09-27T23:59')) } });
  eq(PR.finishedOnTime(cls(week(), ud).find((i) => i.id === 'a:3'), ud, TZ), true);
  const ex = cls([{ id: 9, name: 'Excused', due_at: pdt('2026-09-27T23:59'), submission: { excused: true } }]);
  eq(PR.finishedOnTime(ex[0], userWithDefaults(), TZ), true);
});
test('D9', 'what counts as a task', () => {
  const items = cls([...week(), { id: 8, name: 'Handwritten HW', due_at: pdt('2026-09-30T15:30'), submission_types: ['on_paper'] }]);
  const t = (id) => PR.isTask(items.find((i) => i.id === id));
  eq([t('a:2'), t('a:6'), t('a:8')], [true, false, false]); // a turned-in assignment; an in-person exam; paper homework you haven't checked off
  const ud = userWithDefaults({ done: { 'a:8': true } });
  eq(PR.isTask(cls([{ id: 8, name: 'Handwritten HW', due_at: pdt('2026-09-30T15:30'), submission_types: ['on_paper'] }], ud)[0]), true); // checked off: it counts
});
test('D9', 'no tasks at all: no streak, nothing broken', () => eq(PR.streak([], userWithDefaults(), NOW, TZ).current, 0));
test('D8', 'completed list: everything turned in or checked off, newest first, with how', () => {
  const ud = userWithDefaults({ done: { 'a:7': true }, doneAt: { 'a:7': Date.parse(pdt('2026-10-01T09:30')) } });
  const list = PR.completedItems(cls([...week(), { id: 10, name: 'Graded one', due_at: pdt('2026-09-20T23:59'), points_possible: 20, submission: { workflow_state: 'graded', submitted_at: pdt('2026-09-20T12:00'), score: 18 } }], ud), ud);
  eq(list.map((x) => x.item.title), ['Today', 'Tue work', 'Mon work', 'Fri work', 'Late one', 'Graded one']);
  eq(list.map((x) => PR.completionLabel(x.item)), ['Checked off', 'Turned in', 'Turned in', 'Turned in', 'Turned in late', 'Graded · 18/20']);
});
test('B7', 'Completed and streak have Settings toggles', () => ok(['completedList', 'streak'].every((id) => FEATURES.some((f) => f.id === id))));
test('A10', 'when you checked things off is in backups (userdata)', () => ok('doneAt' in userWithDefaults({}), 'doneAt default'));

// ---------- Phase 6 ----------
group('Mochi’s greeting (J3)');
const MO = await import('../lib/mochi.js');
const withoutMissed = () => week().filter((r) => r.id !== 3);
test('J3', 'morning, with something overdue: worried, overdue first, then today', () => {
  const g = MO.greeting({ items: cls(week()), name: 'Sam Rivera', now: NOW, tz: TZ });
  eq([g.title, g.mood], ['Good morning, Sam!', 'worried']);
  eq(g.lines, ['1 thing overdue: Missed.', '1 thing due today. First up: Today at 11:59 PM.']);
});
test('J3', 'everything due today done: celebrating', () => {
  const ud = userWithDefaults({ done: { 'a:7': true } });
  const g = MO.greeting({ items: cls(withoutMissed(), ud), now: NOW, tz: TZ });
  eq([g.mood, g.lines[0]], ['celebrate', 'Everything due today is done. Nice work!']);
});
test('J3', 'late at night with nothing overdue: sleepy', () => {
  const late = Date.parse('2026-10-01T23:30:00-07:00');
  const g = MO.greeting({ items: cls(withoutMissed()), now: late, tz: TZ });
  eq([g.title, g.mood], ['Still up?', 'sleepy']);
});
test('J3', 'the next class today, with room', () => {
  const items = model.allItems({ courses: [STAT], items: [] }, userWithDefaults(), withDefaults(null), NOW);
  const g = MO.greeting({ items: items.filter((i) => i.area === 'main'), classes: items.filter((i) => i.area === 'classes'), now: NOW, tz: TZ });
  ok(g.lines.includes('Next class: STAT 220 Quiz section AF at 4:30 PM in SOC 234.'), g.lines.join(' / '));
});

group('Ask Mochi: built-in answers (J4)');
const AK = await import('../lib/ask.js');
const COURSES4 = [{ id: '8', nick: 'STAT 220' }, { id: '7', nick: 'ACCT 210' }, { id: '9', nick: 'R E 150' }, { id: '5', nick: 'CSE 143' }];
const course = (q) => AK.findCourse(AK.normalize(q), COURSES4)?.nick || null;
test('J4', 'classes by name, subject or everyday words', () =>
  eq(['how am i doing in accounting', 'stats quiz section', 'real estate deadlines', 'r e 150 quiz', 'stat220', 'cse homework', 'are you there'].map(course), ['ACCT 210', 'STAT 220', 'R E 150', 'R E 150', 'STAT 220', 'CSE 143', null]));
test('J4', 'dates: today, tomorrow, weekdays, next week, 11/27, Nov 26', () => {
  const r = (q) => AK.findRange(AK.normalize(q), NOW, TZ); // NOW is Thu Oct 1
  eq([r('today').from, r('tomorrow').from, r('friday').from, r('thursday').from, r('next tuesday').from, r('11/27').from, r('nov 26th').from, r('1/12').from], ['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-01', '2026-10-06', '2026-11-27', '2026-11-26', '2027-01-12']);
  eq([r('next week').from, r('next week').to, r('this week').from, r('this week').to], ['2026-10-05', '2026-10-11', '2026-10-01', '2026-10-04']);
  eq(r('what is due'), null);
});
test('J4', '“quiz section” is a class meeting, not a quiz', () => eq([AK.meetingKind(AK.normalize('my stat quiz section')), AK.meetingKind(AK.normalize('when is my quiz')), AK.meetingKind(AK.normalize('lecture tomorrow'))], ['quiz section', null, 'lecture']));
const statData = (now) => {
  const all = model.allItems({ courses: [STAT], items: [] }, userWithDefaults(), withDefaults(null), now);
  return { now, tz: TZ, items: all.filter((i) => i.area === 'main'), classes: all.filter((i) => i.area === 'classes'), courses: [{ id: '8', nick: 'STAT 220' }] };
};
test('J4', 'why no STAT quiz section next week (asked Tue Nov 17): Thanksgiving Thursday, Tuesday still on', () => {
  const a = AK.answer('Why don’t I have a STAT quiz section next week?', statData(Date.parse('2026-11-17T10:00:00-08:00')));
  eq(a.text, 'No STAT 220 quiz section on Thu, Nov 26 (Thanksgiving). You still have 1 quiz section next week: Tue, Nov 24 at 4:30 PM.');
  eq(a.list.map((x) => [x.title, x.sub]), [['No class · Thanksgiving', 'STAT 220 · Thu, Nov 26, 4:30 PM']]);
});
test('J4', 'why no lecture on an exam day: the exam takes the slot', () => {
  const a = AK.answer('why is there no stat lecture on 10/30', statData(NOW));
  eq(a.list.map((x) => x.title), ['Exam 1']);
  eq(a.text, 'On Fri, Oct 30, your lecture is Exam 1: same time (3:30 PM) and place, SCI 260, but you’re taking the exam.');
});
const accData = (now) => {
  const all = model.allItems({ courses: [ACC], items: [] }, userWithDefaults(), withDefaults(null), now);
  return { now, tz: TZ, items: all.filter((i) => i.area === 'main'), classes: all.filter((i) => i.area === 'classes'), courses: [{ id: '7', nick: 'ACCT 210' }] };
};
const WED_OCT_7 = Date.parse('2026-10-07T10:00:00-07:00');
test('J4', 'why no accounting quiz section next week on Wednesday: Quiz 1 is in quiz section that day', () => {
  const a = AK.answer('why don’t i have an accounting quiz section next week on wednesday', accData(WED_OCT_7));
  eq(a.text, 'On Wed, Oct 14, your quiz section is Quiz 1: same time (12:30 PM) and place, but you’re taking the quiz.');
  eq(a.list.map((x) => x.title), ['Quiz 1']);
});
test('J4', 'the same question for the whole week gives the reason, then what’s still on', () => {
  const a = AK.answer('why don’t i have an accounting quiz section next week', accData(WED_OCT_7));
  eq(a.text, 'On Wed, Oct 14, your quiz section is Quiz 1: same time (12:30 PM) and place, but you’re taking the quiz. You still have 1 quiz section next week: Fri, Oct 16 at 12:30 PM.');
});
test('J4', 'homework due that day (even if Canvas made it a quiz) doesn’t replace quiz section', () => {
  const d = accData(WED_OCT_7);
  const all = model.allItems({ courses: [ACC], items: [normalizeAssignment(rawA({ id: 72, name: 'Chapter 2 Homework', due_at: pdt('2026-10-14T23:59'), submission_types: ['online_quiz'], quiz_id: 9 }), '7')] }, userWithDefaults(), withDefaults(null), WED_OCT_7);
  const a = AK.answer('why don’t i have an accounting quiz section on wednesday next week', { ...d, items: all.filter((i) => i.area === 'main') });
  eq(a.list.map((x) => x.title), ['Quiz 1']);
});
test('J4', 'a day the class never meets says which days it does', () => {
  const a = AK.answer('why is there no accounting quiz section on tuesday', accData(WED_OCT_7)); // Tue Oct 13
  eq(a.text, 'ACCT 210 quiz sections meet on Wednesdays and Fridays, so there isn’t one on Tue, Oct 13.');
});
test('J4', '“next week on Wednesday” means that one day', () => eq(AK.findRange(AK.normalize('next week on wednesday'), NOW, TZ), { from: '2026-10-07', to: '2026-10-07', label: 'Wed, Oct 7' }));
test('J4', 'next exam', () => {
  const a = AK.answer('When’s my next exam?', statData(NOW));
  eq([a.text, a.list[0].title, a.list[0].sub], ['Your next exams:', 'Exam 1', 'STAT 220 · Fri, Oct 30, 3:30 PM · SCI 260']);
});
test('J4', 'where and when is a class', () => {
  const a = AK.answer('where is my stat lecture tomorrow', statData(NOW));
  eq([a.text, a.list[0].sub], ['STAT 220 lecture tomorrow:', 'Fri, Oct 2, 3:30 PM · SCI 260']);
});
test('J4', 'grades for one class', () => {
  const a = AK.answer('how am I doing in stats', { now: NOW, tz: TZ, items: [], courses: [{ id: '8', nick: 'STAT 220' }], grades: { system: 'uw', courses: [{ course: { id: '8', nick: 'STAT 220' }, pct: 97.4, gp: 4.0, target: 3.9 }] } });
  eq(a.text, 'STAT 220: 97.4% (4.0). On track for your 3.9.');
  const b = AK.answer('how am I doing in stats', { now: NOW, tz: TZ, items: [], courses: [{ id: '8', nick: 'STAT 220' }], grades: { system: 'letterPM', courses: [{ course: { id: '8', nick: 'STAT 220' }, pct: 91.2, gp: 3.7, target: 3.7 }] } });
  eq(b.text, 'STAT 220: 91.2% (A−). On track for your 3.7.'); // K3
});
test('J4', 'what’s due today, overdue, and what to work on', () => {
  const data = { now: NOW, tz: TZ, items: cls(week()), courses: [{ id: '5', nick: 'CSE 143' }], ud: userWithDefaults() };
  const due = AK.answer('what’s due today', data);
  eq([due.text, due.list.map((x) => x.title)], ['1 thing due today:', ['Today']]);
  const late = AK.answer('anything overdue?', data);
  eq([late.text, late.list.map((x) => x.title)], ['1 overdue:', ['Missed']]);
  eq(AK.answer('what should I work on next', data).list.map((x) => x.title), ['Missed', 'Today']); // overdue work you can still turn in comes first (G5)
});
test('J4', 'hello lists examples; nonsense goes to the AI (or a friendly fallback)', () => {
  ok(/^Hi!/.test(AK.answer('hi', { now: NOW, tz: TZ }).text), 'hello');
  eq(AK.answer('what is the meaning of life', { now: NOW, tz: TZ, items: [], courses: [] }), null);
});

group('No grade until something is graded (E7)');
test('E7', 'ACCT with nothing graded: n/a, not 100% from the assumed professionalism points', async () => {
  const { summarize } = await import('../lib/gradeSummary.js');
  const cache = { courses: [{ ...ACC, groups: [], score: null }], items: [normalizeAssignment(rawA({ id: 70, name: 'Ch 1 homework', due_at: pdt('2026-10-09T23:59') }), '7')] };
  const sum = summarize({ cache, items: model.allItems(cache, userWithDefaults(), withDefaults(null), NOW), settings: withDefaults(null), grades: null, now: NOW });
  const c = sum.courses[0];
  eq([c.noGradesYet, c.pct, c.gp, c.atRisk, sum.quarter.gpa], [true, null, null, false, null]);
});
test('E7', 'one graded assignment and the grade shows', async () => {
  const { summarize } = await import('../lib/gradeSummary.js');
  const graded = normalizeAssignment(rawA({ id: 71, name: 'Ch 1 homework', due_at: pdt('2026-09-29T23:59'), assignment_group_id: 9, submission: { workflow_state: 'graded', submitted_at: pdt('2026-09-29T20:00'), score: 9 } }), '7');
  const cache = { courses: [{ ...ACC, groups: [], score: null }], items: [graded] };
  const c = summarize({ cache, items: model.allItems(cache, userWithDefaults(), withDefaults(null), NOW), settings: withDefaults(null), grades: null, now: NOW }).courses[0];
  eq([c.noGradesYet, c.pct != null], [false, true]);
});

test('E33', 'ACCT’s class details open on every tab, with the assumed professionalism shown (not a crash)', async () => {
  const { summarize } = await import('../lib/gradeSummary.js');
  const { renderGradeDrawer } = await import('../ui/gradeDrawer.js');
  const { ui } = await import('../ui/actions.js');
  const graded = normalizeAssignment(rawA({ id: 71, name: 'Ch 1 homework', due_at: pdt('2026-09-29T23:59'), submission: { workflow_state: 'graded', submitted_at: pdt('2026-09-29T20:00'), score: 9 } }), '7');
  const cache = { courses: [{ ...ACC, groups: [], score: null }], items: [graded] };
  const grades = summarize({ cache, items: model.allItems(cache, userWithDefaults(), withDefaults(null), NOW), settings: withDefaults(null), grades: null, now: NOW });
  const ctx = { grades, now: NOW, tz: TZ, colorOf: () => null, nickOf: () => 'ACCT 210', allItems: [], items: [] };
  const text = (nodes) => [nodes].flat(9).filter(Boolean).map((n) => n.textContent || '').join(' ');
  const saved = ui.gradeTab;
  try {
    for (const tab of ['overview', 'assignments', 'setup']) {
      ui.gradeTab = tab;
      const out = text(renderGradeDrawer('grade', '7', ctx));
      if (tab === 'assignments') ok(/Communication & professionalism · not on Canvas · assumed/.test(out) && /1 graded so far: 9 of 10 points/.test(out), out.slice(0, 300));
    }
  } finally {
    ui.gradeTab = saved;
  }
});
test('E22', 'points lost never lists a built-in assumption', () => {
  const course = { items: [{ id: 'manual:prof', manual: true, state: 'graded', possible: 100, score: 95, item: null }, { id: 'x', state: 'graded', possible: 10, score: 8, item: { title: 'HW' } }], groups: [] };
  eq(G.pointsLost({ ...course, kind: 'standard', weighted: false }).map((x) => x.e.id), ['x']);
});

test('J4', 'example questions fit right now, and Mochi can answer every one', () => {
  const d = { ...statData(Date.parse('2026-11-17T10:00:00-08:00')), grades: { courses: [{ course: { id: '8' }, pct: 92.1, gp: 3.7 }] } };
  const qs = AK.suggestQuestions(d, 6);
  eq(qs.slice(0, 2), ['Why is there no STAT 220 quiz section on Nov 26?', 'When is STAT 220 Exam 2?']);
  ok(qs.includes('How am I doing in STAT 220?'), qs.join(' / '));
  for (const q of qs) ok(AK.answer(q, d), `no answer for: ${q}`);
  ok(/No STAT 220 quiz section on Thu, Nov 26 \(Thanksgiving\)/.test(AK.answer(qs[0], d).text), AK.answer(qs[0], d).text);
});
test('J4', 'no cancellation coming up: no “why is there no…” suggestion', () => {
  ok(!AK.suggestQuestions(statData(NOW), 6).some((q) => q.startsWith('Why')), 'nothing cancelled in the next two weeks of Oct 1');
});

group('Ask Mochi: on-device AI (J5)');
const SC = await import('../lib/scheduleContext.js');
test('J5', 'the AI gets a compact, local summary: today, due work, cancelled meetings', () => {
  const d = statData(Date.parse('2026-11-20T09:00:00-08:00'));
  const text = SC.scheduleContext({ ...d, courses: [{ nick: 'STAT 220', name: 'Introduction To Statistics' }] });
  ok(text.startsWith('Today is Fri, Nov 20, 2026'), text.slice(0, 60));
  ok(text.includes('Thu, Nov 26 4:30 PM: STAT 220 No class · Thanksgiving [CANCELLED]'), 'cancelled meeting listed');
  ok(text.includes('Exam 2'), 'exam listed');
});
test('J5', 'the summary is capped so it fits the on-device model', () => {
  const d = statData(NOW);
  ok(SC.scheduleContext({ ...d, days: 90, maxChars: 400 }).length <= 400 + 20, 'capped');
});
test('J5', 'the AI is told to answer only from the schedule', () => ok(/ONLY from the schedule/.test(SC.SYSTEM_PROMPT), 'grounded'));

group('Look and feel (J1, J2, J6, J7)');
test('J1', 'soft pink is the default color theme; classic is kept', () => eq([withDefaults(null).palette, withDefaults({ palette: 'classic' }).palette], ['pink', 'classic']));
test('B7', 'Phase 6 features each have a Settings toggle', () => ok(['roundedType', 'mochi', 'askMochi', 'celebrations'].every((id) => FEATURES.some((f) => f.id === id))));


group('Phase 9: groups and messages');
test('K25', 'only the inbox’s own writes count as messages', () =>
  eq(
    [
      ['POST', '/api/v1/conversations'],
      ['PUT', 'https://canvas.uw.edu/api/v1/conversations/8201'],
      ['POST', '/api/v1/conversations/8201/add_message?x=1'],
      ['PUT', '/api/v1/conversations'], // Canvas's batch update: can delete
      ['POST', '/api/v1/conversations/8201'],
      ['PUT', '/api/v1/conversations/8201/add_message'],
      ['DELETE', '/api/v1/conversations/8201'],
      ['POST', '/api/v1/conversations/8201/add_recipients'],
      ['POST', '/api/v1/courses/1/discussion_topics'],
      ['POST', '/api/v1/conversations/../courses/1/x'],
    ].map(([m, u]) => canvas.isMessageWrite(u, m)),
    [true, true, true, false, false, false, false, false, false, false]
  ));
test('K25', 'public build sends and updates messages, refuses every other write and any delete', async () => {
  let sent = 0;
  canvas.setTransport(async () => (sent++, { json: {} }));
  const tryIt = async (fn) => { try { await fn(); return 'sent'; } catch (e) { return e.name; } };
  const U = 'https://canvas.uw.edu/api/v1';
  try {
    const r = await asPublic(async () => [
      await tryIt(() => canvas.send(`${U}/conversations`, { method: 'POST' })),
      await tryIt(() => canvas.send(`${U}/conversations/8201`, { method: 'PUT' })),
      await tryIt(() => canvas.send(`${U}/conversations/8201/add_message`, { method: 'POST' })),
      await tryIt(() => canvas.send(`${U}/conversations/8201`, { method: 'DELETE' })),
      await tryIt(() => canvas.send(`${U}/conversations/8201/add_recipients`, { method: 'POST' })),
      await tryIt(() => canvas.send(`${U}/conversations`, { method: 'PUT', body: 'conversation_ids[]=8201&event=destroy' })),
      await tryIt(() => canvas.send(`${U}/courses/1/discussion_topics/3/entries`, { method: 'POST' })),
    ]);
    eq([r, sent], [['sent', 'sent', 'sent', 'ReadOnlyError', 'ReadOnlyError', 'ReadOnlyError', 'ReadOnlyError'], 3]);
  } finally {
    canvas.setTransport(fixtureTransport(null));
  }
});
test('K25', 'messaging is on in the public build; submit and replies stay off', async () => {
  const { feat } = await import('../ui/components.js');
  eq(await asPublic(() => [feat('inbox'), feat('sendMessages'), feat('groups'), feat('submit')]), [true, true, true, false]);
});
test('F17', 'each inbox view lists the right conversations', async () => {
  const M = await import('../lib/canvasMessages.js');
  canvas.setTransport(fixtureTransport(null));
  const ids = async (scope) => (await M.listConversations(scope)).map((c) => c.id).filter((id) => id >= 8200 && id < 8300); // the generic sample inbox (owner-data may add more)
  const r = [await ids('inbox'), await ids('unread'), await ids('starred'), await ids('archived')];
  eq(r, [['8201', '8202'], ['8201'], [], []]);
});
test('F17', 'star, archive and mark unread change the views; then put back', async () => {
  const M = await import('../lib/canvasMessages.js');
  canvas.setTransport(fixtureTransport(null));
  const ids = async (scope) => (await M.listConversations(scope)).map((c) => c.id).filter((id) => id >= 8200 && id < 8300); // the generic sample inbox (owner-data may add more)
  try {
    await M.setStarred('8202', true);
    await M.setState('8201', 'archived');
    const after = [await ids('inbox'), await ids('starred'), await ids('archived')];
    const one = (await M.listConversations('archived')).find((c) => c.id === '8201');
    eq([after, one.archived, one.unread], [[['8202'], ['8202'], ['8201']], true, false]);
  } finally {
    await M.setStarred('8202', false);
    await M.setState('8201', 'unread');
  }
  eq(await ids('unread'), ['8201']);
});
test('F17', 'conversations know their class or group', () => {
  const { normalizeConversation } = CN;
  const a = normalizeConversation({ id: 1, workflow_state: 'archived', context_code: 'group_4401', participants: [] });
  const b = normalizeConversation({ id: 2, workflow_state: 'unread', starred: true, context_code: 'course_1001', participants: [] });
  eq([a.groupId, a.courseId, a.archived, b.courseId, b.groupId, b.unread, b.starred], ['4401', null, true, '1001', null, true, true]);
});
test('F18', 'a new message goes to Canvas with its people, class and text', async () => {
  const M = await import('../lib/canvasMessages.js');
  let seen = null;
  canvas.setTransport(async (url, opts = {}) => {
    if (opts.method === 'POST') seen = { url: new URL(url).pathname, to: opts.body.getAll('recipients[]'), subject: opts.body.get('subject'), body: opts.body.get('body'), ctx: opts.body.get('context_code'), group: opts.body.get('group_conversation') };
    return { json: [{ id: 1, subject: 'Q', workflow_state: 'read', participants: [] }] };
  });
  try {
    await M.sendMessage({ recipients: ['course_1001_teachers', '502'], subject: 'Q', body: 'Hi', contextCode: 'course_1001' });
    eq(seen, { url: '/api/v1/conversations', to: ['course_1001_teachers', '502'], subject: 'Q', body: 'Hi', ctx: 'course_1001', group: 'true' });
  } finally {
    canvas.setTransport(fixtureTransport(null));
  }
});
test('F18', 'sending and replying show up in the sample inbox; a refusal says why', async () => {
  const M = await import('../lib/canvasMessages.js');
  canvas.setTransport(fixtureTransport(null));
  const [made] = await M.sendMessage({ recipients: ['501'], subject: 'Office hours?', body: 'Are you in today?', contextCode: 'course_1001' });
  const r = await M.reply(made.id, 'Thanks!');
  const sent = (await M.listConversations('sent')).map((c) => c.subject);
  let err = null;
  try { await M.reply(made.id, 'FAIL'); } catch (e) { err = e.name; }
  eq([r.messages.map((m) => m.body), sent.includes('Office hours?'), err], [['Are you in today?', 'Thanks!'], true, 'HttpError']);
});
test('F18', 'who you can message: quick groups and people, by class or group', async () => {
  const M = await import('../lib/canvasMessages.js');
  canvas.setTransport(fixtureTransport(null));
  const course = await M.searchRecipients('course_1001', '');
  const group = await M.searchRecipients('group_4401', '');
  const found = await M.searchRecipients('course_1001', 'ana');
  eq(
    [course.filter((r) => r.type === 'context').map((r) => r.id), group.map((r) => r.name), found.map((r) => [r.name, r.roles])],
    [['course_1001_teachers', 'course_1001_tas'], ['PA Team 4 (everyone)', 'Jordan Lee', 'Priya Shah', 'Diego Ramos'], [['Ana Ortiz', ['TaEnrollment']]]]
  );
});
test('F16', 'a group’s things load from the group’s own Canvas addresses', async () => {
  const content = await import('../ui/content.js');
  canvas.setTransport(fixtureTransport(null));
  const b = content.contentBase(content.groupKey('4401'));
  const [pages, members, news, topics] = await Promise.all([canvas.getAll(`${b}/pages`), canvas.getAll(`${b}/users`), canvas.getAll(`${b}/discussion_topics`, { only_announcements: 'true' }), canvas.getAll(`${b}/discussion_topics`)]);
  eq([b, content.contentBase('1001'), pages.map((p) => p.url), members.length, news.map((a) => a.title), topics.length > 0], ['/api/v1/groups/4401', '/api/v1/courses/1001', ['team-plan'], 4, ['Meeting moved to Thursday'], true]);
});
test('F16', 'your groups sync with their class', async () => {
  canvas.setTransport(fixtureTransport(null));
  const g = (await canvas.getAll('/api/v1/users/self/groups')).map(CN.normalizeGroup);
  eq(g.map((x) => [x.id, x.name, x.courseId, x.members]), [['4401', 'PA Team 4', '1001', 4]]);
});

async function run() {
  // The sample classes' syllabi (a renamed copy of the owner's, K8).
  const PR = await import('../lib/profiles.js');
  PR.setProfiles((await import('./sample/syllabi.js')).default);
  const out = document.getElementById('out');
  let pass = 0;
  let fail = 0;
  let lastGroup = null;
  for (const t of results) {
    if (t.group !== lastGroup) {
      const h2 = document.createElement('h2');
      h2.textContent = t.group;
      out.append(h2);
      lastGroup = t.group;
    }
    const li = document.createElement('div');
    try {
      await t.fn();
      pass++;
      li.className = 'pass';
      li.textContent = `✓ ${t.id} · ${t.name}`;
    } catch (e) {
      fail++;
      li.className = 'fail';
      li.textContent = `✗ ${t.id} · ${t.name} — ${e.message}`;
    }
    out.append(li);
  }
  const sum = document.getElementById('summary');
  sum.textContent = `${pass} passed, ${fail} failed`;
  sum.className = fail ? 'fail' : 'pass';
  window.__testResults = { pass, fail, failures: [...out.querySelectorAll('.fail')].map((n) => n.textContent) };
}
run();
