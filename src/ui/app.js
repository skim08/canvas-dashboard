// The new-tab dashboard: top bar, four pages (B1), drawer, menus, shortcuts.

import { h } from './dom.js';
import { icon } from './icons.js';
import { state, init, subscribe, requestSync, describeSync, exitDemo } from './store.js';
import { ui, setUi, openDrawer, closeDrawer, toggleDone, togglePin, toast } from './actions.js';
import { feat, itemMenu, dot, iconButton, dueText, button } from './components.js';
import { renderDrawer } from './drawer.js';
import { renderHome } from './pages/home.js';
import { renderCourses } from './pages/courses.js';
import { renderGrades } from './pages/grades.js';
import { renderCalendar } from './pages/calendar.js';
import { renderSettings } from './pages/settings.js';
import { renderOther } from './pages/other.js';
import { renderCourse } from './pages/course.js';
import { renderAnnouncements } from './pages/announcements.js';
import { renderInbox } from './pages/inbox.js';
import { renderPinned } from './pages/pinned.js';
import { renderCompleted } from './pages/completed.js';
import { watchDay } from './celebrate.js';
import { installTooltips } from './tooltip.js';
import { balanceHome } from './pages/home.js';
import { searchEverything } from '../lib/search.js';
import { routeCanvasLink } from '../lib/contentNormalize.js';
import { initReadState } from './content.js';
import { initFocus, focusPill, startFocus, stopFocus, focusState } from './focus.js';
import { allItems, attention, visibleCourses, courseColor, courseNick, searchItems, TYPE_LABEL } from '../lib/model.js';
import { DEFAULT_TZ, formatTime, formatDate, userTz } from '../lib/time.js';
import { renderSetup, needsSetup } from './pages/setup.js';
import { STALE_MS } from '../lib/sync.js';
import { summarize } from '../lib/gradeSummary.js';
import { toggleWhatIf } from './gradeActions.js';
import { CANVAS_ORIGIN, isDev, isDemo } from '../lib/env.js';
import { BUILD } from '../build.js';

const PAGES = [
  { id: 'home', label: 'Home', render: renderHome },
  { id: 'courses', label: 'Courses', render: renderCourses },
  { id: 'grades', label: 'Grades', render: renderGrades },
  { id: 'calendar', label: 'Calendar', render: renderCalendar },
  { id: 'other', label: 'Other', render: renderOther, feature: 'otherTab' },
];

const pagesShown = () => PAGES.filter((p) => !p.feature || feat(p.feature));

