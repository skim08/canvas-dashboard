// K5 + K6 + K7: a class's syllabus. Import one (file, Canvas's syllabus page or pasted
// text), check everything that was found, fix class times and days off by hand, then
// save it to the calendar. Nothing leaves this computer.

import { h } from './dom.js';
import { state, saveSyllabus, removeSyllabus, updateUser } from './store.js';
import { setUi, toast, openDrawer } from './actions.js';
import { button, iconButton, emptyState, dot } from './components.js';
import { icon } from './icons.js';
import { textFromFile } from '../lib/fileText.js';
import { htmlToText } from '../lib/sanitize.js';
import { extractSyllabus, toSyllabus, fromSyllabus } from '../lib/syllabusImport.js';
import { findProfile } from '../lib/profiles.js';
import { formatDate } from '../lib/time.js';
import { aiExtract, aiReady } from './syllabusAI.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const sessions = {}; // courseId → { found, from, error, busy, paste, pasting }
const st = (id) => (sessions[id] ||= { found: null, from: null, error: null, busy: false, paste: '', pasting: false });
const redraw = () => setUi({});
const uid = () => Math.random().toString(36).slice(2, 8);

const FILE_ERRORS = {
  unsupported: 'That kind of file can’t be read. Use a PDF, a Word file (.docx) or a text file, or paste the text.',
  empty: 'No text found in that file. If it’s a scanned PDF (pictures of pages), copy the dates in by pasting text instead.',
  'not-pdf': 'That file doesn’t look like a PDF.',
  'not-docx': 'That file doesn’t look like a Word document.',
  'not-zip': 'That file doesn’t look like a Word document.',
};

function termOf(course) {
  return { termStart: course.termStart?.slice(0, 10) || null, termEnd: course.termEnd?.slice(0, 10) || null };
}

async function run(course, text, from) {
  const s = st(course.id);
  const ctx = { today: new Date().toISOString().slice(0, 10), ...termOf(course) };
  let found = extractSyllabus(text, ctx);
  // Chrome's on-device AI, when this computer has it, fills in what patterns missed.
  if (await aiReady()) {
    try {
      found = await aiExtract(text, ctx, found);
    } catch {
      /* patterns alone are fine */
    }
  }
  Object.assign(s, { found, from, error: null, busy: false, pasting: false });
  redraw();
}

async function onFile(course, file) {
  if (!file) return;
  const s = st(course.id);
  Object.assign(s, { busy: true, error: null });
  redraw();
  try {
    await run(course, await textFromFile(file), file.name);
  } catch (e) {
    Object.assign(s, { busy: false, error: FILE_ERRORS[e.message] || `Couldn’t read ${file.name}. Try pasting its text instead.` });
    redraw();
  }
}

function startBlank(course, existing) {
  const s = st(course.id);
  s.found = existing ? fromSyllabus(existing) : { classes: [{ id: uid(), name: 'Lecture', days: [], start: '', end: '', where: '' }], exams: [], deadlines: [], noClass: [], topics: [] };
  s.from = existing ? 'your saved dates' : 'typed in';
  redraw();
}

async function save(course) {
  const s = st(course.id);
  const f = s.found;
  const clean = {
    classes: f.classes.filter((c) => c.name && c.days.length && c.start),
    exams: f.exams.filter((e) => e.title && e.day),
    deadlines: f.deadlines.filter((d) => d.title && d.day),
    noClass: f.noClass.filter((n) => n.day),
    topics: f.topics.filter((t) => t.day && t.text),
  };
  const entry = toSyllabus({ courseId: course.id, code: course.code, name: course.nick || course.name, source: s.from && s.from !== 'typed in' && s.from !== 'your saved dates' ? `From ${s.from}` : 'Typed in', ...termOf(course) }, clean);
  await saveSyllabus(entry);
  Object.assign(s, { found: null, from: null });
  toast(`Saved for ${course.nick || course.code}: ${summary(entry)}`);
}

// ---------- the start screen ----------

