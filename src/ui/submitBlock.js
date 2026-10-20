// F13: the Submit section in an assignment's details.
// Choose files or write text → review → confirm. Nothing reaches Canvas before you confirm.
// On failure your files and text stay, with a link to submit in Canvas instead.

import { h } from './dom.js';
import { icon } from './icons.js';
import { notify, patchCacheItem } from './store.js';
import { toast } from './actions.js';
import { feat, button, iconButton, segmented } from './components.js';
import { composer, draft, setDraft } from './composer.js';
import { canvasReady } from './content.js';
import { submitOptions, submitText, submitFiles, subFromResponse, describeError } from '../lib/submit.js';
import { formatSize } from '../lib/contentNormalize.js';
import { formatDateTime } from '../lib/time.js';
import { isBlank } from '../lib/richtext.js';

const MODE_LABEL = { online_upload: 'Upload files', online_text_entry: 'Write text' };
const WHY_NOT = {
  other: 'This assignment is turned in another way. Use Open in Canvas.',
  locked: 'Canvas has this assignment locked for you right now.',
  closed: 'Submissions are closed (the “available until” date has passed).',
  notYet: 'Submissions open when the assignment becomes available.',
  noAttempts: 'You’ve used all your attempts.',
};

const states = {}; // itemId -> { mode, files, confirming, busy, step, error, done }
const stateOf = (id) => (states[id] ||= { mode: null, files: [], confirming: false, busy: false, step: '', error: null, done: null });
const set = (id, patch) => (Object.assign(stateOf(id), patch), notify());
const textKey = (item) => `submit:${item.id}`;
const words = (t) => (t.trim().match(/\S+/g) || []).length;

export function submitBlock(item, ctx) {
  if (!feat('submit')) return null;
  const opts = submitOptions(item, ctx.now);
  if (!opts) return null;
  const st = stateOf(item.id);
  const section = (...children) => h('section', { class: 'd-block submit-block' }, h('h3', null, opts.resubmit && !st.done ? 'Resubmit' : 'Submit'), ...children);
  if (opts.reason === 'other') return null; // Open in Canvas covers URL, media and other types
  if (opts.reason && !st.done) return section(h('p', { class: 'caption caption-tight' }, WHY_NOT[opts.reason]));

  if (st.done) {
    return section(
      h('p', { class: 'submit-ok' }, icon('check'), `Submitted to Canvas${st.done.attempt ? ` · attempt ${st.done.attempt}` : ''} · ${formatDateTime(st.done.at, ctx.tz)}`),
      h('p', { class: 'caption caption-tight' }, 'Canvas confirmed it. It shows as Submitted everywhere now.'),
      opts.modes.length ? h('div', { class: 'd-actions' }, button('Submit another attempt', () => set(item.id, { done: null }), { key: 'sub-again', kind: 'ghost' })) : null
    );
  }

  const mode = opts.modes.includes(st.mode) ? st.mode : opts.modes[0];
  const text = draft(textKey(item));
  const ready = mode === 'online_upload' ? st.files.length > 0 : !isBlank(text);
  const accept = (item.allowedExtensions || []).map((x) => `.${x}`).join(',');
  const what = mode === 'online_upload' ? `${st.files.length} file${st.files.length === 1 ? '' : 's'} (${formatSize(st.files.reduce((s, f) => s + f.size, 0))})` : `your text (${words(text)} word${words(text) === 1 ? '' : 's'})`;

  if (st.confirming || st.busy) {
    return section(
      h('p', { class: 'submit-confirm' }, `Submit ${what} to Canvas for “${item.title}”?`),
      opts.resubmit ? h('p', { class: 'caption caption-tight' }, `This will be a new attempt${opts.attemptsLeft != null ? ` (${opts.attemptsLeft} left)` : ''}. Canvas keeps your earlier ones.`) : null,
      st.busy ? h('p', { class: 'caption caption-tight', role: 'status' }, st.step || 'Submitting…') : null,
      h(
        'div',
        { class: 'd-actions' },
        button(st.busy ? 'Submitting…' : 'Submit to Canvas', () => doSubmit(item, mode), { key: 'sub-confirm', kind: 'primary', iconName: 'upload', disabled: st.busy }),
        button('Back', () => set(item.id, { confirming: false }), { key: 'sub-back', kind: 'ghost', disabled: st.busy })
      )
    );
  }

  return section(
    opts.modes.length > 1 ? segmented(opts.modes.map((m) => [m, MODE_LABEL[m]]), mode, (m) => set(item.id, { mode: m, error: null }), `submode:${item.id}`) : null,
    mode === 'online_upload'
      ? [
          h(
            'label',
            { class: 'btn btn-secondary file-pick' },
            icon('upload'),
            st.files.length ? 'Add more files' : 'Choose files',
            h('input', { type: 'file', multiple: true, accept: accept || null, class: 'visually-hidden', 'data-key': `sub-files:${item.id}`, onchange: (e) => (set(item.id, { files: [...st.files, ...e.target.files], error: null }), (e.target.value = '')) })
          ),
          accept ? h('p', { class: 'caption caption-tight' }, `Allowed: ${item.allowedExtensions.join(', ')}`) : null,
          st.files.length
            ? h(
                'ul',
                { class: 'files submit-files' },
                st.files.map((f, i) => h('li', null, icon('file'), h('span', null, f.name), h('span', { class: 'muted' }, formatSize(f.size)), iconButton('x', `Remove ${f.name}`, () => set(item.id, { files: st.files.filter((_, j) => j !== i) }), { key: `sub-rm:${i}`, size: 14 })))
              )
            : null,
        ]
      : composer(textKey(item), { placeholder: 'Write your answer…', rows: 8, label: 'Your answer' }),
    st.error
      ? h('div', { class: 'submit-error', role: 'alert' }, h('p', null, st.error), item.url ? h('a', { href: item.url, target: '_blank', rel: 'noopener', 'data-key': 'sub-canvas' }, 'Submit in Canvas instead', icon('external')) : null)
      : null,
    h('div', { class: 'd-actions' }, button('Review and submit', () => set(item.id, { confirming: true, error: null }), { key: 'sub-review', kind: 'primary', disabled: !ready }))
  );
}

async function doSubmit(item, mode) {
  set(item.id, { busy: true, error: null, step: mode === 'online_upload' ? 'Uploading…' : 'Submitting…' });
  const st = stateOf(item.id);
  try {
    await canvasReady();
    const res = mode === 'online_upload' ? await submitFiles(item, st.files, (i, n) => set(item.id, { step: `Uploading file ${i} of ${n}…` })) : await submitText(item, draft(textKey(item)));
    const sub = subFromResponse(item.sub, res);
    await patchCacheItem(item.id, (i) => (i.sub = { ...i.sub, ...sub }));
    if (mode === 'online_text_entry') setDraft(textKey(item), '');
    set(item.id, { busy: false, confirming: false, files: [], done: { attempt: sub.attempt, at: sub.submittedAt } });
    toast(`Submitted “${item.title}”`);
  } catch (e) {
    set(item.id, { busy: false, confirming: false, error: describeError(e) });
  }
}