// Notification clicks arrive as #/open/<type>/<id> (H1–H7, G7): open that
// thing's details on the right page, then tidy the address.
function handleOpenLink() {
  const m = location.hash.match(/^#\/open\/(item|announcement|grade)\/(.+)$/);
  if (!m) return false;
  const [, type, id] = m;
  const page = type === 'announcement' ? '#/announcements' : type === 'grade' ? '#/grades' : '#/home';
  if (type === 'grade') ui.gradeTab = 'overview';
  ui.drawer = { type, id: decodeURIComponent(id) };
  history.replaceState(null, '', `${location.pathname}${location.search}${page}`);
  return true;
}

// Routes: #/home … #/other, #/settings, plus sub-pages that live under Courses:
// #/course/<id>/<tab> (F1), #/announcements (F2), #/inbox (F8).
function parseRoute() {
  const [id, a, b] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  if (id === 'course' && a) return { page: 'course', courseId: a, tab: b || 'overview', nav: 'courses' };
  if (id === 'announcements' && feat('announcementsFeed')) return { page: 'announcements', nav: 'courses' };
  if (id === 'inbox' && feat('inbox')) return { page: 'inbox', nav: 'courses' };
  if (id === 'pinned' && feat('pins')) return { page: 'pinned', nav: 'home' }; // I2
  if (id === 'completed' && feat('completedList')) return { page: 'completed', nav: 'home' }; // D8
  const page = id === 'settings' || pagesShown().some((p) => p.id === id) ? id : 'home';
  return { page, nav: page };
}
function route() {
  return parseRoute().nav;
}

function buildCtx() {
  const now = Date.now();
  const tz = userTz(state.cache?.profile?.timeZone);
  const all = state.cache?.courses || [];
  const s = state.settings;
  const everything = allItems(state.cache, state.userdata, s, now);
  // B11: main views only see your classes (plus anything you added to Home).
  const items = everything.filter((i) => i.area === 'main');
  const colorOf = (id) => courseColor(id, all, s);
  const nickOf = (id) => courseNick(id, all, s);
  const decorate = (c) => ({ ...c, color: colorOf(c.id), nick: nickOf(c.id) });
  // Phase 2: every grade number on every screen comes from this one summary.
  const grades = summarize({ cache: state.cache, items: everything, settings: s, grades: state.grades, now });
  return {
    grades,
    now,
    tz,
    items,
    otherItems: everything.filter((i) => i.fromOther),
    officeHours: everything.filter((i) => i.officeHours),
    allItems: everything,
    courses: visibleCourses(all, s, 'core').map(decorate),
    otherCourses: visibleCourses(all, s, 'other').map(decorate),
    allCourses: all,
    colorOf,
    nickOf,
    attention: attention(items, { auth: state.auth, atRisk: grades.atRisk }),
  };
}

// Manual refresh always says what happened, so a skipped or failed refresh is never silent.
async function manualRefresh() {
  const r = await requestSync(true);
  toast(describeSync(r));
}

// ---- Top bar ----

function topBar(ctx, current) {
  const syncing = state.syncState.running;
  const offline = !state.online || state.netStatus.offline;
  return h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'topbar-inner' },
      h(
        'nav',
        { class: 'nav', 'aria-label': 'Pages' },
        pagesShown().map((p) => h('a', { href: `#/${p.id}`, class: ['nav-link', current === p.id && 'is-active'], 'aria-current': current === p.id ? 'page' : null, 'data-key': `nav:${p.id}` }, p.label)),
        BUILD.beta ? h('span', { class: 'beta-label', title: 'You’re testing an early version. Thanks! Feedback: Settings → About.' }, 'Beta') : null // K19
      ),
      h(
        'div',
        { class: 'topbar-right' },
        feat('focus') ? focusPill((id) => openDrawer('item', id)) : null,
        feat('search') ? searchBox(ctx) : null,
        h(
          'span',
          { class: 'updated', title: state.cache?.fetchedAt ? `Last updated ${new Date(state.cache.fetchedAt).toLocaleString()}` : '' },
          offline ? h('span', { class: 'tag tag-amber' }, icon('wifiOff', 14), 'Offline') : null,
          state.cache?.fetchedAt ? `Updated ${formatTime(state.cache.fetchedAt, ctx.tz)}` : syncing ? 'Loading…' : ''
        ),
        iconButton('refresh', 'Refresh from Canvas (r)', manualRefresh, { class: syncing ? 'is-spinning' : '', key: 'refresh' }),
        h('a', { href: '#/settings', class: ['icon-btn', current === 'settings' && 'is-on'], title: 'Settings', 'aria-label': 'Settings', 'data-key': 'nav:settings' }, icon('gear'))
      )
    )
  );
}

