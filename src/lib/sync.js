// Refreshes Canvas data into local storage (A6). Runs in the background
// service worker in the extension, or in the page in test mode.

import * as canvas from './canvas.js';
import * as storage from './storage.js';
import { normalizeCourse, normalizeAssignment, normalizePlannerItem, normalizeGroup } from './normalize.js';
import { fromCanvasScheme } from './scaleParse.js';
import { normalizeAnnouncement, normalizeConversation, normalizeTabs, normalizePerson, normalizeGroup as normalizeCanvasGroup, normalizePage, normalizeFile } from './contentNormalize.js';

export const INDEX_MAX_AGE = 6 * 3600 * 1000; // F12: page and file names, refreshed every 6 hours
import { dayKey, DEFAULT_TZ, userTz } from './time.js';
import { CANVAS_ORIGIN } from './env.js';
import { allItems, courseNick } from './model.js';
import { withDefaults, userWithDefaults } from './defaults.js';
import { summarize } from './gradeSummary.js';
import { hasEnded, updateArchive, withoutCourses } from './archive.js';

const LOCK_MS = 90 * 1000;
export const MIN_GAP_MS = 30 * 1000; // throttle between syncs (A6)
export const STALE_MS = 2 * 60 * 1000; // refresh on open if older (A6)

export async function runSync({ force = false } = {}) {
  if (!CANVAS_ORIGIN) return { skipped: 'setup' }; // K1: no school chosen yet
  const { syncState = {}, cache, auth, netStatus } = await storage.get(['syncState', 'cache', 'auth', 'netStatus']);
  const now = Date.now();
  if (syncState.running && now - syncState.startedAt < LOCK_MS) return { skipped: 'running' };
  if (!force && cache?.fetchedAt && now - cache.fetchedAt < STALE_MS) return { skipped: 'fresh' };
  // The throttle only protects Canvas after successful refreshes. After a
  // failure (expired login, offline, error) a retry runs right away (A5, A8).
  const lastFailed = auth?.state === 'expired' || netStatus?.offline || netStatus?.error;
  if (!lastFailed && syncState.lastAttempt && now - syncState.lastAttempt < MIN_GAP_MS) return { skipped: 'throttled' };

  await storage.set({ syncState: { ...syncState, running: true, startedAt: now, lastAttempt: now } });
  let result;
  try {
    const fetched = await fetchEverything();
    // I1: quarters that have ended go to the archive and off the current lists.
    const data = await archiveEnded(fetched, cache);
    data.index = cache?.index && Date.now() - cache.index.fetchedAt < INDEX_MAX_AGE ? cache.index : await soft(buildIndex(data.courses), cache?.index || null);
    await storage.set({
      cache: data,
      auth: { state: 'ok', at: Date.now() },
      netStatus: { offline: false, error: null, at: Date.now() },
    });
    await saveSnapshot(data);
    const skippedCourses = data.courses.filter((c) => c.unavailable).length;
    result = { ok: true, courses: data.courses.length - skippedCourses, items: data.items.length, skippedCourses };
  } catch (e) {
    if (e instanceof canvas.AuthError) {
      await storage.set({ auth: { state: 'expired', at: Date.now() } });
      result = { error: 'auth' };
    } else if (e instanceof canvas.OfflineError) {
      await storage.set({ netStatus: { offline: true, error: null, at: Date.now() } });
      result = { error: 'offline' };
    } else {
      await storage.set({ netStatus: { offline: false, error: e.message || String(e), at: Date.now() } });
      result = { error: e.message || String(e) };
    }
  } finally {
    // lastResult powers the "Last refresh" line in Settings → Data.
    await storage.set({ syncState: { running: false, startedAt: 0, lastAttempt: Date.now(), lastResult: { ...result, at: Date.now() } } });
  }
  return result;
}

// A worker that's just starting can't have a refresh in progress, so any
// "running" flag is left over from one that was stopped (e.g. extension reload).
export async function clearStaleLock() {
  const { syncState } = await storage.get(['syncState']);
  if (syncState?.running) await storage.set({ syncState: { ...syncState, running: false, startedAt: 0 } });
}

// For per-course extras: a refusal (even a 401) just means "not shared with students".
async function soft(promise, fallback) {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof canvas.OfflineError) throw e;
    return fallback;
  }
}

async function optional(promise, fallback) {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof canvas.AuthError || e instanceof canvas.OfflineError) throw e;
    return fallback; // e.g. a course with its Quizzes tab hidden returns 403/404
  }
}

