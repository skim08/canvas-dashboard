// The details drawer (B3). Slides in from the right; Esc, ✕ or a click
// outside closes it. All item details live here, never in the lists.

import { h } from './dom.js';
import { term } from './term.js';
import { icon } from './icons.js';
import { state, updateSettings } from './store.js';
import {
  ui, closeDrawer, openDrawer, toggleDone, togglePin, togglePromoted, hideItem, unhideItem, snoozeItem, snoozeChoices, setType,
  addTodo, updateTodo, deleteTodo, addSubtask, toggleSubtask, deleteSubtask, moveSubtask, setNote, noteValue, setUi,
} from './actions.js';
import { feat, statusTags, dueText, dueTone, button, iconButton, dot, itemRow, emptyState, startsRather } from './components.js';
import { TYPE_LABEL, STATUS_LABEL, lateAcceptance, listable } from '../lib/model.js';
import { formatDateTime, formatDate, formatTime } from '../lib/time.js';
import { sanitizeHtml } from '../lib/sanitize.js';
import { renderGradeDrawer, gradeDrawerTitle, itemGradeBlocks } from './gradeDrawer.js';
import { renderContentDrawer, contentDrawerTitle } from './contentDrawer.js';
import { planBlocks } from './planDrawer.js';
import { submitBlock } from './submitBlock.js';
import { archiveDrawer } from './archiveView.js';
import { streakDrawer } from './streak.js';
import { mochiChat } from './chatDrawer.js';
import { mascotName } from './mochi.js';
import { syllabusDrawer } from './syllabusDrawer.js';
import { eventDrawer, ownEventActions } from './eventDrawer.js';
import { classTimesDrawer } from './classTimesDrawer.js';
import { hiddenMarks } from '../lib/marks.js';
import { unhideMark } from './marks.js';
import { markSeen } from './gradeActions.js';

export function renderDrawer(ctx) {
  const d = ui.drawer;
  if (!d) return null;
  let body = null;
  let title = '';
  if (d.type === 'item') {
    const item = ctx.allItems.find((i) => i.id === d.id);
    if (!item) {
      title = 'Not found';
      body = emptyState('This item no longer exists in Canvas.');
    } else {
      title = item.kind === 'todo' ? 'To-do' : TYPE_LABEL[item.type];
      if (item.status === 'graded' && item.sub?.gradedAt) queueMicrotask(() => markSeen(item.canvasId, item.sub.gradedAt));
      body = item.kind === 'todo' ? todoDetails(item, ctx) : item.source === 'own' && item.eventId ? [itemDetails(item, ctx), ownEventActions(item)] : itemDetails(item, ctx); // G12
    }
  } else if (d.type === 'course') {
    const c = ctx.allCourses.find((x) => x.id === d.id);
    title = 'Course';
    body = c ? courseDetails(c, ctx) : emptyState('Course not found.');
  } else if (d.type === 'todo-new') {
    title = 'New to-do';
    body = newTodoForm(ctx);
  } else if (d.type === 'mochi') {
    title = `Ask ${mascotName()}`;
    body = mochiChat(ctx); // J4, J5
  } else if (d.type === 'streak') {
    title = 'Daily streak';
    body = streakDrawer(ctx); // D9
  } else if (d.type === 'archive') {
    title = `Past ${term()}`;
    body = archiveDrawer(d.id, ctx); // I1
  } else if (d.type === 'classTimes') {
    title = 'Class times';
    body = classTimesDrawer(d.id, ctx); // G13
  } else if (d.type === 'event') {
    title = 'Your event';
    body = eventDrawer(d.id, ctx); // G12
  } else if (d.type === 'syllabus') {
    title = 'Syllabus';
    body = syllabusDrawer(d.id, ctx); // K5–K7
  } else if (d.type === 'hidden') {
    title = 'Hidden and snoozed';
    body = hiddenList(ctx);
  } else if (contentDrawerTitle(d.type)) {
    title = contentDrawerTitle(d.type);
    body = renderContentDrawer(d.type, d.id, ctx);
  } else if (gradeDrawerTitle(d.type)) {
    title = gradeDrawerTitle(d.type);
    body = renderGradeDrawer(d.type, d.id, ctx);
  } else if (d.type === 'help') {
    title = 'Keyboard shortcuts';
    body = shortcutHelp();
  }
  // B3: a large centered window (default), or the side panel. Switch with the button in the header.
  const large = state.settings.detailsView !== 'side';
  return h(
    'div',
    { class: ['drawer-layer', large && 'is-window'], onclick: closeDrawer },
    h(
      'aside',
      { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: (e) => e.stopPropagation() },
      h(
        'div',
        { class: 'drawer-head' },
        h('span', { class: 'drawer-kicker' }, title),
        iconButton(large ? 'sidebar' : 'expand', large ? 'Show as a side panel' : 'Open as a large window', () => updateSettings({ detailsView: large ? 'side' : 'window' }), { key: 'drawer-view' }),
        iconButton('x', 'Close', closeDrawer, { key: 'drawer-close' })
      ),
      h('div', { class: 'drawer-body', 'data-scroll': 'drawer' }, body)
    )
  );
}

