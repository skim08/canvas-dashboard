// K1 + K9: first-run setup. Shown until a school is chosen and Chrome allows the
// dashboard to read that one site; new installs then get a few optional steps.

import { h } from '../dom.js';
import { state, updateSettings, requestSync, startDemo } from '../store.js';
import { button, segmented } from '../components.js';
import { openDrawer } from '../actions.js';
import { setGradeSetting } from '../gradeActions.js';
import { courseRole } from '../../lib/model.js';
import { findProfile } from '../../lib/profiles.js';
import * as G from '../../lib/grades.js';
import { TERM_TYPES } from '../../lib/term.js';
import { term } from '../term.js';
import { mochiSvg } from '../mochi.js';
import * as storage from '../../lib/storage.js';
import { isExtension, isDev, isDemo, devScenario, CANVAS_ORIGIN } from '../../lib/env.js';
import { normalizeSchool, requestAccess, dropAccess, checkCanvas, hostOf } from '../../lib/school.js';
import { feat } from '../components.js';

// Local to this screen: what you've typed and what the last check said.
const su = { input: '', origin: null, status: null, error: null, busy: false, changing: false, step: 'classes' };
let rerender = () => {};

function set(patch) {
  Object.assign(su, patch);
  rerender();
}

// Test mode has no real Canvas: addresses with "example" act like non-Canvas sites,
// and "login." ones like a school where you're signed out.
function check(origin) {
  if (isExtension) return checkCanvas(origin);
  const host = hostOf(origin);
  return Promise.resolve(host.includes('example') ? 'not-canvas' : host.startsWith('login.') && su.status !== 'login' ? 'login' : 'ok');
}

const MESSAGES = {
  'not-canvas': 'That address doesn’t look like Canvas. Open Canvas in a tab and copy the address from the top of the window (for example canvas.yourschool.edu or yourschool.instructure.com).',
  offline: 'Couldn’t reach that address. Check your connection and the spelling, then try again.',
  denied: 'Chrome needs your OK to read your Canvas. Press Continue again and choose Allow.',
};

async function finish(origin) {
  const changed = state.settings.canvasOrigin && state.settings.canvasOrigin !== origin;
  if (changed) {
    // A different school: its Canvas data starts fresh; everything you entered stays.
    await storage.remove(['cache', 'auth', 'netStatus', 'syncState']);
    dropAccess(state.settings.canvasOrigin);
  }
  await updateSettings({ canvasOrigin: origin });
  set({ status: 'ok', busy: false, error: null, changing: false, input: '' });
  requestSync(true);
}

async function afterAccess(origin, granted) {
  if (!granted) return set({ busy: false, error: MESSAGES.denied });
  const result = await check(origin);
  if (result === 'ok') return finish(origin);
  if (result === 'login') return set({ busy: false, origin, status: 'login', error: null });
  if (!state.settings.canvasOrigin || state.settings.canvasOrigin !== origin) dropAccess(origin);
  set({ busy: false, error: MESSAGES[result] || MESSAGES['not-canvas'] });
}

function onContinue(e) {
  e?.preventDefault();
  const r = normalizeSchool(su.input);
  if (r.error) return set({ error: r.error });
  // Chrome only shows its permission prompt for a click, so ask before anything else.
  const ask = requestAccess(r.origin);
  set({ busy: true, error: null, origin: r.origin });
  ask.then((granted) => afterAccess(r.origin, granted)).catch(() => set({ busy: false, error: MESSAGES.denied }));
}

function signedIn() {
  set({ busy: true, error: null });
  check(su.origin).then((result) => (result === 'ok' ? finish(su.origin) : set({ busy: false, status: 'login', error: result === 'login' ? 'Still signed out. Finish signing in on the Canvas tab, then press this again.' : MESSAGES[result] })));
}

