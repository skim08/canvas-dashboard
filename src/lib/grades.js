// Grade engine for Phase 2 (section E). Pure functions only: no DOM, no
// storage. Mirrors how Canvas computes course grades (weights, drop rules,
// extra credit), then adds grade points (UW decimal or letters, K3), GPA and projections.

// ---------- Scales (E1) ----------

// A scale: { rows: [{ min: 95, gp: 4.0 }, ...], mode: 'step' | 'linear',
//            round: 'none' | 'tenth' | 'whole', source, confirmed }

// K3: grading systems. Grades are always stored as grade points (0.0–4.0); letter
// systems just show them as letters.
export const SYSTEMS = {
  letterPM: { label: 'Letter grades with + and − (A, A−, B+, …)', credits: 3, gradTotal: 120 },
  letter: { label: 'Letter grades without + or − (A, B, C, D, F)', credits: 3, gradTotal: 120 },
  uw: { label: 'UW 4.0 decimal (4.0, 3.9, 3.8, …)', credits: 5, gradTotal: 180 },
};
export const systemOf = (g) => (SYSTEMS[g?.system] ? g.system : 'letterPM');
// The most common US cutoffs; always labeled "not from your syllabus".
const LETTER_PM = [['A', 93, 4.0], ['A−', 90, 3.7], ['B+', 87, 3.3], ['B', 83, 3.0], ['B−', 80, 2.7], ['C+', 77, 2.3], ['C', 73, 2.0], ['C−', 70, 1.7], ['D+', 67, 1.3], ['D', 63, 1.0], ['D−', 60, 0.7]];
const LETTER = [['A', 90, 4.0], ['B', 80, 3.0], ['C', 70, 2.0], ['D', 60, 1.0]];
// Letters as Canvas or a transcript writes them (A+ counts as 4.0 at most schools).
export const LETTER_POINTS = { 'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0, E: 0 };

export function scaleTemplate(system) {
  if (system === 'uw') return uwTemplate();
  const table = system === 'letter' ? LETTER : LETTER_PM;
  return { rows: table.map(([letter, min, gp]) => ({ min, gp, letter })), mode: 'step', round: 'none', source: 'template', confirmed: false };
}

// 3.7 → "A−" in a letter system; null in UW's decimal system (shown as 3.7).
export function letterOf(gp, system) {
  if (gp == null || system === 'uw') return null;
  if (gp < 0.7 - 1e-9) return 'F';
  const table = system === 'letter' ? LETTER : LETTER_PM;
  return (table.find(([, , p]) => gp >= p - 1e-9) || ['F'])[0];
}

// K3: the grade a class target means: in a letter system, the lowest letter at or
// above it (a 3.9 target needs an A); in UW's, the number itself.
export function targetLabel(target, system) {
  if (target == null) return '—';
  if (system === 'uw') return target.toFixed(1);
  const table = system === 'letter' ? LETTER : LETTER_PM;
  const hit = [...table].reverse().find(([, , gp]) => gp >= target - 1e-9);
  return hit ? hit[0] : target.toFixed(1);
}
// "an A", "an F", "a B+", "a 3.9"
export const withArticle = (label) => `${/^[AEF8]/.test(label) ? 'an' : 'a'} ${label}`;

// "A−" in letter systems, "3.7" in UW's.
export const gradeLabel = (gp, system) => (gp == null ? '—' : letterOf(gp, system) ?? gp.toFixed(1));

// What a past-quarter grade can be, best first.
export function gradeChoices(system) {
  if (system === 'uw') return [...Array.from({ length: 34 }, (_, i) => Math.round((4.0 - i * 0.1) * 10) / 10), 0];
  return [...(system === 'letter' ? LETTER : LETTER_PM).map(([, , gp]) => gp), 0];
}

// Common UW pattern: 95% = 4.0, then 0.1 lower per 1%, down to 0.7.
// Offered as a starting point only; it's labeled "not from your syllabus".
export function uwTemplate() {
  const rows = [];
  for (let i = 0; i <= 33; i++) rows.push({ min: 95 - i, gp: Math.round((4.0 - i * 0.1) * 10) / 10 });
  return { rows, mode: 'step', round: 'none', source: 'template', confirmed: false };
}

export function sortedRows(scale) {
  return [...(scale?.rows || [])].filter((r) => Number.isFinite(r.min) && Number.isFinite(r.gp)).sort((a, b) => b.min - a.min);
}

function applyRounding(pct, round) {
  if (round === 'whole') return Math.round(pct + 1e-9);
  if (round === 'tenth') return Math.round(pct * 10 + 1e-9) / 10;
  return pct;
}

const floorTenth = (x) => Math.floor(x * 10 + 1e-9) / 10;

// % -> grade point. Below 0.7 is 0.0 (UW's rule, and a D− is 0.7 on letter scales).
export function gradeFromPercent(scale, pct) {
  const rows = sortedRows(scale);
  if (pct == null || !rows.length) return null;
  const p = applyRounding(pct, scale.round);
  let gp = 0;
  if (p >= rows[0].min) gp = rows[0].gp;
  else if (scale.mode === 'linear') {
    for (let i = 1; i < rows.length; i++) {
      const hi = rows[i - 1];
      const lo = rows[i];
      if (p >= lo.min) {
        gp = floorTenth(lo.gp + ((p - lo.min) / (hi.min - lo.min)) * (hi.gp - lo.gp));
        break;
      }
    }
  } else {
    gp = rows.find((r) => p >= r.min)?.gp ?? 0;
  }
  gp = Math.round(gp * 10) / 10;
  return gp < 0.7 ? 0 : gp;
}

// Lowest % that earns at least `gp`, or null if the scale never reaches it.
export function percentForGrade(scale, gp) {
  const rows = sortedRows(scale);
  if (!rows.length || gradeFromPercent(scale, 1000) < gp - 1e-9) return null;
  let lo = -1;
  let hi = Math.max(100, rows[0].min);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (gradeFromPercent(scale, mid) >= gp - 1e-9) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 100 - 1e-6) / 100;
}

