// J3: Mochi, an original cat drawn here (no image files, nothing downloaded).
// Moods: neutral, happy, worried, sleepy, celebrate.

import { h } from './dom.js';
import { state } from './store.js';
import { feat } from './components.js';
import { greeting } from '../lib/mochi.js';
import { mochiChatPanel } from './chatDrawer.js';
import { streak } from '../lib/progress.js';

const INK = '#4a3a40';
const FUR = '#fff8f5';
const PINK = '#f5b3c8';
const NOSE = '#e77fa0';

const EYES = {
  neutral: `<g class="mochi-eyes"><ellipse cx="45" cy="57" rx="4.5" ry="5.5" fill="${INK}"/><ellipse cx="75" cy="57" rx="4.5" ry="5.5" fill="${INK}"/><circle cx="46.5" cy="55" r="1.5" fill="#fff"/><circle cx="76.5" cy="55" r="1.5" fill="#fff"/></g>`,
  happy: `<path d="M39 59 q6 -8 12 0 M69 59 q6 -8 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  worried: `<g class="mochi-eyes"><ellipse cx="45" cy="58" rx="4" ry="5" fill="${INK}"/><ellipse cx="75" cy="58" rx="4" ry="5" fill="${INK}"/></g><path d="M38 48 L50 44 M70 44 L82 48" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
  sleepy: `<path d="M39 57 q6 5 12 0 M69 57 q6 5 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};
EYES.celebrate = EYES.happy;

const MOUTH = {
  neutral: `<path d="M52 70 q4 5 8 0 q4 5 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  worried: `<path d="M53 73 q3.5 -3 7 0 q3.5 3 7 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  sleepy: `<path d="M56 71 h8" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
  celebrate: `<path d="M51 69 q9 13 18 0 z" fill="${NOSE}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
};
MOUTH.happy = MOUTH.neutral;

const EXTRA = {
  worried: `<path d="M97 36 q4 7 0 10 q-4 -3 0 -10z" fill="#9cc9f0"/>`,
  sleepy: `<text x="94" y="30" font-size="14" font-family="ui-rounded, sans-serif" fill="${INK}">z</text><text x="103" y="20" font-size="10" font-family="ui-rounded, sans-serif" fill="${INK}">z</text>`,
  celebrate: `<path d="M12 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z M106 22 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="#f2c48d"/>`,
};

const LABEL = { neutral: 'content', happy: 'happy', worried: 'a little worried', sleepy: 'sleepy', celebrate: 'celebrating' };

export function mochiSvg(mood = 'neutral', size = 64) {
  const m = EYES[mood] ? mood : 'neutral';
  const el = h('span', { class: ['mochi', `mochi-${m}`], role: 'img', 'aria-label': `Mochi the cat, ${LABEL[m]}` });
  el.innerHTML = `<svg width="${size}" height="${Math.round(size * 0.92)}" viewBox="0 0 120 110" aria-hidden="true">
    <path d="M24 46 L30 10 L55 30 Z M96 46 L90 10 L65 30 Z" fill="${FUR}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M31 37 L33 20 L46 31 Z M89 37 L87 20 L74 31 Z" fill="${PINK}"/>
    <ellipse cx="38" cy="99" rx="11" ry="7" fill="${FUR}" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="82" cy="99" rx="11" ry="7" fill="${FUR}" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="60" cy="61" rx="44" ry="37" fill="${FUR}" stroke="${INK}" stroke-width="3"/>
    <path d="M55 27 q5 -6 10 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="34" cy="70" rx="8" ry="5" fill="${PINK}"/><ellipse cx="86" cy="70" rx="8" ry="5" fill="${PINK}"/>
    <path d="M22 64 L6 60 M22 70 L6 73 M98 64 L114 60 M98 70 L114 73" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M56 63 h8 l-4 4.5 z" fill="${NOSE}" stroke="${NOSE}" stroke-width="1.5" stroke-linejoin="round"/>
    ${EYES[m]}${MOUTH[m]}${EXTRA[m] || ''}
  </svg>`;
  return el;
}

export function mochiGreeting(ctx) {
  const atRisk = (ctx.grades?.courses || []).filter((c) => c.atRisk).map((c) => c.course.nick || ctx.nickOf(c.course.id));
  return greeting({
    items: ctx.items,
    classes: ctx.allItems.filter((i) => i.area === 'classes'),
    atRisk,
    streak: feat('streak') ? streak(ctx.items, state.userdata, ctx.now, ctx.tz) : null,
    name: state.cache?.profile?.name || '',
    now: ctx.now,
    tz: ctx.tz,
  });
}

// J3 + J4: Mochi's panel on Home: the day's summary with the chat right under it.
// On wide windows it's as tall as the Grades + Exams column (see balanceHome in home.js).
export function mochiPanel(ctx) {
  if (!feat('mochi') || !state.cache) return null;
  const g = mochiGreeting(ctx);
  return h(
    'section',
    { class: 'mochi-panel' },
    h('header', { class: 'mochi-head' }, mochiSvg(g.mood, 56), h('strong', { class: 'mochi-hello' }, g.title)),
    h('div', { class: 'mochi-bubble' }, g.lines.map((l) => h('p', null, l))),
    mochiChatPanel(ctx)
  );
}

// J7: Mochi in happy empty states.
export function mochiEmpty(text, mood = 'happy') {
  if (!feat('mochi')) return null;
  return h('div', { class: 'empty mochi-empty' }, mochiSvg(mood, 56), h('p', null, text));
}
