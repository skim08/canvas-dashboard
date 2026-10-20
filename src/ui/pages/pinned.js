// I2: everything you've pinned, of every kind, in one place. Opened from Home.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { togglePin } from '../actions.js';
import { emptyState, itemRow, sectionHeader, dot, iconButton } from '../components.js';
import { pinnedEverything, MARK_TYPES } from '../../lib/marks.js';
import { openMark, toggleMarkPin } from '../marks.js';
import { mochiEmpty } from '../mochi.js';

const ICON = { announcement: 'megaphone', page: 'book', file: 'file', discussion: 'chat', conversation: 'mail', module: 'folder', course: 'home' };

export function renderPinned(ctx) {
  const all = pinnedEverything(state.userdata, ctx.allItems);
  const items = all.filter((p) => p.type === 'item');
  const groups = MARK_TYPES.map(([type, label]) => [label, all.filter((p) => p.type === type)]).filter(([, list]) => list.length);
  return h(
    'div',
    { class: 'page' },
    h('a', { class: 'back-link', href: '#/home', 'data-key': 'back-home' }, icon('back', 14), 'Home'),
    h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'Pinned'), all.length ? h('span', { class: 'muted' }, `${all.length} pinned`) : null),
    !all.length ? mochiEmpty('Nothing pinned yet. Use the pin button on anything: assignments, announcements, pages, files, discussions, messages, modules or classes.', 'neutral') || emptyState('Nothing pinned yet. Use the pin button on anything: assignments, announcements, pages, files, discussions, messages, modules or classes.') : null,
    items.length ? h('section', { class: 'section' }, sectionHeader('Assignments and to-dos'), h('div', { class: 'rows' }, items.map((p) => itemRow(p.item, { now: ctx.now, tz: ctx.tz })))) : null,
    groups.map(([label, list]) =>
      h(
        'section',
        { class: 'section' },
        sectionHeader(label),
        h(
          'div',
          { class: 'rows' },
          list.map((p) =>
            h(
              'div',
              { class: 'row compact-row pinned-row' },
              h(
                'button',
                { class: 'row-open', 'data-key': `pinned:${p.key}`, 'data-row': `pinned:${p.key}`, onclick: () => openMark(p) },
                icon(ICON[p.type] || 'file'),
                h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, p.title), p.courseId ? h('span', { class: 'row-meta' }, dot(ctx.colorOf(p.courseId)), ctx.nickOf(p.courseId)) : null)
              ),
              iconButton('pin', 'Unpin', () => (p.type === 'item' ? togglePin(p.item) : toggleMarkPin(p.key, {})), { class: 'is-on', key: `unpin:${p.key}` })
            )
          )
        )
      )
    )
  );
}
