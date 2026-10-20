// UI state: settings, personal data, cached Canvas data and sync status.
// Mirrors chrome.storage, so the new tab, popup and background stay in sync.

import * as storage from '../lib/storage.js';
import { withDefaults, userWithDefaults } from '../lib/defaults.js';
import { gradesWithDefaults } from '../lib/gradeSummary.js';
import { isExtension, isDemo, devScenario, CANVAS_ORIGIN, DEMO_ORIGIN, setDemoFlag } from '../lib/env.js';
import { applySchool, hasAccess } from '../lib/school.js';
import { setProfiles, serializeProfiles } from '../lib/profiles.js';
import { countDay } from '../lib/feedback.js';
import { VERSION } from '../lib/changelog.js';
import { dayKey, userTz } from '../lib/time.js';

export const state = {
  loaded: false,
  settings: withDefaults(null),
  userdata: userWithDefaults(null),
  grades: gradesWithDefaults(null),
  snapshots: [],
  archive: {}, // I1
  syllabi: [], // K8: your syllabi (dates, class meetings, grading rules)
  cache: null,
  auth: { state: 'unknown' },
  netStatus: { offline: false, error: null },
  syncState: { running: false },
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  access: null, // K1: may the dashboard read your school's Canvas? (null = not checked yet)
};

const KEYS = ['settings', 'userdata', 'grades', 'snapshots', 'archive', 'syllabi', 'cache', 'auth', 'netStatus', 'syncState'];
const subs = new Set();
let scheduled = false;

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function notify() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    subs.forEach((fn) => fn(state));
  });
}

function apply(key, value) {
  if (key === 'settings') {
    state.settings = withDefaults(value);
    schoolChanged();
  }
  else if (key === 'userdata') state.userdata = userWithDefaults(value);
  else if (key === 'grades') state.grades = gradesWithDefaults(value);
  else if (key === 'snapshots') state.snapshots = value || [];
  else if (key === 'archive') state.archive = value || {};
  else if (key === 'syllabi') {
    state.syllabi = Array.isArray(value) ? value : [];
    setProfiles(state.syllabi);
  }
  else if (key === 'cache') state.cache = value || null;
  else if (key === 'auth') state.auth = value || { state: 'unknown' };
  else if (key === 'netStatus') state.netStatus = value || { offline: false, error: null };
  else if (key === 'syncState') state.syncState = value || { running: false };
}

// K1: point every module at your school's Canvas and check Chrome still allows it.
let checkedOrigin;
function schoolChanged() {
  const origin = applySchool(state.settings);
  if (origin === checkedOrigin) return;
  checkedOrigin = origin;
  refreshAccess();
}
export async function refreshAccess() {
  const origin = CANVAS_ORIGIN;
  const ok = await hasAccess(origin);
  if (origin !== CANVAS_ORIGIN) return; // changed again meanwhile
  if (ok !== state.access) {
    state.access = ok;
    notify();
  }
}

// K16: start or leave demo mode. Leaving deletes only demo data, then reloads into your
// real dashboard (or setup, if you haven't set it up yet).
export async function startDemo() {
  setDemoFlag(true);
  location.hash = '#/home';
  location.reload();
}
export async function exitDemo() {
  if (!isDemo()) return;
  await storage.clear();
  setDemoFlag(false);
  location.hash = '#/home';
  location.reload();
}

async function ownerSyllabi() {
  try {
    const url = isExtension ? chrome.runtime.getURL('owner-data/syllabi.js') : '/owner-data/syllabi.js';
    // Test mode without owner-data/: the tests' renamed sample syllabi.
    const list = await import(url).catch((e) => (isExtension ? Promise.reject(e) : import('/src/tests/sample/syllabi.js'))).then((m) => m.default);
    return serializeProfiles(list).map((p) => ({ id: `owner-${p.code.replace(/\W+/g, '-').toLowerCase()}`, ...p }));
  } catch {
    return []; // a normal install: there's nothing to bring over
  }
}

// K5–K7: save one syllabus (replacing the one with the same id).
export async function saveSyllabus(entry) {
  const list = [...state.syllabi.filter((p) => p.id !== entry.id), serializeProfiles([entry])[0]];
  state.syllabi = list;
  setProfiles(list);
  notify();
  await storage.set({ syllabi: list });
}
export async function removeSyllabus(id) {
  const list = state.syllabi.filter((p) => p.id !== id);
  state.syllabi = list;
  setProfiles(list);
  notify();
  await storage.set({ syllabi: list });
}

