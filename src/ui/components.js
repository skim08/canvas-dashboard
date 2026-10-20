// Shared UI pieces. Lists show one line per item; details live in the drawer (B3).

import { FEATURES } from '../lib/defaults.js';
import { canWrite } from '../build.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { state } from './store.js';
import { ui, setUi, openDrawer, toggleDone, togglePin, hideItem, snoozeItem, snoozeChoices, togglePromoted } from './actions.js';
import { TYPE_LABEL, lateAcceptance } from '../lib/model.js';
import { formatDue, formatDuePlain, urgency, formatDate, formatWeekday, dayKey, dayDiff } from '../lib/time.js';
import { popCheck, isPopping } from './celebrate.js';

// K15: features that change Canvas don't exist in the public (read-only) build.
const WRITE_FEATURES = new Set(FEATURES.filter((f) => f.writes).map((f) => f.id));
export const feat = (id) => !(WRITE_FEATURES.has(id) && !canWrite()) && state.settings.features[id] !== false;

export function dot(color, label) {
  return h('span', { class: 'dot', style: { background: color || 'var(--text-faint)' }, title: label || null });
}

export function tag(text, tone = 'neutral') {
  return h('span', { class: `tag tag-${tone}` }, text);
}

export function iconButton(name, label, onclick, extra = {}) {
  return h('button', { class: ['icon-btn', extra.class], title: label, 'aria-label': label, onclick, 'data-key': extra.key }, icon(name, extra.size || 16));
}

export function button(text, onclick, { kind = 'secondary', iconName, key, disabled, type = 'button' } = {}) {
  return h('button', { class: `btn btn-${kind}`, onclick, 'data-key': key, disabled, type }, iconName ? icon(iconName) : null, text);
}

// Placeholder before the first successful load: never "Loading…" forever.
export function loadingText(text = 'Loading…') {
  if (state.auth.state === 'expired') return 'Log in to Canvas to load your courses.';
  if (state.netStatus.offline) return 'You’re offline. Your courses will load when you reconnect.';
  if (state.netStatus.error) return 'Couldn’t load from Canvas yet. See the message above, then press refresh.';
  return text;
}

export function emptyState(text) {
  return h('p', { class: 'empty' }, text);
}

export function sectionHeader(title, ...right) {
  return h('div', { class: 'section-head' }, h('h2', null, title), h('div', { class: 'section-tools' }, ...right));
}

// Status tags for an item (D1, D3). "Not submitted" is the default and shows nothing.
export function statusTags(item) {
  const out = [];
  if (item.sub?.missing && !item.done) out.push(tag('Missing', 'red'));
  if (item.sub?.late) out.push(tag('Late', 'amber'));
  if (item.status === 'submitted') out.push(tag('Submitted', 'green'));
  if (item.status === 'graded') out.push(tag('Graded', 'green'));
  if (item.status === 'excused') out.push(tag('Excused', 'neutral'));
  return out;
}

// C14: events (and in-person exams and quizzes) start; assignments are due.
export function startsRather(item) {
  return item.kind === 'event' || ((item.type === 'exam' || item.type === 'quiz') && item.kind === 'assignment' && !item.expectsSubmission);
}

export function dueText(item, now, tz) {
  const verb = startsRather(item) ? 'starts' : 'due';
  if (!item.dueAt) return verb === 'due' ? 'No due date' : 'No time set';
  // G10: a date with no time ("starts Wed", not a made-up time).
  if (item.allDay) {
    const d = dayDiff(dayKey(now, tz), item.day);
    if (d < 0) return `was ${formatDate(item.dueAt, tz)}`;
    return `${verb} ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : d < 7 ? formatWeekday(item.dueAt, tz) : formatDate(item.dueAt, tz)}`;
  }
  // Past and not overdue (done, graded, or nothing was expected): no "overdue" wording.
  if (new Date(item.dueAt).getTime() < now && !item.overdue) return `${verb === 'due' ? 'was due' : 'was'} ${formatDate(item.dueAt, tz)}`;
  return feat('countdowns') ? formatDue(item.dueAt, now, tz, verb) : formatDuePlain(item.dueAt, tz);
}

export function dueTone(item, now) {
  if (item.overdue) return 'red';
  if (item.done) return 'faint';
  return urgency(item.dueAt, now) === 'soon' ? 'amber' : 'muted';
}

function checkbox(item) {
  return h(
    'button',
    {
      class: ['check', item.done && 'is-done', item.done && isPopping(item.id) && 'is-popping'],
      role: 'checkbox',
      'aria-checked': item.done ? 'true' : 'false',
      'aria-label': item.done ? `Mark “${item.title}” not done` : `Mark “${item.title}” done`,
      onclick: (e) => {
        e.stopPropagation();
        // J6: the box fills and pops first, then the item moves to Done.
        if (!item.done && popCheck(item.id, e.currentTarget)) setTimeout(() => toggleDone(item), 320);
        else toggleDone(item);
      },
    },
    icon('check', 14)
  );
}

