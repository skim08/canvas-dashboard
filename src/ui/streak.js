// D9: daily streak. A small chip on Home; details in a drawer.

import { h } from './dom.js';
import { icon } from './icons.js';
import { state } from './store.js';
import { openDrawer } from './actions.js';
import { feat } from './components.js';
import { streak } from '../lib/progress.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const keyLabel = (key, opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(`${key}T12:00:00Z`));

export const streakOf = (ctx) => streak(ctx.items, state.userdata, ctx.now, ctx.tz);

export function streakChip(ctx) {
  if (!feat('streak')) return null;
  const s = streakOf(ctx);
  const t = s.today;
  const title = t.state === 'open' ? `${t.total - t.done} left today to keep it going` : t.state === 'done' ? 'Everything due today is done' : 'Nothing due today';
  return h(
    'button',
    { class: ['streak-chip', s.current > 0 && 'is-on'], 'data-key': 'streak', title, onclick: () => openDrawer('streak') },
    icon('flame', 14),
    s.current ? `${s.current}-day streak` : 'No streak yet'
  );
}

export function streakDrawer(ctx) {
  const s = streakOf(ctx);
  const t = s.today;
  // Calendar weeks, Monday first, ending this week.
  const pad = (new Date(`${s.recent[0].key}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells = [...Array.from({ length: pad }, () => null), ...s.recent];
  const STATE = { done: 'Everything done', missed: 'Something missed or late', open: 'Today, in progress', none: 'Nothing due' };
  return [
    h(
      'header',
      { class: 'd-header streak-head' },
      h('div', { class: 'streak-big' }, icon('flame', 28), h('strong', null, String(s.current)), h('span', null, s.current === 1 ? 'day' : 'days')),
      h('p', { class: 'd-due' }, `Best: ${plural(s.best, 'day')}`)
    ),
    h(
      'p',
      { class: ['streak-today', t.state === 'open' && 'is-open'] },
      t.state === 'open' ? `${t.total - t.done} of ${t.total} still due today. Finish them to keep your streak going.` : t.state === 'done' ? `Today’s done: all ${t.total} finished.` : 'Nothing due today. Your streak is safe.'
    ),
    h('div', { class: 'streak-grid-head' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('span', null, d))),
    h(
      'div',
      { class: 'streak-grid' },
      cells.map((d) =>
        d
          ? h('span', { class: ['streak-day', `is-${d.state}`, d.key === t.key && 'is-today'], title: `${keyLabel(d.key, { weekday: 'short', month: 'short', day: 'numeric' })}: ${STATE[d.state]}${d.total ? ` (${d.done} of ${d.total})` : ''}` }, keyLabel(d.key, { day: 'numeric' }))
          : h('span', { class: 'streak-day is-blank' })
      )
    ),
    h('div', { class: 'streak-legend' }, ['done', 'missed', 'none'].map((k) => h('span', null, h('span', { class: `streak-dot is-${k}` }), STATE[k]))),
    h('p', { class: 'caption' }, 'A day counts when everything due that day is turned in or checked off by the end of the day. Days with nothing due don’t break your streak. Events, lectures and in-person exams aren’t tasks.'),
  ];
}
