// F16: one page per Canvas group (project teams, study groups your instructor set up).
// Groups have their own announcements, discussions, pages, files and members, like a
// small class. Opened from Courses → Your groups, or the class page's study group.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { openDrawer } from '../actions.js';
import { dot, emptyState, sectionHeader, button, feat, tag } from '../components.js';
import { relativeAgo, formatDate } from '../../lib/time.js';
import { CANVAS_ORIGIN } from '../../lib/env.js';
import { useContent, groupKey } from '../content.js';
import { pagesTab, filesTab, discussionsTab, statusView } from './course.js';
import { newMessage, isMe, canCompose } from './inbox.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'discussions', label: 'Discussions' },
  { id: 'pages', label: 'Pages' },
  { id: 'files', label: 'Files' },
  { id: 'people', label: 'People' },
];

export const groupsList = () => state.cache?.groups || [];
export const groupHref = (g, tab = '') => `#/group/${g.id}${tab ? `/${tab}` : ''}`;

function overviewTab(ctx, g, key) {
  const news = useContent('groupNews', key);
  const topics = useContent('topics', key);
  const members = useContent('members', key);
  const recent = topics.status === 'ready' ? topics.data.filter((t) => !t.isAnnouncement).sort((a, b) => new Date(b.lastReplyAt || b.postedAt || 0) - new Date(a.lastReplyAt || a.postedAt || 0)).slice(0, 3) : [];
  return [
    h(
      'section',
      { class: 'section' },
      sectionHeader('Announcements'),
      news.status !== 'ready'
        ? statusView(news, 'announcements')
        : news.data.length
          ? h('div', { class: 'rows' }, news.data.slice(0, 3).map((a) => h('button', { class: ['row', 'ann-row', a.unread > 0 && 'is-unread'], 'data-key': `gann:${a.id}`, onclick: () => openDrawer('discussion', `${key}|${a.id}`) }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, a.title), h('span', { class: 'row-meta' }, [a.author, a.postedAt ? relativeAgo(a.postedAt, ctx.now) : null].filter(Boolean).join(' · '))))))
          : emptyState('No group announcements.')
    ),
    h(
      'section',
      { class: 'section' },
      sectionHeader('Recent discussions', h('a', { class: 'link-btn', href: groupHref(g, 'discussions'), 'data-key': 'g-all-disc' }, 'All discussions')),
      topics.status !== 'ready'
        ? statusView(topics, 'discussions')
        : recent.length
          ? h('div', { class: 'rows' }, recent.map((t) => h('button', { class: ['row', 'compact-row', t.unread > 0 && 'is-unread'], 'data-key': `gdt:${t.id}`, onclick: () => openDrawer('discussion', `${key}|${t.id}`) }, icon('chat'), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, t.title, t.unread > 0 ? tag(`${t.unread} new`, 'accent') : null), h('span', { class: 'row-meta' }, [`${t.replies} repl${t.replies === 1 ? 'y' : 'ies'}`, t.lastReplyAt ? `last activity ${relativeAgo(t.lastReplyAt, ctx.now)}` : t.postedAt ? formatDate(t.postedAt, ctx.tz) : null].filter(Boolean).join(' · '))))))
          : emptyState('No discussions yet. Start one in Canvas.')
    ),
    h('section', { class: 'section' }, sectionHeader('Members', h('a', { class: 'link-btn', href: groupHref(g, 'people'), 'data-key': 'g-all-people' }, 'See all')), members.status === 'ready' ? h('p', { class: 'group-members' }, members.data.map((m) => m.name).join(', ')) : statusView(members, 'members')),
  ];
}

