// Calendar (Phase 4): Day (G9), Week (G1), Month (G2), Quarter (C7) and List.
// Week view is where planning happens: drag work onto the day you'll do it (G6),
// with each day's total hours (G4).

import { h } from '../dom.js';
import { syllabusCalendarBanner } from '../syllabusDrawer.js';
import { Term } from '../term.js';
import { state, updateSettings } from '../store.js';
import { ui, setUi, openDrawer } from '../actions.js';
import { emptyState, loadingText, sectionHeader, filterBar, itemRow, feat, segmented, dot, iconButton, startsRather, button } from '../components.js';
import { dayGroups, applyFilter, listable } from '../../lib/model.js';
import { formatDayHeading, dayKey, formatKeyRange, addDays, dayDiff, formatTime, formatDate } from '../../lib/time.js';
import { weekKeys, monthKeys, itemsOnDay, workloadByDay, quarterWeeks, workItems, estimateOf, plansFor, formatMinutes, plannableAhead } from '../../lib/planning.js';
import { addPlan, updatePlan, deletePlan } from '../planActions.js';
import { mochiEmpty } from '../mochi.js';

const VIEWS = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['quarter', 'Term', 'timeline'], // K4: labeled Quarter or Semester when shown
  ['list', 'List'],
];

const keyLabel = (key, opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(`${key}T12:00:00Z`));

export function renderCalendar(ctx) {
  const s = state.settings;
  const views = VIEWS.filter(([, , f]) => !f || feat(f)).map(([v, label, f]) => [v, v === 'quarter' ? Term() : label, f]);
  const view = views.some(([v]) => v === s.calendarView) ? s.calendarView : 'week';
  const today = dayKey(ctx.now, ctx.tz);
  const anchor = ui.calAnchor || today;
  const filtered = applyFilter(ctx.items, s.filterCourses);
  // G11: class meetings (Day and Week only).
  const classes = feat('classSchedule') ? applyFilter(ctx.allItems.filter((i) => i.area === 'classes'), s.filterCourses) : [];
  const c = { ...ctx, items: filtered, classes, today, anchor };
  const step = { day: 1, week: 7, month: 0 }[view];
  const move = (dir) => {
    if (view === 'month') {
      const [y, m] = anchor.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      setUi({ calAnchor: d.toISOString().slice(0, 10) });
    } else setUi({ calAnchor: addDays(anchor, dir * step) });
  };
  const title =
    view === 'day' ? formatDayHeading(anchor, today)
    : view === 'week' ? formatKeyRange(weekKeys(anchor)[0], weekKeys(anchor)[6])
    : view === 'month' ? keyLabel(anchor, { month: 'long', year: 'numeric' })
    : null;

  return h(
    'div',
    { class: ['page', (view === 'week' || view === 'quarter' || view === 'month') && 'page-wide'] },
    h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'Calendar'), segmented(views.map(([v, l]) => [v, l]), view, (v) => updateSettings({ calendarView: v }), 'cview')),
    feat('classSchedule') ? syllabusCalendarBanner(ctx) : null, // K23
    title
      ? h(
          'div',
          { class: 'cal-nav' },
          iconButton('back', 'Previous', () => move(-1), { key: 'cal-prev' }),
          h('button', { class: 'btn btn-secondary btn-sm', 'data-key': 'cal-today', onclick: () => setUi({ calAnchor: today }) }, 'Today'),
          iconButton('chevron', 'Next', () => move(1), { key: 'cal-next' }),
          h('h2', { class: 'cal-title' }, title),
          // G12: new events start from the row you're looking at, on the right.
          feat('customEvents') ? h('span', { class: 'cal-nav-end' }, button('New event', () => openDrawer('event', `new|${anchor}|`), { key: 'cal-new-event', iconName: 'plus' })) : null
        )
      : feat('customEvents')
        ? h('div', { class: 'cal-nav' }, h('span', { class: 'cal-nav-end' }, button('New event', () => openDrawer('event', `new|${anchor}|`), { key: 'cal-new-event', iconName: 'plus' })))
        : null,
    filterBar(ctx.courses, s, updateSettings, { sort: view === 'list' }),
    !state.cache
      ? emptyState(loadingText())
      : view === 'day'
        ? dayView(c)
        : view === 'week'
          ? weekView(c)
          : view === 'month'
            ? monthView(c)
            : view === 'quarter'
              ? quarterView(c)
              : listView(c)
  );
}

