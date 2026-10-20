// Phase 3: course content loaded when you open it (modules, pages, files,
// discussions, messages). Saved locally so it opens instantly next time,
// then refreshed quietly in the background.

import * as canvas from '../lib/canvas.js';
import * as write from '../lib/canvasWrite.js';
import { canWrite } from '../build.js';
import * as storage from '../lib/storage.js';
import { isDev, isDemo, usesSample, devScenario } from '../lib/env.js';
import { notify, state } from './store.js';
import {
  normalizeModules, normalizePage, normalizeFile, normalizeFolder, normalizeTopic, normalizeThread, normalizeConversationDetail,
} from '../lib/contentNormalize.js';

const TTL = 10 * 60 * 1000; // re-check Canvas after 10 minutes
const mem = new Map();

let transportReady = null;
function ensureTransport() {
  if (!usesSample()) return Promise.resolve();
  transportReady ||= import('../lib/fixtures.js').then((fx) => canvas.setTransport(fx.fixtureTransport(isDemo() ? 'demo' : devScenario())));
  return transportReady;
}

const FETCHERS = {
  modules: (c) => canvas.getAll(`/api/v1/courses/${c}/modules`, { 'include[]': ['items', 'content_details'] }).then(normalizeModules),
  pages: (c) => canvas.getAll(`/api/v1/courses/${c}/pages`, { sort: 'title' }).then((list) => list.map(normalizePage)),
  page: (c, url) => canvas.get(`/api/v1/courses/${c}/pages/${encodeURIComponent(url)}`).then(normalizePage),
  frontPage: (c) => canvas.get(`/api/v1/courses/${c}/front_page`).then(normalizePage),
  files: async (c) => {
    const [folders, files] = await Promise.all([canvas.getAll(`/api/v1/courses/${c}/folders`), canvas.getAll(`/api/v1/courses/${c}/files`)]);
    return { folders: folders.map(normalizeFolder), files: files.map(normalizeFile) };
  },
  topics: (c) => canvas.getAll(`/api/v1/courses/${c}/discussion_topics`).then((list) => list.map(normalizeTopic)),
  topic: (c, id) => canvas.get(`/api/v1/courses/${c}/discussion_topics/${id}`).then(normalizeTopic),
  thread: (c, id) => canvas.get(`/api/v1/courses/${c}/discussion_topics/${id}/view`).then(normalizeThread),
  conversation: (_c, id) => canvas.get(`/api/v1/conversations/${id}`).then(normalizeConversationDetail), // opening it marks it read in Canvas
};

const keyOf = (kind, courseId, key) => `content:${kind}:${courseId || ''}:${key || ''}`;

// Returns { status: 'loading' | 'ready' | 'hidden' | 'error', data, error }. Re-renders when it changes.
export function useContent(kind, courseId, key = '') {
  const k = keyOf(kind, courseId, key);
  let entry = mem.get(k);
  if (!entry) {
    entry = { status: 'loading', data: null };
    mem.set(k, entry);
    load(k, kind, courseId, key, entry, true);
  } else if (entry.status === 'ready' && !entry.busy && Date.now() - entry.at > TTL) {
    load(k, kind, courseId, key, entry, false);
  }
  return entry;
}

export function refreshContent(kind, courseId, key = '') {
  const k = keyOf(kind, courseId, key);
  const entry = mem.get(k);
  if (entry && !entry.busy) load(k, kind, courseId, key, entry, false);
}

async function load(k, kind, courseId, key, entry, first) {
  entry.busy = true;
  if (first) {
    const saved = (await storage.get([k]))[k];
    if (saved) {
      Object.assign(entry, { status: 'ready', data: saved.data, at: saved.at });
      notify();
      if (Date.now() - saved.at < TTL) {
        entry.busy = false;
        return;
      }
    }
  }
  try {
    await ensureTransport();
    const data = await FETCHERS[kind](courseId, key);
    Object.assign(entry, { status: 'ready', data, at: Date.now(), error: null });
    storage.set({ [k]: { data, at: entry.at } });
  } catch (e) {
    if (entry.status !== 'ready') {
      // A section the instructor hid answers 401/403/404 (F5 "says so instead of an error").
      const hidden = e instanceof canvas.HttpError && [401, 403, 404].includes(e.status);
      Object.assign(entry, { status: hidden || e instanceof canvas.AuthError ? 'hidden' : 'error', error: e.message });
    }
  } finally {
    entry.busy = false;
    notify();
  }
}

// F13, F14: writes need the same Canvas connection (sample data in test mode).
export const canvasReady = () => ensureTransport();

// F14: post a reply to a topic (parentId null) or to someone's post, then reload the thread.
export async function postReply(courseId, topicId, parentId, html) {
  await ensureTransport();
  const path = `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries${parentId ? `/${parentId}/replies` : ''}`;
  const entry = await write.post(path, { message: html });
  refreshContent('thread', courseId, topicId);
  return entry;
}

// F2: opening an announcement marks it read in Canvas too.
export async function markAnnouncementRead(a) {
  if (a.read || isRead('ann', a.canvasId)) return;
  readLocally('ann', a.canvasId);
  if (!canWrite()) return; // K15: the public build remembers it here only
  try {
    await ensureTransport();
    await write.put(`/api/v1/courses/${a.courseId}/discussion_topics/${a.canvasId}/read`);
  } catch {
    /* it stays read here; Canvas catches up next time you open it there */
  }
}

// Things you've opened here, until the next Canvas refresh reports them read.
const readKey = 'readLocally';
let readSet = null;
export function isRead(kind, id) {
  return !!(readSet || state.readLocally || {})[`${kind}:${id}`];
}
export function readLocally(kind, id) {
  if (isRead(kind, id)) return; // already marked: don't trigger another redraw (that would loop)
  readSet = { ...(readSet || state.readLocally || {}), [`${kind}:${id}`]: Date.now() };
  state.readLocally = readSet;
  storage.set({ [readKey]: readSet });
  notify();
}
export async function initReadState() {
  readSet = (await storage.get([readKey]))[readKey] || {};
  state.readLocally = readSet;
}