function block(title, ...children) {
  return h('section', { class: 'd-block' }, title ? h('h3', null, title) : null, ...children);
}

function kv(rows) {
  return h(
    'dl',
    { class: 'kv' },
    rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => [h('dt', null, k), h('dd', null, v)])
  );
}

const SUBMISSION_LABEL = {
  online_upload: 'File upload',
  online_text_entry: 'Text entry',
  online_url: 'Website URL',
  media_recording: 'Media recording',
  online_quiz: 'Quiz',
  discussion_topic: 'Discussion post',
  external_tool: 'External tool',
  on_paper: 'On paper',
  none: 'No submission',
  student_annotation: 'Annotation',
};

function itemDetails(item, ctx) {
  const { now, tz } = ctx;
  const late = item.source === 'own' ? null : lateAcceptance(item, now); // G12: your own events aren't submitted
  // In-person quizzes from a syllabus (G10) aren't taken in Canvas.
  const isQuizLike = item.source !== 'syllabus' && (item.type === 'quiz' || item.isQuiz || (item.type === 'exam' && item.submissionTypes.includes('online_quiz')));
  const desc = item.descriptionHtml ? sanitizeHtml(item.descriptionHtml, { courseId: item.courseId }) : null;

  return [
    h(
      'header',
      { class: 'd-header' },
      item.courseId ? h('button', { class: 'd-course', 'data-key': 'd-course', onclick: () => openDrawer('course', item.courseId) }, dot(item.color), item.nick) : null,
      h('h2', { class: 'd-title' }, item.title),
      h(
        'p',
        { class: 'd-due' },
        item.dueAt
          ? item.allDay
            ? `${formatDateTime(item.dueAt, tz).split(' · ')[0]} · time not listed`
            : `${startsRather(item) ? 'Starts' : 'Due'} ${formatDateTime(item.dueAt, tz)}${item.endAt ? ` – ${formatTime(item.endAt, tz)}` : ''}`
          : 'No due date',
        item.dueAt && !item.allDay && (new Date(item.dueAt).getTime() >= now || item.overdue) ? h('span', { class: `tone-${dueTone(item, now)}` }, ` · ${dueText(item, now, tz)}`) : null
      ),
      // G10, G11
      item.source === 'syllabus' || item.dateFrom === 'syllabus' ? h('p', { class: 'caption caption-tight' }, `${item.source === 'syllabus' ? 'From' : 'Date from'} your ${item.syllabusOf || 'syllabus'}.${item.canvasDate ? '' : ` Canvas doesn’t list ${item.source === 'syllabus' ? 'it' : 'this date'}.`}`) : null,
      h(
        'div',
        { class: 'd-tags' },
        item.kind === 'assignment' ? h('span', { class: 'tag tag-neutral' }, STATUS_LABEL[item.status] || 'Not submitted') : null,
        ...statusTags(item).filter((t) => !['Submitted', 'Graded', 'Excused'].includes(t.textContent)),
        late && !item.done ? h('span', { class: `tag tag-${late.closed ? 'red' : 'amber'}` }, late.closed ? 'Closed' : late.until ? `Accepting late work until ${formatDate(late.until, tz)}` : 'Still accepting submissions') : null
      )
    ),
    // C8 / F15
    h(
      'div',
      { class: 'd-actions' },
      item.url
        ? h(
            'a',
            { class: 'btn btn-primary', href: item.url, target: '_blank', rel: 'noopener', 'data-key': 'open-canvas' },
            isQuizLike ? 'Take in Canvas' : 'Open in Canvas',
            icon('external')
          )
        : null,
      feat('checklist') && !item.classMeeting
        ? h(
            'button',
            { class: ['btn', 'btn-secondary', item.done && 'is-on'], 'data-key': 'd-done', onclick: () => toggleDone(item) },
            icon('check'),
            item.done ? 'Done' : 'Mark done'
          )
        : null,
      item.officeHours
        ? h(
            'button',
            { class: ['btn', 'btn-secondary', item.promoted && 'is-on'], 'data-key': 'd-promote', onclick: () => togglePromoted(item) },
            icon(item.promoted ? 'check' : 'homePlus'),
            item.promoted ? 'On your calendar & to-dos' : 'Add to calendar & to-dos'
          )
        : item.fromOther && feat('otherTab')
        ? h(
            'button',
            { class: ['btn', 'btn-secondary', item.promoted && 'is-on'], 'data-key': 'd-promote', onclick: () => togglePromoted(item) },
            icon(item.promoted ? 'check' : 'homePlus'),
            item.promoted ? 'On Home' : 'Add to Home'
          )
        : null,
      feat('pins') ? iconButton('pin', item.pinned ? 'Unpin' : 'Pin to top', () => togglePin(item), { class: item.pinned ? 'is-on' : '', key: 'd-pin' }) : null,
      feat('hideSnooze') ? iconButton('clock', 'Snooze', () => setUi({ snoozeOpen: !ui.snoozeOpen }), { key: 'd-snooze', class: ui.snoozeOpen ? 'is-on' : '' }) : null,
      feat('hideSnooze') ? iconButton('eyeOff', 'Hide', () => (hideItem(item), closeDrawer()), { key: 'd-hide' }) : null
    ),
    feat('hideSnooze') && ui.snoozeOpen
      ? h(
          'div',
          { class: 'd-snooze' },
          snoozeChoices().map((c) => button(`${c.label} · ${c.sub}`, () => (setUi({ snoozeOpen: false }), snoozeItem(item, c.until), closeDrawer()), { key: `snz:${c.label}` }))
        )
      : null,
    submitBlock(item, ctx), // F13
    ...itemGradeBlocks(item, ctx),
    ...planBlocks(item, ctx),
    isQuizLike
      ? block(
          item.type === 'exam' ? 'Exam' : 'Quiz',
          kv([
            ['Time limit', item.quiz?.timeLimit ? `${item.quiz.timeLimit} minutes` : item.quiz ? 'None' : null],
            ['Attempts', item.quiz ? (item.quiz.attempts === -1 ? 'Unlimited' : item.quiz.attempts) : null],
            ['Questions', item.quiz?.questionCount],
            ['Points', item.points],
          ]),
          h('p', { class: 'caption' }, 'Quizzes and exams run on Canvas’s own page.')
        )
      : null,
    feat('subtasks') ? subtasks(item) : null,
    feat('notes') ? notes(item) : null,
    block(
      'Details',
      kv([
        ['Points', !isQuizLike ? item.points : null],
        ['Available from', item.unlockAt ? formatDateTime(item.unlockAt, tz) : null],
        ['Available until', item.lockAt ? formatDateTime(item.lockAt, tz) : null],
        ['Submit as', item.submissionTypes.length ? item.submissionTypes.map((t) => SUBMISSION_LABEL[t] || t).join(', ') : null],
        ['Attempt', item.sub?.attempt],
        ['Submitted', item.sub?.submittedAt ? formatDateTime(item.sub.submittedAt, tz) : null],
        ['Score', item.status === 'graded' && item.sub?.score != null ? `${item.sub.score}${item.points != null ? ` / ${item.points}` : ''}` : null],
        ['Category', item.groupName],
        ['Location', item.location],
        ['Type', typeSelect(item)],
      ])
    ),
    desc && !desc.empty ? block('Instructions', h('div', { class: 'prose' }, desc.fragment)) : null,
    desc?.files.length
      ? block(
          'Files',
          h(
            'ul',
            { class: 'files' },
            desc.files.map((f) => h('li', null, h('a', { href: f.url, target: '_blank', rel: 'noopener', 'data-key': `file:${f.id}` }, icon('file'), h('span', null, f.name), icon('download'))))
          )
        )
      : null,
    item.rubric?.length && !(item.status === 'graded' && item.sub?.rubric) ? block('Rubric', rubricTable(item.rubric)) : null,
  ];
}

