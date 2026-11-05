// J4 + J5: Ask Mochi. Built-in answers first (exact, instant); questions it doesn't
// recognize go to Chrome's on-device AI when this Mac has it. Nothing leaves your computer,
// and the conversation isn't saved.

import { h } from './dom.js';
import { icon } from './icons.js';
import { state, notify } from './store.js';
import { openDrawer } from './actions.js';
import { feat, button } from './components.js';
import { mochiSvg, mascotName } from './mochi.js';
import { answer, suggestQuestions } from '../lib/ask.js';
import { scheduleContext } from '../lib/scheduleContext.js';
import { streak } from '../lib/progress.js';
import { aiStatus, askAI } from './localAI.js';

const chat = { messages: [], input: '', busy: false, ai: null, lastQuestion: '' };

export function askData(ctx) {
  return {
    now: ctx.now,
    tz: ctx.tz,
    items: ctx.items,
    classes: ctx.allItems.filter((i) => i.area === 'classes'),
    courses: [...ctx.courses, ...ctx.otherCourses].map((c) => ({ id: c.id, nick: c.nick, name: c.name, code: c.code })),
    grades: ctx.grades,
    streak: feat('streak') ? streak(ctx.items, state.userdata, ctx.now, ctx.tz) : null,
    officeHours: ctx.officeHours,
    ud: state.userdata,
  };
}

// Keep the newest message in view (after the redraw restores the old scroll position).
const toBottom = () => requestAnimationFrame(() => {
  for (const b of document.querySelectorAll('.drawer-body, .chat-log.is-panel')) b.scrollTop = b.scrollHeight;
});

const say = (msg) => {
  chat.messages.push(msg);
  notify();
  toBottom();
  return msg;
};

async function send(ctx, text) {
  const q = String(text || '').trim();
  if (!q || chat.busy) return;
  chat.input = '';
  // Empty the box itself too: the redraw keeps whatever a focused field holds.
  if (typeof document !== 'undefined') for (const box of document.querySelectorAll('[data-key^="chat-input"]')) box.value = '';
  chat.lastQuestion = q;
  say({ from: 'me', text: q });
  const data = askData(ctx);
  const built = answer(q, data);
  if (built) return say({ from: 'mochi', ...built, source: 'built-in' });
  chat.ai ??= await aiStatus();
  if (chat.ai === 'available' || chat.ai === 'downloading') return aiReply(data, q);
  if (chat.ai === 'downloadable') {
    return say({ from: 'mochi', text: 'I don’t know that one by heart. Chrome can download a small AI model that runs on your Mac to answer questions like this. It’s a one-time download of a few GB, and nothing you ask leaves your computer.', offerDownload: true });
  }
  say({ from: 'mochi', text: 'I don’t understand that one yet. I can answer things like:', list: suggestQuestions(data, 5).map((e) => ({ title: e, ask: true })) });
}

async function aiReply(data, q) {
  chat.busy = true;
  const msg = say({ from: 'mochi', text: '…', source: 'ai', pending: true });
  try {
    const context = scheduleContext({ ...data, courses: data.courses });
    await askAI(
      context,
      q,
      (t) => {
        msg.text = t;
        notify();
        toBottom();
      },
      (p) => {
        msg.text = `Getting ready… ${Math.round(p * 100)}%`;
        notify();
      }
    );
    chat.ai = 'available';
  } catch (e) {
    msg.text = `Chrome’s on-device AI didn’t answer (${e.message || 'unknown error'}). Try asking another way.`;
    msg.source = null;
  } finally {
    msg.pending = false;
    chat.busy = false;
    notify();
  }
}