// C12 + F12: one search across assignments, announcements, pages and files.
function searchBox(ctx) {
  const q = ui.search.query;
  const index = state.cache?.index || {};
  const visible = new Set([...ctx.courses, ...ctx.otherCourses].map((c) => c.id));
  const groups = ui.search.open && q ? searchEverything({ items: ctx.allItems, announcements: state.cache?.announcements, pages: index.pages, files: index.files, nickOf: ctx.nickOf, visibleCourseIds: visible }, q) : [];
  const flat = groups.flatMap((g) => g.results);
  const active = Math.min(ui.search.active, Math.max(0, flat.length - 1));
  const pick = (r) => {
    setUi({ search: { query: '', open: false, active: 0 } });
    document.activeElement?.blur();
    if (r.type === 'assignment') openDrawer('item', r.id);
    else if (r.type === 'announcement') openDrawer('announcement', r.id);
    else if (r.type === 'page') openDrawer('page', r.id);
    else if (r.type === 'file') {
      ui.folder = { ...(ui.folder || {}), [r.courseId]: r.ref.folderId };
      ui.fileHighlight = r.id;
      location.hash = `#/course/${r.courseId}/files`;
    }
  };
  const metaOf = (r) => {
    const course = r.courseId ? [dot(ctx.colorOf(r.courseId)), ctx.nickOf(r.courseId)] : 'Personal';
    if (r.type === 'assignment') return [course, ` · ${TYPE_LABEL[r.ref.type]} · ${r.ref.done ? 'Done' : dueText(r.ref, ctx.now, ctx.tz)}`];
    if (r.type === 'announcement') return [course, r.ref.postedAt ? ` · ${formatDate(r.ref.postedAt, ctx.tz)}` : ''];
    if (r.type === 'file') return [course, r.ref.folderId ? ' · File' : ''];
    return [course, ' · Page'];
  };
  let n = -1;
  return h(
    'div',
    { class: 'search' },
    icon('search'),
    h('input', {
      id: 'search',
      type: 'search',
      placeholder: 'Search everything',
      value: q,
      autocomplete: 'off',
      'aria-label': 'Search assignments, announcements, pages and files',
      'data-key': 'search',
      oninput: (e) => setUi({ search: { query: e.target.value, open: true, active: 0 } }),
      onfocus: () => q && setUi({ search: { ...ui.search, open: true } }),
      onblur: () => setTimeout(() => ui.search.open && setUi({ search: { ...ui.search, open: false } }), 150),
      onkeydown: (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setUi({ search: { ...ui.search, active: Math.min(active + 1, flat.length - 1) } });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setUi({ search: { ...ui.search, active: Math.max(active - 1, 0) } });
        } else if (e.key === 'Enter' && flat[active]) {
          e.preventDefault();
          pick(flat[active]);
        } else if (e.key === 'Escape') {
          setUi({ search: { query: '', open: false, active: 0 } });
          e.target.blur();
        }
      },
    }),
    ui.search.open && q
      ? h(
          'div',
          { class: 'search-results', role: 'listbox' },
          groups.length
            ? groups.map((g) => [
                h('div', { class: 'search-group' }, g.label),
                g.results.map((r) => {
                  n++;
                  const idx = n;
                  return h(
                    'button',
                    { class: ['search-result', idx === active && 'is-active'], role: 'option', 'aria-selected': String(idx === active), onmousedown: (e) => e.preventDefault(), onclick: () => pick(r) },
                    h('span', { class: 'row-title' }, r.title),
                    h('span', { class: 'row-meta' }, metaOf(r))
                  );
                }),
              ])
            : h('p', { class: 'search-empty' }, 'No matches')
        )
      : null
  );
}

// A5 + A8 banners
function banners(current) {
  const out = [];
  // On Home, "Needs attention" already shows the login problem (B2), so skip the duplicate.
  const attentionOnHome = current === 'home' && state.settings.homeSections.some((s) => s.id === 'attention' && s.visible);
  if (state.auth.state === 'expired' && !attentionOnHome) {
    out.push(
      h(
        'div',
        { class: 'banner tone-red' },
        icon('alert'),
        h('span', null, 'Your Canvas login expired. Log in, then come back here.'),
        h('a', { class: 'btn btn-primary btn-sm', href: `${CANVAS_ORIGIN}/login`, target: '_blank', rel: 'noopener', 'data-key': 'login' }, 'Log in to Canvas')
      )
    );
  }
  if (state.netStatus.error && state.auth.state !== 'expired') {
    out.push(
      h(
        'div',
        { class: 'banner tone-amber' },
        icon('alert'),
        h('span', null, `Couldn’t refresh from Canvas (${state.netStatus.error}).${state.cache ? ' Showing your last saved data.' : ''}`),
        h('button', { class: 'btn btn-secondary btn-sm', 'data-key': 'retry', onclick: manualRefresh }, 'Try again')
      )
    );
  }
  return out;
}

function toastView() {
  if (!ui.toast) return null;
  return h(
    'div',
    { class: 'toast', role: 'status' },
    h('span', null, ui.toast.text),
    ui.toast.undo ? h('button', { class: 'link-btn', onclick: () => (ui.toast.undo(), setUi({ toast: null })) }, 'Undo') : null
  );
}

// ---- Render loop with focus/scroll preservation ----

const root = document.getElementById('app');

function snapshotFocus() {
  const el = document.activeElement;
  const key = el?.closest?.('[data-key]')?.getAttribute('data-key');
  const scrolls = {};
  document.querySelectorAll('[data-scroll]').forEach((n) => (scrolls[n.dataset.scroll] = { top: n.scrollTop, left: n.scrollLeft }));
  return {
    key,
    isField: el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'),
    value: el?.value,
    start: el?.selectionStart,
    end: el?.selectionEnd,
    scrolls,
  };
}

