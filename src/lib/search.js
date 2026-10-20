// F12: one search across assignments, announcements, pages and files.
// Pure: returns groups of results; the UI decides how each one opens.

import { searchItems } from './model.js';

function matches(text, tokens) {
  const hay = text.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

function rank(title, q) {
  const t = title.toLowerCase();
  return t.startsWith(q) ? 0 : t.includes(q) ? 1 : 2;
}

const stripHtml = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

/**
 * sources: { items, announcements, pages, files, nickOf(courseId), visibleCourseIds:Set }
 * Returns [{ type, label, results: [{ type, id, title, courseId, meta, ref }] }] (empty groups left out).
 */
export function searchEverything(sources, query, perGroup = 5) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const ok = (courseId) => !courseId || !sources.visibleCourseIds || sources.visibleCourseIds.has(courseId);
  const pick = (list, text) =>
    list
      .filter((x) => ok(x.courseId) && matches(`${text(x)} ${sources.nickOf?.(x.courseId) || ''}`, tokens))
      .sort((a, b) => rank(a.title || a.name, q) - rank(b.title || b.name, q))
      .slice(0, perGroup);

  const groups = [
    { type: 'assignment', label: 'Assignments', results: searchItems(sources.items || [], query, perGroup).map((i) => ({ type: 'assignment', id: i.id, title: i.title, courseId: i.courseId, ref: i })) },
    { type: 'announcement', label: 'Announcements', results: pick(sources.announcements || [], (a) => `${a.title} ${stripHtml(a.html)}`).map((a) => ({ type: 'announcement', id: a.id, title: a.title, courseId: a.courseId, ref: a })) },
    { type: 'page', label: 'Pages', results: pick(sources.pages || [], (p) => p.title).map((p) => ({ type: 'page', id: `${p.courseId}|${p.url}`, title: p.title, courseId: p.courseId, ref: p })) },
    { type: 'file', label: 'Files', results: pick((sources.files || []).map((f) => ({ ...f, title: f.name })), (f) => f.name).map((f) => ({ type: 'file', id: f.id, title: f.name, courseId: f.courseId, ref: f })) },
  ];
  return groups.filter((g) => g.results.length);
}
