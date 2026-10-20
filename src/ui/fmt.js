// Number formatting for grades: one place, so every screen agrees.

import { state } from './store.js';
import { letterOf, systemOf, targetLabel, withArticle } from '../lib/grades.js';

export const pct = (p, digits = 1) => (p == null || Number.isNaN(p) ? '—' : `${p.toFixed(digits)}%`);
// K3: letters in a letter-grade system ("A−"), decimals in UW's (3.7).
export const gp = (g) => (g == null ? '—' : letterOf(g, systemOf(state.grades)) ?? g.toFixed(1));
export const gpa = (x) => (x == null ? '—' : x.toFixed(2));
export const signed = (x, digits = 2) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(digits)}`);
export const pts = (x) => (x == null ? '—' : Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0$/, ''));

// "0.04 below 3.9" / "0.02 above 3.9" / "right at 3.9"
export function gapText(gap, target) {
  if (gap == null) return '';
  if (Math.abs(gap) < 0.005) return `right at ${target.toFixed(1)}`;
  return `${Math.abs(gap).toFixed(2)} ${gap > 0 ? 'above' : 'below'} ${target.toFixed(1)}`;
}

// E11 in one plain sentence.
export function needText(c) {
  const r = c.required;
  if (c.excluded && c.excluded !== 'Credits not set') return null;
  if (!r || r.status === 'no-target') return null;
  const t = targetLabel(c.target, systemOf(state.grades));
  if (r.status === 'secured') return `${t} is locked in, even with 0% on what’s left`;
  if (r.status === 'none') return c.noGradesYet ? 'Nothing graded on Canvas yet' : 'No graded work left'; // K10: classes with no assignments
  if (r.status === 'unreachable') return `${t} is out of reach. Best possible: ${r.best != null ? r.best.toFixed(1) + '%' : '—'}`;
  return `Need ${r.need.toFixed(1)}% on what’s left for ${withArticle(t)}`;
}

// E29/E31: what to show in a class's score column. Pace-based classes say so.
export function scoreText(c) {
  if (c.noGradesYet) return 'N/A'; // nothing graded yet
  if (c.paceBased && c.model.kind === 'outOf' && c.pct != null) return `${Math.round((c.pct / 100) * c.model.outOf)} pts`;
  return pct(c.pct);
}
