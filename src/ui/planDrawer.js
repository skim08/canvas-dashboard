// Item details: estimate (G3), time spent (G7), plan sessions (G6), focus timer (G7).

import { h } from './dom.js';
import { state } from './store.js';
import { feat, button, iconButton } from './components.js';
import { estimateOf, plansFor, spentOf, formatMinutes } from '../lib/planning.js';
import { dayKey, addDays } from '../lib/time.js';
import { setEstimate, addPlan, updatePlan, deletePlan } from './planActions.js';
import { startFocus, stopFocus, focusState, FOCUS_LENGTHS } from './focus.js';

const STEPS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480];

// G7: the length picked for the next focus session, per item (until the page reloads).
const picked = {};

export function planBlocks(item, ctx) {
  if (item.kind === 'event' || item.done && !estimateOf(item, state.userdata) && !spentOf(item, state.userdata)) {
    return item.kind === 'event' ? [] : spentBlock(item);
  }
  const out = [];
  const est = estimateOf(item, state.userdata);
  const spent = spentOf(item, state.userdata);
  const f = focusState();
  const focusingThis = f && f.itemId === item.id;

  if (feat('estimates') || feat('focus')) {
    out.push(
      h(
        'section',
        { class: 'd-block' },
        h('h3', null, 'Time'),
        feat('estimates')
          ? h(
              'label',
              { class: 'field-row' },
              h('span', null, 'How long it’ll take'),
              h(
                'select',
                { 'data-key': 'd-est', 'aria-label': 'Time estimate', onchange: (e) => setEstimate(item.id, Number(e.target.value) || null) },
                h('option', { value: '', selected: !est }, 'No estimate'),
                STEPS.map((m) => h('option', { value: String(m), selected: est === m }, formatMinutes(m))),
                est && !STEPS.includes(est) ? h('option', { value: String(est), selected: true }, formatMinutes(est)) : null
              )
            )
          : null,
        spent ? h('p', { class: 'caption caption-tight' }, `Spent so far: ${formatMinutes(Math.round(spent / 60))}${est ? ` of ~${formatMinutes(est)}` : ''}`) : null,
        feat('focus') && !item.done
          ? focusingThis
            ? button(`Stop focus (${f.phase === 'break' ? 'on a break' : 'working'})`, stopFocus, { key: 'd-focus-stop', iconName: 'x' })
            : focusStart(item)
          : null
      )
    );
  }

  if (feat('planning') && !item.done) {
    const plans = plansFor(state.userdata, item.id).sort((a, b) => a.day.localeCompare(b.day) || String(a.start).localeCompare(String(b.start)));
    const today = dayKey(ctx.now, ctx.tz);
    out.push(
      h(
        'section',
        { class: 'd-block' },
        h('h3', null, 'Plan'),
        plans.length
          ? h(
              'ul',
              { class: 'edit-list' },
              plans.map((p) =>
                h(
                  'li',
                  null,
                  h('input', { type: 'date', value: p.day, 'aria-label': 'Day', 'data-key': `pd:${p.id}`, onchange: (e) => e.target.value && updatePlan(p.id, { day: e.target.value }) }),
                  h('input', { type: 'time', value: p.start || '', 'aria-label': 'Start time (optional)', 'data-key': `pt:${p.id}`, onchange: (e) => updatePlan(p.id, { start: e.target.value || null }) }),
                  h('select', { 'aria-label': 'Length', 'data-key': `pm:${p.id}`, onchange: (e) => updatePlan(p.id, { minutes: Number(e.target.value) }) }, STEPS.map((m) => h('option', { value: String(m), selected: p.minutes === m }, formatMinutes(m)))),
                  iconButton('trash', 'Remove plan', () => deletePlan(p.id), { key: `pdel:${p.id}` })
                )
              )
            )
          : h('p', { class: 'caption caption-tight' }, 'Plan when you’ll work on this. You can also drag it onto a day in Calendar → Week.'),
        h(
          'div',
          { class: 'd-actions' },
          button('Today', () => addPlan(item.id, today), { key: 'plan-today', iconName: 'plus' }),
          button('Tomorrow', () => addPlan(item.id, addDays(today, 1)), { key: 'plan-tomorrow', iconName: 'plus' }),
          h('label', { class: 'plan-pick' }, h('span', { class: 'muted' }, 'or'), h('input', { type: 'date', 'aria-label': 'Plan on a day', 'data-key': 'plan-date', onchange: (e) => e.target.value && (addPlan(item.id, e.target.value), (e.target.value = '')) }))
        )
      )
    );
  }
  return out;
}

function focusStart(item) {
  const def = state.settings.focusWork;
  const minutes = picked[item.id] ?? def;
  const lengths = [...new Set([...FOCUS_LENGTHS, def])].sort((a, b) => a - b);
  return h(
    'div',
    { class: 'focus-start' },
    button('Start focus', () => startFocus(item, picked[item.id] ?? def), { key: 'd-focus', iconName: 'clock', kind: 'secondary' }), // read at click time: picking a length doesn't redraw
    h(
      'select',
      { 'aria-label': 'Focus length', 'data-key': 'd-focus-len', onchange: (e) => (picked[item.id] = Number(e.target.value)) },
      lengths.map((m) => h('option', { value: String(m), selected: m === minutes }, `${m} min${m === def ? ' (default)' : ''}`))
    )
  );
}

function spentBlock(item) {
  const spent = spentOf(item, state.userdata);
  return spent ? [h('section', { class: 'd-block' }, h('h3', null, 'Time'), h('p', { class: 'caption caption-tight' }, `You spent ${formatMinutes(Math.round(spent / 60))} on this.`))] : [];
}