// Problems that make a scale unusable or suspicious, in plain language.
export function scaleProblems(scale) {
  const rows = sortedRows(scale);
  const out = [];
  if (!rows.length) return ['Add at least one row.'];
  if (rows.some((r) => r.gp < 0 || r.gp > 4)) out.push('Grade points must be between 0.0 and 4.0.');
  if (rows.some((r) => Math.round(r.gp * 10) !== r.gp * 10 && Math.abs(Math.round(r.gp * 10) - r.gp * 10) > 1e-6)) out.push('Grade points go in steps of 0.1.');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].gp > rows[i - 1].gp) out.push(`${rows[i].min}% gives a higher grade than ${rows[i - 1].min}%.`);
    if (rows[i].min === rows[i - 1].min) out.push(`${rows[i].min}% appears twice.`);
  }
  return out;
}

// ---------- Course model ----------

// Turn an app item into what the engine needs. Returns null if it never counts.
export function engineItem(item, now, cfg = {}) {
  if (item.source !== 'canvas' || item.kind !== 'assignment' || item.omit) return null;
  if ((item.points ?? 0) <= 0 && !(item.sub?.score > 0)) return null; // ungraded 0-point items never count
  const sub = item.sub || {};
  const extraCredit = !!cfg.extraCredit?.[item.canvasId] || (item.points ?? 0) === 0;
  const possible = extraCredit ? 0 : item.points ?? 0;
  if (sub.state === 'excused') return { id: item.canvasId, groupId: item.groupId, possible, score: null, state: 'excused', item };
  const graded = sub.state === 'graded' && sub.score != null;
  let state;
  if (graded) state = 'graded';
  else if (sub.state === 'submitted') state = 'pending';
  else {
    const past = item.dueAt && new Date(item.dueAt).getTime() < now;
    const locked = item.lockAt && new Date(item.lockAt).getTime() <= now;
    if (past && !item.expectsSubmission) state = 'pending'; // taken in person, waiting for a score
    else if (locked) state = 'closed'; // can't be submitted any more: counts as 0
    else state = 'open';
  }
  return { id: item.canvasId, groupId: item.groupId, possible, score: graded ? sub.score : null, state, extraCredit, item };
}