function typeSelect(item) {
  const own = item.kind === 'todo' ? null : state.userdata.types[item.id];
  return h(
    'select',
    { 'data-key': 'd-type', 'aria-label': 'Type', onchange: (e) => setType(item, e.target.value) },
    item.kind !== 'todo' ? h('option', { value: '', selected: !own }, `Automatic (${TYPE_LABEL[item.type]})`) : null,
    ['assignment', 'quiz', 'exam', 'discussion', 'reading', item.kind === 'todo' ? 'todo' : null]
      .filter(Boolean)
      .map((t) => h('option', { value: t, selected: item.kind === 'todo' ? item.type === t : own === t }, TYPE_LABEL[t]))
  );
}

function rubricTable(rubric) {
  return h(
    'table',
    { class: 'rubric' },
    h('thead', null, h('tr', null, h('th', null, 'Criterion'), h('th', null, 'Ratings'), h('th', { class: 'num' }, 'Pts'))),
    h(
      'tbody',
      null,
      rubric.map((r) =>
        h(
          'tr',
          null,
          h('td', null, h('div', { class: 'rubric-name' }, r.description), r.longDescription ? h('div', { class: 'rubric-long' }, r.longDescription) : null),
          h('td', null, h('div', { class: 'ratings' }, r.ratings.map((x) => h('span', { class: 'rating' }, h('span', { class: 'num' }, String(x.points)), ` ${x.description}`)))),
          h('td', { class: 'num' }, String(r.points))
        )
      )
    ),
    h('tfoot', null, h('tr', null, h('td', { colspan: '2' }, 'Total'), h('td', { class: 'num' }, String(rubric.reduce((s, r) => s + (r.points || 0), 0)))))
  );
}