// One row per item (B3). Compact = single line, comfortable = small card (B6).
export function itemRow(item, { now, tz, showCourse = true, showLate = false, plain = false, action = null, noCheck = false } = {}) {
  const subs = state.userdata.subtasks[item.id] || [];
  const hasNote = feat('notes') && !!state.userdata.notes[item.id];
  const late = showLate && item.overdue ? lateAcceptance(item, now) : null;

  const meta = h(
    'span',
    { class: 'row-meta' },
    showCourse && item.courseId ? h('span', { class: 'course' }, dot(item.color), item.nick) : null,
    showCourse && !item.courseId && item.kind === 'todo' ? h('span', { class: 'course' }, dot(null), 'Personal') : null,
    feat('typeLabels') ? h('span', { class: 'type' }, TYPE_LABEL[item.type]) : null,
    ...statusTags(item),
    item.plannedToday ? tag('Planned today', 'accent') : null, // G6
    late ? h('span', { class: late.closed ? 'late-closed' : 'late-open' }, late.closed ? 'Closed' : late.until ? `Accepting until ${formatDate(late.until, tz)}` : 'Still accepting') : null
  );

  const extras = h(
    'span',
    { class: 'row-extras' },
    feat('pins') && item.pinned ? h('span', { class: 'mini', title: 'Pinned' }, icon('pin', 14)) : null,
    item.promoted ? h('span', { class: 'mini', title: 'Added to Home from Other' }, icon('home', 14)) : null,
    hasNote ? h('span', { class: 'mini', title: 'Has notes' }, icon('note', 14)) : null,
    feat('subtasks') && subs.length ? h('span', { class: 'mini count', title: 'Subtasks' }, `${subs.filter((s) => s.done).length}/${subs.length}`) : null
  );

  return h(
    'div',
    {
      class: ['row', item.done && !plain && 'is-done', item.overdue && 'is-overdue'],
      'data-row': item.id,
      'data-key': `row:${item.id}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${item.title}, ${dueText(item, now, tz)}`,
      onclick: () => openDrawer('item', item.id),
      onkeydown: (e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) openDrawer('item', item.id);
      },
    },
    feat('checklist') && !noCheck ? checkbox(item) : null,
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, item.title), meta),
    extras,
    h('span', { class: `row-due tone-${dueTone(item, now)}` }, dueText(item, now, tz)),
    action,
    iconButton(
      'more',
      'More actions',
      (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        setUi({ menu: { itemId: item.id, x: r.right, y: r.bottom, mode: 'main' } });
      },
      { class: 'row-more', key: `more:${item.id}` }
    )
  );
}

// A titled group of rows, capped at 7 with "Show all" (design principle 4).
export function group(key, label, items, ctx, { collapsed = false, tone, showLate = false, limit = 7, showCount = true } = {}) {
  if (!items.length) return null;
  const expanded = ui.expanded[key];
  const open = collapsed ? !!expanded : true;
  const shown = open ? (collapsed || expanded ? items : items.slice(0, limit)) : [];
  return h(
    'div',
    { class: 'group' },
    h(
      'button',
      {
        class: ['group-head', tone && `tone-${tone}`],
        'data-key': `group:${key}`,
        onclick: collapsed ? () => setUi({ expanded: { ...ui.expanded, [key]: !expanded } }) : null,
        tabindex: collapsed ? '0' : '-1',
        'aria-expanded': collapsed ? String(open) : null,
      },
      collapsed ? icon(open ? 'chevronDown' : 'chevron', 14) : null,
      h('span', null, label),
      showCount ? h('span', { class: 'count' }, String(items.length)) : null
    ),
    shown.length ? h('div', { class: 'rows' }, shown.map((i) => itemRow(i, { ...ctx, showLate }))) : null,
    !collapsed && items.length > limit
      ? h(
          'button',
          { class: 'show-all', 'data-key': `showall:${key}`, onclick: () => setUi({ expanded: { ...ui.expanded, [key]: !expanded } }) },
          expanded ? 'Show less' : `Show all ${items.length}`
        )
      : null
  );
}

// C13/C15: one button to bring an item onto your main views, or take it off.
export function promoteButton(item, { add = 'Add to Home', added = 'On Home', title = 'Show this on Home with your classes' } = {}) {
  return h(
    'button',
    {
      class: ['btn', 'btn-sm', 'btn-secondary', item.promoted && 'is-on'],
      'data-key': `promote:${item.id}`,
      title: item.promoted ? 'Remove it again' : title,
      onclick: (e) => {
        e.stopPropagation();
        togglePromoted(item);
      },
    },
    icon(item.promoted ? 'check' : 'homePlus', 14),
    item.promoted ? added : add
  );
}