function summary(entry) {
  const sc = entry.schedule || {};
  const parts = [
    [(sc.classes || []).length, 'class meeting'],
    [(sc.exams || []).length, 'exam or quiz', 'exams or quizzes'],
    [(sc.deadlines || []).length, 'deadline'],
    [(sc.noClass || []).length, 'day off', 'days off'],
  ].filter(([n]) => n);
  return parts.map(([n, one, many]) => `${n} ${n === 1 ? one : many || `${one}s`}`).join(' · ') || 'No dates yet';
}

function startScreen(course) {
  const s = st(course.id);
  const mine = state.syllabi.find((p) => String(p.courseId) === String(course.id));
  const builtIn = !mine && findProfile(course);
  return [
    mine
      ? h(
          'section',
          { class: 'd-block' },
          h('h3', null, 'Saved'),
          h('p', null, summary(mine)),
          h('p', { class: 'caption' }, `${mine.source || 'Your syllabus'}${mine.imported ? ` · ${formatDate(`${mine.imported}T12:00:00Z`, 'UTC', { year: 'numeric' })}` : ''}`),
          h(
            'div',
            { class: 'd-actions' },
            button('Edit dates and class times', () => startBlank(course, mine), { kind: 'primary', key: 'syl-edit' }),
            button('Remove', () => (removeSyllabus(mine.id), toast('Syllabus dates removed')), { kind: 'danger-ghost', key: 'syl-remove' })
          )
        )
      : builtIn
        ? h('section', { class: 'd-block' }, h('h3', null, 'Built in'), h('p', null, summary(builtIn)), h('p', { class: 'caption' }, `${builtIn.source || 'Typed in from your syllabus'}. Importing a syllabus here replaces it for this class.`))
        : h('p', { class: 'd-lead' }, 'Add your syllabus to see exams, deadlines and class times on your calendar. Everything is read on this computer, and you check it before anything is saved.'),
    h(
      'section',
      { class: 'd-block' },
      h('h3', null, mine || builtIn ? 'Import again' : 'Import your syllabus'),
      h(
        'div',
        { class: 'syl-sources' },
        h(
          'label',
          { class: ['btn', 'btn-secondary', s.busy && 'is-disabled'], 'data-key': 'syl-file' },
          h('input', { type: 'file', accept: '.pdf,.docx,.txt,.md,.html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain', class: 'visually-hidden', disabled: s.busy, onchange: (e) => onFile(course, e.target.files[0]) }),
          s.busy ? 'Reading…' : 'Upload a PDF or Word file'
        ),
        course.syllabusHtml ? button('Use the syllabus on Canvas', () => (Object.assign(s, { busy: true }), redraw(), run(course, htmlToText(course.syllabusHtml), 'the Canvas syllabus page')), { key: 'syl-canvas', disabled: s.busy }) : null,
        button('Paste text', () => (Object.assign(s, { pasting: !s.pasting }), redraw()), { key: 'syl-paste-open', kind: 'ghost' })
      ),
      s.pasting
        ? h(
            'div',
            { class: 'syl-paste' },
            h('textarea', { class: 'text-input', rows: 8, placeholder: 'Paste the schedule part of your syllabus here.', value: s.paste, 'data-key': 'syl-paste', 'aria-label': 'Syllabus text', oninput: (e) => (s.paste = e.target.value) }),
            button('Find dates', () => s.paste.trim() && run(course, s.paste, 'pasted text'), { kind: 'primary', key: 'syl-paste-go' })
          )
        : null,
      s.error ? h('p', { class: 'setup-error', role: 'alert' }, s.error) : null,
      !mine ? h('button', { class: 'link-btn', 'data-key': 'syl-blank', onclick: () => startBlank(course, null) }, 'Or type class times and dates in yourself') : null
    ),
    // G13: class times you type in, for when the syllabus doesn't list them.
    h(
      'section',
      { class: 'd-block' },
      h('h3', null, 'Class times'),
      typedTimes(course.id)
        ? h('p', null, (state.userdata.classTimes[course.id] || []).map((r) => `${r.name}: ${r.days.join(', ')}`).join(' · '))
        : hasTimes(mine || builtIn)
          ? h('p', null, 'From your syllabus.')
          : h('p', { class: 'setup-error' }, 'No class times yet, so lectures and sections aren’t on your calendar.'),
      button(typedTimes(course.id) ? 'Edit class times' : 'Add class times', () => openDrawer('classTimes', course.id), { key: 'syl-class-times', kind: typedTimes(course.id) || hasTimes(mine || builtIn) ? 'secondary' : 'primary', iconName: 'clock' })
    ),
    // K23: online or self-paced classes have no class times; stop asking for them.
    !state.userdata.syllabusSkip?.[course.id] && !hasTimes(mine || builtIn)
      ? h('p', { class: 'caption' }, 'No set class times, like an online class? ', h('button', { class: 'link-btn', 'data-key': 'syl-skip', onclick: () => (skipSyllabus(course.id), toast(`OK: ${course.nick || course.code} won’t ask for class times`)) }, 'Mark as not needed'))
      : null,
  ];
}