// ---------- shared pieces ----------

const planned = () => state.userdata.plans || [];
const itemById = (ctx, id) => ctx.allItems.find((i) => i.id === id);

function dragData(e, data) {
  e.dataTransfer.setData('text/plain', JSON.stringify(data));
  e.dataTransfer.effectAllowed = 'move';
}

function card(i, ctx, { showTime = true, draggable = true, showDue = false } = {}) {
  const est = feat('estimates') ? estimateOf(i, state.userdata) : null;
  const canPlan = feat('planning') && draggable && !i.done && i.kind !== 'event';
  return h(
    'button',
    {
      class: ['cal-card', `k-${kindOf(i)}`, i.done && 'is-done', i.overdue && 'is-overdue', i.cancelled && 'is-cancelled'],
      style: { '--ev': i.color || 'var(--text-faint)' },
      draggable: canPlan ? 'true' : null,
      ondragstart: canPlan ? (e) => dragData(e, { kind: 'item', id: i.id }) : null,
      'data-key': `cc:${i.id}`,
      'data-row': i.id,
      'data-tip': `${i.title}${canPlan ? '\nDrag onto the calendar to plan it' : ''}`,
      onclick: () => openDrawer('item', i.id),
    },
    h(
      'span',
      { class: 'cal-card-top' },
      i.courseId && !showDue ? dot(i.color) : null,
      showDue && i.dueAt ? h('span', { class: ['cal-time', i.overdue && 'tone-red'] }, `${i.overdue ? 'Overdue · ' : 'Due '}${formatDate(i.dueAt, ctx.tz, { weekday: 'short' })}`) : null,
      showTime && i.dueAt && !i.allDay ? h('span', { class: 'cal-time' }, formatTime(i.dueAt, ctx.tz)) : null,
      est ? h('span', { class: 'cal-est' }, `~${formatMinutes(est)}`) : null
    ),
    h('span', { class: 'cal-card-title' }, pill(i), i.title),
    showDue && i.dueAt ? daysLeft(i, ctx) : null
  );
}

