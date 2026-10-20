// G7: focus timer controls and the countdown pill in the top bar.
// The background worker ends sessions and sends notifications, so the timer
// keeps going after you close the tab. In test mode the page does that job.

import { h } from './dom.js';
import { icon } from './icons.js';
import * as storage from '../lib/storage.js';
import { state, notify, updateUser } from './store.js';
import { toast } from './actions.js';
import { startFocus as begin, stopFocus as finish } from '../lib/focus.js';
import { usesSample } from '../lib/env.js';

export function focusState() {
  return state.focus || null;
}

// G7: minutes defaults to Settings → Planning; the details panel can pick another length.
export const FOCUS_LENGTHS = [15, 20, 25, 30, 45, 50, 60, 90];

export async function startFocus(item, minutes = state.settings.focusWork) {
  const f = begin(item, Date.now(), { work: minutes, brk: state.settings.focusBreak });
  state.focus = f;
  notify();
  await storage.set({ focus: f });
  toast(`Focus: ${minutes} minutes on “${item.title}”`);
}

export async function stopFocus() {
  const f = state.focus;
  if (!f) return;
  const secs = finish(f, Date.now());
  state.focus = null;
  notify();
  await storage.set({ focus: null });
  if (secs > 0) {
    await updateUser((ud) => {
      ud.focusLog ||= {};
      ud.focusLog[f.itemId] = (ud.focusLog[f.itemId] || 0) + secs;
    });
  }
  toast(secs >= 60 ? `Logged ${Math.round(secs / 60)} minutes` : 'Focus stopped');
}

const mmss = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// The pill updates its own text every second, without redrawing the page.
export function focusPill(openItem) {
  const f = focusState();
  if (!f) return null;
  return h(
    'div',
    { class: ['focus-pill', f.phase === 'break' && 'is-break'] },
    h('button', { class: 'focus-pill-main', title: 'Open the item', 'data-key': 'focus-open', onclick: () => openItem(f.itemId) }, icon('clock', 14), h('span', { class: 'focus-time', 'data-ends': String(f.endsAt) }, mmss(f.endsAt - Date.now())), h('span', { class: 'focus-label' }, f.phase === 'break' ? 'Break' : f.title)),
    h('button', { class: 'icon-btn focus-stop', title: 'Stop focus', 'aria-label': 'Stop focus', 'data-key': 'focus-stop', onclick: stopFocus }, icon('x', 14))
  );
}

let ticking = false;
export async function initFocus() {
  state.focus = (await storage.get(['focus'])).focus || null;
  storage.onChange((c) => {
    if ('focus' in c) {
      state.focus = c.focus.newValue || null;
      notify();
    }
  });
  if (ticking) return;
  ticking = true;
  setInterval(async () => {
    document.querySelectorAll('.focus-time[data-ends]').forEach((el) => (el.textContent = mmss(Number(el.dataset.ends) - Date.now())));
    // Test mode has no background worker, so the page moves the timer along.
    if (usesSample() && state.focus && Date.now() >= state.focus.endsAt) {
      const { runFocus } = await import('../lib/notifyRunner.js');
      await runFocus({ show: devShow });
    }
  }, 1000);
}

// Test mode: notifications appear as toasts and are kept for checking.
export function devShow(n) {
  window.__notes = [...(window.__notes || []), n];
  toast(`${n.title}: ${n.message.split('\n')[0]}`);
}
