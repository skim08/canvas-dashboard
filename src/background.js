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

chrome.runtime.onInstalled.addListener(async () => {
  await ready;
  await configure();
  syncAndNotify({ force: true });
});

chrome.runtime.onStartup.addListener(async () => {
  await ready;
  await configure();
  await syncAndNotify({});
  notifyNow(); // H3: a missed morning summary shows when Chrome opens that morning
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) ready.then(() => syncAndNotify({ force: true }));
  else if (alarm.name === TICK) ready.then(notifyNow);
  else if (alarm.name === FOCUS) ready.then(() => runFocus({ show })).then(scheduleFocus);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    applySchool(changes.settings.newValue);
    configure();
  }
  if (changes.focus) scheduleFocus();
  if (changes.syllabi) setProfiles(changes.syllabi.newValue); // K8
  if (changes.userdata || changes.settings) notifyNow(); // keep the badge current when you check things off
});

// Clicking a notification opens the right place in the dashboard.
chrome.notifications.onClicked.addListener(async (id) => {
  const { notifyState } = await chrome.storage.local.get('notifyState');
  const target = notifyState?.targets?.[id] || '#/home';
  chrome.tabs.create({ url: chrome.runtime.getURL(`src/newtab.html?app=1${target}`) });
  chrome.notifications.clear(id);
});

// With the popup turned off, clicking the icon opens the dashboard.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab.html?app=1') });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'sync') {
    ready.then(() => syncAndNotify({ force: !!msg.force })).then(sendResponse, (e) => sendResponse({ error: e.message }));
    return true; // keep the channel open for the async reply
  }
  return false;
});
