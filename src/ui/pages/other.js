// Other (B11): events and non-class courses, kept out of your main views.
// Anything here can be added to Home (C13).

import { h } from '../dom.js';
import { state } from '../store.js';
import { ui, setUi } from '../actions.js';
import { group, sectionHeader, emptyState, loadingText, dot, promoteButton } from '../components.js';
import { groupItems, listable } from '../../lib/model.js';

export function renderOther(ctx) {
  const { otherItems, otherCourses, now, tz } = ctx;
  const active = new Set(ui.otherFilter || []);
  const filtered = listable(otherItems).filter((i) => !active.size || active.has(i.courseId));
  const onHome = filtered.filter((i) => i.promoted);
  const g = groupItems(filtered.filter((i) => !i.promoted), { now, tz, sort: 'due', pinsEnabled: false });
  const rowCtx = { now, tz, action: null };
  const withAction = (key, label, items, opts) => {
    const node = group(`other-${key}`, label, items, rowCtx, opts);
    // Each row gets its own Add to Home button.
    node?.querySelectorAll('[data-row]').forEach((row) => {
      const item = items.find((i) => i.id === row.getAttribute('data-row'));
      if (item) row.insertBefore(promoteButton(item), row.querySelector('.row-more'));
    });
    return node;
  };
  const toggleChip = (id) => {
    const set = new Set(ui.otherFilter || []);
    set.has(id) ? set.delete(id) : set.add(id);
    setUi({ otherFilter: [...set] });
  };
  const upcoming = g.overdue.length + g.today.length + g.week.length + g.later.length + g.nodate.length;

  return h(
    'div',
    { class: 'page' },
    h(
      'section',
      { class: 'section' },
      sectionHeader('Other'),
      h('p', { class: 'page-intro' }, 'Events and non-class courses, kept out of your way. Add anything to Home to keep it next to your classes.'),
      otherCourses.length
        ? h(
            'div',
            { class: 'chips' },
            h('button', { class: ['chip', !active.size && 'is-on'], 'data-key': 'ochip:all', onclick: () => setUi({ otherFilter: [] }) }, 'All'),
            otherCourses.map((c) =>
              h('button', { class: ['chip', active.has(c.id) && 'is-on'], 'aria-pressed': String(active.has(c.id)), 'data-key': `ochip:${c.id}`, onclick: () => toggleChip(c.id) }, dot(c.color), c.nick)
            )
          )
        : null,
      withAction('home', 'On Home', onHome),
      withAction('overdue', 'Overdue', g.overdue, { tone: 'red' }),
      withAction('today', 'Today', g.today),
      withAction('week', 'This week', g.week),
      withAction('later', 'Later', g.later),
      withAction('nodate', 'No date', g.nodate, { collapsed: true }),
      !state.cache
        ? emptyState(loadingText())
        : !otherCourses.length
          ? emptyState('No other courses. Everything you have is a class.')
          : !upcoming && !onHome.length
            ? emptyState('Nothing coming up here.')
            : null,
      otherCourses.length ? h('a', { class: 'link-btn', href: '#/settings', 'data-key': 'other-settings' }, 'Change which courses count as classes') : null
    )
  );
}