// ---------- K6: review (and K7: edit by hand) ----------

const field = (label, input) => h('label', { class: 'syl-field' }, h('span', null, label), input);
const text = (value, onchange, key, placeholder = '') => h('input', { class: 'text-input', value: value || '', placeholder, 'data-key': key, onchange: (e) => (onchange(e.target.value.trim()), redraw()) });
const date = (value, onchange, key) => h('input', { class: 'text-input', type: 'date', value: value || '', 'data-key': key, onchange: (e) => (onchange(e.target.value), redraw()) });
const time = (value, onchange, key, label) => h('input', { class: 'text-input syl-time', type: 'time', value: value || '', 'aria-label': label, 'data-key': key, onchange: (e) => (onchange(e.target.value || null), redraw()) });
const source = (line) => (line ? h('p', { class: 'syl-source' }, `From: “${line.length > 140 ? `${line.slice(0, 140)}…` : line}”`) : null);
const removeBtn = (list, i, key, what) => iconButton('x', `Remove ${what}`, () => (list.splice(i, 1), redraw()), { key });

function group(title, list, render, onAdd, addLabel) {
  return h(
    'section',
    { class: 'd-block syl-group' },
    h('h3', null, `${title}${list.length ? ` (${list.length})` : ''}`),
    list.length ? h('div', { class: 'syl-list' }, list.map(render)) : h('p', { class: 'caption' }, 'None found.'),
    h('button', { class: 'link-btn', 'data-key': `syl-add-${title}`, onclick: () => (onAdd(), redraw()) }, addLabel)
  );
}