// Build the engine's view of one course from Canvas data + your overrides.
// cfg: { weighting: 'auto'|'weighted'|'points', weights: {groupId: %}, drops: {groupId: {lowest, highest}}, extraCredit: {assignmentId: true}, manual: {categoryId: %}, auto }
// profile: a built-in syllabus setup (E33), used unless cfg.auto === false.
export function buildCourse(course, items, now, cfg = {}, profile = null) {
  const useProfile = profile?.model && cfg.auto !== false;
  if (useProfile && profile.model.kind !== 'outOf') return buildFromProfile(course, items, now, cfg, profile);
  const built = buildStandard(course, items, now, cfg);
  // E29: graded out of a fixed total, from the syllabus or the total you typed in (E34).
  const outOf = cfg.outOf > 0 ? cfg.outOf : useProfile ? profile.model.outOf : null;
  if (outOf) {
    built.kind = 'outOf';
    built.outOf = outOf;
    built.weighted = false;
    addUnposted(built);
  }
  built.fallbackRate = overallRate(built.items);
  return built;
}

// E35: points the class total promises that Canvas hasn't posted yet (some classes post
// each assignment the week it's due) are work still to come, not zeros. They count as
// one open item: at your pace in projections, full marks at best, nothing at worst.
function addUnposted(built) {
  const posted = built.items.filter((e) => !e.extraCredit && e.state !== 'excused').reduce((s, e) => s + (e.possible || 0), 0);
  const left = Math.round((built.outOf - posted) * 100) / 100;
  if (!(left > 0)) return;
  built.groups.push({ id: '__unposted', name: 'Not posted yet', weight: 0, dropLowest: 0, dropHighest: 0, neverDrop: new Set() });
  built.items.push({ id: '__unposted', groupId: '__unposted', possible: left, score: null, state: 'open', unposted: true, item: null });
  built.unposted = left;
}

function overallRate(engineItems) {
  const graded = engineItems.filter((e) => e.state === 'graded' && e.possible > 0);
  const p = graded.reduce((s, e) => s + e.possible, 0);
  return p ? graded.reduce((s, e) => s + e.score, 0) / p : 1;
}

// E30/E31/E33: categories come from the syllabus; assignments are sorted into them by name.
function buildFromProfile(course, items, now, cfg, profile) {
  const m = profile.model;
  const cats =
    m.kind === 'selfWeighted'
      ? [...m.completion.map((c) => ({ ...c, role: 'completion' })), ...m.exams.map((e) => ({ ...e, role: 'exam' }))]
      : m.categories.map((c) => ({ ...c, role: 'weighted' }));
  const all = items.filter((i) => i.courseId === course.id).map((i) => engineItem(i, now, cfg)).filter(Boolean);
  const engineItems = [];
  const unmatched = [];
  const test = (re, s) => !!re && re.test(s || '');
  for (const e of all) {
    const name = e.item.title;
    const group = e.item.groupName;
    const cat =
      cats.find((c) => c.priority && test(c.match, name)) ||
      cats.find((c) => !c.manual && test(c.group, group)) ||
      cats.find((c) => !c.manual && test(c.match, name));
    if (cat) engineItems.push({ ...e, groupId: cat.id });
    else unmatched.push(e);
  }
  for (const c of cats.filter((c) => c.manual)) {
    // E30: a category Canvas doesn't track, at an assumed score you can change.
    const score = cfg.manual?.[c.id] ?? c.manual.assume;
    engineItems.push({ id: `manual:${c.id}`, groupId: c.id, possible: 100, score, state: 'graded', manual: true, item: null });
  }
  const groups = cats.map((c) => ({
    id: c.id,
    name: c.name,
    weight: c.weight ?? 0,
    dropLowest: c.dropLowest || 0,
    dropHighest: 0,
    dropMinCount: c.dropMinCount || 0,
    neverDrop: new Set(),
    role: c.role,
    max: c.max,
    share: c.share,
    manual: !!c.manual,
    note: c.note || null,
  }));
  return {
    id: course.id,
    kind: m.kind === 'selfWeighted' ? 'selfWeighted' : 'standard',
    weighted: m.kind === 'weighted',
    groups,
    items: engineItems,
    unmatched,
    fallbackRate: overallRate(engineItems.filter((e) => !e.manual)),
  };
}