function messageView(ctx, m, i) {
  return h(
    'div',
    { class: ['chat-row', m.from === 'me' ? 'is-me' : 'is-mochi'] },
    m.from === 'mochi' ? mochiSvg(m.pending ? 'neutral' : 'happy', 28) : null,
    h(
      'div',
      { class: 'chat-msg' },
      h('p', null, m.text),
      m.list?.length
        ? h(
            'ul',
            { class: 'chat-list' },
            m.list.map((x, j) =>
              h(
                'li',
                null,
                x.ask
                  ? h('button', { class: 'link-btn', 'data-key': `chat-ex:${i}:${j}`, onclick: () => send(ctx, x.title) }, x.title)
                  : x.id
                    ? h('button', { class: 'chat-item', 'data-key': `chat-it:${i}:${j}`, onclick: () => openDrawer('item', x.id) }, h('strong', null, x.title), x.sub ? h('span', { class: 'muted' }, x.sub) : null)
                    : h('span', { class: 'chat-item' }, h('strong', null, x.title), x.sub ? h('span', { class: 'muted' }, x.sub) : null)
              )
            )
          )
        : null,
      m.offerDownload
        ? h(
            'div',
            { class: 'd-actions' },
            button('Download it', () => ((m.offerDownload = false), (chat.ai = 'downloading'), aiReply(askData(ctx), chat.lastQuestion)), { key: `chat-dl:${i}`, kind: 'secondary', iconName: 'download' })
          )
        : null,
      m.source === 'ai' && !m.pending ? h('span', { class: 'chat-source' }, 'On-device AI · double-check important details') : null
    )
  );
}

function chatForm(ctx, key) {
  return h(
    'form',
    { class: 'chat-form', onsubmit: (e) => (e.preventDefault(), send(ctx, chat.input)) },
    h('input', { class: 'text-input', type: 'text', placeholder: 'Ask about your schedule…', 'aria-label': `Ask ${mascotName()}`, 'data-key': key, value: chat.input, autofocus: key === 'chat-input', oninput: (e) => (chat.input = e.target.value) }),
    h('button', { class: 'btn btn-primary', type: 'submit', 'data-key': `${key}-send`, 'aria-label': 'Send', disabled: chat.busy }, icon('up'))
  );
}

const suggestions = (ctx, n = 5) => h('div', { class: 'chat-suggest' }, suggestQuestions(askData(ctx), n).map((e, j) => h('button', { class: 'chat-sug', 'data-key': `chat-sug:${j}`, onclick: () => send(ctx, e) }, e)));

// J4: the chat inside Mochi's panel on Home.
export function mochiChatPanel(ctx) {
  if (!feat('askMochi')) return null;
  if (chat.ai === null) aiStatus().then((s) => ((chat.ai = s), notify()));
  return h(
    'div',
    { class: 'chat-panel' },
    chat.messages.length ? h('div', { class: 'chat-log is-panel', role: 'log', 'aria-live': 'polite' }, chat.messages.map((m, i) => messageView(ctx, m, i))) : h('div', { class: 'chat-log is-panel' }, h('p', { class: 'caption caption-tight' }, 'Ask me anything about your schedule:'), suggestions(ctx, 4)),
    chatForm(ctx, 'chat-input-panel')
  );
}

export function mochiChat(ctx) {
  if (!feat('askMochi')) return h('p', { class: 'caption' }, `Ask ${mascotName()} is turned off in Settings → Features.`);
  if (chat.ai === null) aiStatus().then((s) => ((chat.ai = s), notify()));
  const aiNote =
    chat.ai === 'available' ? 'Smarter answers: Chrome’s on-device AI is ready.' : chat.ai === 'downloadable' || chat.ai === 'downloading' ? 'Chrome’s on-device AI can be downloaded for questions I don’t know by heart.' : chat.ai ? 'Chrome’s on-device AI isn’t available on this Mac, so I stick to what I know by heart.' : '';
  return [
    h('header', { class: 'chat-head' }, mochiSvg('happy', 48), h('div', null, h('h2', { class: 'd-title' }, `Ask ${mascotName()}`), h('p', { class: 'caption caption-tight' }, 'Answers come from your dashboard and stay on your computer.'))),
    h(
      'div',
      { class: 'chat-log', role: 'log', 'aria-live': 'polite' },
      chat.messages.length
        ? chat.messages.map((m, i) => messageView(ctx, m, i))
        : [h('p', { class: 'muted' }, 'Try one of these:'), suggestions(ctx)]
    ),
    chatForm(ctx, 'chat-input'),
    aiNote ? h('p', { class: 'caption chat-ai-note' }, aiNote) : null,
  ];
}