function peopleTab(ctx, g, key) {
  const r = useContent('members', key);
  if (r.status !== 'ready') return statusView(r, 'members');
  const canSend = canCompose();
  return h(
    'div',
    { class: 'rows' },
    r.data.map((p) =>
      h(
        'div',
        { class: 'row compact-row person-row' },
        icon('users'),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, p.name, isMe(p.name, p.id) ? tag('You', 'neutral') : null)),
        canSend && !isMe(p.name, p.id) ? button('Message', () => newMessage(`group_${g.id}`, { id: p.id, name: p.name }), { kind: 'ghost', iconName: 'mail', key: `gmsg:${p.id}` }) : null
      )
    )
  );
}

export function renderGroup(ctx, groupId, tabId) {
  const g = groupsList().find((x) => x.id === String(groupId));
  if (!g) return h('div', { class: 'page' }, h('a', { class: 'back-link', href: '#/courses', 'data-key': 'back-courses' }, icon('back', 14), 'Courses'), emptyState(state.cache ? 'Group not found. You may have left it.' : 'Loading…'));
  const key = groupKey(g.id);
  const tab = TABS.some((t) => t.id === tabId) ? tabId : 'overview';
  const asCourse = { id: key, isGroup: true }; // F16: the class tabs work for groups too
  const body = tab === 'overview' ? overviewTab(ctx, g, key) : tab === 'people' ? peopleTab(ctx, g, key) : { pages: pagesTab, files: filesTab, discussions: discussionsTab }[tab](ctx, asCourse);
  const course = g.courseId ? ctx.allCourses.find((c) => c.id === g.courseId) : null;
  return h(
    'div',
    { class: 'page page-course page-group' },
    h('a', { class: 'back-link', href: '#/courses', 'data-key': 'back-courses' }, icon('back', 14), 'Courses'),
    h(
      'header',
      { class: 'course-head' },
      h(
        'div',
        null,
        h('h1', { class: 'page-title course-title' }, icon('users', 20), g.name),
        h('p', { class: 'muted course-sub' }, course ? h('a', { href: `#/course/${course.id}`, class: 'group-course', 'data-key': 'g-course' }, dot(ctx.colorOf(course.id)), ctx.nickOf(course.id)) : 'Canvas group', g.members ? ` · ${g.members} member${g.members === 1 ? '' : 's'}` : '')
      ),
      h(
        'div',
        { class: 'course-head-actions' },
        canCompose() ? button('Message the group', () => newMessage(`group_${g.id}`, { id: `group_${g.id}`, name: `Everyone in ${g.name}` }), { kind: 'primary', iconName: 'mail', key: 'g-message' }) : null,
        h('a', { class: 'btn btn-secondary', href: g.url || `${CANVAS_ORIGIN}/groups/${g.id}`, target: '_blank', rel: 'noopener', 'data-key': 'g-canvas' }, 'Open in Canvas', icon('external'))
      )
    ),
    h('nav', { class: 'tabs', 'aria-label': 'Group sections' }, TABS.map((t) => h('a', { href: groupHref(g, t.id), class: ['tab', t.id === tab && 'is-active'], 'aria-current': t.id === tab ? 'page' : null, 'data-key': `gtab:${t.id}` }, t.label))),
    body
  );
}

// Courses page: your Canvas groups, each a card that opens its page.
export function groupsSection(ctx) {
  const list = groupsList();
  if (!list.length) return null;
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Your groups'),
    h(
      'div',
      { class: 'group-list' },
      list.map((g) => {
        const c = g.courseId ? ctx.allCourses.find((x) => x.id === g.courseId) : null;
        return h('a', { class: 'group-card', href: groupHref(g), 'data-key': `group:${g.id}`, 'data-row': `group:${g.id}` }, h('span', { class: 'group-card-icon' }, icon('users', 18)), h('span', { class: 'group-card-main' }, h('span', { class: 'group-card-name' }, g.name), h('span', { class: 'group-card-meta' }, c ? [dot(ctx.colorOf(c.id)), ctx.nickOf(c.id)] : 'Canvas group', g.members ? ` · ${g.members} members` : '')), icon('chevron', 14));
      })
    )
  );
}
