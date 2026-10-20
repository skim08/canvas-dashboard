// Runs the notification rules against stored data. Used by the background
// worker (real Chrome notifications) and by the page in test mode.

import * as storage from './storage.js';
import { withDefaults, userWithDefaults } from './defaults.js';
import { allItems, courseNick } from './model.js';
import { summarize } from './gradeSummary.js';
import { evaluate } from './notify.js';
import { badgeFor } from './planning.js';
import { advance } from './focus.js';
import { DEFAULT_TZ, userTz } from './time.js';

// show(note) displays one notification; setBadge({ text, color, title }) updates the icon.
export async function runNotifications({ show, setBadge, now = Date.now() }) {
  const { cache, settings, userdata, grades, notifyState } = await storage.get(['cache', 'settings', 'userdata', 'grades', 'notifyState']);
  if (!cache) return { notes: [] };
  const s = withDefaults(settings);
  const ud = userWithDefaults(userdata);
  const tz = userTz(cache.profile?.timeZone);
  const items = allItems(cache, ud, s, now);
  let summary = null;
  try {
    summary = summarize({ cache, items, settings: s, grades: { ...(grades || {}), whatIfOn: false }, now });
  } catch {
    summary = null;
  }
  const nickOf = (id) => courseNick(id, cache.courses || [], s);
  const { notes, next } = evaluate({ prev: notifyState || {}, cache, items, summary, settings: s, now, tz, nickOf });
  await storage.set({ notifyState: next });
  for (const n of notes) await show(n);
  if (setBadge) await setBadge(s.features.badge === false ? { text: '', color: 'accent', title: '' } : badgeFor(items, now, tz));
  return { notes };
}

// G7: move the focus timer along when a session ends.
export async function runFocus({ show, now = Date.now() }) {
  const { focus, userdata } = await storage.get(['focus', 'userdata']);
  if (!focus || now < focus.endsAt) return focus || null;
  const r = advance(focus, now);
  const ud = userWithDefaults(userdata);
  if (r.logged) {
    ud.focusLog = { ...(ud.focusLog || {}), [focus.itemId]: (ud.focusLog?.[focus.itemId] || 0) + r.logged };
    await storage.set({ userdata: ud });
  }
  await storage.set({ focus: r.focus });
  if (r.note) await show(r.note);
  return r.focus;
}
