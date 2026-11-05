// UI-only state (drawer, menus, expanded groups) and every action that
// changes the owner's personal data.

import { state, updateUser, notify } from './store.js';

export const ui = {
  drawer: null, // { type: 'item' | 'course' | 'todo-new' | 'hidden' | 'help', id }
  menu: null, // { itemId, x, y, mode }
  expanded: {}, // group/section key -> true
  attentionOpen: {},
  importPreview: null,
  confirmClear: false,
  toast: null,
};

export function setUi(patch) {
  Object.assign(ui, patch);
  notify();
}

export function openDrawer(type, id = null) {
  ui.drawer = { type, id };
  ui.drawerSeq = (ui.drawerSeq || 0) + 1; // forms start fresh each time they open (G12, G13)
  ui.menu = null;
  ui.snoozeOpen = false;
  notify();
}

export function closeDrawer() {
  ui.drawer = null;
  notify();
}

let toastTimer;
export function toast(text, undo) {
  ui.toast = { text, undo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setUi({ toast: null }), 5000);
  notify();
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// D2
export function toggleDone(item) {
  if (item.kind === 'todo') {
    return updateUser((ud) => {
      const t = ud.todos.find((x) => x.id === item.id);
      if (t) {
        t.done = !t.done;
        t.doneAt = t.done ? Date.now() : null; // D9
      }
    });
  }
  const next = !item.done;
  const canvasDone = ['submitted', 'graded', 'excused'].includes(item.status) || !!item.plannerDone;
  return updateUser((ud) => {
    if (next === canvasDone) delete ud.done[item.id];
    else ud.done[item.id] = next;
    ud.doneAt ||= {};
    if (next && !canvasDone) ud.doneAt[item.id] = Date.now(); // D9: when you checked it off
    else delete ud.doneAt[item.id];
  });
}

// C10
export function togglePin(item) {
  return updateUser((ud) => {
    if (ud.pins[item.id]) delete ud.pins[item.id];
    else ud.pins[item.id] = Date.now();
  });
}

// C11
export function hideItem(item) {
  updateUser((ud) => {
    ud.hidden[item.id] = Date.now();
  });
  toast(`Hidden “${item.title}”`, () => unhideItem(item.id));
}
export function unhideItem(id) {
  return updateUser((ud) => {
    delete ud.hidden[id];
    delete ud.snoozed[id];
  });
}
export function snoozeItem(item, until) {
  updateUser((ud) => {
    ud.snoozed[item.id] = new Date(until).toISOString();
  });
  toast(`Snoozed “${item.title}”`, () => unhideItem(item.id));
}

export function snoozeChoices(now = new Date()) {
  const later = new Date(now.getTime() + 3 * 3600000);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextWeek.setHours(9, 0, 0, 0);
  return [
    { label: 'Later today', sub: '3 hours', until: later },
    { label: 'Tomorrow', sub: '9:00 AM', until: tomorrow },
    { label: 'Next week', sub: 'Mon 9:00 AM', until: nextWeek },
  ];
}

// C13: bring an item from the Other page onto Home, or send it back.
export function togglePromoted(item) {
  const adding = !item.promoted;
  updateUser((ud) => {
    ud.promoted ||= {};
    if (adding) ud.promoted[item.id] = Date.now();
    else delete ud.promoted[item.id];
  });
  const where = item.officeHours ? 'your calendar and to-dos' : 'Home';
  toast(adding ? `Added “${item.title}” to ${where}` : `Removed “${item.title}” from ${where}`, () => togglePromoted({ ...item, promoted: adding }));
}

// C5
export function setType(item, type) {
  return updateUser((ud) => {
    if (item.kind === 'todo') {
      const t = ud.todos.find((x) => x.id === item.id);
      if (t) t.type = type;
    } else if (!type) delete ud.types[item.id];
    else ud.types[item.id] = type;
  });
}

// D2: own to-dos
export async function addTodo({ title, courseId, dueAt, type }) {
  const id = `t:${uid()}`;
  await updateUser((ud) => {
    ud.todos.push({ id, title: title.trim(), courseId: courseId || null, dueAt: dueAt || null, type: type || 'todo', done: false, createdAt: Date.now() });
  });
  return id;
}
export function updateTodo(id, patch) {
  return updateUser((ud) => {
    const t = ud.todos.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  });
}
export function deleteTodo(id) {
  const t = state.userdata.todos.find((x) => x.id === id);
  updateUser((ud) => {
    ud.todos = ud.todos.filter((x) => x.id !== id);
    delete ud.notes[id];
    delete ud.subtasks[id];
    delete ud.pins[id];
  });
  if (t) toast(`Deleted “${t.title}”`, () => updateUser((ud) => ud.todos.push(t)));
}

// D5
export function addSubtask(itemId, text) {
  if (!text.trim()) return;
  return updateUser((ud) => {
    (ud.subtasks[itemId] ||= []).push({ id: uid(), text: text.trim(), done: false });
  });
}
export function toggleSubtask(itemId, subId) {
  return updateUser((ud) => {
    const s = (ud.subtasks[itemId] || []).find((x) => x.id === subId);
    if (s) s.done = !s.done;
  });
}
export function deleteSubtask(itemId, subId) {
  return updateUser((ud) => {
    ud.subtasks[itemId] = (ud.subtasks[itemId] || []).filter((x) => x.id !== subId);
    if (!ud.subtasks[itemId].length) delete ud.subtasks[itemId];
  });
}
export function moveSubtask(itemId, subId, dir) {
  return updateUser((ud) => {
    const list = ud.subtasks[itemId] || [];
    const i = list.findIndex((x) => x.id === subId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  });
}

// D6
// Unsaved keystrokes are kept here so a re-render never wipes what you're typing.
const noteTimers = {};
const noteDrafts = {};
export function noteValue(itemId) {
  return noteDrafts[itemId] ?? state.userdata.notes[itemId] ?? '';
}
export function setNote(itemId, text) {
  noteDrafts[itemId] = text;
  clearTimeout(noteTimers[itemId]);
  noteTimers[itemId] = setTimeout(async () => {
    await updateUser((ud) => {
      if (text.trim()) ud.notes[itemId] = text;
      else delete ud.notes[itemId];
    });
    if (noteDrafts[itemId] === text) delete noteDrafts[itemId];
  }, 350);
}