function schoolStep() {
  if (su.status === 'login') {
    return [
      h('h1', { class: 'setup-title' }, 'Sign in to Canvas'),
      h('p', { class: 'setup-lead' }, `Sign in at ${hostOf(su.origin)} the way you normally do. The dashboard uses that login; it never sees your password.`),
      h(
        'div',
        { class: 'setup-actions' },
        h('a', { class: 'btn btn-primary', href: `${su.origin}/login`, target: '_blank', rel: 'noopener', 'data-key': 'setup-login' }, 'Open Canvas sign-in'),
        button(su.busy ? 'Checking…' : 'I’ve signed in', signedIn, { key: 'setup-signed-in', disabled: su.busy })
      ),
      su.error ? h('p', { class: 'setup-error', role: 'alert' }, su.error) : null,
      h('button', { class: 'link-btn', 'data-key': 'setup-back', onclick: () => set({ status: null, error: null }) }, 'Use a different address'),
    ];
  }
  const current = state.settings.canvasOrigin;
  return [
    h('h1', { class: 'setup-title' }, su.changing ? 'Change school' : current ? 'Allow access to your Canvas' : 'Which Canvas does your school use?'),
    h(
      'p',
      { class: 'setup-lead' },
      current && !su.changing
        ? `Chrome needs your OK to read ${hostOf(current)}. Your data stays on this computer.`
        : 'Type the address you see when you’re on Canvas. The dashboard only ever talks to this one site, and everything stays on this computer.'
    ),
    h(
      'form',
      { class: 'setup-form', onsubmit: onContinue },
      h('label', { class: 'visually-hidden', for: 'setup-school' }, 'Canvas address'),
      h('input', {
        id: 'setup-school',
        class: 'text-input setup-input',
        type: 'text',
        inputmode: 'url',
        autocomplete: 'url',
        spellcheck: 'false',
        placeholder: 'canvas.yourschool.edu',
        value: su.input,
        'data-key': 'setup-school',
        oninput: (e) => {
          su.input = e.target.value;
          if (su.error) set({ error: null });
        },
      }),
      button(su.busy ? 'Checking…' : 'Continue', null, { kind: 'primary', key: 'setup-continue', type: 'submit', disabled: su.busy })
    ),
    su.error ? h('p', { class: 'setup-error', role: 'alert' }, su.error) : null,
    h('p', { class: 'setup-hint' }, 'Examples: canvas.uw.edu, canvas.asu.edu, yourschool.instructure.com'),
    !su.changing ? h('div', { class: 'setup-demo' }, h('span', null, 'Just looking?'), button('Try it with sample data', startDemo, { key: 'setup-demo', kind: 'ghost' })) : null, // K16
    su.changing ? h('button', { class: 'link-btn', 'data-key': 'setup-cancel', onclick: () => set({ changing: false, error: null, input: '' }) }, `Keep using ${hostOf(current)}`) : null,
  ];
}

// K9: after the school, new students get three short, skippable steps.
const STEPS = ['classes', 'grading', 'syllabi'];

export function needsSetup() {
  // Test mode with sample data skips the optional steps (try them with ?scenario=setup).
  const sample = (isDev && devScenario() !== 'setup') || isDemo();
  return !CANVAS_ORIGIN || state.access === false || su.changing || (!state.settings.setupDone && !sample);
}

const finishSetup = () => updateSettings({ setupDone: true });
const stepOf = () => (STEPS.includes(su.step) ? su.step : 'classes');
const go = (step) => set({ step });

function stepNav(step, { next = 'Next' } = {}) {
  const i = STEPS.indexOf(step);
  return h(
    'div',
    { class: 'setup-actions' },
    i > 0 ? button('Back', () => go(STEPS[i - 1]), { kind: 'ghost', key: 'setup-prev' }) : null,
    i < STEPS.length - 1 ? button(next, () => go(STEPS[i + 1]), { kind: 'primary', key: 'setup-next' }) : button('Finish', finishSetup, { kind: 'primary', key: 'setup-finish' })
  );
}

function progress(step) {
  const i = STEPS.indexOf(step);
  return h('p', { class: 'setup-step' }, `Step ${i + 2} of ${STEPS.length + 1}`);
}

