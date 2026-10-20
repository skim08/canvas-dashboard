// I2: pin, hide and notes on announcements, pages, files, discussions, messages,
// modules and classes. Assignments and to-dos keep their own (C10, C11, D6).

import { h } from './dom.js';
import { state, updateUser, updateSettings } from './store.js';
import { toast, openDrawer, closeDrawer, setUi, ui, noteValue, setNote } from './actions.js';
import { feat, iconButton } from './components.js';
import { setMark, isMarkHidden, isMarkPinned } from '../lib/marks.js';

// meta: { type, title, courseId, ref } — enough to list and reopen it later.
export function toggleMarkPin(key, meta) {
  const on = !isMarkPinned(state.userdata, key);
  return updateUser((ud) => setMark((ud.marks ||= {}), key, meta, { pinned: on ? Date.now() : null }));
}

export function hideMark(key, meta) {
  if (meta.type === 'course') return hideCourse(meta);
  updateUser((ud) => setMark((ud.marks ||= {}), key, meta, { hidden: Date.now() }));
  toast(`Hidden “${meta.title}”`, () => unhideMark(key));
}

export function unhideMark(key) {
  return updateUser((ud) => setMark((ud.marks ||= {}), key, {}, { hidden: null }));
}

// Classes already have a Hide switch (Settings → Courses); this is the same switch.
function hideCourse(meta) {
  const set = (hidden) => updateSettings({ courses: { ...state.settings.courses, [meta.ref]: { ...(state.settings.courses[meta.ref] || {}), hidden } } });
  set(true);
  location.hash = '#/courses';
  toast(`Hidden ${meta.title}. Show it again in Settings → Courses.`, () => set(false));
}

export function markButtons(key, meta, { afterHide = closeDrawer } = {}) {
  const pinned = isMarkPinned(state.userdata, key);
  return [
    feat('pins') ? iconButton('pin', pinned ? 'Unpin' : 'Pin', () => toggleMarkPin(key, meta), { class: pinned ? 'is-on' : '', key: `mk-pin:${key}` }) : null,
    feat('hideSnooze') ? iconButton('eyeOff', meta.type === 'course' ? 'Hide this class' : 'Hide', () => (hideMark(key, meta), afterHide?.()), { key: `mk-hide:${key}` }) : null,
  ];
}

export function markNotes(key) {
  if (!feat('notes')) return null;
  return h(
    'section',
    { class: 'd-block' },
    h('h3', null, 'Notes'),
    h('textarea', { class: 'notes', rows: '3', placeholder: 'Anything to remember…', 'data-key': `note:${key}`, value: noteValue(key), oninput: (e) => setNote(key, e.target.value) }),
    h('p', { class: 'caption' }, 'Saved automatically.')
  );
}

export const notHidden = (keyOf) => (x) => !isMarkHidden(state.userdata, keyOf(x));
export const pinMark = (key) => (feat('pins') && isMarkPinned(state.userdata, key) ? h('span', { class: 'pin-mark', title: 'Pinned', 'aria-label': 'Pinned' }) : null);

// Reopen something from the Pinned page or the hidden list.
export function openMark(m) {
  if (m.type === 'item') return openDrawer('item', m.key);
  if (m.type === 'module') {
    const [courseId, id] = m.ref.split('|');
    setUi({ modulesOpen: { ...(ui.modulesOpen || {}), [courseId]: { ...(ui.modulesOpen?.[courseId] || {}), [id]: true } } });
    return openDrawer('module', m.ref);
  }
  if (m.type === 'course') {
    location.hash = `#/course/${m.ref}`;
    return null;
  }
  return openDrawer(m.type, m.ref);
}