// D5
function subtasks(item) {
  const list = state.userdata.subtasks[item.id] || [];
  return block(
    `Subtasks${list.length ? ` · ${list.filter((s) => s.done).length}/${list.length}` : ''}`,
    h(
      'ul',
      { class: 'subtasks' },
      list.map((s, i) =>
        h(
          'li',
          { class: s.done ? 'is-done' : null },
          h('button', { class: ['check', s.done && 'is-done'], role: 'checkbox', 'aria-checked': String(s.done), 'aria-label': s.text, 'data-key': `sub:${s.id}`, onclick: () => toggleSubtask(item.id, s.id) }, icon('check', 14)),
          h('span', { class: 'sub-text' }, s.text),
          i > 0 ? iconButton('up', 'Move up', () => moveSubtask(item.id, s.id, -1), { key: `subup:${s.id}` }) : h('span', { class: 'icon-spacer' }),
          i < list.length - 1 ? iconButton('down', 'Move down', () => moveSubtask(item.id, s.id, 1), { key: `subdn:${s.id}` }) : h('span', { class: 'icon-spacer' }),
          iconButton('trash', 'Delete subtask', () => deleteSubtask(item.id, s.id), { key: `subdel:${s.id}` })
        )
      )
    ),
    h(
      'form',
      {
        class: 'inline-form',
        onsubmit: (e) => {
          e.preventDefault();
          const input = e.target.elements.text;
          addSubtask(item.id, input.value);
          input.value = '';
        },
      },
      h('input', { name: 'text', class: 'text-input', placeholder: 'Add a step, like “Outline”', 'data-key': 'sub-new', autocomplete: 'off' }),
      button('Add', null, { type: 'submit', key: 'sub-add' })
    )
  );
}