// "Not planned yet": days left, colored by urgency (red ≤ 1 day or late, amber 2–3, yellow-green 4–6, green 7+).
function daysLeft(i, ctx) {
  const d = dayDiff(ctx.today, dayKey(i.dueAt, ctx.tz));
  const level = d <= 1 ? 'urgent' : d <= 3 ? 'soon' : d <= 6 ? 'week' : 'later';
  const text = d < 0 ? `${-d} day${d === -1 ? '' : 's'} late` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`;
  return h('span', { class: ['days-left', `is-${level}`], 'aria-label': d < 0 ? `${text}` : `${text} left` }, text);
}

function planCard(p, ctx) {
  const i = itemById(ctx, p.itemId);
  if (!i) return null;
  return h(
    'div',
    {
      class: 'cal-plan',
      draggable: 'true',
      ondragstart: (e) => dragData(e, { kind: 'plan', id: p.id }),
      'data-key': `pl:${p.id}`,
    },
    h('button', { class: 'cal-plan-main', onclick: () => openDrawer('item', i.id), title: 'Planned work session' }, h('span', { class: 'cal-card-top' }, i.courseId ? dot(i.color) : null, h('span', { class: 'cal-time' }, p.start ? fmtHM(p.start) : 'Planned'), h('span', { class: 'cal-est' }, formatMinutes(p.minutes))), h('span', { class: 'cal-card-title' }, i.title)),
    iconButton('x', 'Remove plan', (e) => (e.stopPropagation(), deletePlan(p.id)), { key: `pld:${p.id}`, class: 'cal-plan-x', size: 14 })
  );
}

function fmtHM(hm) {
  const [hh, mm] = hm.split(':').map(Number);
  return `${((hh + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${hh >= 12 ? 'PM' : 'AM'}`;
}

function workloadTag(minutes) {
  if (!feat('workload') || !minutes) return null;
  const over = minutes / 60 > state.settings.workloadLimit;
  return h('span', { class: ['cal-load', over && 'is-over'], title: over ? `Over your ${state.settings.workloadLimit}h limit` : 'Planned and due work' }, `${formatMinutes(minutes)}`);
}

// ---------- Hour grid: Week (G1, G4, G6) and Day (G9) ----------
// Apple-Calendar-style: a scrollable 24-hour grid where timed things are blocks and the
// gaps between them are your free time. Things with a date but no time sit in an
// all-day row on top; deadlines (no start time) are listed at the end of each day.

const SNAP = 15;

// What a calendar entry looks like: a class meeting, a quiz or exam, another event,
// or something due.
function kindOf(i) {
  if (i.classMeeting) return 'class';
  if (i.type === 'exam' || i.type === 'quiz') return 'test';
  if (i.kind === 'event') return 'event';
  return 'due';
}
const isTimed = (i) => !i.allDay && (i.kind === 'event' || startsRather(i));
const pill = (i) => (kindOf(i) === 'test' && !i.classMeeting ? h('span', { class: 'tg-pill' }, i.type === 'quiz' ? 'Quiz' : 'Exam') : null);

function minutesOf(iso, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(iso));
  return +parts.find((p) => p.type === 'hour').value * 60 + +parts.find((p) => p.type === 'minute').value;
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
// "3:30–4:50 PM", or "11 AM–12:15 PM" when it crosses noon.
function range(s, e) {
  const a = fmtHM(hhmm(s));
  const b = fmtHM(hhmm(Math.min(e, 1439)));
  return `${a.slice(-2) === b.slice(-2) ? a.slice(0, -3) : a}–${b}`;
}

// Everything on one day, split by where it goes.
function daySplit(ctx, key) {
  const all = [...itemsOnDay(ctx.items, key, ctx.tz).filter((i) => i.area !== 'officeHours'), ...itemsOnDay(ctx.classes, key, ctx.tz)];
  const plans = feat('planning') ? planned().filter((p) => p.day === key && itemById(ctx, p.itemId)) : [];
  return {
    timed: all.filter(isTimed),
    allDay: all.filter((i) => i.allDay),
    due: all.filter((i) => !i.allDay && !isTimed(i)),
    timedPlans: plans.filter((p) => p.start),
    anyTimePlans: plans.filter((p) => !p.start),
  };
}

// Overlapping blocks share the column side by side.
function lanes(blocks) {
  const sorted = [...blocks].sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [];
  let end = -1;
  const flush = () => {
    const ends = [];
    for (const b of cluster) {
      let lane = ends.findIndex((x) => x <= b.s);
      if (lane < 0) lane = ends.length;
      ends[lane] = b.e;
      b.lane = lane;
    }
    for (const b of cluster) b.n = ends.length;
    cluster = [];
  };
  for (const b of sorted) {
    if (b.s >= end) flush();
    cluster.push(b);
    end = Math.max(end, b.e);
  }
  flush();
  return sorted;
}

// How many lines of title fit in a block, and whether the time/place line fits too.
// Titles stop at a whole line with "…" instead of being cut mid-word.
const LINE_PX = 13; // matches .tg-btn line-height
function fit(b, hourPx) {
  const inner = Math.max(18, ((b.e - b.s) / 60) * hourPx - 2) - 8; // 4px padding top and bottom
  const total = Math.max(1, Math.floor(inner / LINE_PX));
  return total >= 3 ? { lines: total - 1, meta: true } : { lines: total, meta: false };
}

function itemBlock(i, ctx) {
  const s = minutesOf(i.dueAt, ctx.tz);
  const e = i.endAt ? Math.max(minutesOf(i.endAt, ctx.tz), s + SNAP) : s + 60;
  const k = kindOf(i);
  return {
    s,
    e,
    key: `tg:${i.id}`,
    cls: [`k-${k}`, i.cancelled && 'is-cancelled', i.done && 'is-done'],
    color: i.color,
    body: h(
      'button',
      { class: 'tg-btn', 'data-key': `tg:${i.id}`, 'data-row': i.id, 'data-tip': `${i.title}\n${range(s, e)}${i.location ? ` · ${i.location}` : ''}`, onclick: () => openDrawer('item', i.id) },
      h('span', { class: 'tg-title' }, pill(i), i.title),
      h('span', { class: 'tg-meta' }, `${range(s, e)}${i.location ? ` · ${i.location}` : ''}`)
    ),
  };
}

function planBlock(p, ctx) {
  const i = itemById(ctx, p.itemId);
  const [hh, mm] = p.start.split(':').map(Number);
  const s = hh * 60 + mm;
  const e = s + p.minutes;
  return {
    s,
    e,
    key: `tgp:${p.id}`,
    cls: ['k-plan'],
    color: i.color,
    drag: { kind: 'plan', id: p.id },
    body: [
      h(
        'button',
        { class: 'tg-btn', 'data-key': `tgp:${p.id}`, 'data-tip': `Planned: work on ${i.title}\n${range(s, e)} · drag to move`, onclick: () => openDrawer('item', i.id) },
        h('span', { class: 'tg-title' }, `Work on ${i.title}`),
        h('span', { class: 'tg-meta' }, `${range(s, e)} · ${formatMinutes(p.minutes)}`)
      ),
      iconButton('x', 'Remove plan', (e2) => (e2.stopPropagation(), deletePlan(p.id)), { key: `tgpx:${p.id}`, class: 'cal-plan-x', size: 14 }),
    ],
  };
}

function dropProps(day, { timed = false } = {}) {
  if (!feat('planning')) return {};
  return {
    'data-day': day,
    ondragover: (e) => {
      e.preventDefault();
      e.currentTarget.classList.add('is-over');
    },
    ondragleave: (e) => e.currentTarget.classList.remove('is-over'),
    ondrop: (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('is-over');
      let d;
      try {
        d = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch {
        return; // not ours
      }
      let start = null;
      if (timed) {
        const rect = e.currentTarget.getBoundingClientRect();
        const hourPx = rect.height / 24;
        const min = Math.round((((e.clientY - rect.top) / hourPx) * 60) / SNAP) * SNAP;
        start = hhmm(Math.max(0, Math.min(24 * 60 - SNAP, min)));
      }
      if (d.kind === 'item') addPlan(d.id, day, { start });
      else if (d.kind === 'plan') updatePlan(d.id, timed ? { day, start } : { day, start: null });
    },
  };
}

function timeGrid(ctx, days, { view, hourPx, load = {} }) {
  const split = Object.fromEntries(days.map((k) => [k, daySplit(ctx, k)]));
  const anyAllDay = days.some((k) => split[k].allDay.length || split[k].anyTimePlans.length);
  const anyDue = view === 'week' && days.some((k) => split[k].due.length);
  const nowMin = minutesOf(new Date(ctx.now).toISOString(), ctx.tz);
  const earliest = Math.min(...days.flatMap((k) => [...split[k].timed.map((i) => minutesOf(i.dueAt, ctx.tz)), ...split[k].timedPlans.map((p) => +p.start.slice(0, 2) * 60)]), 8 * 60);
  const startY = (Math.max(0, Math.min(earliest - 30, 8 * 60)) / 60) * hourPx;
  const cols = { '--cols': String(days.length), '--hour': `${hourPx}px` };
  const head = (k) =>
    h(
      'div',
      { class: ['tg-day-head', k === ctx.today && 'is-today', k < ctx.today && 'is-past'] },
      h('span', { class: 'tg-dow' }, keyLabel(k, { weekday: 'short' })),
      h('span', { class: 'tg-num' }, keyLabel(k, { day: 'numeric' })),
      workloadTag(load[k])
    );
  return h(
    'div',
    { class: ['tg', `tg-${view}`], style: cols },
    h(
      'div',
      { class: 'tg-x', 'data-scroll': `tg-x-${view}` },
      h(
        'div',
        { class: 'tg-inner' },
        view === 'week' ? h('div', { class: 'tg-row tg-heads' }, h('div', { class: 'tg-gutter' }), days.map(head)) : null,
        anyAllDay
          ? h(
              'div',
              { class: 'tg-row tg-allday' },
              h('div', { class: 'tg-gutter tg-label' }, 'all-day'),
              days.map((k) => h('div', { class: 'tg-cell', ...dropProps(k) }, split[k].allDay.map((i) => card(i, ctx, { showTime: false })), split[k].anyTimePlans.map((p) => planCard(p, ctx))))
            )
          : null,
        h(
          'div',
          { class: 'tg-body', 'data-scroll': `tg-y-${view}`, 'data-start-y': String(Math.round(startY)) },
          h(
            'div',
            { class: 'tg-grid' },
            h(
              'div',
              { class: 'tg-gutter tg-hours' },
              // Like Apple Calendar, an hour label near the current time makes room for it.
              Array.from({ length: 23 }, (_, n) => (days.includes(ctx.today) && Math.abs((n + 1) * 60 - nowMin) < 20 ? null : h('span', { class: 'tg-hour', style: { top: `${(n + 1) * hourPx}px` } }, fmtHM(`${n + 1}:00`)))),
              days.includes(ctx.today) ? h('span', { class: 'tg-now-label', style: { top: `${(nowMin / 60) * hourPx}px` } }, formatTime(new Date(ctx.now).toISOString(), ctx.tz)) : null
            ),
            days.map((k) =>
              h(
                'div',
                {
                  class: ['tg-col', k === ctx.today && 'is-today', k < ctx.today && 'is-past'],
                  ...dropProps(k, { timed: true }),
                  // G12: a click on an empty slot starts a new event there (on the half hour).
                  onclick: feat('customEvents')
                    ? (e) => {
                        if (e.target !== e.currentTarget) return;
                        const min = Math.max(0, Math.min(23 * 60 + 30, Math.floor(((e.clientY - e.currentTarget.getBoundingClientRect().top) / hourPx) * 2) * 30));
                        openDrawer('event', `new|${k}|${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
                      }
                    : null,
                  title: feat('customEvents') ? 'Click an empty spot to add an event' : null,
                },
                lanes([...split[k].timed.map((i) => itemBlock(i, ctx)), ...split[k].timedPlans.map((p) => planBlock(p, ctx))]).map((b) =>
                  h(
                    'div',
                    {
                      class: ['tg-block', ...b.cls, b.e - b.s < 40 && 'is-short', fit(b, hourPx).meta === false && 'no-meta'],
                      style: { top: `${(b.s / 60) * hourPx}px`, height: `${Math.max(18, ((b.e - b.s) / 60) * hourPx - 2)}px`, left: `calc(4px + ${b.lane} * (100% - 4px) / ${b.n})`, width: `calc((100% - 4px) / ${b.n} - 4px)`, '--ev': b.color || 'var(--text-faint)', '--lines': String(fit(b, hourPx).lines) },
                      draggable: b.drag ? 'true' : null,
                      ondragstart: b.drag ? (e) => dragData(e, b.drag) : null,
                    },
                    b.body
                  )
                ),
                k === ctx.today ? h('div', { class: 'tg-now', style: { top: `${(nowMin / 60) * hourPx}px` } }) : null
              )
            )
          )
        ),
        anyDue
          ? h(
              'div',
              { class: 'tg-row tg-due' },
              h('div', { class: 'tg-gutter tg-label' }, 'due'),
              days.map((k) => h('div', { class: 'tg-cell', ...dropProps(k) }, split[k].due.map((i) => card(i, ctx))))
            )
          : null
      )
    ),
    legend()
  );
}