export async function init() {
  const data = await storage.get(KEYS);
  // K9: people who used the dashboard before setup existed skip its optional steps.
  if (data.settings && data.settings.setupDone === undefined) {
    data.settings = { ...data.settings, setupDone: true };
    await storage.set({ settings: data.settings });
  }
  // K3: grades from before grading systems existed are UW decimal, with UW's 180 credits.
  if (data.grades && data.grades.system === undefined) {
    data.grades = { ...data.grades, system: 'uw', creditsGoal: data.grades.creditsGoal ?? 180 };
    await storage.set({ grades: data.grades });
  }
  // K16: a fresh demo starts as a set-up sample student (UW-style 4.0 grades, its own syllabi).
  if (isDemo() && !data.settings) {
    const { demoSyllabi } = await import('../lib/fixtures.js');
    data.settings = { ...withDefaults(null), canvasOrigin: DEMO_ORIGIN, setupDone: true };
    data.grades = { ...gradesWithDefaults(null), system: 'uw', creditsGoal: 180 };
    data.syllabi = serializeProfiles(demoSyllabi());
    await storage.set({ settings: data.settings, grades: data.grades, syllabi: data.syllabi });
  }
  // K8: the owner's hand-written syllabi move into saved data once (the folder isn't published).
  if (data.syllabi === undefined) {
    data.syllabi = await ownerSyllabi();
    await storage.set({ syllabi: data.syllabi });
  }
  for (const k of KEYS) apply(k, data[k]);
  await refreshAccess();
  // K20: people updating from before "What's new" existed get its notes once; new installs don't.
  if (!isDemo() && state.settings.seenVersion == null) await updateSettings({ seenVersion: state.settings.setupDone && data.cache ? '0.1.0' : VERSION });
  // K18: count today as a day of use (never in demo mode; never sent anywhere).
  if (!isDemo() && state.settings.setupDone) {
    const next = countDay(state.settings.usage, dayKey(Date.now(), userTz()));
    if (next) await updateSettings({ usage: next });
  }
  if (isExtension && chrome.permissions?.onAdded) {
    chrome.permissions.onAdded.addListener(refreshAccess);
    chrome.permissions.onRemoved.addListener(refreshAccess);
  }
  state.loaded = true;
  mirrorBoot();
  storage.onChange((changes) => {
    let touched = false;
    for (const [k, { newValue }] of Object.entries(changes)) {
      if (KEYS.includes(k)) {
        apply(k, newValue);
        touched = true;
      }
    }
    if (touched) notify();
  });
  window.addEventListener('online', () => {
    state.online = true;
    notify();
    requestSync(true); // A8: refresh when the connection returns
  });
  window.addEventListener('offline', () => {
    state.online = false;
    notify();
  });
  notify();
}

// Synchronous copies for boot.js, so the theme applies before first paint (B5).
function mirrorBoot() {
  try {
    localStorage.setItem('boot:theme', state.settings.theme);
    localStorage.setItem('boot:palette', state.settings.palette || 'pink');
    localStorage.setItem('boot:newtab', state.settings.newTab ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export async function updateSettings(change) {
  const next = typeof change === 'function' ? change(structuredClone(state.settings)) || state.settings : { ...state.settings, ...change };
  state.settings = withDefaults(next);
  schoolChanged();
  mirrorBoot();
  notify();
  await storage.set({ settings: state.settings });
}

export async function updateUser(fn) {
  const draft = structuredClone(state.userdata);
  fn(draft);
  state.userdata = userWithDefaults(draft);
  notify();
  await storage.set({ userdata: state.userdata });
}

let snapTimer;
// F13: show Canvas's answer right away (the next refresh confirms it).
export async function patchCacheItem(id, fn) {
  if (!state.cache) return;
  const cache = structuredClone(state.cache);
  const item = cache.items.find((i) => i.id === id);
  if (!item) return;
  fn(item);
  state.cache = cache;
  notify();
  await storage.set({ cache });
}

export async function updateGrades(fn) {
  const draft = structuredClone(state.grades);
  fn(draft);
  state.grades = gradesWithDefaults(draft);
  notify();
  await storage.set({ grades: state.grades });
  // E20: grades changed (new scale, credits…), so record a snapshot. What-if never counts.
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    if (state.cache) import('../lib/sync.js').then((m) => m.saveSnapshot(state.cache));
  }, 800);
}

let devReady = null;
async function devSync(force) {
  if (!devReady) {
    devReady = Promise.all([import('../lib/canvas.js'), import('../lib/fixtures.js'), import('../lib/sync.js')]).then(([canvas, fx, sync]) => {
      canvas.setTransport(fx.fixtureTransport(isDemo() ? 'demo' : devScenario()));
      return sync;
    });
  }
  const sync = await devReady;
  const r = await sync.runSync({ force });
  // Test mode: run the notification rules here, since there's no background worker.
  if (r?.ok) {
    const [{ runNotifications }, { devShow }] = await Promise.all([import('../lib/notifyRunner.js'), import('./focus.js')]);
    await runNotifications({ show: devShow, setBadge: (b) => (state.devBadge = b) });
  }
  return r;
}

// Test mode: the 5-minute reminder check, on demand.
export async function devTick(now) {
  const [{ runNotifications }, { devShow }] = await Promise.all([import('../lib/notifyRunner.js'), import('./focus.js')]);
  return runNotifications({ show: devShow, setBadge: (b) => (state.devBadge = b), now });
}

// Plain-language summary of a refresh result, for toasts and Settings.
export function describeSync(r) {
  if (!r) return 'No refresh yet';
  if (r.ok) {
    const parts = [`${r.courses} course${r.courses === 1 ? '' : 's'}`, `${r.items} item${r.items === 1 ? '' : 's'}`];
    if (r.skippedCourses) parts.push(`${r.skippedCourses} course skipped (see Settings → Courses)`);
    return `Updated · ${parts.join(' · ')}`;
  }
  if (r.skipped === 'running') return 'Already refreshing…';
  if (r.skipped === 'throttled') return 'Just refreshed. Try again in a few seconds.';
  if (r.skipped === 'fresh') return 'Already up to date';
  if (r.skipped === 'setup') return 'Choose your school first.';
  if (r.error === 'auth') return 'Your Canvas login expired. Log in, then refresh.';
  if (r.error === 'offline') return 'You’re offline.';
  return `Couldn’t refresh: ${r.error}`;
}

export async function requestSync(force = false) {
  if (isExtension && !isDemo()) {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'sync', force });
      return r || { error: 'the background worker didn’t respond. Reload the extension in chrome://extensions' };
    } catch (e) {
      return { error: e.message };
    }
  }
  return devSync(force);
}