function restoreFocus(f) {
  for (const [k, pos] of Object.entries(f.scrolls)) {
    const n = document.querySelector(`[data-scroll="${k}"]`);
    if (n && pos) {
      n.scrollTop = pos.top;
      n.scrollLeft = pos.left;
    }
  }
  if (!f.key) return;
  const el = root.querySelector(`[data-key="${CSS.escape(f.key)}"]`);
  if (!el) return;
  if (f.isField && el.value !== f.value && el.type !== 'file') el.value = f.value; // keep unsaved typing
  el.focus({ preventScroll: true });
  if (f.isField && f.start != null) {
    try {
      el.setSelectionRange(f.start, f.end);
    } catch {
      /* some input types don't support selection */
    }
  }
}

let lastDrawerKey = null;

function render() {
  if (!state.loaded) return;
  const focus = snapshotFocus();
  // K1: nothing else until your school's Canvas is chosen and allowed.
  if (needsSetup()) {
    root.replaceChildren(renderSetup(render), toastView() || '');
    restoreFocus(focus);
    return;
  }
  const ctx = buildCtx();
  const current = route();
  const r = parseRoute();
  const page =
    r.page === 'settings'
      ? renderSettings(ctx)
      : r.page === 'course'
        ? renderCourse(ctx, r.courseId, r.tab)
        : r.page === 'announcements'
          ? renderAnnouncements(ctx)
          : r.page === 'inbox'
            ? renderInbox(ctx)
            : r.page === 'pinned'
              ? renderPinned(ctx)
              : r.page === 'completed'
                ? renderCompleted(ctx)
            : PAGES.find((p) => p.id === r.page).render(ctx);
  const menuItem = ui.menu ? ctx.allItems.find((i) => i.id === ui.menu.itemId) : null;

  const drawerKey = ui.drawer ? `${ui.drawer.type}:${ui.drawer.id}` : null;
  if (drawerKey !== lastDrawerKey) focus.scrolls.drawer = { top: 0, left: 0 };

  document.documentElement.dataset.density = state.settings.density;
  root.replaceChildren(
    topBar(ctx, current),
    h('main', { class: 'main' }, banners(current), page),
    renderDrawer(ctx) || '',
    itemMenu(menuItem) || '',
    toastView() || '',
    isDemo()
      ? h('div', { class: 'demo-banner', role: 'status' }, h('strong', null, 'Demo — sample data'), h('span', null, 'A made-up student. Nothing here is real, and nothing is sent anywhere.'), button('Exit demo', exitDemo, { key: 'exit-demo', kind: 'secondary' })) // K16
      : isDev
        ? h('div', { class: 'dev-badge', title: 'Running with sample data, not your real Canvas' }, 'Test mode · sample data')
        : ''
  );
  restoreFocus(focus);
  watchDay(ctx); // J6
  if (current === 'home') balanceHome();
  if (!performance.getEntriesByName('first-render').length) performance.mark('first-render'); // A2 timing
  // C7: the quarter timeline opens scrolled to this week (after that, your scroll is kept).
  const tl = root.querySelector('.timeline-scroll[data-today-x]');
  if (tl && !focus.scrolls.timeline) tl.scrollLeft = Number(tl.dataset.todayX);
  // G1/G9: the hour grid opens at your first thing of the day (8 AM at the latest).
  root.querySelectorAll('.tg-body[data-start-y]').forEach((n) => {
    if (!focus.scrolls[n.dataset.scroll]) n.scrollTop = Number(n.dataset.startY);
  });
  if (drawerKey && drawerKey !== lastDrawerKey) {
    const target = root.querySelector('.drawer [autofocus]') || root.querySelector('.drawer');
    target?.focus?.({ preventScroll: true });
  }
  lastDrawerKey = drawerKey;
}

// ---- Theme (B5) ----

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  document.documentElement.dataset.palette = state.settings.palette || 'pink'; // J1
  document.documentElement.toggleAttribute('data-rounded', feat('roundedType')); // J2
}

// ---- Keyboard shortcuts (B9) ----

function focusedItemId() {
  return document.activeElement?.closest?.('[data-row]')?.getAttribute('data-row');
}

function moveFocus(dir) {
  const scope = root.querySelector('.drawer') || root.querySelector('main');
  const rows = [...scope.querySelectorAll('[data-row]')];
  if (!rows.length) return;
  const idx = rows.indexOf(document.activeElement?.closest('[data-row]'));
  const next = rows[Math.max(0, Math.min(rows.length - 1, idx < 0 ? 0 : idx + dir))];
  next.focus();
  next.scrollIntoView({ block: 'nearest' });
}

