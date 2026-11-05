// G12: add or edit one of your own events. Opens from "+ Event" on the Calendar, a
// click on an empty time slot, the E key, or an event's details.

import { h } from './dom.js';
import { state, updateUser } from './store.js';
import { ui, closeDrawer, openDrawer, setUi, toast } from './actions.js';
import { button } from './components.js';
import { dayKey, weekdayOfKey } from '../lib/time.js';
import { occurrences } from '../lib/events.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TYPES = [
  ['event', 'Event'],
  ['reading', 'Reading'],
  ['assignment', 'Something to make (slides, a draft…)'],
  ['todo', 'Task'],
];
const uid = () => Math.random().toString(36).slice(2, 10);
// An hour later, but never past 11:59 PM (so a late start still has an end after it).
const plusHour = (t) => {
  const [hh, mm] = t.split(':').map(Number);
  return hh >= 23 ? '23:59' : `${String(hh + 1).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

let draft = null;
let draftFor = null;

function startDraft(id, ctx) {
  const existing = (state.userdata.events || []).find((e) => e.id === id);
  if (existing) return structuredClone({ ...existing, repeat: existing.repeat || null });
  const [, day, start] = String(id).split('|'); // "new|2026-11-09|14:00" from a click on the grid
  const s = start || '';
  return { id: uid(), title: '', courseId: null, day: day || ui_day(ctx), start: s, end: s ? plusHour(s) : '', repeat: null, note: '', type: 'event', skip: [] };
}
const ui_day = (ctx) => dayKey(ctx.now, ctx.tz);

function save(isNew) {
  const d = draft;
  if (!d.title.trim()) return toast('Give the event a name first.');
  if (!d.day) return toast('Pick a date.');
  if (d.start && d.end && d.end <= d.start) return toast('The end time is before the start time.');
  const clean = { ...d, title: d.title.trim(), start: d.start || null, end: d.start ? d.end || null : null, repeat: d.repeat?.days?.length ? { days: d.repeat.days, until: d.repeat.until || null } : null, note: d.note.trim() };
  updateUser((ud) => {
    ud.events = [...(ud.events || []).filter((e) => e.id !== clean.id), clean];
  });
  const n = occurrences(clean).length;
  toast(isNew ? (n > 1 ? `Added ${n} times to your calendar` : 'Added to your calendar') : 'Event saved');
  draft = null;
  closeDrawer();
}

function remove(id) {
  updateUser((ud) => {
    ud.events = (ud.events || []).filter((e) => e.id !== id);
  });
  draft = null;
  closeDrawer();
  toast('Event deleted');
}

// "Delete this one" on a repeating event: that day is skipped, the rest stay.
export function removeOccurrence(eventId, day) {
  updateUser((ud) => {
    ud.events = (ud.events || []).map((e) => (e.id === eventId ? { ...e, skip: [...(e.skip || []), day] } : e));
  });
  closeDrawer();
  toast('Removed from that day');
}

const redraw = () => setUi({});

// Turning on the first day makes the event weekly; turning off the last makes it one-time.
function toggleDay(d, x) {
  // Starting to repeat: the event's own date is one of its days too.
  const days = d.repeat?.days?.length ? d.repeat.days : d.day && weekdayOfKey(d.day) !== x ? [weekdayOfKey(d.day)] : [];
  const next = days.includes(x) ? days.filter((y) => y !== x) : DAYS.filter((y) => y === x || days.includes(y));
  d.repeat = next.length ? { days: next, until: d.repeat?.until || '' } : null;
  redraw();
}
const field = (label, control) => h('label', { class: 'form-field' }, h('span', null, label), control);

export function eventDrawer(id, ctx) {
  const isNew = String(id).startsWith('new');
  const key = `${id}#${ui.drawerSeq}`; // closing without saving throws the changes away
  if (draftFor !== key || !draft) {
    draft = startDraft(id, ctx);
    draftFor = key;
  }
  const d = draft;
  const repeating = !!d.repeat;
  return h(
    'form',
    {
      class: 'event-form',
      onsubmit: (e) => {
        e.preventDefault();
        save(isNew);
      },
    },
    h('header', { class: 'd-header' }, h('h2', { class: 'd-title' }, isNew ? 'New event' : 'Edit event'), h('p', { class: 'd-due' }, 'For things Canvas doesn’t list. Only on this computer.')),
    field('What', h('input', { class: 'text-input', value: d.title, placeholder: 'Pre-class reading: Ch. 5', 'data-key': 'ev-title', autofocus: isNew, oninput: (e) => (d.title = e.target.value) })),
    h(
      'div',
      { class: 'event-row' },
      field('Date', h('input', { class: 'text-input', type: 'date', value: d.day, 'data-key': 'ev-day', onchange: (e) => (d.day = e.target.value) })),
      field('Starts', h('input', { class: 'text-input', type: 'time', value: d.start || '', 'data-key': 'ev-start', onchange: (e) => ((d.start = e.target.value), d.start && !d.end && (d.end = plusHour(d.start)), redraw()) })),
      field('Ends', h('input', { class: 'text-input', type: 'time', value: d.end || '', disabled: !d.start, 'data-key': 'ev-end', onchange: (e) => (d.end = e.target.value) }))
    ),
    !d.start ? h('p', { class: 'caption caption-tight' }, 'No start time: it shows as an all-day item.') : null,
    h(
      'div',
      { class: 'event-row' },
      field(
        'Class (optional)',
        h('select', { 'data-key': 'ev-course', onchange: (e) => (d.courseId = e.target.value || null) }, h('option', { value: '', selected: !d.courseId }, 'None'), ctx.courses.map((c) => h('option', { value: c.id, selected: d.courseId === c.id }, c.nick)))
      ),
      field('Kind', h('select', { 'data-key': 'ev-type', onchange: (e) => (d.type = e.target.value) }, TYPES.map(([v, l]) => h('option', { value: v, selected: d.type === v }, l))))
    ),
    // Repeats every: pick days (none = just this once).
    h(
      'div',
      { class: 'form-field' },
      h('span', null, 'Repeats every'),
      h(
        'div',
        { class: 'syl-days event-days', role: 'group', 'aria-label': 'Repeats every' },
        DAYS.map((x) => {
          const on = !!d.repeat?.days?.includes(x);
          return h('button', { type: 'button', class: ['syl-day', on && 'is-on'], 'aria-pressed': String(on), title: on ? `Stop repeating on ${x}` : `Repeat every ${x}`, 'data-key': `ev-day:${x}`, onclick: () => toggleDay(d, x) }, x.slice(0, 2));
        })
      ),
      repeating
        ? h(
            'div',
            { class: 'event-repeat' },
            field('Until', h('input', { class: 'text-input', type: 'date', value: d.repeat.until || '', min: d.day, 'data-key': 'ev-until', onchange: (e) => (d.repeat.until = e.target.value) })),
            !d.repeat.until ? h('p', { class: 'caption caption-tight' }, 'No end date: it repeats for 16 weeks.') : null
          )
        : h('p', { class: 'caption caption-tight' }, 'Pick days to repeat it every week. Leave them all off for a one-time event.')
    ),
    field('Note (optional)', h('textarea', { class: 'text-input', rows: 3, value: d.note, 'data-key': 'ev-note', oninput: (e) => (d.note = e.target.value) })),
    h(
      'div',
      { class: 'd-actions' },
      button(isNew ? 'Add to calendar' : 'Save', null, { kind: 'primary', type: 'submit', key: 'ev-save' }),
      button('Cancel', () => ((draft = null), closeDrawer()), { key: 'ev-cancel', kind: 'ghost' }),
      !isNew ? button(repeating ? 'Delete every time' : 'Delete', () => remove(d.id), { key: 'ev-delete', kind: 'danger-ghost' }) : null
    )
  );
}

// In an event's details: edit it, or delete this day / the whole event.
export function ownEventActions(item) {
  return h(
    'div',
    { class: 'd-actions' },
    button(item.repeats ? 'Edit every time' : 'Edit', () => openDrawer('event', item.eventId), { key: 'ev-edit' }),
    item.repeats ? button('Delete this one', () => removeOccurrence(item.eventId, item.day), { key: 'ev-del-one', kind: 'ghost' }) : null,
    button(item.repeats ? 'Delete every time' : 'Delete', () => remove(item.eventId), { key: 'ev-del-all', kind: 'danger-ghost' })
  );
}
