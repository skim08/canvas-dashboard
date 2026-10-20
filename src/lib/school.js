// K1: which school's Canvas you use. The address comes from setup, Chrome asks you
// to allow that one site, and nothing else is ever contacted (except F13 uploads).

import { isExtension, setCanvasOrigin, CANVAS_ORIGIN, usesSample } from './env.js';
import { ACCEPT, parseCanvasJson } from './canvas.js';

// "canvas.asu.edu", a full link copied from Canvas, or "asu.instructure.com" → the origin.
export function normalizeSchool(input) {
  let text = String(input || '').trim();
  if (!text) return { error: 'Type your school’s Canvas address.' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
  let u;
  try {
    u = new URL(text);
  } catch {
    return { error: 'That doesn’t look like a web address.' };
  }
  if (u.protocol !== 'https:') return { error: 'Canvas addresses are secure (https) links.' };
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || /^\d+(\.\d+){3}$/.test(host) || host === 'localhost' || u.port) return { error: 'Use your school’s Canvas address, like canvas.yourschool.edu.' };
  return { origin: `https://${host}` };
}

export const hostOf = (origin) => (origin ? new URL(origin).hostname : '');

// Applies the saved school (call before anything talks to Canvas).
export function applySchool(settings) {
  setCanvasOrigin(settings?.canvasOrigin || null);
  return CANVAS_ORIGIN;
}

export async function hasAccess(origin = CANVAS_ORIGIN) {
  if (!origin) return false;
  if (usesSample()) return true;
  return chrome.permissions.contains({ origins: [`${origin}/*`] });
}

// Must run straight from a click (Chrome only shows the prompt for a user action).
export function requestAccess(origin) {
  if (!isExtension) return Promise.resolve(true);
  return chrome.permissions.request({ origins: [`${origin}/*`] });
}

// Removes access to a school you no longer use.
export async function dropAccess(origin) {
  if (!isExtension || !origin) return;
  try {
    await chrome.permissions.remove({ origins: [`${origin}/*`] });
  } catch {
    /* already gone */
  }
}

// Is this a Canvas site, and are you signed in? → 'ok' | 'login' | 'not-canvas' | 'offline'
export async function checkCanvas(origin, fetcher = fetch) {
  let res;
  try {
    res = await fetcher(`${origin}/api/v1/users/self`, { credentials: 'include', headers: { Accept: ACCEPT } });
  } catch {
    return 'offline';
  }
  const path = new URL(res.url || origin).pathname;
  if (/\/login\b/.test(path)) return 'login';
  let json = null;
  try {
    json = parseCanvasJson(await res.text());
  } catch {
    return 'not-canvas';
  }
  if (res.status === 401 && json && (json.errors || json.status === 'unauthenticated')) return 'login';
  if (res.ok && json && json.id != null) return 'ok';
  return 'not-canvas';
}
