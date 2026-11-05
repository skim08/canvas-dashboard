// J3 + J8: the mascot (Neko the cat by default; each theme has its own, see mascots.js).
// Moods: neutral, happy, worried, sleepy, celebrate. Code names still say "mochi": that was
// Neko's first name, and saved settings use it.

import { h } from './dom.js';
import { MASCOTS, themeOf, mascotMarkup } from './mascots.js';
import { state } from './store.js';
import { feat } from './components.js';
import { greeting } from '../lib/mochi.js';
import { mochiChatPanel } from './chatDrawer.js';
import { streak } from '../lib/progress.js';

const LABEL = { neutral: 'content', happy: 'happy', worried: 'a little worried', sleepy: 'sleepy', celebrate: 'celebrating' };

// J8: the mascot that goes with your theme (Neko the cat unless you pick another).
export const mascot = () => MASCOTS[themeOf(state.settings.palette).mascot];
export const mascotName = () => mascot().name;

export function mochiSvg(mood = 'neutral', size = 64) {
  const m = LABEL[mood] ? mood : 'neutral';
  const id = themeOf(state.settings.palette).mascot;
  const el = h('span', { class: ['mochi', `mochi-${m}`], role: 'img', 'aria-label': `${MASCOTS[id].name} the ${MASCOTS[id].animal}, ${LABEL[m]}` });
  el.innerHTML = mascotMarkup(id, m, size);
  return el;
}

export function mochiGreeting(ctx) {
  const atRisk = (ctx.grades?.courses || []).filter((c) => c.atRisk).map((c) => c.course.nick || ctx.nickOf(c.course.id));
  return greeting({
    items: ctx.items,
    classes: ctx.allItems.filter((i) => i.area === 'classes'),
    atRisk,
    streak: feat('streak') ? streak(ctx.items, state.userdata, ctx.now, ctx.tz) : null,
    name: state.settings.nickname || state.cache?.profile?.name || '', // K24: your chosen name first
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