// D6
function notes(item) {
  return block(
    'Notes',
    h('textarea', {
      class: 'notes',
      rows: '4',
      placeholder: 'Anything to remember…',
      'data-key': `note:${item.id}`,
      value: noteValue(item.id),
      oninput: (e) => setNote(item.id, e.target.value),
    }),
    h('p', { class: 'caption' }, 'Saved automatically.')
  );
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function courseSelect(value, key, onchange, courses) {
  return h(
    'select',
    { name: 'course', 'data-key': key, onchange },
    h('option', { value: '', selected: !value }, 'Personal (no course)'),
    courses.map((c) => h('option', { value: c.id, selected: value === c.id }, c.nick))
  );
}

function todoDetails(item, ctx) {
  return [
    h(
      'header',
      { class: 'd-header' },
      h('input', { class: 'title-input', value: item.title, 'aria-label': 'Title', 'data-key': 'todo-title', onchange: (e) => e.target.value.trim() && updateTodo(item.id, { title: e.target.value.trim() }) }),
      item.dueAt ? h('p', { class: 'd-due' }, `Due ${formatDateTime(item.dueAt, ctx.tz)}`, h('span', { class: `tone-${dueTone(item, ctx.now)}` }, ` · ${dueText(item, ctx.now, ctx.tz)}`)) : null
    ),
    h(
      'div',
      { class: 'd-actions' },
      h('button', { class: ['btn', 'btn-secondary', item.done && 'is-on'], 'data-key': 'd-done', onclick: () => toggleDone(item) }, icon('check'), item.done ? 'Done' : 'Mark done'),
      feat('pins') ? iconButton('pin', item.pinned ? 'Unpin' : 'Pin to top', () => togglePin(item), { class: item.pinned ? 'is-on' : '', key: 'd-pin' }) : null,
      iconButton('trash', 'Delete to-do', () => (deleteTodo(item.id), closeDrawer()), { key: 'd-delete' })
    ),
    block(
      'Details',
      kv([
        ['Course', courseSelect(item.courseId, 'todo-course', (e) => updateTodo(item.id, { courseId: e.target.value || null }), ctx.courses)],
        ['Due', h('input', { type: 'datetime-local', value: toLocalInput(item.dueAt), 'data-key': 'todo-due', onchange: (e) => updateTodo(item.id, { dueAt: e.target.value ? new Date(e.target.value).toISOString() : null }) })],
        ['Type', typeSelect(item)],
      ])
    ),
    ...planBlocks(item, ctx),
    feat('subtasks') ? subtasks(item) : null,
    feat('notes') ? notes(item) : null,
  ];
}

function newTodoForm(ctx) {
  return h(
    'form',
    {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        const f = e.target.elements;
        if (!f.title.value.trim()) return f.title.focus();
        const id = await addTodo({ title: f.title.value, courseId: f.course.value, dueAt: f.due.value ? new Date(f.due.value).toISOString() : null, type: f.type.value });
        openDrawer('item', id);
      },
    },
    h('label', { class: 'form-field' }, h('span', null, 'What do you need to do?'), h('input', { name: 'title', class: 'text-input', placeholder: 'Read chapter 4', autofocus: true, 'data-key': 'new-title', autocomplete: 'off' })),
    h('label', { class: 'form-field' }, h('span', null, 'Course'), courseSelect(null, 'new-course', null, ctx.courses)),
    h('label', { class: 'form-field' }, h('span', null, 'Due (optional)'), h('input', { name: 'due', type: 'datetime-local', 'data-key': 'new-due' })),
    h(
      'label',
      { class: 'form-field' },
      h('span', null, 'Type'),
      h('select', { name: 'type', 'data-key': 'new-type' }, [['todo', 'To-do'], ['reading', 'Reading'], ['exam', 'Exam / study'], ['assignment', 'Assignment']].map(([v, l]) => h('option', { value: v }, l)))
    ),
    h('div', { class: 'd-actions' }, button('Add to-do', null, { kind: 'primary', type: 'submit', key: 'new-submit' }), button('Cancel', closeDrawer, { key: 'new-cancel' }))
  );
}

