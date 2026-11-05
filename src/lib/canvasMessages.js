// F17 + F18 + K25: the Canvas inbox. Reading, and the only writes the public build may
// make: send a message, reply, and mark a conversation read/unread, starred or archived.
// lib/canvas.js refuses any other write in the public build (isMessagePath).
// Writes need Canvas's CSRF token, read from its _csrf_token cookie ("cookies" permission).

import { CANVAS_ORIGIN } from './env.js';
import { get, getAll, send, buildUrl } from './canvas.js';
import { normalizeConversation, normalizeConversationDetail } from './contentNormalize.js';

async function csrfToken() {
  if (typeof chrome === 'undefined' || !chrome.cookies) return null;
  const c = await chrome.cookies.get({ url: CANVAS_ORIGIN, name: '_csrf_token' });
  return c ? decodeURIComponent(c.value) : null;
}

function form(fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => body.append(k, x));
    else if (v != null) body.append(k, String(v));
  }
  return body;
}

const write = async (path, method, fields) => (await send(buildUrl(path), { method, body: form(fields), csrf: await csrfToken() })).json;

// The inbox views Canvas offers.
export const SCOPES = ['inbox', 'unread', 'starred', 'sent', 'archived'];

export async function listConversations(scope = 'inbox') {
  const params = scope === 'inbox' ? {} : { scope };
  return (await getAll('/api/v1/conversations', params, 3)).map(normalizeConversation);
}

export const getConversation = async (id) => normalizeConversationDetail(await get(`/api/v1/conversations/${id}`));

// "read" | "unread" | "archived"
export const setState = (id, state) => write(`/api/v1/conversations/${id}`, 'PUT', { 'conversation[workflow_state]': state });
export const setStarred = (id, starred) => write(`/api/v1/conversations/${id}`, 'PUT', { 'conversation[starred]': starred ? 'true' : 'false' });

// A new message. recipients: user ids, or groups of people like "course_123_teachers",
// "course_123_tas" or "group_456". One conversation for everyone (not one per person).
export async function sendMessage({ recipients, subject, body, contextCode }) {
  const res = await write('/api/v1/conversations', 'POST', { 'recipients[]': recipients, subject, body, context_code: contextCode || null, group_conversation: 'true', bulk_message: 'false', mode: 'sync' });
  return Array.isArray(res) ? res.map(normalizeConversation) : res;
}

export const reply = async (id, body) => normalizeConversationDetail(await write(`/api/v1/conversations/${id}/add_message`, 'POST', { body }));

// People and groups you can message in a class or group (Canvas decides who's allowed).
export async function searchRecipients(context, search = '') {
  const list = await get('/api/v1/search/recipients', { context, search: search || null, per_page: 30, 'types[]': ['user', 'context'] });
  return (list || []).map((r) => ({ id: String(r.id), name: r.name, type: r.type || (String(r.id).includes('_') ? 'context' : 'user'), count: r.user_count ?? null, roles: Object.values(r.common_courses || {}).flat().concat(Object.values(r.common_groups || {}).flat()) }));
}
