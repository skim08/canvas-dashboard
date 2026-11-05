// G13: type in a class's meeting times when the syllabus doesn't list them, so lectures,
// quiz sections and labs show as blocks on the calendar every week.

import { h } from './dom.js';
import { state, updateUser } from './store.js';
import { ui, closeDrawer, openDrawer, setUi, toast } from './actions.js';
import { button, iconButton, emptyState } from './components.js';
import { findProfile } from '../lib/profiles.js';
import { addDays, dayKey, formatTime, instantAt } from '../lib/time.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KINDS = ['Lecture', 'Quiz section', 'Lab', 'Discussion', 'Seminar'];
const uid = () => Math.random().toString(36).slice(2, 8);
const redraw = () => setUi({});

let draft = null;
let draftFor = null;

// The term's first and last day, so weekly meetings stop when the term does.
function termRange(course, ctx) {
  const today = dayKey(ctx.now, ctx.tz);
  return { from: course.termStart ? dayKey(course.termStart, ctx.tz) : addDays(today, -7), until: course.termEnd ? dayKey(course.termEnd, ctx.tz) : addDays(today, 120) };
}

const fmt = (t, ctx) => (t ? formatTime(instantAt('2026-01-05', ...t.split(':').map(Number), ctx.tz), ctx.tz) : '');

// Meetings the syllabus already gives (shown, not edited here).
function fromSyllabus(course) {
  const p = findProfile(course);
  return (p?.schedule?.classes || []).filter((c) => c.days?.length && (c.start || c.sections));
}

function save(course, ctx) {
  const rows = draft.filter((r) => r.days.length && r.start);
  const bad = draft.find((r) => (r.days.length || r.start) && !(r.days.length && r.start));
  if (bad) return toast('Each meeting needs at least one day and a start time.');
  if (rows.some((r) => r.end && r.end <= r.start)) return toast('An end time is before its start time.');
  const range = termRange(course, ctx);
  updateUser((ud) => {
    ud.classTimes = { ...(ud.classTimes || {}) };
    if (rows.length) ud.classTimes[course.id] = rows.map((r) => ({ id: r.id, name: r.name.trim() || 'Class', days: r.days, start: r.start, end: r.end || null, where: r.where.trim() || null, from: r.from || range.from, until: r.until || range.until }));
    else delete ud.classTimes[course.id];
    if (rows.length && ud.syllabusSkip?.[course.id]) ud.syllabusSkip = { ...ud.syllabusSkip, [course.id]: false };
  });
  draft = null;
  closeDrawer();
  toast(rows.length ? `Class times saved: ${course.nick} is on your calendar every week` : 'Class times removed');
}

function noMeetings(course) {
  updateUser((ud) => {
    ud.syllabusSkip = { ...(ud.syllabusSkip || {}), [course.id]: true };
  });
  draft = null;
  closeDrawer();
  toast(`OK: ${course.nick} won’t ask for class times`);
}

