// D8: everything you've turned in or checked off, newest first, by week. Opened from Home.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { ui, setUi } from '../actions.js';
import { emptyState, itemRow, sectionHeader, dot } from '../components.js';
import { completedItems, completionLabel } from '../../lib/progress.js';
import { mochiEmpty } from '../mochi.js';
import { weekOf, formatKeyRange, formatDate } from '../../lib/time.js';

export function renderCompleted(ctx) {
  const all = completedItems(ctx.items, state.userdata);
  const course = ui.doneCourse || null;
  const list = course ? all.filter((x) => x.item.courseId === course) : all;
  const thisWeek = weekOf(new Date(ctx.now), ctx.tz).start;
  const groups = new Map();
  for (const x of list) {
    const start = x.at ? weekOf(new Date(x.at), ctx.tz).start : 'unknown';
    if (!groups.has(start)) groups.set(start, []);
    groups.get(start).push(x);
  }
  const label = (start) => (start === 'unknown' ? 'Earlier' : start === thisWeek ? 'This week' : formatKeyRange(start, weekOf(new Date(`${start}T12:00:00Z`), 'UTC').end));
  const courses = ctx.courses.filter((c) => all.some((x) => x.item.courseId === c.id));
  return h(
    'div',
    { class: 'page page-completed' },
    h('a', { class: 'back-link', href: '#/home', 'data-key': 'back-home' }, icon('back', 14), 'Home'),
    h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'Completed'), all.length ? h('span', { class: 'muted' }, `${all.length} finished`) : null),
    courses.length > 1
      ? h(
          'div',
          { class: 'chips' },
          h('button', { class: ['chip', !course && 'is-on'], 'data-key': 'done:all', onclick: () => setUi({ doneCourse: null }) }, 'All'),
          courses.map((c) => h('button', { class: ['chip', course === c.id && 'is-on'], 'data-key': `done:${c.id}`, onclick: () => setUi({ doneCourse: course === c.id ? null : c.id }) }, dot(c.color), c.nick))
        )
      : null,
    !list.length ? mochiEmpty('Nothing finished yet. Work you turn in or check off shows up here.', 'neutral') || emptyState('Nothing finished yet. Work you turn in or check off shows up here.') : null,
    [...groups.entries()].map(([start, xs]) =>
      h(
        'section',
        { class: 'section' },
        sectionHeader(label(start), h('span', { class: 'muted' }, String(xs.length))),
        h(
          'div',
          { class: 'rows' },
          xs.map((x) => {
            const row = itemRow(x.item, { now: ctx.now, tz: ctx.tz });
            // When and how it was finished, instead of the due date.
            const due = row.querySelector('.row-due');
            if (due) {
              due.textContent = `${completionLabel(x.item)}${x.at ? ` · ${formatDate(x.at, ctx.tz)}` : ''}`;
              due.className = 'row-due tone-muted';
            }
            // The label on the right already says Turned in / Graded / Excused.
            row.querySelectorAll('.row-meta .tag').forEach((t) => ['Submitted', 'Graded', 'Excused'].includes(t.textContent) && t.remove());
            return row;
          })
        )
      )
    )
  );
}

export const completedCount = (ctx) => completedItems(ctx.items, state.userdata).length;
