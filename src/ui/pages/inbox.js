// F8: your Canvas messages. Reading happens here; replies happen in Canvas.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { openDrawer } from '../actions.js';
import { emptyState, loadingText, tag } from '../components.js';
import { relativeAgo } from '../../lib/time.js';
import { CANVAS_ORIGIN } from '../../lib/env.js';
import { isRead } from '../content.js';
import { MARK_KEY } from '../../lib/marks.js';
import { notHidden, pinMark } from '../marks.js';

const shown = notHidden((c) => MARK_KEY.conversation(c.id)); // I2

export function unreadMessages() {
  return (state.cache?.conversations || []).filter((c) => c.unread && !isRead('conv', c.id)).filter(shown);
}

export function renderInbox(ctx) {
  const list = (state.cache?.conversations || []).filter(shown);
  const unread = unreadMessages().length;
  return h(
    'div',
    { class: 'page' },
    h('a', { class: 'back-link', href: '#/courses', 'data-key': 'back-courses' }, icon('back', 14), 'Courses'),
    h(
      'div',
      { class: 'page-head' },
      h('h1', { class: 'page-title' }, 'Inbox'),
      h('a', { class: 'btn btn-secondary', href: `${CANVAS_ORIGIN}/conversations`, target: '_blank', rel: 'noopener', 'data-key': 'inbox-canvas' }, 'New message in Canvas', icon('external'))
    ),
    unread ? h('p', { class: 'muted' }, `${unread} unread`) : null,
    list.length
      ? h(
          'div',
          { class: 'rows' },
          list.map((c) => {
            const isUnread = c.unread && !isRead('conv', c.id);
            return h(
              'button',
              { class: ['row', 'ann-row', isUnread && 'is-unread'], 'data-key': `conv:${c.id}`, 'data-row': `conv:${c.id}`, onclick: () => openDrawer('conversation', c.id) },
              h(
                'span',
                { class: 'row-main' },
                h('span', { class: 'row-title' }, pinMark(MARK_KEY.conversation(c.id)), c.subject, isUnread ? tag('New', 'accent') : null),
                h('span', { class: 'row-meta' }, [c.participants.slice(0, 3).join(', '), c.context, c.lastAt ? relativeAgo(c.lastAt, ctx.now) : null].filter(Boolean).join(' · ')),
                h('span', { class: 'ann-snippet' }, c.lastMessage.slice(0, 160))
              )
            );
          })
        )
      : emptyState(state.cache ? 'No messages.' : loadingText())
  );
}