function legend() {
  const sw = (k, label) => h('span', { class: 'tg-key' }, h('span', { class: `tg-swatch k-${k}` }), label);
  return h('div', { class: 'tg-legend' }, sw('class', 'Lecture or section'), sw('test', 'Quiz or exam'), sw('event', 'Event'), feat('planning') ? sw('plan', 'Planned work') : null, sw('due', 'Due'));
}

function weekView(ctx) {
  const days = weekKeys(ctx.anchor);
  const load = workloadByDay(ctx.items, state.userdata, ctx.tz);
  // Work you can do ahead, including online quizzes you take on your own time.
  const unplanned = feat('planning')
    ? workItems(ctx.items)
        .filter((i) => i.dueAt && plannableAhead(i) && !plansFor(state.userdata, i.id).length && dayDiff(ctx.today, dayKey(i.dueAt, ctx.tz)) <= 14)
        .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    : [];
  // One column per class, in your class order, soonest first; personal to-dos last.
  const order = ctx.courses.map((c) => c.id);
  const rank = (id) => (id == null ? 1e4 : order.includes(id) ? order.indexOf(id) : 1e3);
  const byClass = [...new Set(unplanned.map((i) => i.courseId || null))]
    .sort((a, b) => rank(a) - rank(b))
    .map((id) => ({ id, nick: id ? ctx.nickOf(id) : 'Personal', color: id ? ctx.colorOf(id) : null, items: unplanned.filter((i) => (i.courseId || null) === id) }));
  return [
    timeGrid(ctx, days, { view: 'week', hourPx: 44, load }),
    feat('planning')
      ? h(
          'section',
          { class: 'section' },
          sectionHeader('Not planned yet'),
          h('p', { class: 'caption caption-tight' }, unplanned.length ? 'Drag any of these onto a time in the week to plan when you’ll work on it, or onto the all-day row for any time that day.' : 'Everything due in the next two weeks has a plan.'),
          unplanned.length
            ? h(
                'div',
                { class: 'unplanned' },
                byClass.map((c) =>
                  h(
                    'section',
                    { class: 'unplanned-col' },
                    h('h3', { class: 'unplanned-head' }, dot(c.color), c.nick, h('span', { class: 'muted' }, String(c.items.length))),
                    c.items.map((i) => card(i, ctx, { showTime: false, showDue: true }))
                  )
                )
              )
            : null
        )
      : null,
  ];
}

