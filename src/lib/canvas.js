// Canvas REST API client. Uses the browser's existing login to your school's Canvas
// (A4, K1): no token, no password. Only ever talks to CANVAS_ORIGIN (A7), with one exception
// the owner approved on 2026-10-06: file uploads for submissions (F13) may go to
// Instructure's file storage (inst-fs), the server Canvas itself sends them to.

import { CANVAS_ORIGIN } from './env.js';
import { canWrite, canMessage } from '../build.js';

export class AuthError extends Error {
  constructor() {
    super('Canvas login expired');
    this.name = 'AuthError';
  }
}
export class OfflineError extends Error {
  constructor() {
    super('Offline');
    this.name = 'OfflineError';
  }
}
export class HttpError extends Error {
  constructor(status, path, detail = null) {
    super(`Canvas returned ${status} for ${path}`);
    this.name = 'HttpError';
    this.status = status;
    this.detail = detail; // Canvas's own error message, when it sends one
  }
}
// F13: the only other host allowed, and only for the file upload step. Nothing else
// (no Canvas cookies, no security token) is sent there.
export const UPLOAD_HOST_RE = /^inst-fs-[a-z0-9-]+\.inscloudgate\.net$/;
export const isUploadHost = (url) => url.protocol === 'https:' && UPLOAD_HOST_RE.test(url.hostname);

// F13: Canvas asked for a file to go to some other server (A7 forbids it).
export class ForeignHostError extends Error {
  constructor(host) {
    super(`Canvas wants this file uploaded to ${host}, which the dashboard isn’t allowed to contact.`);
    this.name = 'ForeignHostError';
    this.host = host;
  }
}

// Canvas IDs can exceed JavaScript's safe integer range (e.g. 283480000000000347
// for courses hosted on another Canvas server) and would be silently rounded.
// This header makes Canvas send every ID as a string instead.
export const ACCEPT = 'application/json+canvas-string-ids';

// Test mode swaps this for sample data.
let transport = fetchTransport;
export function setTransport(fn) {
  transport = fn;
}

// K25: the Canvas inbox's own writes, and nothing else: send a message (POST
// /conversations), reply (POST /conversations/<id>/add_message) and update one
// conversation (PUT /conversations/<id>: read/unread, star, archive). PUT on
// /conversations itself is Canvas's batch update, which can delete, so it's refused.
const pathOf = (url) => String(url).replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
const MESSAGE_WRITES = { POST: /^\/api\/v1\/conversations(\/\d+\/add_message)?$/, PUT: /^\/api\/v1\/conversations\/\d+$/ };
export const isMessageWrite = (url, method) => !!MESSAGE_WRITES[method]?.test(pathOf(url));
const writeAllowed = (url, method) => canWrite() || (canMessage() && isMessageWrite(url, method));

// K15: the public build only reads (except the inbox, K25). Anything else that would change Canvas stops here.
export class ReadOnlyError extends Error {
  constructor() {
    super('This version of Neko can’t make that change in Canvas (it only reads, apart from your messages)');
    this.name = 'ReadOnlyError';
  }
}

// Writes live in canvasWrite.js (owner build only); it plugs in the upload sender.
let externalSender = null;
export function setExternalSender(fn) {
  externalSender = fn;
}

// K1: no school chosen yet (setup hasn't finished).
export class NoSchoolError extends Error {
  constructor() {
    super('Choose your school first');
    this.name = 'NoSchoolError';
  }
}

// A7/K1: every request goes to your school's Canvas and nowhere else.
export function checkTarget(url) {
  if (!CANVAS_ORIGIN) throw new NoSchoolError();
  if (new URL(url).origin !== CANVAS_ORIGIN) throw new ForeignHostError(new URL(url).host);
}

async function fetchTransport(url, opts = {}) {
  const method = opts.method || 'GET';
  if (method !== 'GET' && !writeAllowed(url, method)) throw new ReadOnlyError(); // K15, K25
  if (opts.external) {
    if (!externalSender) throw new ReadOnlyError();
    return externalSender(url, opts);
  }
  checkTarget(url);
  let res;
  const headers = { Accept: ACCEPT };
  if (method !== 'GET' && opts.csrf) headers['X-CSRF-Token'] = opts.csrf;
  try {
    res = await fetch(url, { method, credentials: 'include', headers, body: opts.body }); // FormData / URLSearchParams set their own Content-Type
  } catch {
    throw new OfflineError();
  }
  const finalPath = new URL(res.url || url).pathname;
  const type = res.headers.get('content-type') || '';
  // Expired sessions get a 401, or a redirect to the HTML login page (A5).
  if (res.status === 401 || /\/login\b/.test(finalPath) || (res.ok && type.includes('text/html'))) {
    throw new AuthError();
  }
  if (!res.ok) {
    let detail = null;
    try {
      const j = parseCanvasJson(await res.text());
      detail = j?.errors?.[0]?.message || j?.message || (typeof j?.errors === 'object' ? Object.values(j.errors).flat()[0]?.message : null) || null;
    } catch {
      /* not JSON */
    }
    throw new HttpError(res.status, new URL(url).pathname, detail);
  }
  const text = await res.text();
  return { json: text ? parseCanvasJson(text) : null, link: res.headers.get('Link'), location: res.headers.get('Location') };
}

// Canvas prefixes JSON with "while(1);" for cookie-authenticated requests.
export function parseCanvasJson(text) {
  return JSON.parse(text.replace(/^while\(1\);/, ''));
}

export function buildUrl(path, params = {}) {
  if (!CANVAS_ORIGIN) throw new NoSchoolError();
  const url = new URL(path.startsWith('http') ? path : CANVAS_ORIGIN + path);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else if (v != null) url.searchParams.set(k, v);
  }
  return url.toString();
}

function nextLink(link) {
  if (!link) return null;
  for (const part of link.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

export async function get(path, params) {
  return (await transport(buildUrl(path, params))).json;
}

// For canvasWrite.js: the same connection (sample data in test and demo mode).
// K15: checked here as well, so sample data (test and demo mode) obeys it too.
export function send(url, opts = {}) {
  if ((opts.method || 'GET') !== 'GET' && !writeAllowed(url, opts.method)) return Promise.reject(new ReadOnlyError());
  return transport(url, opts);
}

// Follows pagination. Capped so a runaway list can't hammer Canvas.
export async function getAll(path, params = {}, maxPages = 20) {
  let url = buildUrl(path, { per_page: 100, ...params });
  const out = [];
  for (let i = 0; url && i < maxPages; i++) {
    const { json, link } = await transport(url);
    out.push(...json);
    const next = nextLink(link);
    url = next && next.startsWith(CANVAS_ORIGIN) ? next : null;
  }
  return out;
}

// Runs async jobs with limited concurrency, so Canvas isn't flooded (A6).
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}