function reviewScreen(course) {
  const s = st(course.id);
  const f = s.found;
  const mine = state.syllabi.find((p) => String(p.courseId) === String(course.id));
  const total = f.classes.length + f.exams.length + f.deadlines.length + f.noClass.length + f.topics.length;
  return [
    h('p', { class: 'd-lead' }, s.from === 'typed in' || s.from === 'your saved dates' ? 'Add or fix class times and dates. Nothing changes until you save.' : `Found ${total} thing${total === 1 ? '' : 's'} in ${s.from}. Check each one against your syllabus: fix anything wrong, remove what doesn’t belong, then save.`),
    // G13: the syllabus didn't say when the class meets: ask now, while you're here.
    !f.classes.length
      ? h(
          'div',
          { class: 'setup-todo ct-callout' },
          h('div', { class: 'setup-todo-head' }, h('strong', null, 'No class times were found in this syllabus'), h('span', null, 'Add when your lecture and sections meet so they show as blocks on your calendar every week. Your school’s class schedule lists them.')),
          h('div', { class: 'ct-add' }, ['Lecture', 'Quiz section', 'Lab', 'Discussion'].map((k) => button(k, () => (f.classes.push({ id: uid(), name: k, days: [], start: '', end: '', where: '' }), redraw()), { key: `syl-quick:${k}`, iconName: 'plus' })))
        )
      : null,
    group(
      'Class meetings',
      f.classes,
      (c, i) =>
        h(
          'div',
          { class: 'syl-item' },
          h(
            'div',
            { class: 'syl-row' },
            field('Name', text(c.name, (v) => (c.name = v), `cl-name:${i}`, 'Lecture')),
            h(
              'div',
              { class: 'syl-field' },
              h('span', null, 'Days'),
              h('div', { class: 'syl-days', role: 'group', 'aria-label': 'Days' }, DAYS.map((d) => h('button', { class: ['syl-day', c.days.includes(d) && 'is-on'], 'aria-pressed': String(c.days.includes(d)), 'data-key': `cl-day:${i}:${d}`, onclick: () => ((c.days = c.days.includes(d) ? c.days.filter((x) => x !== d) : DAYS.filter((x) => x === d || c.days.includes(x))), redraw()) }, d.slice(0, 2))))
            ),
            field('Starts', time(c.start, (v) => (c.start = v), `cl-start:${i}`, 'Starts')),
            field('Ends', time(c.end, (v) => (c.end = v), `cl-end:${i}`, 'Ends')),
            field('Room', text(c.where, (v) => (c.where = v || null), `cl-room:${i}`, 'Room')),
            removeBtn(f.classes, i, `cl-rm:${i}`, 'meeting')
          ),
          !c.days.length || !c.start ? h('p', { class: 'syl-warn' }, 'Needs days and a start time to show on the calendar.') : null,
          source(c.line)
        ),
      () => f.classes.push({ id: uid(), name: f.classes.length ? 'Section' : 'Lecture', days: [], start: '', end: '', where: '' }),
      'Add a class meeting'
    ),
    group(
      'Exams and quizzes',
      f.exams,
      (e, i) =>
        h(
          'div',
          { class: 'syl-item' },
          h(
            'div',
            { class: 'syl-row' },
            field('Name', text(e.title, (v) => (e.title = v), `ex-title:${i}`, 'Midterm 1')),
            field('Date', date(e.day, (v) => (e.day = v), `ex-day:${i}`)),
            field('Starts', time(e.start, (v) => (e.start = v), `ex-start:${i}`, 'Starts')),
            field('Ends', time(e.end, (v) => (e.end = v), `ex-end:${i}`, 'Ends')),
            field('Room', text(e.where, (v) => (e.where = v || null), `ex-room:${i}`, e.inClass ? 'In class' : 'Room')),
            removeBtn(f.exams, i, `ex-rm:${i}`, 'exam')
          ),
          e.inClass && !e.start ? h('p', { class: 'caption caption-tight' }, 'In class: same time and room as that day’s class.') : null,
          source(e.line)
        ),
      () => f.exams.push({ id: uid(), title: '', type: 'exam', day: '', start: null, end: null, where: null }),
      'Add an exam or quiz'
    ),
    group(
      'Deadlines',
      f.deadlines,
      (d, i) =>
        h(
          'div',
          { class: 'syl-item' },
          h('div', { class: 'syl-row' }, field('What’s due', text(d.title, (v) => (d.title = v), `dl-title:${i}`, 'Essay 1')), field('Date', date(d.day, (v) => (d.day = v), `dl-day:${i}`)), field('Time', time(d.time, (v) => (d.time = v), `dl-time:${i}`, 'Time due')), removeBtn(f.deadlines, i, `dl-rm:${i}`, 'deadline')),
          source(d.line)
        ),
      () => f.deadlines.push({ id: uid(), title: '', day: '', time: null }),
      'Add a deadline'
    ),
    group(
      'Days off',
      f.noClass,
      (n, i) => h('div', { class: 'syl-item' }, h('div', { class: 'syl-row' }, field('Date', date(n.day, (v) => (n.day = v), `nc-day:${i}`)), field('Why', text(n.title, (v) => (n.title = v || 'No class'), `nc-title:${i}`, 'No class · Holiday')), removeBtn(f.noClass, i, `nc-rm:${i}`, 'day off')), source(n.line)),
      () => f.noClass.push({ day: '', title: 'No class' }),
      'Add a day off'
    ),
    f.topics.length
      ? group(
          'Topics',
          f.topics,
          (t, i) => h('div', { class: 'syl-item' }, h('div', { class: 'syl-row' }, field('Date', date(t.day, (v) => (t.day = v), `tp-day:${i}`)), field('Topic', text(t.text, (v) => (t.text = v), `tp-text:${i}`)), removeBtn(f.topics, i, `tp-rm:${i}`, 'topic'))),
          () => f.topics.push({ day: '', text: '' }),
          'Add a topic'
        )
      : null,
    h(
      'div',
      { class: 'd-actions syl-save' },
      button('Save to calendar', () => save(course), { kind: 'primary', key: 'syl-save' }),
      button('Cancel', () => (Object.assign(s, { found: null, from: null }), redraw()), { kind: 'ghost', key: 'syl-cancel' }),
      mine && s.from !== 'your saved dates' ? h('span', { class: 'caption' }, 'Saving replaces the dates you saved before for this class.') : null
    ),
  ];
}

