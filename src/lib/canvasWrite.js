// F2, F13, F14: everything that changes something on Canvas, in one file (K15).
// Owner build only: the public zip replaces this file with a stub that refuses, and its
// manifest drops the "cookies" permission and Instructure's upload host.
// Writes need Canvas's CSRF token (the _csrf_token cookie, via the "cookies" permission).

import { CANVAS_ORIGIN } from './env.js';
import { send, buildUrl, setExternalSender, isUploadHost, ForeignHostError, OfflineError, HttpError, parseCanvasJson } from './canvas.js';

export const WRITES = true;

async function csrfToken() {
  if (typeof chrome === 'undefined' || !chrome.cookies) return null;
  const c = await chrome.cookies.get({ url: CANVAS_ORIGIN, name: '_csrf_token' });
  return c ? decodeURIComponent(c.value) : null;
}

// F13: the file itself, to Instructure's storage. No cookies (credentials: 'omit') and
// no CSRF token: the one-time upload URL Canvas gave us is the only authorization.
setExternalSender(async (url, opts) => {
  let res;
  try {
    res = await fetch(url, { method: 'POST', credentials: 'omit', headers: { Accept: 'application/json' }, body: opts.body });
  } catch {
    throw new OfflineError();
  }
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, new URL(url).pathname, text.slice(0, 200) || null);
  return { json: text ? parseCanvasJson(text) : null, location: res.headers.get('Location') };
});

// F2: marks an announcement read on Canvas.
export async function put(path, params) {
  return (await send(buildUrl(path, params), { method: 'PUT', csrf: await csrfToken() })).json;
}

// Form fields go in the body (submission text can be long). Arrays repeat the key.
export function formBody(fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => body.append(k, x));
    else if (v != null) body.append(k, String(v));
  }
  return body;
}

// F13 submits; F14 posts replies.
export async function post(path, fields = {}) {
  return (await send(buildUrl(path), { method: 'POST', body: formBody(fields), csrf: await csrfToken() })).json;
}

// F13 step 2: send the file where Canvas said to: your school's Canvas, or Instructure's
// file storage. Any other host is refused before anything is sent.
export async function uploadFile(uploadUrl, params, file) {
  const target = new URL(uploadUrl, CANVAS_ORIGIN);
  const external = target.origin !== CANVAS_ORIGIN;
  if (external && !isUploadHost(target)) throw new ForeignHostError(target.host);
  const form = new FormData();
  for (const [k, v] of Object.entries(params || {})) form.append(k, v);
  form.append('file', file, file.name); // Canvas requires the file to be the last field
  const { json, location } = await send(target.toString(), { method: 'POST', body: form, external, csrf: external ? null : await csrfToken() });
  return { ...(json || {}), location: json?.location || location || null };
}
