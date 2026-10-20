// E33 + G10/G11 + K8: syllabus setups (grading rules, exams, deadlines, class
// meetings), matched to Canvas courses by course code or course id. They live in your
// saved data (storage key "syllabi"): imported from a syllabus (K5), typed in (K7), or
// the owner's hand-written ones (owner-data/). Patterns (`match`, `group`) are stored
// as text and turned into case-insensitive regular expressions here.

// Every module reads this live list; setProfiles() swaps it when your data changes.
export let PROFILES = [];

const PATTERN_KEYS = new Set(['match', 'group']);

function hydrate(value, key) {
  if (PATTERN_KEYS.has(key) && typeof value === 'string') {
    try {
      return new RegExp(value, 'i');
    } catch {
      return /(?!)/; // a broken pattern matches nothing
    }
  }
  if (Array.isArray(value)) return value.map((v) => hydrate(v));
  if (value && typeof value === 'object' && !(value instanceof RegExp)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, hydrate(v, k)]));
  return value;
}

export function setProfiles(list) {
  PROFILES = (Array.isArray(list) ? list : []).map((p) => hydrate(p));
}

// For saving: regular expressions become their pattern text (all are case-insensitive).
export function serializeProfiles(list) {
  return JSON.parse(JSON.stringify(list || [], (k, v) => (v instanceof RegExp ? v.source : v)));
}

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// A syllabus saved for one Canvas course (K5–K7) wins; otherwise by course code:
// "BIO 180 A Au 26: …", "B IO 180 A" and "BIO 180 B" all match "BIO 180".
export function findProfile(course, profiles = PROFILES) {
  const id = String(course.id ?? '');
  const byId = id && profiles.find((p) => p.courseId != null && String(p.courseId) === id);
  if (byId) return byId;
  const hay = norm(`${course.code || course.course_code || ''} ${course.name || ''}`);
  return profiles.find((p) => p.courseId == null && p.code && (hay.startsWith(norm(p.code)) || norm(course.code || '').startsWith(norm(p.code)))) || null;
}

// Plain-language summary of a profile's rules, for the Setup tab.
export function describeProfile(p) {
  const m = p.model;
  if (!m) return [];
  if (m.kind === 'outOf') return [`Graded out of ${m.outOf} points. Every point you earn counts, including points beyond ${m.outOf}.`];
  if (m.kind === 'selfWeighted') {
    return [
      ...m.completion.map((c) => `${c.name}: up to ${c.max}%, by how much you complete.`),
      'Exams share whatever is left: Exam 1 and Exam 2 get 2/7 each, the final 3/7.',
    ];
  }
  return m.categories.map((c) => `${c.name}: ${c.weight}%${c.note ? ` — ${c.note}` : ''}`);
}
