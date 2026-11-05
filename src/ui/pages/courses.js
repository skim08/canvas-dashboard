// Courses (B1). Phase 1: a clean list of courses; each opens its details.

import { h } from '../dom.js';
import { needsSyllabus } from '../syllabusDrawer.js';
import { state } from '../store.js';
import { openDrawer } from '../actions.js';
import { icon } from '../icons.js';
import * as F from '../fmt.js';
import { unreadAnnouncements } from './announcements.js';
import { unreadMessages } from './inbox.js';
import { dot, emptyState, loadingText, sectionHeader, dueText, group, feat, promoteButton } from '../components.js';
import { listable, sortItems } from '../../lib/model.js';

const OH_DAYS = 14;
const ohLabels = { add: 'Add to calendar & to-dos', added: 'Added', title: 'Add this session to your calendar and to-do list' };

// C15: office hours, out of your to-do list until you choose to go.
function officeHoursSection(ctx) {
  const { officeHours, courses, now, tz } = ctx;
  const horizon = now + OH_DAYS * 86400000;
  const upcoming = sortItems(
    listable(officeHours).filter((i) => i.dueAt && new Date(i.endAt || i.dueAt).getTime() >= now && new Date(i.dueAt).getTime() <= horizon),
    'due'
  );
  if (!upcoming.length) return null;
  const rowCtx = { now, tz };
  const withButtons = (node, items) => {
    node?.querySelectorAll('[data-row]').forEach((row) => {
      const item = items.find((i) => i.id === row.getAttribute('data-row'));
      if (item) row.insertBefore(promoteButton(item, ohLabels), row.querySelector('.row-more'));
    });
    return node;
  };
  const added = upcoming.filter((i) => i.promoted);
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Office hours'),
    h('p', { class: 'page-intro' }, `The next ${OH_DAYS} days. They stay off your to-do list unless you add a session.`),
    withButtons(group('oh-added', 'Added', added, rowCtx), added),
    courses.map((c) => {
      const list = upcoming.filter((i) => i.courseId === c.id && !i.promoted);
      return withButtons(group(`oh-${c.id}`, `${c.nick} · ${list.length} session${list.length === 1 ? '' : 's'}`, list, { ...rowCtx, noCheck: true }, { collapsed: true, showCount: false }), list);
    })
  );
}

export function renderCourses(ctx) {
  const missing = new Set(needsSyllabus(ctx).map((c) => c.id)); // K23
  const { courses, items, now, tz } = ctx;
  return h(
    'div',
    { class: 'page' },
    h(
      'section',
      { class: 'section' },
      sectionHeader(
        'Courses',
        feat('announcementsFeed') ? h('a', { class: 'btn btn-ghost', href: '#/announcements', 'data-key': 'go-ann' }, icon('megaphone'), 'Announcements', unreadAnnouncements(ctx).length ? h('span', { class: 'tag tag-accent' }, String(unreadAnnouncements(ctx).length)) : null) : null,
        feat('inbox') ? h('a', { class: 'btn btn-ghost', href: '#/inbox', 'data-key': 'go-inbox' }, icon('mail'), 'Inbox', unreadMessages().length ? h('span', { class: 'tag tag-accent' }, String(unreadMessages().length)) : null) : null
      ),
      courses.length
        ? h(
            'div',
            { class: 'course-grid' },
            courses.map((c) => {
              const mine = listable(items).filter((i) => i.courseId === c.id);
              const next = mine.filter((i) => !i.done && !i.overdue && i.dueAt && new Date(i.dueAt).getTime() >= now).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0];
              const overdue = mine.filter((i) => i.overdue).length;
              return h(
                'button',
                { class: 'course-card', 'data-key': `course:${c.id}`, 'data-row': `course:${c.id}`, onclick: () => (location.hash = `#/course/${c.id}`) },
                h('span', { class: 'course-card-top' }, dot(c.color), h('span', { class: 'course-card-nick' }, c.nick), h('span', { class: 'course-card-score' }, (() => {
                  // Same number as the Grades page (syllabus rules, pace) so every screen agrees.
                  const g = ctx.grades.courses.find((x) => x.course.id === c.id);
                  return g ? [F.scoreText(g), g.gp != null ? h('span', { class: 'muted' }, ` · ${F.gp(g.gp)}`) : null] : c.score != null ? `${c.score.toFixed(1)}%` : '';
                })())),
                h('span', { class: 'course-card-name' }, c.name),
                h(
                  'span',
                  { class: 'course-card-next' },
                  next ? `Next: ${next.title} · ${dueText(next, now, tz)}` : 'Nothing upcoming',
                  overdue ? h('span', { class: 'tone-red' }, ` · ${overdue} overdue`) : null
                ),
                missing.has(c.id) ? h('span', { class: 'course-card-todo' }, 'No class times yet · open to add your syllabus') : null // K23
              );
            })
          )
        : emptyState(state.cache ? 'No active courses found.' : loadingText())
    ),
    feat('officeHours') ? officeHoursSection(ctx) : null
  );
}
