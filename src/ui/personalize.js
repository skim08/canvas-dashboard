// K24: "Make Neko yours": six quick questions, one per screen, each skippable. Answers
// are saved as you go (they're ordinary settings, so they're in backup and can be
// changed in Settings later). Used in first-run setup and from Settings.

import { h } from './dom.js';
import { state, updateSettings } from './store.js';
import { setUi } from './actions.js';
import { button, segmented } from './components.js';
import { setGradeSetting } from './gradeActions.js';
import { THEMES, MASCOTS, mascotMarkup } from './mascots.js';
import { mascot, mochiSvg } from './mochi.js';
import * as G from '../lib/grades.js';

const pq = { i: 0, name: null };
const redraw = () => setUi({});

const firstName = () => (state.settings.nickname || (state.cache?.profile?.name || '').split(' ')[0] || '').trim();

function choice(label, sub, on, onclick, key, art = null) {
  return h('button', { class: ['setup-choice', 'pq-choice', on && 'is-on'], role: 'radio', 'aria-checked': String(on), 'data-key': key, onclick }, art, h('span', { class: 'pq-choice-text' }, h('strong', null, label), sub ? h('span', null, sub) : null));
}

// The questions, in order. Each returns its title, a short why, and its controls.
const QUESTIONS = [
  {
    id: 'buddy',
    title: () => 'Pick your study buddy',
    why: 'Each buddy comes with its own colors. You can switch any time on the Themes tab.',
    body: () =>
      h(
        'div',
        { class: 'pq-buddies', role: 'radiogroup' },
        THEMES.filter((t) => t.id !== 'classic').map((t) => {
          const art = h('span', { class: 'pq-art', 'aria-hidden': 'true' });
          art.innerHTML = mascotMarkup(t.mascot, 'happy', 56);
          return choice(MASCOTS[t.mascot].name, `${MASCOTS[t.mascot].animal[0].toUpperCase()}${MASCOTS[t.mascot].animal.slice(1)} · ${t.title}`, (state.settings.palette || 'pink') === t.id, () => updateSettings({ palette: t.id }), `pq-buddy:${t.id}`, art);
        })
      ),
    auto: true,
  },
  {
    id: 'name',
    title: () => `What should ${mascot().name} call you?`,
    why: 'Used in your daily greeting. Only on this computer.',
    body: () => {
      if (pq.name == null) pq.name = firstName();
      return h('input', { class: 'text-input pq-input', value: pq.name, placeholder: 'Your first name or a nickname', maxlength: '30', 'data-key': 'pq-name', oninput: (e) => (pq.name = e.target.value), onkeydown: (e) => e.key === 'Enter' && next() });
    },
    save: () => updateSettings({ nickname: (pq.name || '').trim() || null }),
  },
  {
    id: 'goal',
    title: () => 'What GPA are you aiming for?',
    why: 'Neko shows how each class is tracking against it and what you need on what’s left.',
    body: () => {
      const sys = G.systemOf(state.grades);
      // In plain words for letter-grade schools; UW's decimal grades speak for themselves.
      const opts =
        sys === 'uw'
          ? [[4.0], [3.9], [3.7], [3.5], [3.3], [3.0]]
          : sys === 'letter'
            ? [[4.0, 'All A’s'], [3.5, 'A’s and B’s'], [3.0, 'Mostly B’s'], [2.5, 'B’s and C’s']]
            : [[4.0, 'All A’s'], [3.7, 'Mostly A−'], [3.3, 'Mostly B+'], [3.0, 'Mostly B’s']];
      return h(
        'div',
        { class: 'pq-chips', role: 'radiogroup' },
        opts.map(([v, words]) => choice(v.toFixed(1), words || null, Math.abs(state.grades.targetGpa - v) < 0.001, () => setGradeSetting('targetGpa', v), `pq-goal:${v}`))
      );
    },
    auto: true,
  },
  {
    id: 'workload',
    title: () => 'How much schoolwork a day feels like enough?',
    why: 'The calendar warns you when a day’s plans go over this.',
    body: () => h('div', { class: 'pq-chips', role: 'radiogroup' }, [2, 3, 4, 6, 8].map((v) => choice(`${v} hours`, null, state.settings.workloadLimit === v, () => updateSettings({ workloadLimit: v }), `pq-work:${v}`))),
    auto: true,
  },
  {
    id: 'reminders',
    title: () => `How should ${mascot().name} remind you?`,
    why: 'Reminders are Chrome notifications. Change them any time in Settings → Notifications.',
    body: () => {
      const f = state.settings.features;
      const hours = (state.settings.notify.reminderHours || []).join(',');
      const mode = f.deadlineReminders === false ? (f.morningSummary === false ? 'none' : 'morning') : hours === '48,24' ? 'early' : 'standard';
      const pick = (m) =>
        updateSettings((s) => {
          s.features = { ...s.features, deadlineReminders: m === 'standard' || m === 'early', morningSummary: m !== 'none' };
          if (m === 'standard') s.notify = { ...s.notify, reminderHours: [24, 2] };
          if (m === 'early') s.notify = { ...s.notify, reminderHours: [48, 24] };
          return s;
        });
      return [
        h(
          'div',
          { class: 'pq-list', role: 'radiogroup' },
          choice('A day before, and 2 hours before', 'Plus a morning summary of your day', mode === 'standard', () => pick('standard'), 'pq-rem:standard'),
          choice('Two days before, and the day before', 'For people who like a head start. Plus a morning summary', mode === 'early', () => pick('early'), 'pq-rem:early'),
          choice('Just a morning summary', 'One notification each morning with what’s due', mode === 'morning', () => pick('morning'), 'pq-rem:morning'),
          choice('No notifications', 'Everything still shows on your dashboard', mode === 'none', () => pick('none'), 'pq-rem:none')
        ),
        mode !== 'none'
          ? h(
              'label',
              { class: 'setup-inline' },
              h('span', null, 'Morning summary at'),
              h('select', { 'data-key': 'pq-morning', onchange: (e) => updateSettings((s) => ((s.notify = { ...s.notify, morningTime: e.target.value }), s)) }, ['07:00', '08:00', '09:00', '10:00'].map((t) => h('option', { value: t, selected: state.settings.notify.morningTime === t }, `${Number(t.slice(0, 2))}:00 AM`)))
            )
          : null,
      ];
    },
  },
  {
    id: 'look',
    title: () => 'Last one: how should it look?',
    why: 'Both can be changed in Settings → Appearance.',
    body: () =>
      h(
        'div',
        { class: 'pq-look' },
        h('div', { class: 'pq-look-row' }, h('span', null, 'Light or dark'), segmented([['light', 'Light'], ['dark', 'Dark'], ['system', 'Match my computer']], state.settings.theme, (v) => updateSettings({ theme: v }), 'pq-theme')),
        h('div', { class: 'pq-look-row' }, h('span', null, 'Lists'), segmented([['comfortable', 'Roomy'], ['compact', 'Compact']], state.settings.density, (v) => updateSettings({ density: v }), 'pq-density'))
      ),
  },
];

