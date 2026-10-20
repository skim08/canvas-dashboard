// E1 helpers: find a grading scale in syllabus text or pasted text, and import
// a Canvas grading scheme. Results are always suggestions; nothing is saved
// until you confirm it.

import { LETTER_POINTS } from './grades.js';

const GP_RE = /(?<![\d.])([0-4]\.\d)(?![\d.%])/;

// One line -> { min, gp, line } or null. Handles "95-100% 4.0", "4.0 = 95%",
// "94% → 3.9", "≥ 93: 3.8", tables split by tabs, etc.
export function parseScaleLine(line) {
  const gpMatch = line.match(GP_RE);
  if (!gpMatch) return null;
  const gp = parseFloat(gpMatch[1]);
  const rest = line.slice(0, gpMatch.index) + ' ' + line.slice(gpMatch.index + gpMatch[0].length);
  const nums = [...rest.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%?/g)].map((m) => parseFloat(m[1])).filter((n) => n >= 30 && n <= 100);
  if (!nums.length) return null;
  return { min: Math.min(...nums), gp, line: line.trim() };
}

// Scan a block of text. Only returns a result if it looks like a real scale
// (3+ rows whose grade points go down as the percentages go down).
export function findScale(text) {
  const rows = [];
  const lines = [];
  for (const line of String(text || '').split(/\r?\n|<br\s*\/?>|<\/(?:p|li|tr|div|h[1-6])>/i)) {
    const clean = line.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const r = parseScaleLine(clean);
    if (r) {
      rows.push({ min: r.min, gp: r.gp });
      lines.push(r.line);
    }
  }
  const dedup = [...new Map(rows.map((r) => [r.min, r])).values()].sort((a, b) => b.min - a.min);
  const monotone = dedup.every((r, i) => i === 0 || r.gp <= dedup[i - 1].gp);
  if (dedup.length < 3 || !monotone) return null;
  return { rows: dedup, lines };
}

// Canvas grading scheme -> scale, when its names are grade points ("4.0", "3.9", …) or
// letters ("A", "A-", "B+", …; K3).
export function fromCanvasScheme(scheme) {
  const list = scheme?.grading_scheme || scheme?.data || [];
  const pointOf = (name) => (/^[0-4](\.\d)?$/.test(name) ? parseFloat(name) : LETTER_POINTS[name.toUpperCase().replace(/[−–]/g, '-')] ?? null);
  const rows = list.map((r) => ({ name: String(r.name).trim(), value: Number(r.value) })).filter((r) => pointOf(r.name) != null && Number.isFinite(r.value));
  if (rows.length < 3 || rows.length !== list.length) return null;
  const letters = rows.some((r) => !/^[0-4]/.test(r.name));
  return {
    rows: rows.map((r) => ({ min: Math.round(r.value * 10000) / 100, gp: pointOf(r.name), ...(letters ? { letter: r.name.replace(/-/g, '−') } : {}) })).sort((a, b) => b.min - a.min),
    mode: 'step',
    round: 'none',
    source: 'canvas',
    confirmed: false,
  };
}
