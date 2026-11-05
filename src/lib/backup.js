// A10: back up and restore everything the owner has entered.
// Canvas data (re-downloadable) and login state are never included.

import { APP_NAME } from './env.js';
import { SCHEMA_VERSION, DEFAULT_SETTINGS, DEFAULT_USERDATA } from './defaults.js';
import { DEFAULT_GRADES } from './gradeSummary.js';

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

// The shape each part of a backup must have. Fields that don't match are left out
// (so a damaged or crafted file can't break the app); fields not listed here pass through.
const SHAPES = { settings: DEFAULT_SETTINGS, userdata: DEFAULT_USERDATA, grades: DEFAULT_GRADES, snapshots: [], archive: {}, syllabi: [] };
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function conform(value, shape, path, dropped) {
  if (Array.isArray(shape)) return Array.isArray(value) ? value : (dropped.push(path), undefined);
  if (isPlain(shape)) {
    if (!isPlain(value)) return dropped.push(path), undefined;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const want = shape[k];
      const fixed = want == null ? v : conform(v, want, `${path}.${k}`, dropped);
      if (fixed !== undefined) out[k] = fixed;
    }
    return out;
  }
  return typeof value === typeof shape ? value : (dropped.push(path), undefined);
}
// Keys that could change how every object behaves; never needed in a backup.
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Every key that holds owner-entered data. Later phases add their keys here.
export const BACKUP_KEYS = ['settings', 'userdata', 'grades', 'snapshots', 'archive', 'syllabi']; // archive (I1): Canvas stops showing past terms; syllabi (K8): yours, imported or typed in

export function makeBackup(all) {
  const data = {};
  for (const k of BACKUP_KEYS) if (all[k] !== undefined) data[k] = all[k];
  return {
    app: 'canvas-dashboard',
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function parseBackup(text) {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('That file is too large to be a backup.');
  let obj;
  try {
    obj = JSON.parse(text, (k, v) => (BAD_KEYS.has(k) ? undefined : v));
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  if (obj?.app !== 'canvas-dashboard' || typeof obj.data !== 'object') {
    throw new Error(`That file isn’t a ${APP_NAME} backup.`);
  }
  if (obj.schema > SCHEMA_VERSION) {
    throw new Error('That backup is from a newer version of the dashboard. Update the extension first.');
  }
  const data = {};
  const dropped = [];
  for (const k of BACKUP_KEYS) {
    if (obj.data[k] === undefined) continue;
    const v = conform(obj.data[k], SHAPES[k], k, dropped);
    if (v !== undefined) data[k] = v;
  }
  return { exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null, data, dropped };
}

export function summarize(data) {
  const ud = data.userdata || {};
  const s = data.settings || {};
  const count = (o) => Object.keys(o || {}).length;
  return [
    ['Course settings (nicknames, colors)', count(s.courses)],
    ['Your to-dos', (ud.todos || []).length],
    ['Notes', count(ud.notes)],
    ['Items with subtasks', count(ud.subtasks)],
    ['Pinned items', count(ud.pins) + Object.values(ud.marks || {}).filter((m) => m.pinned).length],
    ['Hidden or snoozed items', count(ud.hidden) + count(ud.snoozed) + Object.values(ud.marks || {}).filter((m) => m.hidden).length],
    ['Checklist changes', count(ud.done)],
    ['Type corrections', count(ud.types)],
    ['Items added to Home from Other', count(ud.promoted)],
    ['Classes with your own quick links', count(ud.links)],
    ['Classes with your own office hours', count(ud.officeHours)],
    ['Study groups', count(ud.studyGroups)],
    ['Your own events', (ud.events || []).length], // G12
    ['Classes with class times you typed in', count(ud.classTimes)], // G13
    ['Grading setups (scales, credits, weights)', count(data.grades?.courses)],
    ['Past terms', (data.grades?.past || []).length],
    ['Saved what-if scenarios', (data.grades?.scenarios || []).length],
    ['Regrade notes', count(data.grades?.regrades)],
    ['Grade snapshots', (data.snapshots || []).length],
    ['Syllabi', (data.syllabi || []).length],
    ['Archived terms', count(data.archive)],
  ];
}