function buildStandard(course, items, now, cfg) {
  const groups = (course.groups || []).map((g) => {
    const own = cfg.drops?.[g.id];
    return {
      id: g.id,
      name: g.name,
      weight: cfg.weights?.[g.id] ?? g.weight ?? 0,
      dropLowest: own?.lowest ?? g.rules?.dropLowest ?? 0,
      dropHighest: own?.highest ?? g.rules?.dropHighest ?? 0,
      neverDrop: new Set(g.rules?.neverDrop || []),
    };
  });
  const engineItems = items.filter((i) => i.courseId === course.id).map((i) => engineItem(i, now, cfg)).filter(Boolean);
  // Items whose group Canvas didn't return still count, in an "Other" bucket.
  const known = new Set(groups.map((g) => g.id));
  if (engineItems.some((e) => !known.has(e.groupId))) groups.push({ id: '__other', name: 'Other', weight: 0, dropLowest: 0, dropHighest: 0, neverDrop: new Set() });
  for (const e of engineItems) if (!known.has(e.groupId)) e.groupId = '__other';
  const mode = cfg.weighting && cfg.weighting !== 'auto' ? cfg.weighting : course.weighted ? 'weighted' : 'points';
  return { id: course.id, kind: 'standard', groups, items: engineItems, unmatched: [], weighted: mode === 'weighted' };
}

// Courses whose "current grade" is really a projection (E29, E31).
export const paceBased = (course) => course.kind === 'outOf' || course.kind === 'selfWeighted';

// ---------- Drop rules (E4) ----------

function ratio(list) {
  const p = list.reduce((s, x) => s + x.p, 0);
  return p > 0 ? list.reduce((s, x) => s + x.s, 0) / p : null;
}