function courseDetails(c, ctx) {
  const { now, tz } = ctx;
  const mine = listable(ctx.allItems).filter((i) => i.courseId === c.id);
  const upcoming = mine.filter((i) => !i.done && !i.overdue && i.dueAt && new Date(i.dueAt).getTime() >= now).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const overdue = mine.filter((i) => i.overdue);
  const recent = mine.filter((i) => i.status === 'graded').sort((a, b) => new Date(b.sub?.gradedAt || b.dueAt || 0) - new Date(a.sub?.gradedAt || a.dueAt || 0)).slice(0, 5);
  return [
    h(
      'header',
      { class: 'd-header' },
      h('span', { class: 'd-course' }, dot(ctx.colorOf(c.id)), ctx.nickOf(c.id)),
      h('h2', { class: 'd-title' }, c.name),
      c.term ? h('p', { class: 'd-due' }, c.term) : null
    ),
    h(
      'div',
      { class: 'd-actions' },
      h('a', { class: 'btn btn-primary', href: c.url, target: '_blank', rel: 'noopener', 'data-key': 'course-open' }, 'Open in Canvas', icon('external')),
      h('a', { class: 'btn btn-secondary', href: '#/settings', 'data-key': 'course-customize', onclick: closeDrawer }, 'Customize')
    ),
    block('Current score', h('p', { class: 'big-num' }, c.score != null ? `${c.score.toFixed(1)}%` : c.hideTotals ? 'Hidden by instructor' : '—'), h('p', { class: 'caption' }, 'As calculated by Canvas.')),
    overdue.length ? block('Overdue', h('div', { class: 'rows' }, overdue.map((i) => itemRow(i, { now, tz, showCourse: false, showLate: true })))) : null,
    block('Upcoming', upcoming.length ? h('div', { class: 'rows' }, upcoming.slice(0, 10).map((i) => itemRow(i, { now, tz, showCourse: false }))) : emptyState('Nothing upcoming.')),
    recent.length ? block('Recently graded', h('div', { class: 'rows' }, recent.map((i) => itemRow(i, { now, tz, showCourse: false })))) : null,
  ];
}

const MARK_NOUN = { announcement: 'announcement', page: 'page', file: 'file', discussion: 'discussion', conversation: 'message', module: 'module' };

function hiddenList(ctx) {
  const ud = state.userdata;
  const ids = new Set([...Object.keys(ud.hidden), ...Object.keys(ud.snoozed).filter((id) => new Date(ud.snoozed[id]).getTime() > ctx.now)]);
  const items = ctx.allItems.filter((i) => ids.has(i.id));
  const marks = hiddenMarks(ud); // I2: announcements, pages, files, discussions, messages, modules
  if (!items.length && !marks.length) return emptyState('Nothing hidden.');
  return h(
    'ul',
    { class: 'hidden-list' },
    items.map((i) =>
      h(
        'li',
        null,
        h('span', { class: 'hidden-main' }, h('span', { class: 'row-title' }, i.title), h('span', { class: 'row-meta' }, i.courseId ? [dot(i.color), i.nick] : 'Personal', ' · ', ud.hidden[i.id] ? 'Hidden' : `Snoozed until ${formatDateTime(ud.snoozed[i.id], ctx.tz)}`)),
        button(ud.hidden[i.id] ? 'Unhide' : 'Wake up', () => unhideItem(i.id), { key: `unhide:${i.id}` })
      )
    ),
    marks.map((m) =>
      h(
        'li',
        null,
        h('span', { class: 'hidden-main' }, h('span', { class: 'row-title' }, m.title), h('span', { class: 'row-meta' }, m.courseId ? [dot(ctx.colorOf(m.courseId)), ctx.nickOf(m.courseId)] : null, m.courseId ? ' · ' : null, `Hidden ${MARK_NOUN[m.type] || ''}`)),
        button('Unhide', () => unhideMark(m.key), { key: `unhide:${m.key}` })
      )
    )
  );
}

export const SHORTCUTS = [
  ['1 – 5', 'Home, Courses, Grades, Calendar, Other'],
  [',', 'Settings'],
  ['/', 'Search'],
  ['j / k', 'Next / previous item'],
  ['Enter', 'Open details'],
  ['x', 'Mark focused item done'],
  ['p', 'Pin focused item'],
  ['n', 'New to-do'],
  ['w', 'What-if mode on / off'],
  ['a', 'Announcements'],
  ['i', 'Inbox'],
  ['m', 'Ask your mascot (Neko, or your theme’s)'],
  ['e', 'Add your own event to the calendar'],
  ['f', 'Start or stop focus on the selected item'],
  ['[ / ]', 'Calendar: previous / next'],
  ['t', 'Calendar: today'],
  ['r', 'Refresh from Canvas'],
  ['Esc', 'Close'],
  ['?', 'This list'],
];

function shortcutHelp() {
  return h('dl', { class: 'shortcuts' }, SHORTCUTS.map(([k, v]) => [h('dt', null, k.split(' ').map((p) => (p === '/' && k !== '/' ? ' / ' : p === '–' ? ' – ' : h('kbd', null, p)))), h('dd', null, v)]));
}