export function syllabusDrawer(courseId, ctx) {
  const raw = [...ctx.courses, ...(ctx.otherCourses || [])].find((c) => c.id === courseId) || ctx.allCourses.find((c) => c.id === courseId);
  if (!raw) return emptyState('Class not found.');
  const course = { ...raw, nick: raw.nick || ctx.nickOf?.(courseId) || raw.autoNick || raw.code };
  const s = st(courseId);
  return [h('header', { class: 'd-header' }, h('h2', { class: 'd-title' }, course.nick || course.code || course.name), h('p', { class: 'd-due' }, 'Syllabus dates and class times')), ...(s.found ? reviewScreen(course) : startScreen(course))];
}

// For tests: the review state of a class.
export const syllabusSession = (courseId) => st(courseId);

// ---------- K23: syllabus setup comes first ----------

// A class has its times once its syllabus lists weekly meetings or dated sessions.
const hasTimes = (p) => !!p && ((p.schedule?.classes || []).some((c) => (c.days && c.days.length) || (p.schedule?.sessions || []).some((m) => m.in === c.id)));

const typedTimes = (courseId) => (state.userdata.classTimes?.[courseId] || []).length > 0; // G13

// Classes still missing their syllabus or class times (unless you said they don't need one).
export function needsSyllabus(ctx) {
  return (ctx.courses || []).filter((c) => !c.unavailable && !state.userdata.syllabusSkip?.[c.id] && !hasTimes(findProfile(c)) && !typedTimes(c.id));
}

// What a class still needs: its syllabus, or (syllabus added, no times found) just its class times.
export const needsWhat = (c) => (findProfile(c) ? 'times' : 'syllabus');
const openNext = (c) => (needsWhat(c) === 'times' ? openDrawer('classTimes', c.id) : openDrawer('syllabus', c.id));

export const skipSyllabus = (courseId) =>
  updateUser((ud) => {
    ud.syllabusSkip = { ...(ud.syllabusSkip || {}), [courseId]: true };
  });

export const openSyllabus = (courseId) => openDrawer('syllabus', courseId);

// Home: a clear "finish setting up" card until every class has its times.
export function syllabusSetupCard(ctx) {
  const list = needsSyllabus(ctx);
  if (!list.length) return null;
  return h(
    'section',
    { class: 'setup-todo', 'aria-label': 'Finish setting up' },
    h(
      'div',
      { class: 'setup-todo-head' },
      h('strong', null, list.every((c) => needsWhat(c) === 'times') ? 'Finish setting up: add your class times' : 'Finish setting up: add your syllabi'),
      h('span', null, 'Canvas doesn’t share when your classes meet. Add each syllabus (or type the class times) so lectures, sections, exams and deadlines show on your calendar. About a minute per class.')
    ),
    h(
      'div',
      { class: 'setup-todo-list' },
      list.map((c) => h('button', { class: 'setup-todo-chip', 'data-key': `k23-add:${c.id}`, onclick: () => openNext(c) }, dot(c.color), h('span', null, c.nick), h('span', { class: 'setup-todo-add' }, icon('plus', 14), needsWhat(c) === 'times' ? 'Class times' : 'Syllabus')))
    )
  );
}

// Calendar: a one-line reminder above the grid.
export function syllabusCalendarBanner(ctx) {
  const list = needsSyllabus(ctx);
  if (!list.length) return null;
  return h(
    'div',
    { class: 'banner tone-amber cal-k23', role: 'status' },
    icon('alert'),
    h('span', { class: 'cal-k23-text' }, `${list.length === 1 ? `${list[0].nick} doesn’t` : `${list.length} classes don’t`} have class times yet, so ${list.length === 1 ? 'its lectures and sections aren’t' : 'their lectures and sections aren’t'} on your calendar.`),
    h('span', { class: 'cal-k23-links' }, list.map((c) => button(`Add ${c.nick} times`, () => openNext(c), { key: `k23-cal:${c.id}`, kind: 'secondary' })))
  );
}