// D4
export function progressBar({ done, total }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  return h(
    'div',
    { class: 'progress', title: `${done} of ${total} done this week` },
    h('span', { class: 'progress-label' }, `${done} of ${total} done this week`),
    h('span', { class: 'progress-track', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('span', { class: 'progress-fill', style: { width: `${pct}%` } }))
  );
}

// C4: course filter chips + sort menu.
export function filterBar(courses, settings, update, { sort = true } = {}) {
  if (!feat('filters')) return null;
  const active = new Set(settings.filterCourses);
  return h(
    'div',
    { class: 'filter-bar' },
    h(
      'div',
      { class: 'chips', role: 'group', 'aria-label': 'Filter by course' },
      h('button', { class: ['chip', !active.size && 'is-on'], 'data-key': 'chip:all', onclick: () => update((s) => ((s.filterCourses = []), s)) }, 'All'),
      courses.map((c) =>
        h(
          'button',
          {
            class: ['chip', active.has(c.id) && 'is-on'],
            'data-key': `chip:${c.id}`,
            'aria-pressed': String(active.has(c.id)),
            onclick: () =>
              update((s) => {
                const set = new Set(s.filterCourses);
                set.has(c.id) ? set.delete(c.id) : set.add(c.id);
                s.filterCourses = [...set];
                return s;
              }),
          },
          dot(c.color),
          c.nick
        )
      )
    ),
    !sort
      ? null
      : h(
      'label',
      { class: 'sort' },
      h('span', null, 'Sort'),
      h(
        'select',
        { 'data-key': 'sort', onchange: (e) => update((s) => ((s.sort = e.target.value), s)) },
        [
          ['due', 'Due date'],
          ['course', 'Course'],
          ['points', 'Points'],
          ['type', 'Type'],
        ].map(([v, l]) => h('option', { value: v, selected: settings.sort === v }, l))
      )
    )
  );
}

// Row "more" menu: pin, hide, snooze (C10, C11).
export function itemMenu(item) {
  if (!ui.menu || !item) return null;
  const close = () => setUi({ menu: null });
  const { x, y, mode } = ui.menu;
  const style = { top: `${Math.min(y + 4, window.innerHeight - 260)}px`, left: `${Math.max(8, x - 220)}px` };
  const entries = [];
  if (mode === 'main') {
    entries.push(menuItem('external', 'Open details', () => (close(), openDrawer('item', item.id))));
    if (feat('pins')) entries.push(menuItem('pin', item.pinned ? 'Unpin' : 'Pin to top', () => (close(), togglePin(item))));
    if (feat('hideSnooze')) {
      entries.push(menuItem('clock', 'Snooze…', () => setUi({ menu: { ...ui.menu, mode: 'snooze' } })));
      entries.push(menuItem('eyeOff', 'Hide', () => (close(), hideItem(item))));
    }
  } else {
    for (const c of snoozeChoices()) entries.push(menuItem('clock', c.label, () => (close(), snoozeItem(item, c.until)), c.sub));
    entries.push(
      h(
        'label',
        { class: 'menu-date' },
        h('span', null, 'Pick a date'),
        h('input', {
          type: 'date',
          'data-key': 'snooze-date',
          onchange: (e) => {
            if (!e.target.value) return;
            const d = new Date(`${e.target.value}T09:00`);
            close();
            snoozeItem(item, d);
          },
        })
      )
    );
  }
  return h('div', { class: 'menu-layer', onclick: close }, h('div', { class: 'menu', style, role: 'menu', onclick: (e) => e.stopPropagation() }, entries));
}

function menuItem(iconName, label, onclick, sub) {
  return h('button', { class: 'menu-item', role: 'menuitem', onclick, 'data-key': `menu:${label}` }, icon(iconName), h('span', null, label), sub ? h('span', { class: 'menu-sub' }, sub) : null);
}

export function segmented(options, value, onchange, key) {
  return h(
    'div',
    { class: 'segmented', role: 'radiogroup' },
    options.map(([v, l]) =>
      h('button', { class: ['seg', value === v && 'is-on'], role: 'radio', 'aria-checked': String(value === v), 'data-key': `${key}:${v}`, onclick: () => onchange(v) }, l)
    )
  );
}

export function toggle(checked, onchange, label, key) {
  return h(
    'button',
    { class: ['switch', checked && 'is-on'], role: 'switch', 'aria-checked': String(checked), 'aria-label': label, 'data-key': key, onclick: () => onchange(!checked) },
    h('span', { class: 'knob' })
  );
}
