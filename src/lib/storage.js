// Thin wrapper over chrome.storage.local, with a localStorage fallback for test mode.
// All data lives on this computer (A7).
// K16: in demo mode every key gets a "demo:" prefix, so sample data never touches
// (or even sees) your real data, and leaving the demo deletes only demo keys.

import { isExtension, isDemo } from './env.js';

const PREFIX = 'cd:';
const DEMO = 'demo:';
const devListeners = new Set();

const inSpace = (key) => (isDemo() ? key.startsWith(DEMO) : !key.startsWith(DEMO) && key !== 'demoMode');
const toStored = (key) => (isDemo() ? DEMO + key : key);
const fromStored = (key) => (isDemo() ? key.slice(DEMO.length) : key);

export async function get(keys) {
  const out = {};
  if (isExtension) {
    const raw = await chrome.storage.local.get(keys.map(toStored));
    for (const k of keys) if (raw[toStored(k)] !== undefined) out[k] = raw[toStored(k)];
    return out;
  }
  for (const k of keys) {
    const raw = localStorage.getItem(PREFIX + toStored(k));
    if (raw != null) out[k] = JSON.parse(raw);
  }
  return out;
}

export async function getAll() {
  const out = {};
  if (isExtension) {
    const raw = await chrome.storage.local.get(null);
    for (const [k, v] of Object.entries(raw)) if (inSpace(k)) out[fromStored(k)] = v;
    return out;
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(PREFIX) && inSpace(k.slice(PREFIX.length))) out[fromStored(k.slice(PREFIX.length))] = JSON.parse(localStorage.getItem(k));
  }
  return out;
}

export async function set(obj) {
  if (isExtension) return chrome.storage.local.set(Object.fromEntries(Object.entries(obj).map(([k, v]) => [toStored(k), v])));
  const changes = {};
  for (const [k, v] of Object.entries(obj)) {
    localStorage.setItem(PREFIX + toStored(k), JSON.stringify(v));
    changes[k] = { newValue: v };
  }
  devListeners.forEach((fn) => fn(changes));
}

export async function remove(keys) {
  if (isExtension) return chrome.storage.local.remove(keys.map(toStored));
  const changes = {};
  for (const k of keys) {
    localStorage.removeItem(PREFIX + toStored(k));
    changes[k] = { newValue: undefined };
  }
  devListeners.forEach((fn) => fn(changes));
}

// Clears this space only: real data, or (in demo mode) the demo's.
export async function clear() {
  return remove(Object.keys(await getAll()));
}

export function onChange(fn) {
  if (isExtension) {
    const listener = (changes, area) => {
      if (area !== 'local') return;
      const mine = Object.fromEntries(Object.entries(changes).filter(([k]) => inSpace(k)).map(([k, v]) => [fromStored(k), v]));
      if (Object.keys(mine).length) fn(mine);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  devListeners.add(fn);
  const storageListener = (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const k = e.key.slice(PREFIX.length);
    if (inSpace(k)) fn({ [fromStored(k)]: { newValue: e.newValue == null ? undefined : JSON.parse(e.newValue) } });
  };
  window.addEventListener('storage', storageListener);
  return () => {
    devListeners.delete(fn);
    window.removeEventListener('storage', storageListener);
  };
}
