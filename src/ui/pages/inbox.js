// F8, F17: your Canvas inbox as its own tab. Read, star, archive and filter your
// conversations; F18: write new messages and reply without opening Canvas.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { openDrawer, ui, setUi } from '../actions.js';
import { emptyState, loadingText, tag, button, feat, dot } from '../components.js';
import { relativeAgo } from '../../lib/time.js';
import { isRead, useContent } from '../content.js';
import { MARK_KEY } from '../../lib/marks.js';
import { notHidden, pinMark } from '../marks.js';
import { star } from '../inboxActions.js';

const shown = notHidden((c) => MARK_KEY.conversation(c.id)); // I2

export const isUnread = (c) => c.unread && !isRead('conv', c.id);

export function unreadMessages() {
  return (state.cache?.conversations || []).filter((c) => isUnread(c) && !c.archived).filter(shown);
}

const VIEWS = [
  ['inbox', 'Inbox'],
  ['unread', 'Unread'],
  ['starred', 'Starred'],
  ['sent', 'Sent'],
  ['archived', 'Archived'],
];

// What each view keeps after a star/archive/read change made here (before Canvas reloads it).
const STILL_IN = {
  inbox: (c) => !c.archived,
  unread: (c) => c.unread,
  starred: (c) => c.starred,
  sent: () => true,
  archived: (c) => c.archived,
};

// F18: open the writing window, optionally for a class or group ("course_1001", "group_4401")
// and a person or group of people.
export const newMessage = (context = '', to = null) => openDrawer('compose', JSON.stringify({ context, to }));

function listFor(scope) {
  const r = useContent('conversations', null, scope);
  // The synced inbox shows at once while the fresh one loads.
  const data = r.status === 'ready' ? r.data : scope === 'inbox' ? state.cache?.conversations : null;
  return { data: data ? data.filter(STILL_IN[scope]).filter(shown) : null, status: r.status };
}

// Everyone in the conversation but you (Canvas lists you too).
// Is this name (and id, when known) you?
export function isMe(name, id = null) {
  const p = state.cache?.profile || {};
  if (id != null && p.id) return String(id) === p.id;
  return !!name && (name === p.fullName || name === p.name || (!!p.name && name.startsWith(`${p.name} `)));
}

export const others = (c) => {
  if (c.audience?.length) return c.audience;
  const rest = c.participants.filter((n) => !isMe(n));
  return rest.length ? rest : c.participants;
};

function contextLabel(c, ctx) {
  if (c.courseId) return { color: ctx.colorOf(c.courseId), name: ctx.nickOf(c.courseId) || c.context };
  return { color: null, name: c.context };
}

function row(c, ctx, scope) {
  const unread = isUnread(c);
  const where = contextLabel(c, ctx);
  return h(
    'div',
    { class: ['conv-row', unread && 'is-unread'] },
    h(
      'button',
      { class: ['row', 'ann-row', 'conv-open', unread && 'is-unread'], 'data-key': `conv:${c.id}`, 'data-row': `conv:${c.id}`, onclick: () => openDrawer('conversation', c.id) },
      h(
        'span',
        { class: 'row-main' },
        h('span', { class: 'row-title' }, unread ? h('span', { class: 'unread-dot', 'aria-label': 'Unread' }) : null, pinMark(MARK_KEY.conversation(c.id)), h('span', { class: 'conv-subject' }, c.subject), c.count > 1 ? h('span', { class: 'conv-count muted' }, String(c.count)) : null),
        h('span', { class: 'row-meta' }, where.name ? h('span', { class: 'conv-where' }, where.color ? dot(where.color) : icon('users', 12), where.name) : null, h('span', null, [scope === 'sent' ? `To ${others(c).slice(0, 3).join(', ')}` : others(c).slice(0, 3).join(', '), c.lastAt ? relativeAgo(c.lastAt, ctx.now) : null].filter(Boolean).join(' · '))),
        c.lastMessage ? h('span', { class: 'ann-snippet' }, c.lastMessage.slice(0, 160)) : null
      )
    ),
    h('button', { class: ['icon-btn', 'conv-star', c.starred && 'is-on'], title: c.starred ? 'Unstar' : 'Star', 'aria-label': c.starred ? `Unstar “${c.subject}”` : `Star “${c.subject}”`, 'aria-pressed': String(!!c.starred), 'data-key': `star:${c.id}`, onclick: () => star(c) }, icon('star', 16))
  );
}

export function renderInbox(ctx) {
  const scope = VIEWS.some(([v]) => v === ui.inboxView) ? ui.inboxView : 'inbox';
  const filter = ui.inboxFilter || '';
  const { data, status } = listFor(scope);
  // Classes and groups that appear in this view, for the filter menu.
  const contexts = new Map();
  for (const c of data || []) {
    if (c.courseId) contexts.set(`course_${c.courseId}`, ctx.nickOf(c.courseId) || c.context);
    else if (c.groupId) contexts.set(`group_${c.groupId}`, c.context || 'Group');
  }
  const list = (data || []).filter((c) => !filter || (c.courseId ? `course_${c.courseId}` : c.groupId ? `group_${c.groupId}` : '') === filter);
  const unread = unreadMessages().length;
  const canSend = feat('sendMessages');
  return h(
    'div',
    { class: 'page inbox-page' },
    h(
      'div',
      { class: 'page-head' },
      h('h1', { class: 'page-title' }, 'Inbox'),
      canSend ? button('New message', () => newMessage(filter), { kind: 'primary', iconName: 'plus', key: 'inbox-new' }) : null
    ),
    h(
      'div',
      { class: 'inbox-tools' },
      h(
        'div',
        { class: 'inbox-views', role: 'tablist', 'aria-label': 'Inbox views' },
        VIEWS.map(([v, label]) =>
          h('button', { class: ['inbox-view', scope === v && 'is-on'], role: 'tab', 'aria-selected': String(scope === v), 'data-key': `inbox-view:${v}`, onclick: () => setUi({ inboxView: v, inboxFilter: '' }) }, label, v === 'inbox' && unread ? h('span', { class: 'tag tag-accent' }, String(unread)) : null)
        )
      ),
      contexts.size > 1 || filter
        ? h('select', { class: 'inbox-filter', 'aria-label': 'Show messages from', 'data-key': 'inbox-filter', onchange: (e) => setUi({ inboxFilter: e.target.value }) }, h('option', { value: '', selected: !filter }, 'All classes and groups'), [...contexts].map(([id, name]) => h('option', { value: id, selected: filter === id }, name)))
        : null
    ),
    list.length
      ? h('div', { class: 'rows conv-list' }, list.map((c) => row(c, ctx, scope)))
      : data
        ? emptyState(
            { inbox: 'No messages. New ones from your instructors, TAs and classmates show up here.', unread: 'You’re all caught up.', starred: 'Star a message to keep it here.', sent: 'Nothing sent yet.', archived: 'Nothing archived.' }[scope] + (filter ? ' (for this class)' : '')
          )
        : status === 'error'
          ? emptyState('Couldn’t load your messages from Canvas. Press refresh to try again.')
          : emptyState(state.cache ? 'Loading messages…' : loadingText()),
    canSend ? h('p', { class: 'caption inbox-note' }, 'Messages you send here go through Canvas, exactly as if you’d sent them there. To attach a file, use Canvas’s inbox.') : null
  );
}