function combos(n, k, cap = 20000) {
  const out = [];
  const pick = (start, acc) => {
    if (out.length > cap) return;
    if (acc.length === k) return void out.push(acc.slice());
    for (let i = start; i < n; i++) {
      acc.push(i);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out.length > cap ? null : out;
}

// Choose which k items to drop. Lowest: keep the best possible group %.
// Highest: drop the k that lower it most. Never-drop items stay.
function chooseDrops(entries, k, wantHigh) {
  const cand = entries.map((e, i) => ({ ...e, i })).filter((e) => !e.never && e.p > 0);
  k = Math.min(k, cand.length, entries.length - 1);
  if (k <= 0) return [];
  const all = combos(cand.length, k);
  const score = (dropIdx) => {
    const set = new Set(dropIdx.map((j) => cand[j].i));
    return ratio(entries.filter((_, i) => !set.has(i))) ?? 0;
  };
  if (all) {
    let best = null;
    let bestVal = wantHigh ? Infinity : -Infinity;
    for (const c of all) {
      const v = score(c);
      if (wantHigh ? v < bestVal : v > bestVal) {
        bestVal = v;
        best = c;
      }
    }
    return best.map((j) => cand[j].i);
  }
  // Too many combinations: greedy by item percentage.
  return cand
    .sort((a, b) => (wantHigh ? b.s / b.p - a.s / a.p : a.s / a.p - b.s / b.p))
    .slice(0, k)
    .map((e) => e.i);
}

// ---------- Scoring ----------

// Score a course where `valueOf(engineItem)` gives each item's score, or null to leave it out.
export function scoreCourse(course, valueOf) {
  const groups = course.groups.map((g) => {
    let entries = course.items
      .filter((e) => e.groupId === g.id && e.state !== 'excused')
      .map((e) => ({ id: e.id, s: valueOf(e), p: e.possible, never: g.neverDrop.has(e.id) }))
      .filter((x) => x.s != null);
    let dropped = [];
    const canDrop = !g.dropMinCount || entries.length >= g.dropMinCount; // E30: e.g. only once all 3 quizzes are graded
    if (g.dropLowest && canDrop) {
      const idx = chooseDrops(entries, g.dropLowest, false);
      dropped = idx.map((i) => entries[i].id);
      entries = entries.filter((_, i) => !idx.includes(i));
    }
    if (g.dropHighest) {
      const idx = chooseDrops(entries, g.dropHighest, true);
      dropped = dropped.concat(idx.map((i) => entries[i].id));
      entries = entries.filter((_, i) => !idx.includes(i));
    }
    const earned = entries.reduce((s, x) => s + x.s, 0);
    const possible = entries.reduce((s, x) => s + x.p, 0);
    return { id: g.id, name: g.name, weight: g.weight, role: g.role, max: g.max, share: g.share, manual: g.manual, note: g.note, earned, possible, pct: possible > 0 ? (earned / possible) * 100 : null, dropped, count: entries.length };
  });

  let pct = null;
  if (course.kind === 'outOf') {
    // E29: points earned ÷ the class total. Extra points still count.
    const earned = groups.reduce((s, g) => s + g.earned, 0);
    pct = (earned / course.outOf) * 100;
    for (const g of groups) g.contribution = (g.earned / course.outOf) * 100;
    return { pct, groups };
  }
  if (course.kind === 'selfWeighted') {
    // E31: completion categories earn up to `max`% each; exams split the rest by share.
    let fixed = 0;
    for (const g of groups.filter((x) => x.role === 'completion')) {
      const c = g.possible > 0 ? g.earned / g.possible : 0; // no completed credit yet = 0
      g.contribution = g.max * Math.min(1, c);
      fixed += g.contribution;
    }
    const exams = groups.filter((x) => x.role === 'exam' && x.possible > 0);
    const shareSum = exams.reduce((s, g) => s + g.share, 0);
    const rest = 100 - fixed;
    let examRate = shareSum ? exams.reduce((s, g) => s + g.share * (g.earned / g.possible), 0) / shareSum : null;
    if (examRate == null) examRate = course.fallbackRate ?? null; // no exam scores yet: assume your average so far
    for (const g of groups.filter((x) => x.role === 'exam')) g.contribution = g.possible > 0 && shareSum ? (rest * g.share * (g.earned / g.possible)) / shareSum : 0;
    for (const g of groups.filter((x) => x.role === 'exam')) g.weight = shareSum ? (rest * g.share) / 7 : 0;
    pct = examRate == null ? null : fixed + rest * examRate;
    return { pct, groups };
  }
  if (course.weighted) {
    const active = groups.filter((g) => g.possible > 0 && g.weight > 0);
    const totalW = active.reduce((s, g) => s + g.weight, 0);
    if (totalW > 0) pct = active.reduce((s, g) => s + g.weight * (g.earned / g.possible), 0) / totalW * 100;
    for (const g of groups) g.contribution = g.possible > 0 && g.weight > 0 && totalW > 0 ? (g.weight / totalW) * (g.earned / g.possible) * 100 : 0;
  } else {
    const earned = groups.reduce((s, g) => s + g.earned, 0);
    const possible = groups.reduce((s, g) => s + g.possible, 0);
    if (possible > 0) pct = (earned / possible) * 100;
    for (const g of groups) g.contribution = possible > 0 ? (g.earned / possible) * 100 : 0;
  }
  return { pct, groups };
}

// Current grade: graded work only (how Canvas shows it). What-if scores win.
export function current(course, whatIf = {}) {
  if (paceBased(course)) {
    // For these, "graded work only" isn't a grade: show where your current pace lands.
    const rates = gradedRates(course, whatIf);
    return project(course, (e) => e.possible * (rates[e.groupId] ?? course.fallbackRate ?? 1), whatIf);
  }
  return scoreCourse(course, (e) => (whatIf[e.id] != null ? whatIf[e.id] : e.state === 'graded' ? e.score : null));
}

// Your average so far in each category (raw, before drops). Falls back to your overall average.
function gradedRates(course, whatIf = {}) {
  const out = {};
  const all = course.items.filter((e) => e.possible > 0 && (whatIf[e.id] != null || e.state === 'graded'));
  const total = all.reduce((s, e) => s + e.possible, 0);
  const overall = total ? all.reduce((s, e) => s + (whatIf[e.id] ?? e.score), 0) / total : course.fallbackRate ?? 1;
  for (const g of course.groups) {
    const list = all.filter((e) => e.groupId === g.id && !e.manual);
    const p = list.reduce((s, e) => s + e.possible, 0);
    out[g.id] = p ? list.reduce((s, e) => s + (whatIf[e.id] ?? e.score), 0) / p : overall;
  }
  return out;
}

// Fill remaining work with a rule. `fill(e)` returns the score for open/pending items.
export function project(course, fill, whatIf = {}) {
  return scoreCourse(course, (e) => {
    if (whatIf[e.id] != null) return whatIf[e.id];
    if (e.state === 'graded') return e.score;
    if (e.state === 'closed') return 0;
    return fill(e);
  });
}

function groupRates(course, whatIf) {
  if (paceBased(course)) return gradedRates(course, whatIf);
  const cur = current(course, whatIf);
  const overall = cur.pct != null ? cur.pct / 100 : 1;
  return Object.fromEntries(cur.groups.map((g) => [g.id, g.pct != null ? g.pct / 100 : overall]));
}

// E12: best / worst / likely.
export function range(course, whatIf = {}) {
  const rates = groupRates(course, whatIf);
  return {
    best: project(course, (e) => e.possible, whatIf).pct,
    worst: project(course, () => 0, whatIf).pct,
    likely: project(course, (e) => e.possible * (rates[e.groupId] ?? 1), whatIf).pct,
  };
}

const isRemaining = (e, whatIf) => whatIf[e.id] == null && (e.state === 'open' || e.state === 'pending');

// E11: the average you need on open work to reach `threshold`%.
// Pending work (turned in, not graded) is assumed to score at your current rate.
export function required(course, threshold, whatIf = {}) {
  const open = course.items.filter((e) => isRemaining(e, whatIf) && e.state === 'open' && e.possible > 0);
  const pending = course.items.filter((e) => isRemaining(e, whatIf) && e.state === 'pending');
  const rates = groupRates(course, whatIf);
  const at = (x) => project(course, (e) => (e.state === 'pending' ? e.possible * (rates[e.groupId] ?? 1) : e.possible * x), whatIf).pct;
  if (threshold == null) return { status: 'no-target' };
  if (!open.length) return { status: 'none', pct: at(0), pending: pending.length };
  const worst = at(0);
  const best = at(1);
  if (worst != null && worst >= threshold - 1e-9) return { status: 'secured', pending: pending.length };
  if (best == null || best < threshold - 1e-9) return { status: 'unreachable', best, pending: pending.length };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) >= threshold - 1e-9) hi = mid;
    else lo = mid;
  }
  return { status: 'needed', need: Math.ceil(hi * 1000 - 1e-6) / 10, openCount: open.length, pending: pending.length };
}