export function classTimesDrawer(courseId, ctx) {
  // The decorated course (with your nickname), or the raw one if it isn't listed as a class.
  const raw = [...ctx.courses, ...(ctx.otherCourses || [])].find((c) => c.id === courseId) || ctx.allCourses.find((c) => c.id === courseId);
  if (!raw) return emptyState('Class not found.');
  const course = { ...raw, nick: raw.nick || ctx.nickOf?.(courseId) || raw.autoNick || raw.code };
  if (draftFor !== `${courseId}#${ui.drawerSeq}` || !draft) {
    const saved = state.userdata.classTimes?.[courseId] || [];
    draft = saved.length ? structuredClone(saved).map((r) => ({ ...r, where: r.where || '', end: r.end || '' })) : [{ id: uid(), name: 'Lecture', days: [], start: '', end: '', where: '' }];
    draftFor = `${courseId}#${ui.drawerSeq}`;
  }
  const already = fromSyllabus(course);
  const range = termRange(course, ctx);
  const row = (r, i) =>
    h(
      'div',
      { class: 'syl-item' },
      h(
        'div',
        { class: 'syl-row' },
        h('label', { class: 'syl-field' }, h('span', null, 'Name'), h('input', { class: 'text-input', value: r.name, list: 'ct-kinds', 'data-key': `ct-name:${i}`, oninput: (e) => (r.name = e.target.value) })),
        h(
          'div',
          { class: 'syl-field' },
          h('span', null, 'Days'),
          h('div', { class: 'syl-days', role: 'group', 'aria-label': 'Days' }, DAYS.map((d) => h('button', { type: 'button', class: ['syl-day', r.days.includes(d) && 'is-on'], 'aria-pressed': String(r.days.includes(d)), 'data-key': `ct-day:${i}:${d}`, onclick: () => ((r.days = r.days.includes(d) ? r.days.filter((x) => x !== d) : DAYS.filter((x) => x === d || r.days.includes(x))), redraw()) }, d.slice(0, 2))))
        ),
        h('label', { class: 'syl-field' }, h('span', null, 'Starts'), h('input', { class: 'text-input syl-time', type: 'time', value: r.start, 'data-key': `ct-start:${i}`, onchange: (e) => (r.start = e.target.value) })),
        h('label', { class: 'syl-field' }, h('span', null, 'Ends'), h('input', { class: 'text-input syl-time', type: 'time', value: r.end, 'data-key': `ct-end:${i}`, onchange: (e) => (r.end = e.target.value) })),
        h('label', { class: 'syl-field' }, h('span', null, 'Room'), h('input', { class: 'text-input', value: r.where, placeholder: 'Optional', 'data-key': `ct-room:${i}`, oninput: (e) => (r.where = e.target.value) })),
        iconButton('x', 'Remove this meeting', () => (draft.splice(i, 1), redraw()), { key: `ct-rm:${i}` })
      )
    );
  return [
    h('header', { class: 'd-header' }, h('h2', { class: 'd-title' }, `${course.nick} class times`), h('p', { class: 'd-due' }, 'They show as blocks on your calendar every week.')),
    h('p', { class: 'd-lead' }, 'Add each time the class meets: lecture, quiz section, lab or discussion. Your class schedule (on your school’s registration site) lists the days, times and rooms.'),
    already.length
      ? h('section', { class: 'd-block' }, h('h3', null, 'From your syllabus'), h('ul', { class: 'plain-list' }, already.map((c) => h('li', null, `${c.name}: ${c.days.join(', ')}${c.start ? ` · ${fmt(c.start, ctx)}${c.end ? `–${fmt(c.end, ctx)}` : ''}` : ''}${c.where ? ` · ${c.where}` : ''}`))), h('p', { class: 'caption' }, 'Add anything missing below.'))
      : null,
    h('section', { class: 'd-block syl-group' }, h('h3', null, 'Your class times'), h('div', { class: 'syl-list' }, draft.map(row)), h('datalist', { id: 'ct-kinds' }, KINDS.map((k) => h('option', { value: k })))),
    h('div', { class: 'ct-add' }, h('span', { class: 'caption' }, 'Add:'), KINDS.slice(0, 4).map((k) => button(k, () => (draft.push({ id: uid(), name: k, days: [], start: '', end: '', where: '' }), redraw()), { key: `ct-add:${k}`, iconName: 'plus', kind: 'ghost' }))),
    h('p', { class: 'caption' }, `Weekly from ${range.from} until ${range.until} (your term). Days off from your syllabus are skipped.`),
    h(
      'div',
      { class: 'd-actions syl-save' },
      button('Save class times', () => save(course, ctx), { kind: 'primary', key: 'ct-save' }),
      button('Cancel', () => ((draft = null), closeDrawer()), { kind: 'ghost', key: 'ct-cancel' }),
      h('button', { class: 'link-btn', 'data-key': 'ct-none', onclick: () => noMeetings(course) }, 'This class has no class meetings (online)')
    ),
  ];
}

export const openClassTimes = (courseId) => openDrawer('classTimes', courseId);
