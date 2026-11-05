// Service worker: background refresh (A6), popup on/off (A3/B7), and the
// single place where Canvas syncs run so pages never double-fetch.

import { runSync, clearStaleLock } from './lib/sync.js';
import { withDefaults } from './lib/defaults.js';
import { runNotifications, runFocus } from './lib/notifyRunner.js';
import { applySchool } from './lib/school.js';
import { APP_NAME } from './lib/env.js';
import { setProfiles } from './lib/profiles.js';

const ALARM = 'refresh';
const TICK = 'tick'; // H1/H3 reminders and the morning summary, every 5 minutes
const FOCUS = 'focus'; // G7

const BADGE = { red: '#bb3a22', accent: '#b03867' }; // J1: soft pink

async function show(n) {
  await chrome.notifications.create(n.key, { type: 'basic', iconUrl: chrome.runtime.getURL('src/icons/icon128.png'), title: n.title, message: n.message, priority: 1 });
}
async function setBadge(b) {
  await chrome.action.setBadgeText({ text: b.text });
  await chrome.action.setBadgeBackgroundColor({ color: BADGE[b.color] || BADGE.accent });
  await chrome.action.setTitle({ title: b.title ? `${APP_NAME} · ${b.title}` : APP_NAME });
}
async function notifyNow() {
  try {
    await runNotifications({ show, setBadge });
  } catch (e) {
    console.warn('notifications', e);
  }
}
async function syncAndNotify(opts) {
  const r = await runSync(opts);
  if (r?.ok) await notifyNow();
  return r;
}

async function scheduleFocus() {
  const { focus } = await chrome.storage.local.get('focus');
  await chrome.alarms.clear(FOCUS);
  if (focus?.endsAt) await chrome.alarms.create(FOCUS, { when: Math.max(Date.now() + 1000, focus.endsAt) });
}

// K1: your school's Canvas, before anything syncs.
const ready = Promise.all([clearStaleLock(), chrome.storage.local.get(['settings', 'syllabi']).then(({ settings: s, syllabi }) => (applySchool(s), setProfiles(syllabi)))]);
ready.catch(() => {}); // a failure here is reported by whichever task waits on it

async function settings() {
  const { settings: s } = await chrome.storage.local.get('settings');
  return withDefaults(s);
}

async function configure() {
  const s = await settings();
  const existing = await chrome.alarms.get(ALARM);
  if (!existing || existing.periodInMinutes !== s.refreshMinutes) {
    await chrome.alarms.create(ALARM, { periodInMinutes: s.refreshMinutes, delayInMinutes: 1 });
  }
  await chrome.action.setPopup({ popup: s.features.popup === false ? '' : 'src/popup.html' });
  if (!(await chrome.alarms.get(TICK))) await chrome.alarms.create(TICK, { periodInMinutes: 5, delayInMinutes: 1 });
}

// Chrome can stop or restart this worker mid-task (after a reload, an update, or when it's
// idle); the API call then fails with "No SW". Every background task goes through here so
// that's a quiet note in the log, not an "Uncaught" error on chrome://extensions.
function safely(task, label) {
  Promise.resolve()
    .then(task)
    .catch((e) => console.warn(`Neko background: ${label} stopped (${e?.message || e}). It runs again on the next refresh.`));
}

chrome.runtime.onInstalled.addListener(() =>
  safely(async () => {
    await ready;
    await configure();
    await syncAndNotify({ force: true });
  }, 'install')
);

chrome.runtime.onStartup.addListener(() =>
  safely(async () => {
    await ready;
    await configure();
    await syncAndNotify({});
    await notifyNow(); // H3: a missed morning summary shows when Chrome opens that morning
  }, 'startup')
);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) safely(() => ready.then(() => syncAndNotify({ force: true })), 'refresh');
  else if (alarm.name === TICK) safely(() => ready.then(notifyNow), 'reminders');
  else if (alarm.name === FOCUS) safely(() => ready.then(() => runFocus({ show })).then(scheduleFocus), 'focus timer');
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    applySchool(changes.settings.newValue);
    safely(configure, 'settings');
  }
  if (changes.focus) safely(scheduleFocus, 'focus timer');
  if (changes.syllabi) setProfiles(changes.syllabi.newValue); // K8
  if (changes.userdata || changes.settings) safely(notifyNow, 'badge'); // keep the badge current when you check things off
});

// Clicking a notification opens the right place in the dashboard.
chrome.notifications.onClicked.addListener((id) =>
  safely(async () => {
    const { notifyState } = await chrome.storage.local.get('notifyState');
    const target = notifyState?.targets?.[id] || '#/home';
    await chrome.tabs.create({ url: chrome.runtime.getURL(`src/newtab.html?app=1${target}`) });
    await chrome.notifications.clear(id);
  }, 'notification click')
);

// With the popup turned off, clicking the icon opens the dashboard.
chrome.action.onClicked.addListener(() => safely(() => chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab.html?app=1') }), 'open dashboard'));

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'sync') {
    ready.then(() => syncAndNotify({ force: !!msg.force })).then(sendResponse, (e) => sendResponse({ error: e.message }));
    return true; // keep the channel open for the async reply
  }
  return false;
});
