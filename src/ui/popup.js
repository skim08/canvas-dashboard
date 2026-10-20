// A3: toolbar popup. Overdue first, then today and tomorrow.

import { h } from './dom.js';
import { icon } from './icons.js';
import { state, init, subscribe, requestSync } from './store.js';
import { dot, dueText, dueTone, statusTags, loadingText } from './components.js';
import { allItems, listable } from '../lib/model.js';
import { DEFAULT_TZ, dayKey, addDays, formatTime, userTz } from '../lib/time.js';
import { CANVAS_ORIGIN, dashboardUrl, isExtension } from '../lib/env.js';
import { STALE_MS } from '../lib/sync.js';

const root = document.getElementById('popup');

function openDashboard(hash = '') {
  const url = dashboardUrl() + hash;
  if (isExtension) {
    chrome.tabs.create({ url });
    window.close();
  } else {
    location.href = url;
  }
}

function row(i, now, tz) {
  return h(
    'button',
    { class: ['row', 'popup-row', i.overdue && 'is-overdue'], onclick: () => openDashboard(`#/home`) },
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, i.title), h('span', { class: 'row-meta' }, i.courseId ? h('span', { class: 'course' }, dot(i.color), i.nick) : 'Personal', ...statusTags(i))),
    h('span', { class: `row-due tone-${dueTone(i, now)}` }, dueText(i, now, tz))
  );
}

function render() {
  if (!state.loaded) return;
  if (state.settings.theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.dataset.palette = state.settings.palette || 'pink'; // J1
  const now = Date.now();
  const tz = userTz(state.cache?.profile?.timeZone);
  const items = listable(allItems(state.cache, state.userdata, state.settings, now)).filter((i) => i.area === 'main');
  const today = dayKey(now, tz);
  const tomorrow = addDays(today, 1);
  const byDue = (a, b) => new Date(a.dueAt) - new Date(b.dueAt);
  const overdue = items.filter((i) => i.overdue).sort(byDue);
  const todayList = items.filter((i) => !i.overdue && !i.done && i.dueAt && dayKey(i.dueAt, tz) === today && new Date(i.dueAt).getTime() >= now).sort(byDue);
  const tomorrowList = items.filter((i) => !i.overdue && !i.done && i.dueAt && dayKey(i.dueAt, tz) === tomorrow).sort(byDue);

  const section = (label, list, tone) =>
    list.length ? h('div', { class: 'group' }, h('div', { class: ['group-head', tone && `tone-${tone}`] }, h('span', null, label), h('span', { class: 'count' }, String(list.length))), h('div', { class: 'rows' }, list.map((i) => row(i, now, tz)))) : null;

  root.replaceChildren(
    h(
      'div',
      { class: 'popup' },
      !CANVAS_ORIGIN || state.access === false
        ? h('div', { class: 'banner tone-amber' }, icon('alert'), h('span', null, 'Finish setting up: choose your school’s Canvas.'))
        : state.auth.state === 'expired'
        ? h('div', { class: 'banner tone-red' }, icon('alert'), h('span', null, 'Canvas login expired.'), h('a', { class: 'btn btn-primary btn-sm', href: `${CANVAS_ORIGIN}/login`, target: '_blank', rel: 'noopener' }, 'Log in to Canvas'))
        : null,
      section('Overdue', overdue, 'red'),
      section('Today', todayList),
      section('Tomorrow', tomorrowList),
      !overdue.length && !todayList.length && !tomorrowList.length ? h('p', { class: 'empty' }, state.cache ? 'Nothing due today or tomorrow.' : loadingText()) : null,
      h(
        'div',
        { class: 'popup-foot' },
        h('span', { class: 'updated' }, state.cache?.fetchedAt ? `Updated ${formatTime(state.cache.fetchedAt, tz)}` : ''),
        h('button', { class: 'btn btn-primary', onclick: () => openDashboard() }, 'Open dashboard')
      )
    )
  );
}

(async function start() {
  await init();
  subscribe(render);
  render();
  const lastFailed = state.auth.state === 'expired' || state.netStatus.offline || state.netStatus.error;
  if (lastFailed) requestSync(true);
  else if (!state.cache?.fetchedAt || Date.now() - state.cache.fetchedAt > STALE_MS) requestSync(false);
})();