// Share of the final course grade one item is worth (0–1). Used by E13, E14, E18, E21.
// Measured directly: the grade with this item at full marks minus the grade with
// it at zero, everything else held at your likely scores. Works for every grading
// model (weights, drops, fixed-point totals, self-weighted formulas).
export function itemShare(course, e) {
  if (!e || e.manual || !(e.possible > 0)) return 0;
  const rates = groupRates(course, {});
  const base = (x) => {
    if (x.state === 'graded') return x.score;
    if (x.state === 'closed') return 0;
    return x.possible * (rates[x.groupId] ?? 1);
  };
  const at = (v) => scoreCourse(course, (x) => (x.state === 'excused' ? null : x === e || x.id === e.id ? v : base(x))).pct;
  const hi = at(e.possible);
  const lo = at(0);
  return hi == null || lo == null ? 0 : Math.max(0, (hi - lo) / 100);
}

// E13: points still up for grabs, by category.
export function available(course, whatIf = {}) {
  const open = course.items.filter((e) => isRemaining(e, whatIf) && e.state === 'open' && e.possible > 0);
  const byGroup = course.groups
    .map((g) => {
      const list = open.filter((e) => e.groupId === g.id);
      return { id: g.id, name: g.name, points: list.reduce((s, e) => s + e.possible, 0), share: list.reduce((s, e) => s + itemShare(course, e), 0) };
    })
    .filter((g) => g.points > 0);
  return { points: byGroup.reduce((s, g) => s + g.points, 0), share: byGroup.reduce((s, g) => s + g.share, 0), byGroup };
}

// E22: submitted but not graded.
export function pending(course) {
  const list = course.items.filter((e) => e.state === 'pending');
  return { items: list, share: list.reduce((s, e) => s + itemShare(course, e), 0) };
}