function onKey(e) {
  if (e.key === 'Escape') {
    if (ui.menu) return setUi({ menu: null });
    if (ui.drawer) return closeDrawer();
    return;
  }
  if (!feat('shortcuts')) return;
  const t = e.target;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  const k = e.key;
  const pages = { 1: 'home', 2: 'courses', 3: 'grades', 4: 'calendar', ...(feat('otherTab') ? { 5: 'other' } : {}) };
  if (pages[k]) location.hash = `#/${pages[k]}`;
  else if (k === ',') location.hash = '#/settings';
  else if (k === '/' && feat('search')) {
    e.preventDefault();
    document.getElementById('search')?.focus();
  } else if (k === 'j') moveFocus(1);
  else if (k === 'k') moveFocus(-1);
  else if (k === 'r') manualRefresh();
  else if (k === '?') openDrawer('help');
  else if (k === 'n' && feat('checklist')) openDrawer('todo-new');
  else if (k === 'w' && feat('whatIf')) toggleWhatIf();
  else if (k === 'a' && feat('announcementsFeed')) location.hash = '#/announcements';
  else if (k === 'f' && feat('focus')) {
    if (focusState()) stopFocus();
    else {
      const id = focusedItemId();
      const item = id && buildCtx().allItems.find((i) => i.id === id);
      if (!item) return;
      startFocus(item);
    }
  } else if ((k === '[' || k === ']' || k === 't') && route() === 'calendar') {
    const nav = root.querySelector(`[data-key="${k === '[' ? 'cal-prev' : k === ']' ? 'cal-next' : 'cal-today'}"]`);
    if (!nav) return;
    nav.click();
  }
  else if (k === 'i' && feat('inbox')) location.hash = '#/inbox';
  else if (k === 'm' && feat('askMochi')) openDrawer('mochi'); // J4
  else if (k === 'x' || k === 'p') {
    const id = focusedItemId();
    const item = id && buildCtx().allItems.find((i) => i.id === id);
    if (!item) return;
    if (k === 'x' && feat('checklist')) toggleDone(item);
    if (k === 'p' && feat('pins')) togglePin(item);
  } else return;
  e.preventDefault();
}

// ---- Start ----

// F1–F7: Canvas links inside pages, announcements and instructions open in the dashboard.
function onContentClick(e) {
  const a = e.target.closest?.('.prose a[href]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const r = routeCanvasLink(a.getAttribute('href'));
  if (!r) return;
  if (r.type === 'page') openDrawer('page', `${r.courseId}|${r.url}`);
  else if (r.type === 'discussion') {
    const ann = (state.cache?.announcements || []).find((x) => x.canvasId === r.id);
    if (ann) openDrawer('announcement', ann.id);
    else openDrawer('discussion', `${r.courseId}|${r.id}`);
  } else if (r.type === 'assignment') {
    const item = (state.cache?.items || []).find((i) => i.canvasId === r.id && i.kind === 'assignment');
    if (!item) return; // not one of yours: let Canvas open it
    openDrawer('item', item.id);
  } else if (r.type === 'tab') {
    ui.drawer = null;
    location.hash = `#/course/${r.courseId}/${r.tab}`;
  } else return; // files: the link already downloads
  e.preventDefault();
}

async function start() {
  await init();
  await initReadState();
  await initFocus();
  installTooltips();
  addEventListener('resize', () => route() === 'home' && balanceHome());
  handleOpenLink();
  document.addEventListener('click', onContentClick, true); // capture: drawers stop bubbling
  applyTheme();
  subscribe(() => {
    applyTheme();
    render();
  });
  window.addEventListener('hashchange', () => {
    if (handleOpenLink()) return render();
    ui.drawer = null;
    ui.menu = null;
    render();
    window.scrollTo(0, 0);
  });
  window.addEventListener('keydown', onKey);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
  setInterval(render, 60 * 1000); // C3: countdowns tick every minute
  render();
  // A6: refresh on open when data is stale, or when the last attempt failed (A5, A8).
  const lastFailed = state.auth.state === 'expired' || state.netStatus.offline || state.netStatus.error;
  if (lastFailed) requestSync(true);
  else if (!state.cache?.fetchedAt || Date.now() - state.cache.fetchedAt > STALE_MS) requestSync(false);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // A5: coming back after logging in to Canvas clears the banner right away.
    if (state.auth.state === 'expired') requestSync(true);
    else if (state.cache?.fetchedAt && Date.now() - state.cache.fetchedAt > STALE_MS) requestSync(false);
  });
}

start();
