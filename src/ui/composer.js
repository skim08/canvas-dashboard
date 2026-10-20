// F13, F14: a writing box with basic formatting (see lib/richtext.js).
// Drafts live here, outside the page, so a re-render or a failed post never loses text.

import { h } from './dom.js';
import { notify } from './store.js';

const drafts = {};
export const draft = (key) => drafts[key] ?? '';
// Redraws only when the box goes from empty to not (so Submit/Post buttons enable),
// never on every keystroke.
export function setDraft(key, text) {
  const was = !!(drafts[key] || '').trim();
  if (text) drafts[key] = text;
  else delete drafts[key];
  if (was !== !!(text || '').trim()) notify();
}

function edit(e, key, fn) {
  const ta = e.currentTarget.closest('.composer').querySelector('textarea');
  const { selectionStart: s, selectionEnd: t, value } = ta;
  const { text, from, to } = fn(value, s, t);
  ta.value = text;
  setDraft(key, text);
  ta.focus();
  ta.setSelectionRange(from, to);
}

// **selection** or *selection*
const wrap = (mark) => (value, s, t) => {
  const sel = value.slice(s, t) || 'text';
  return { text: value.slice(0, s) + mark + sel + mark + value.slice(t), from: s + mark.length, to: s + mark.length + sel.length };
};

// "- " in front of each selected line (or the current one).
const bullets = (value, s, t) => {
  const start = value.lastIndexOf('\n', s - 1) + 1;
  const lines = value.slice(start, t).split('\n').map((l) => (/^\s*[-*]\s/.test(l) ? l : `- ${l}`));
  const block = lines.join('\n');
  return { text: value.slice(0, start) + block + value.slice(t), from: start + block.length, to: start + block.length };
};

export function composer(key, { placeholder = 'Write here…', rows = 5, label = 'Text', disabled = false } = {}) {
  const tool = (text, title, fn, cls) => h('button', { type: 'button', class: ['composer-tool', cls], title, 'aria-label': title, disabled, onclick: (e) => edit(e, key, fn) }, text);
  return h(
    'div',
    { class: 'composer' },
    h('div', { class: 'composer-bar', role: 'toolbar', 'aria-label': 'Formatting' }, tool('B', 'Bold', wrap('**'), 'is-bold'), tool('I', 'Italic', wrap('*'), 'is-italic'), tool('• List', 'Bulleted list', bullets)),
    h('textarea', { class: 'notes composer-text', rows: String(rows), placeholder, 'aria-label': label, 'data-key': `cmp:${key}`, value: draft(key), disabled, oninput: (e) => setDraft(key, e.target.value) }),
    h('p', { class: 'caption caption-tight' }, '**bold**, *italic*, and “- ” at the start of a line for a list. Links work as typed.')
  );
}