function dayView(ctx) {
  const key = ctx.anchor;
  const { due } = daySplit(ctx, key);
  const load = workloadByDay(ctx.items, state.userdata, ctx.tz)[key];
  return h(
    'div',
    { class: 'day-view' },
    timeGrid(ctx, [key], { view: 'day', hourPx: 56 }),
    h('section', { class: 'section' }, sectionHeader('Due', workloadTag(load)), due.length ? h('div', { class: 'rows' }, due.map((i) => itemRow(i, { now: ctx.now, tz: ctx.tz }))) : mochiEmpty('Nothing due.', 'happy') || emptyState('Nothing due.'))
  );
}

// ---------- Month (G2) ----------

function monthView(ctx) {
  const keys = monthKeys(ctx.anchor);
  const month = ctx.anchor.slice(0, 7);
  const selected = ui.calSelected && ui.calSelected.slice(0, 7) === month ? ui.calSelected : null;
  const dayItems = (k) => itemsOnDay(ctx.items, k, ctx.tz).filter((i) => i.area !== 'officeHours');
  return [
    h('div', { class: 'month-head' }, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => h('span', null, d))),
    h(
      'div',
      { class: 'month' },
      keys.map((k) => {
        const list = dayItems(k);
        const plans = planned().filter((p) => p.day === k).length;
        const exams = list.filter((i) => i.type === 'exam').length;
        return h(
          'button',
          {
            class: ['month-day', k.slice(0, 7) !== month && 'is-other', k === ctx.today && 'is-today', selected === k && 'is-selected'],
            'data-key': `md:${k}`,
            'aria-label': `${keyLabel(k, { weekday: 'long', month: 'long', day: 'numeric' })}: ${list.length} items`,
            onclick: () => setUi({ calSelected: selected === k ? null : k }),
          },
          h('span', { class: 'month-num' }, keyLabel(k, { day: 'numeric' })),
          list.length ? h('span', { class: 'month-dots' }, list.slice(0, 4).map((i) => dot(i.color)), list.length > 4 ? h('span', { class: 'muted' }, `+${list.length - 4}`) : null) : null,
          list.length ? h('span', { class: 'month-count' }, `${list.length} item${list.length === 1 ? '' : 's'}${exams ? ` · ${exams} exam${exams === 1 ? '' : 's'}` : ''}`) : null,
          plans ? h('span', { class: 'month-plan' }, `${plans} planned`) : null
        );
      })
    ),
    selected
      ? h(
          'section',
          { class: 'section' },
          sectionHeader(formatDayHeading(selected, ctx.today), h('button', { class: 'link-btn', 'data-key': 'open-day', onclick: () => (setUi({ calAnchor: selected }), updateSettings({ calendarView: 'day' })) }, 'Open day')),
          dayItems(selected).length ? h('div', { class: 'rows' }, dayItems(selected).map((i) => itemRow(i, { now: ctx.now, tz: ctx.tz }))) : emptyState('Nothing on this day.')
        )
      : h('p', { class: 'caption' }, 'Click a day to see what’s on it.'),
  ];
}

