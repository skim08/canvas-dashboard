// F18: write a new Canvas message. Pick a class or group, then who it's to (its
// instructors, its TAs, your whole group, or anyone Canvas lets you message there).
// It's sent through Canvas, as if you'd written it in Canvas's inbox.

import { h } from './dom.js';
import { icon } from './icons.js';
import { state } from './store.js';
import { closeDrawer, setUi } from './actions.js';
import { button } from './components.js';
import { sendNew, findRecipients, describeMessageError } from './inboxActions.js';
import { CANVAS_ORIGIN } from '../lib/env.js';

const redraw = () => setUi({});

let m = null; // the message being written
let mFor = null;
let searchTimer = null;

// Classes and groups you can send from.
export function contextsFor(ctx) {
  const courses = [...ctx.courses, ...(ctx.otherCourses || [])].map((c) => ({ id: `course_${c.id}`, name: c.nick || c.code || c.name, kind: 'course' }));
  const groups = (state.cache?.groups || []).map((g) => ({ id: `group_${g.id}`, name: g.name, kind: 'group', courseId: g.courseId }));
  return [...courses, ...groups];
}

// One-click "who": a class's instructors or TAs, or everyone in a group.
function quickPicks(context, ctx) {
  if (!context) return [];
  const c = contextsFor(ctx).find((x) => x.id === context);
  if (!c) return [];
  if (c.kind === 'group') return [{ id: context, name: `Everyone in ${c.name}` }];
  return [
    { id: `${context}_teachers`, name: `${c.name} instructors` },
    { id: `${context}_tas`, name: `${c.name} TAs` },
  ];
}

function start(id) {
  let init = {};
  try {
    init = JSON.parse(id || '{}') || {};
  } catch {
    /* plain new message */
  }
  return { context: init.context || '', to: init.to ? [init.to] : [], subject: init.subject || '', body: '', search: '', results: null, searching: false, busy: false, error: null };
}

function search(text) {
  m.search = text;
  clearTimeout(searchTimer);
  const mine = m;
  searchTimer = setTimeout(async () => {
    const context = mine.context;
    const query = mine.search.trim();
    if (!context) return;
    mine.searching = true;
    redraw();
    let results = [];
    let error = null;
    try {
      results = (await findRecipients(context, query)).filter((r) => r.type === 'user');
    } catch (e) {
      error = describeMessageError(e).replace(' Your text is still here.', '');
    }
    // A newer search (or another class) wins: drop answers that arrive late.
    if (mine.context !== context || mine.search.trim() !== query) return;
    mine.results = results;
    mine.error = error;
    mine.searching = false;
    if (m === mine) redraw();
  }, 250);
}

function setContext(v) {
  m.context = v;
  m.to = m.to.filter((r) => !/^(course|group)_/.test(r.id)); // the old class's "instructors" etc. no longer apply
  m.results = null;
  m.search = '';
  if (v) search('');
  redraw();
}

const has = (id) => m.to.some((r) => r.id === id);
const add = (r) => (has(r.id) ? null : m.to.push({ id: r.id, name: r.name }), redraw());
const remove = (id) => ((m.to = m.to.filter((r) => r.id !== id)), redraw());

async function send() {
  if (!m.context) return ((m.error = 'Pick a class or group first.'), redraw());
  if (!m.to.length) return ((m.error = 'Add at least one person to send it to.'), redraw());
  if (!m.body.trim()) return ((m.error = 'Write a message first.'), redraw());
  m.busy = true;
  m.error = null;
  redraw();
  const mine = m;
  const r = await sendNew({ recipients: mine.to.map((x) => x.id), subject: mine.subject.trim() || null, body: mine.body.trim(), contextCode: mine.context });
  mine.busy = false;
  if (r.ok) {
    m = null;
    mFor = null;
    closeDrawer();
  } else {
    mine.error = r.error;
    redraw();
  }
}

const field = (label, control, extra) => h('label', { class: ['form-field', extra] }, h('span', null, label), control);