export async function fetchEverything() {
  const profile = await canvas.get('/api/v1/users/self/profile');
  const rawCourses = await canvas.getAll('/api/v1/courses', {
    enrollment_state: 'active',
    'include[]': ['total_scores', 'term', 'sections'],
  });
  const courses = rawCourses
    .filter((c) => !c.access_restricted_by_date && (c.enrollments || []).some((e) => e.type === 'student'))
    .map(normalizeCourse);

  // One course refusing access (e.g. a 403 from a course hosted on another
  // Canvas server) must never block the rest. It's skipped and flagged instead.
  let authFailures = 0;
  const perCourse = await canvas.pool(courses, 4, async (course) => {
    try {
      const [assignments, groups, quizzes, detail, subs, tabs, staff] = await Promise.all([
        canvas.getAll(`/api/v1/courses/${course.id}/assignments`, { 'include[]': ['submission', 'score_statistics'], order_by: 'due_at' }),
        soft(canvas.getAll(`/api/v1/courses/${course.id}/assignment_groups`), []),
        soft(canvas.getAll(`/api/v1/courses/${course.id}/quizzes`), []),
        // E3 weights flag + E1 syllabus
        soft(canvas.get(`/api/v1/courses/${course.id}`, { 'include[]': ['syllabus_body'] }), null),
        // E24 comments + E25 rubric scores
        soft(canvas.getAll(`/api/v1/courses/${course.id}/students/submissions`, { 'student_ids[]': 'self', 'include[]': ['submission_comments', 'rubric_assessment'] }), []),
        // F1/F9: which sections and tools this class shows students
        soft(canvas.getAll(`/api/v1/courses/${course.id}/tabs`), null),
        // F10: instructors and TAs
        soft(canvas.getAll(`/api/v1/courses/${course.id}/users`, { 'enrollment_type[]': ['teacher', 'ta'], 'include[]': ['enrollments'] }), []),
      ]);
      course.nav = tabs ? normalizeTabs(tabs) : null;
      course.staff = staff.map(normalizePerson);
      if (detail) {
        course.weighted = !!detail.apply_assignment_group_weights;
        course.syllabusHtml = detail.syllabus_body || '';
        if (detail.grading_standard_id) {
          const std = await soft(canvas.get(`/api/v1/courses/${course.id}/grading_standards/${detail.grading_standard_id}`), null);
          course.canvasScale = fromCanvasScheme(std);
        }
      }
      course.groups = groups.map(normalizeGroup);
      const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]));
      const quizzesById = Object.fromEntries(quizzes.map((q) => [q.id, q]));
      const subsById = Object.fromEntries(subs.map((s) => [String(s.assignment_id), s]));
      return assignments
        .filter((a) => a.published !== false)
        .map((a) => {
          const extra = subsById[String(a.id)];
          const merged = extra ? { ...a, submission: { ...(a.submission || {}), ...extra } } : a;
          return normalizeAssignment(merged, course.id, groupsById, quizzesById);
        });
    } catch (e) {
      if (e instanceof canvas.OfflineError) throw e;
      if (e instanceof canvas.AuthError) authFailures++;
      course.unavailable = e instanceof canvas.HttpError ? `Canvas returned ${e.status}` : e instanceof canvas.AuthError ? 'Canvas said you don’t have access' : e.message || 'Unknown error';
      return [];
    }
  });
  // The profile loaded, so the login works. Only treat it as expired if every course was refused.
  if (courses.length && authFailures === courses.length) throw new canvas.AuthError();

  const start = new Date(Date.now() - 21 * 86400000).toISOString();
  const end = new Date(Date.now() + 150 * 86400000).toISOString();
  const planner = await optional(canvas.getAll('/api/v1/planner/items', { start_date: start, end_date: end }), []);
  const courseIds = new Set(courses.map((c) => c.id));
  const plannerItems = planner
    .map(normalizePlannerItem)
    .filter((x) => x && (x.courseId == null || courseIds.has(x.courseId)));

  // F2: announcements from the last 60 days, all classes in one request.
  const live = courses.filter((c) => !c.unavailable);
  const announcements = live.length
    ? await optional(
        canvas.getAll('/api/v1/announcements', { 'context_codes[]': live.map((c) => `course_${c.id}`), start_date: new Date(Date.now() - 60 * 86400000).toISOString(), end_date: new Date(Date.now() + 86400000).toISOString() }, 5),
        []
      )
    : [];
  // F8 inbox, F11 your Canvas groups.
  const conversations = await optional(canvas.getAll('/api/v1/conversations', { scope: 'inbox', per_page: 50 }, 1), []);
  const groups = await optional(canvas.getAll('/api/v1/users/self/groups'), []);

  return {
    fetchedAt: Date.now(),
    profile: { id: profile.id != null ? String(profile.id) : null, name: profile.short_name || profile.name || '', fullName: profile.name || '', timeZone: profile.time_zone || DEFAULT_TZ, calendarFeed: profile.calendar?.ics || null }, // G8
    courses,
    items: [...perCourse.flat(), ...plannerItems],
    announcements: announcements.map(normalizeAnnouncement).sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt)),
    conversations: conversations.map(normalizeConversation),
    groups: groups.map(normalizeCanvasGroup),
  };
}