// ---------- Quarter timeline (C7) ----------

const COL = 104;

function quarterView(ctx) {
  const { weeks, start, today } = quarterWeeks(ctx.courses, ctx.items, ctx.now, ctx.tz);
  const x = (key) => (dayDiff(start, key) / 7) * COL;
  const width = weeks.length * COL;
  const items = listable(ctx.items).filter((i) => i.dueAt && i.courseId && i.area === 'main');
  return [
    h(
      'div',
      { class: 'timeline-scroll', 'data-scroll': 'timeline', 'data-today-x': String(Math.max(0, x(today) - 2 * COL)) },
      h(
        'div',
        { class: 'timeline', style: { width: `${width + 120}px` } },
        h(
          'div',
          { class: 'tl-weeks', style: { width: `${width + 120}px` } },
          h('div', { class: 'tl-corner' }),
          weeks.map((w) => h('div', { class: 'tl-week', style: { width: `${COL}px` } }, keyLabel(w, { month: 'short', day: 'numeric' })))
        ),
        ctx.courses.map((c) =>
          h(
            'div',
            { class: 'tl-row' },
            h('div', { class: 'tl-label' }, dot(c.color), c.nick),
            h(
              'div',
              { class: 'tl-track', style: { width: `${width}px` } },
              items
                .filter((i) => i.courseId === c.id)
                .map((i) => {
                  const k = dayKey(i.dueAt, ctx.tz);
                  return h('button', {
                    class: ['tl-mark', i.type === 'exam' && 'is-exam', i.done && 'is-done', i.overdue && 'is-overdue'],
                    style: { left: `${x(k) + COL / 14}px`, background: i.type === 'exam' ? null : c.color, borderColor: c.color },
                    title: `${i.title} · ${formatDate(i.dueAt, ctx.tz)}`,
                    'aria-label': `${i.title}, ${formatDate(i.dueAt, ctx.tz)}`,
                    'data-key': `tl:${i.id}`,
                    onclick: () => openDrawer('item', i.id),
                  });
                })
            )
          )
        ),
        h('div', { class: 'tl-today', style: { left: `${120 + x(today) + COL / 14}px` }, title: 'Today' })
      )
    ),
    h('p', { class: 'caption' }, 'Diamonds are exams. Hover a mark to see what it is; click it for details.'),
  ];
}

// ---------- List (the Phase 1 agenda) ----------

function listView(ctx) {
  const { items, now, tz, today } = ctx;
  const days = ui.expanded['cal-more'] ? 150 : 45;
  const groups = dayGroups(items, { now, tz, days });
  if (!groups.length) return emptyState('Nothing on the calendar.');
  return h(
    'div',
    { class: 'agenda' },
    groups.map((g) => {
      return h(
        'div',
        { class: 'agenda-day' },
        h('div', { class: ['agenda-head', g.diff === 0 && 'is-today'] }, h('span', null, formatDayHeading(g.key, today))),
        h('div', { class: 'rows' }, g.items.map((i) => itemRow(i, { now, tz })))
      );
    }),
    h('button', { class: 'show-all', 'data-key': 'cal-more', onclick: () => setUi({ expanded: { ...ui.expanded, 'cal-more': !ui.expanded['cal-more'] } }) }, ui.expanded['cal-more'] ? 'Show less' : 'Show further ahead')
  );
}