export function composeDrawer(id, ctx) {
  if (mFor !== id || !m) {
    m = start(id);
    mFor = id;
    if (m.context) queueMicrotask(() => search(''));
  }
  const contexts = contextsFor(ctx);
  const picks = quickPicks(m.context, ctx);
  const people = (m.results || []).filter((r) => !has(r.id));
  return h(
    'form',
    {
      class: 'compose-form',
      onsubmit: (e) => {
        e.preventDefault();
        send();
      },
    },
    h('header', { class: 'd-header' }, h('h2', { class: 'd-title' }, 'New message'), h('p', { class: 'd-due' }, 'Sent through Canvas, so it shows up in their Canvas inbox and email.')),
    field(
      'Class or group',
      h(
        'select',
        { 'data-key': 'cm-context', disabled: m.busy, onchange: (e) => setContext(e.target.value) },
        h('option', { value: '', selected: !m.context }, 'Pick one…'),
        contexts.some((c) => c.kind === 'course') ? h('optgroup', { label: 'Classes' }, contexts.filter((c) => c.kind === 'course').map((c) => h('option', { value: c.id, selected: m.context === c.id }, c.name))) : null,
        contexts.some((c) => c.kind === 'group') ? h('optgroup', { label: 'Your groups' }, contexts.filter((c) => c.kind === 'group').map((c) => h('option', { value: c.id, selected: m.context === c.id }, c.name))) : null
      )
    ),
    h(
      'div',
      { class: 'form-field' },
      h('span', null, 'To'),
      m.to.length
        ? h('div', { class: 'chips cm-to' }, m.to.map((r) => h('span', { class: 'chip is-on' }, r.name, h('button', { type: 'button', class: 'chip-x', title: `Remove ${r.name}`, 'aria-label': `Remove ${r.name}`, 'data-key': `cm-rm:${r.id}`, onclick: () => remove(r.id) }, icon('x', 12)))))
        : h('p', { class: 'caption caption-tight' }, m.context ? 'Pick who below.' : 'Pick a class or group first.'),
      picks.length ? h('div', { class: 'chips cm-picks' }, picks.map((p) => h('button', { type: 'button', class: ['chip', has(p.id) && 'is-on'], 'aria-pressed': String(has(p.id)), 'data-key': `cm-pick:${p.id}`, onclick: () => (has(p.id) ? remove(p.id) : add(p)) }, icon(has(p.id) ? 'check' : 'plus', 12), p.name))) : null,
      m.context
        ? h(
            'div',
            { class: 'cm-search' },
            h('input', { class: 'text-input', type: 'search', value: m.search, placeholder: 'Or search for a person by name', 'aria-label': 'Search for a person', 'data-key': 'cm-search', disabled: m.busy, oninput: (e) => search(e.target.value), onkeydown: (e) => e.key === 'Enter' && (e.preventDefault(), people[0] && add(people[0])) }),
            m.searching && !m.results
              ? h('p', { class: 'caption caption-tight' }, 'Looking…')
              : people.length
                ? h('ul', { class: 'cm-results' }, people.slice(0, 8).map((p) => h('li', null, h('button', { type: 'button', class: 'cm-person', 'data-key': `cm-add:${p.id}`, onclick: () => add(p) }, icon('plus', 12), h('span', null, p.name), roleOf(p) ? h('span', { class: 'muted' }, roleOf(p)) : null))))
                : m.results && m.search && !m.results.length
                  ? h('p', { class: 'caption caption-tight' }, 'No one by that name here.')
                  : null
          )
        : null
    ),
    field('Subject', h('input', { class: 'text-input', value: m.subject, placeholder: 'Optional', maxlength: '255', 'data-key': 'cm-subject', disabled: m.busy, oninput: (e) => (m.subject = e.target.value) })),
    field('Message', h('textarea', { class: 'text-input cm-body', rows: 8, value: m.body, placeholder: m.context.startsWith('group_') ? 'Hi team…' : 'Hi Professor…', 'data-key': 'cm-body', disabled: m.busy, oninput: (e) => (m.body = e.target.value) })),
    m.error ? h('div', { class: 'submit-error', role: 'alert' }, h('p', null, m.error)) : null,
    h(
      'div',
      { class: 'd-actions' },
      button(m.busy ? 'Sending…' : 'Send', null, { kind: 'primary', type: 'submit', iconName: 'send', key: 'cm-send', disabled: m.busy }),
      button('Cancel', () => ((m = null), (mFor = null), closeDrawer()), { kind: 'ghost', key: 'cm-cancel', disabled: m.busy }),
      h('a', { class: 'link-btn', href: `${CANVAS_ORIGIN}/conversations`, target: '_blank', rel: 'noopener', 'data-key': 'cm-canvas' }, 'Attach a file in Canvas instead')
    )
  );
}

const ROLE = { TeacherEnrollment: 'Instructor', TaEnrollment: 'TA', StudentEnrollment: 'Student', DesignerEnrollment: 'Designer', ObserverEnrollment: 'Observer', Member: 'Member' };
const roleOf = (p) => [...new Set((p.roles || []).map((r) => ROLE[r]).filter(Boolean))].join(', ');