function classesStep() {
  const courses = (state.cache?.courses || []).filter((c) => !c.unavailable);
  const set1 = (c, patch) => updateSettings((s) => ((s.courses[c.id] = { ...(s.courses[c.id] || {}), ...patch }), s));
  return [
    progress('classes'),
    h('h1', { class: 'setup-title' }, 'Which of these are your classes?'),
    h('p', { class: 'setup-lead' }, 'Classes count toward your grades and to-do list. Clubs, advising and other Canvas sites go under Other.'),
    state.cache
      ? h(
          'div',
          { class: 'setup-list' },
          courses.map((c) =>
            h(
              'div',
              { class: 'setup-row' },
              h('span', { class: 'setup-row-name' }, h('strong', null, c.autoNick || c.code), h('span', null, c.name)),
              segmented([['core', 'Class'], ['other', 'Other']], courseRole(c, state.settings), (v) => set1(c, { role: v }), `setup-role:${c.id}`)
            )
          )
        )
      : h('p', { class: 'setup-hint' }, state.auth.state === 'expired' ? 'Your Canvas sign-in expired. Sign in again in another tab, then come back.' : 'Loading your classes from Canvas…'),
    stepNav('classes'),
  ];
}

function gradingStep() {
  const sys = G.systemOf(state.grades);
  return [
    progress('grading'),
    h('h1', { class: 'setup-title' }, 'How does your school grade?'),
    h('p', { class: 'setup-lead' }, 'Used for letter grades and GPA. You can change this, and each class’s scale, later.'),
    h(
      'div',
      { class: 'setup-choices', role: 'radiogroup' },
      Object.entries(G.SYSTEMS).map(([id, s]) =>
        h('button', { class: ['setup-choice', sys === id && 'is-on'], role: 'radio', 'aria-checked': String(sys === id), 'data-key': `setup-sys:${id}`, onclick: () => setGradeSetting('system', id) }, h('strong', null, s.label), h('span', null, `Usually ${s.credits} credits per class`))
      )
    ),
    h(
      'label',
      { class: 'setup-inline' },
      h('span', null, 'Terms'),
      h('select', { 'data-key': 'setup-term', onchange: (e) => updateSettings({ termType: e.target.value || null }) }, h('option', { value: '', selected: !state.settings.termType }, `Detect from Canvas (${term()}s)`), Object.entries(TERM_TYPES).map(([v, label]) => h('option', { value: v, selected: state.settings.termType === v }, label)))
    ),
    stepNav('grading'),
  ];
}

function syllabiStep() {
  const classes = (state.cache?.courses || []).filter((c) => !c.unavailable && courseRole(c, state.settings) === 'core');
  const has = (c) => findProfile(c);
  return [
    progress('syllabi'),
    h('h1', { class: 'setup-title' }, 'Add your syllabi (optional)'),
    h('p', { class: 'setup-lead' }, 'Exams, deadlines and class times from your syllabi go on your calendar. You check everything before it’s saved. You can also do this later from each class’s page.'),
    h(
      'div',
      { class: 'setup-list' },
      classes.map((c) =>
        h(
          'div',
          { class: 'setup-row' },
          h('span', { class: 'setup-row-name' }, h('strong', null, c.autoNick || c.code), h('span', null, has(c) ? 'Syllabus added' : 'No syllabus yet')),
          button(has(c) ? 'Edit' : 'Add syllabus', () => (finishSetup(), (location.hash = `#/course/${c.id}`), openDrawer('syllabus', c.id)), { key: `setup-syl:${c.id}` })
        )
      )
    ),
    stepNav('syllabi'),
  ];
}

// Settings → General → School → Change.
export function startSchoolChange() {
  set({ changing: true, input: '', status: null, error: null });
}

export function renderSetup(onChange) {
  rerender = onChange;
  if (!su.input && !su.changing && state.settings.canvasOrigin) su.input = hostOf(state.settings.canvasOrigin);
  const schoolDone = CANVAS_ORIGIN && state.access !== false && !su.changing;
  const step = stepOf();
  const body = !schoolDone ? schoolStep() : step === 'grading' ? gradingStep() : step === 'syllabi' ? syllabiStep() : classesStep();
  return h(
    'main',
    { class: 'setup' },
    h(
      'section',
      { class: ['setup-card', schoolDone && 'is-wide'] },
      feat('mochi') && !schoolDone ? h('div', { class: 'setup-mascot' }, mochiSvg('happy', 72)) : null,
      body,
      schoolDone ? h('button', { class: 'link-btn', 'data-key': 'setup-skip', onclick: finishSetup }, 'Skip setup for now') : null,
      h('p', { class: 'setup-foot' }, 'Not affiliated with Instructure or your school.')
    )
  );
}