let onFinish = () => {};

// After picking a choice, move on once (a double-click or a quick Next mustn't skip a question).
let pending = null;
function autoNext() {
  if (pending) return;
  const at = pq.i;
  pending = setTimeout(() => {
    pending = null;
    if (pq.i === at) next();
  }, 180);
}

function next() {
  clearTimeout(pending);
  pending = null;
  const q = QUESTIONS[pq.i];
  q.save?.();
  if (pq.i < QUESTIONS.length - 1) pq.i += 1;
  else finish();
  redraw();
}
function back() {
  QUESTIONS[pq.i].save?.();
  pq.i = Math.max(0, pq.i - 1);
  redraw();
}
function finish() {
  QUESTIONS[pq.i].save?.();
  updateSettings({ personalized: true });
  pq.i = 0;
  pq.name = null;
  onFinish();
}

export const startPersonalize = () => {
  pq.i = 0;
  pq.name = null;
};

// The current question. `done` runs after the last question (or "Skip the rest").
export function personalizeQuiz({ done, setupStep = null }) {
  onFinish = done;
  const q = QUESTIONS[pq.i];
  const last = pq.i === QUESTIONS.length - 1;
  return h(
    'div',
    { class: 'pq' },
    h('div', { class: 'pq-head' }, mochiSvg('happy', 64), h('p', { class: 'setup-step' }, `${setupStep ? `${setupStep} · ` : ''}Question ${pq.i + 1} of ${QUESTIONS.length}`), h('div', { class: 'pq-dots', 'aria-hidden': 'true' }, QUESTIONS.map((_, k) => h('span', { class: ['pq-dot', k <= pq.i && 'is-on'] })))),
    h('h1', { class: 'setup-title' }, q.title()),
    h('p', { class: 'setup-lead' }, q.why),
    h('div', { class: 'pq-body', onclick: q.auto ? (e) => e.target.closest('.pq-choice') && autoNext() : null }, q.body()),
    h(
      'div',
      { class: 'setup-actions' },
      pq.i > 0 ? button('Back', back, { kind: 'ghost', key: 'pq-back' }) : null,
      button(last ? 'Done' : 'Next', next, { kind: 'primary', key: 'pq-next' })
    ),
    h('div', { class: 'pq-skips' }, !last ? h('button', { class: 'link-btn', 'data-key': 'pq-skip', onclick: () => ((pq.i += 1), redraw()) }, 'Skip this question') : null, h('button', { class: 'link-btn', 'data-key': 'pq-skip-all', onclick: finish }, 'Skip the rest'))
  );
}

export const PERSONALIZE_QUESTIONS = QUESTIONS.map((q) => q.id);