// E18: graded work where you lost points, by how much it cost your course grade.
export function pointsLost(course) {
  return course.items
    .filter((e) => !e.manual && e.state === 'graded' && e.possible > 0 && e.score < e.possible) // built-in assumptions aren't assignments
    .map((e) => ({ e, lost: e.possible - e.score, cost: itemShare(course, e) * ((e.possible - e.score) / e.possible) * 100 }))
    .sort((a, b) => b.cost - a.cost);
}

// ---------- GPA (E8, E9, E10, E26–E28) ----------

export const NON_NUMERIC = ['S', 'NS', 'CR', 'NC', 'P', 'NP', 'W', 'I', 'HW', 'RD', 'N', 'X'];
export const EARNS_CREDIT = (g) => (typeof g === 'number' ? g >= 0.7 : g === 'S' || g === 'CR' || g === 'P');

// entries: [{ credits, gp }] with numeric gp. Returns null when there's nothing to average.
export function gpaOf(entries) {
  const list = entries.filter((e) => typeof e.gp === 'number' && e.credits > 0);
  const cr = list.reduce((s, e) => s + e.credits, 0);
  return cr ? list.reduce((s, e) => s + e.gp * e.credits, 0) / cr : null;
}

// Past courses that count toward GPA (numeric, and the counting attempt if repeated).
export function pastGpaEntries(pastQuarters) {
  return (pastQuarters || []).flatMap((q) => (q.courses || []).filter((c) => typeof c.grade === 'number' && c.counts !== false).map((c) => ({ credits: c.credits, gp: c.grade, name: c.name, quarter: q.name })));
}

export function cumulative(pastQuarters, currentEntries) {
  const past = pastGpaEntries(pastQuarters);
  return { official: gpaOf(past), projected: gpaOf([...past, ...currentEntries]) };
}

// E10: the course costing you the most GPA against your target.
export function biggestDrag(entries, target) {
  let worst = null;
  for (const e of entries) {
    const cost = e.credits * (target - e.gp);
    if (cost > 1e-9 && (!worst || cost > worst.cost)) worst = { ...e, cost };
  }
  return worst;
}

// E26: GPA per quarter and running cumulative.
export function quarterHistory(pastQuarters, currentQuarter) {
  const rows = [];
  const running = [];
  for (const q of pastQuarters || []) {
    const entries = (q.courses || []).filter((c) => typeof c.grade === 'number' && c.counts !== false).map((c) => ({ credits: c.credits, gp: c.grade }));
    running.push(...entries);
    rows.push({ name: q.name, gpa: gpaOf(entries), cumulative: gpaOf(running), projected: false });
  }
  if (currentQuarter && currentQuarter.entries.length) {
    running.push(...currentQuarter.entries);
    rows.push({ name: currentQuarter.name, gpa: gpaOf(currentQuarter.entries), cumulative: gpaOf(running), projected: true });
  }
  return rows;
}

// E27
export function credits(pastQuarters, inProgress) {
  const all = (pastQuarters || []).flatMap((q) => q.courses || []);
  const counting = all.filter((c) => c.counts !== false);
  return {
    completed: counting.filter((c) => EARNS_CREDIT(c.grade)).reduce((s, c) => s + (c.credits || 0), 0),
    gpaCredits: counting.filter((c) => typeof c.grade === 'number').reduce((s, c) => s + (c.credits || 0), 0),
    inProgress,
  };
}

export function deptOf(name) {
  const m = String(name || '').match(/^\s*([A-Z][A-Z&]*(?: [A-Z&]+)*)[\s-]?\d{2,4}/);
  return m ? m[1] : null;
}

// E28: credit-weighted average grade by department.
export function subjects(entries) {
  const map = new Map();
  for (const e of entries) {
    const d = deptOf(e.name);
    if (!d || typeof e.gp !== 'number' || !(e.credits > 0)) continue;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(e);
  }
  return [...map.entries()].map(([dept, list]) => ({ dept, gpa: gpaOf(list), count: list.length, credits: list.reduce((s, e) => s + e.credits, 0) })).sort((a, b) => b.gpa - a.gpa || b.credits - a.credits);
}
