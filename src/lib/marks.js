// I2: pin, notes and hide for everything, not just assignments.
// Each thing gets a key; pins and hides live in userdata.marks[key] with enough
// detail (title, class) to list them without reloading Canvas. Notes use
// userdata.notes[key], like assignment notes (D6). Assignments keep C10/C11.

export const MARK_KEY = {
  announcement: (id) => (String(id).startsWith('ann:') ? String(id) : `ann:${id}`), // announcement ids already look like "ann:123"
  page: (courseId, url) => `page:${courseId}|${url}`,
  file: (courseId, id) => `file:${courseId}|${id}`,
  discussion: (courseId, id) => `topic:${courseId}|${id}`,
  conversation: (id) => `conv:${id}`,
  module: (courseId, id) => `module:${courseId}|${id}`,
  course: (id) => `course:${id}`,
};

export const MARK_TYPES = [
  ['announcement', 'Announcements'],
  ['page', 'Pages'],
  ['file', 'Files'],
  ['discussion', 'Discussions'],
  ['conversation', 'Messages'],
  ['module', 'Modules'],
  ['course', 'Classes'],
];

export const isMarkHidden = (ud, key) => !!ud.marks?.[key]?.hidden;
export const isMarkPinned = (ud, key) => !!ud.marks?.[key]?.pinned;

// Applies a change to one mark and drops it once nothing is left on it.
export function setMark(marks, key, meta, patch) {
  const next = { ...(marks[key] || {}), ...meta, ...patch };
  if (!next.pinned && !next.hidden) delete marks[key];
  else marks[key] = next;
  return marks;
}

// Everything pinned, newest pin first: assignments/to-dos (C10) plus every other type.
export function pinnedEverything(ud, items) {
  const fromItems = items.filter((i) => ud.pins?.[i.id]).map((i) => ({ key: i.id, type: 'item', title: i.title, courseId: i.courseId, item: i, at: ud.pins[i.id] }));
  const fromMarks = Object.entries(ud.marks || {})
    .filter(([, m]) => m.pinned)
    .map(([key, m]) => ({ key, type: m.type, title: m.title, courseId: m.courseId || null, ref: m.ref, at: m.pinned }));
  return [...fromItems, ...fromMarks].sort((a, b) => b.at - a.at);
}

export function hiddenMarks(ud) {
  return Object.entries(ud.marks || {})
    .filter(([, m]) => m.hidden)
    .map(([key, m]) => ({ key, ...m }))
    .sort((a, b) => b.hidden - a.hidden);
}
