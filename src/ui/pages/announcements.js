// F2: announcements from every class in one feed, newest first.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { ui, setUi } from '../actions.js';
import { emptyState, loadingText, dot } from '../components.js';
import { announcementRow } from './course.js';
import { isRead } from '../content.js';
import { MARK_KEY } from '../../lib/marks.js';
import { notHidden } from '../marks.js';

const shown = notHidden((a) => MARK_KEY.announcement(a.id)); // I2

export function unreadAnnouncements(ctx) {
  const core = new Set(ctx.courses.map((c) => c.id));
  return (state.cache?.announcements || []).filter((a) => core.has(a.courseId) && !a.read && !isRead('ann', a.canvasId)).filter(shown);
}

export function renderAnnouncements(ctx) {
  const all = (state.cache?.announcements || []).filter(shown);
  const core = new Set(ctx.courses.map((c) => c.id));
  const showAll = !!ui.annAll;
  const filter = ui.annCourse || null;
  const list = all.filter((a) => (showAll || core.has(a.courseId)) && (!filter || a.courseId === filter));
  const unread = unreadAnnouncements(ctx).length;
  const courses = (showAll ? [...ctx.courses, ...ctx.otherCourses] : ctx.courses).filter((c) => all.some((a) => a.courseId === c.id));
  return h(
    'div',
    { class: 'page' },
    h('a', { class: 'back-link', href: '#/courses', 'data-key': 'back-courses' }, icon('back', 14), 'Courses'),
    h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'Announcements'), unread ? h('span', { class: 'muted' }, `${unread} unread`) : null),
    h(
      'div',
      { class: 'filter-bar' },
      h(
        'div',
        { class: 'chips' },
        h('button', { class: ['chip', !filter && 'is-on'], 'data-key': 'ann:all', onclick: () => setUi({ annCourse: null }) }, 'All'),
        courses.map((c) => h('button', { class: ['chip', filter === c.id && 'is-on'], 'data-key': `annc:${c.id}`, onclick: () => setUi({ annCourse: filter === c.id ? null : c.id }) }, dot(c.color), c.nick))
      ),
      ctx.otherCourses.length ? h('label', { class: 'sort' }, h('input', { type: 'checkbox', checked: showAll, 'data-key': 'ann-other', onchange: (e) => setUi({ annAll: e.target.checked, annCourse: null }) }), h('span', null, 'Include Other')) : null
    ),
    list.length ? h('div', { class: 'rows' }, list.map((a) => announcementRow(a, ctx, true))) : emptyState(state.cache ? 'No announcements in the last 60 days.' : loadingText())
  );
}