// F12: names of pages and files in every class, so search can find them.
// Bodies are loaded on demand when you open something.
export async function buildIndex(courses) {
  const out = { fetchedAt: Date.now(), pages: [], files: [] };
  await canvas.pool(
    courses.filter((c) => !c.unavailable),
    3,
    async (c) => {
      const showsPages = !c.nav || c.nav.sections.includes('pages');
      const showsFiles = !c.nav || c.nav.sections.includes('files');
      const [pages, files] = await Promise.all([
        showsPages ? soft(canvas.getAll(`/api/v1/courses/${c.id}/pages`, { sort: 'title' }), []) : [],
        showsFiles ? soft(canvas.getAll(`/api/v1/courses/${c.id}/files`), []) : [],
      ]);
      out.pages.push(...pages.map((p) => ({ ...normalizePage(p), courseId: c.id })));
      out.files.push(...files.map((f) => ({ ...normalizeFile(f), courseId: c.id })));
    }
  );
  return out;
}

// Real grades (never what-if) for every course in `data`, or null if the math fails.
function gradeSummary(data, { settings, userdata, grades }) {
  try {
    const s = withDefaults(settings);
    return summarize({ cache: data, items: allItems(data, userWithDefaults(userdata), s, data.fetchedAt), settings: s, grades: { ...(grades || {}), whatIfOn: false }, now: data.fetchedAt });
  } catch {
    return null; // never let a grade-math problem block a refresh
  }
}

// I1: save ended courses (with their final grades), then return the data without them.
export async function archiveEnded(data, prevCache, now = Date.now()) {
  const ended = new Set(data.courses.filter((c) => hasEnded(c, now)).map((c) => c.id));
  const gone = (prevCache?.courses || []).some((c) => hasEnded(c, now) && !data.courses.some((x) => x.id === c.id));
  if (!ended.size && !gone) return data;
  const stored = await storage.get(['archive', 'settings', 'userdata', 'grades', 'snapshots']);
  const settings = withDefaults(stored.settings);
  const summaryById = Object.fromEntries((gradeSummary(data, stored)?.courses || []).map((c) => [c.course.id, c]));
  const archive = updateArchive(stored.archive, {
    data,
    prevCache,
    summaryById,
    userdata: userWithDefaults(stored.userdata),
    snapshots: stored.snapshots || [],
    nickOf: (id) => courseNick(id, [...data.courses, ...(prevCache?.courses || [])], settings),
    now,
  });
  await storage.set({ archive });
  return withoutCourses(data, ended);
}

// Grade snapshots (approved early part of E20): one per day, plus a new one
// whenever a course score changes. Phase 2 draws charts from these.
export async function saveSnapshot(data) {
  const { snapshots = [], settings, userdata, grades } = await storage.get(['snapshots', 'settings', 'userdata', 'grades']);
  const tz = userTz(data.profile?.timeZone);
  // E20: Canvas's score plus your computed % and UW grade (real grades only, never what-if).
  const sum = gradeSummary(data, { settings, userdata, grades });
  const byId = Object.fromEntries((sum?.courses || []).map((c) => [c.course.id, c]));
  const courses = Object.fromEntries(data.courses.map((c) => [c.id, { score: c.score, grade: c.grade, pct: byId[c.id]?.pct ?? null, gp: byId[c.id]?.gp ?? null }]));
  const gpa = { quarter: sum?.quarter.gpa ?? null, cumulative: sum?.cumulative.projected ?? null };
  const entry = { date: dayKey(data.fetchedAt, tz), at: data.fetchedAt, courses, gpa };
  const last = snapshots[snapshots.length - 1];
  if (last && last.date === entry.date && JSON.stringify([last.courses, last.gpa]) === JSON.stringify([courses, gpa])) {
    last.at = entry.at; // same day, nothing changed: just bump the time
  } else {
    snapshots.push(entry);
  }
  await storage.set({ snapshots: snapshots.slice(-3000) });
}
