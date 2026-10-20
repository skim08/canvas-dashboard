// Combines the grade engine with your grade settings into everything the
// Grades screens show. Pure: no DOM, no storage.

import * as G from './grades.js';
import { courseRole } from './model.js';
import { findProfile } from './profiles.js';
import { findScale } from './scaleParse.js';
import { termWord } from './term.js';

export const DEFAULT_GRADES = {
  targetGpa: 3.9, // E6
  recentDays: 14, // E24
  creditsGoal: null, // E27 (null = the system's norm: 180 for UW quarters, 120 for semesters)
  courses: {}, // courseId -> { scale, credits, grading, target, weighting, weights, drops, extraCredit }
  past: [], // E5: [{ id, name, courses: [{ id, name, credits, grade, counts }] }]
  whatIfOn: false, // E16
  whatIf: {}, // assignmentId -> hypothetical score
  scenarios: [], // [{ id, name, scores }]
  regrades: {}, // E23: assignmentId -> { note, status: 'ask' | 'asked' | 'resolved', at }
  seen: {}, // E24: assignmentId -> gradedAt you've seen
  useCanvas: true, // E32: show Canvas's own % when it's reliable
  system: 'letterPM', // K3: 'letterPM' | 'letter' | 'uw' (people from before K3 keep 'uw')
  defaultCredits: null, // K3: usual credits per class (null = the system's norm)
};

export const DEFAULT_CREDITS = 5; // most UW classes; always labeled "assumed" (E33)
// K3: your usual credits per class: yours, or the norm for your grading system.
export const usualCredits = (g) => g?.defaultCredits ?? G.SYSTEMS[G.systemOf(g)].credits;

export function gradesWithDefaults(g) {
  const out = { ...DEFAULT_GRADES, ...(g || {}) };
  for (const k of ['courses', 'whatIf', 'regrades', 'seen']) out[k] = { ...(g?.[k] || {}) };
  for (const k of ['past', 'scenarios']) out[k] = [...(g?.[k] || [])];
  return out;
}

// E33: the scale in use, in order of trust. Every course gets one; guesses are labeled.
//   yours → your syllabus setup (built in) → instructor's Canvas scheme → found in the Canvas syllabus → common UW scale
export function scaleFor(course, cfg, profile = null, system = 'uw') {
  if (cfg?.scale?.rows?.length) return { scale: cfg.scale, source: cfg.scale.source || 'yours', note: null };
  if (profile?.scale) return { scale: profile.scale, source: 'profile', note: null };
  if (course.canvasScale) return { scale: course.canvasScale, source: 'canvas', note: null };
  if (!profile) {
    const found = course.syllabusHtml ? findScale(course.syllabusHtml) : null;
    if (found) return { scale: { rows: found.rows, mode: 'step', round: 'none' }, source: 'syllabus-auto', note: 'Found in the course syllabus on Canvas.' };
  }
  const what = system === 'uw' ? 'the common UW scale (95% = 4.0, 0.1 less per 1%)' : system === 'letter' ? 'a common letter scale (90% A, 80% B, 70% C, 60% D)' : 'a common letter scale (93% A, 90% A−, 87% B+, and so on)';
  return { scale: G.scaleTemplate(system), source: 'estimate', note: profile?.scaleNote || `No scale found, so this uses ${what} as an estimate.` };
}

// Why a course isn't in GPA, or null if it is. Only S/NS and CR/NC classes are left out now.
export function exclusionReason(course, cfg) {
  if (cfg?.grading && cfg.grading !== 'numeric') return cfg.grading === 'sn' ? 'Graded S/NS' : cfg.grading === 'pnp' ? 'Graded P/NP' : 'Graded CR/NC';
  return null;
}

// E32: can Canvas's own current % be trusted for this class?
export function canvasReliable(course, cfg, profileActive) {
  if (profileActive) return false; // the syllabus has rules Canvas can't represent
  if (course.score == null || course.hideTotals) return false;
  const has = (o) => o && Object.keys(o).length > 0;
  if (has(cfg.weights) || has(cfg.drops) || has(cfg.extraCredit)) return false;
  if (cfg.weighting && cfg.weighting !== 'auto') return false;
  return true;
}

export function summarize({ cache, items, settings, grades, now }) {
  const g = gradesWithDefaults(grades);
  const whatIf = g.whatIfOn ? g.whatIf : {};
  const allCourses = (cache?.courses || []).filter((c) => !c.unavailable && !settings.courses[c.id]?.hidden);
  const core = allCourses.filter((c) => courseRole(c, settings) === 'core');

  const courses = core.map((course) => {
    const cfg = g.courses[course.id] || {};
    const profile = findProfile(course);
    const profileActive = !!profile && cfg.auto !== false;
    const model = G.buildCourse(course, items, now, cfg, profileActive ? profile : null);
    const { scale, source: scaleSource, note: scaleNote } = scaleFor(course, cfg, profileActive ? profile : null, G.systemOf(g));
    const credits = cfg.credits ?? (profileActive ? profile.credits : null) ?? usualCredits(g);
    const creditsAssumed = cfg.credits == null && !(profileActive && profile.credits);
    const target = cfg.target ?? g.targetGpa;
    const threshold = scale ? G.percentForGrade(scale, target) : null;
    const engineCur = G.current(model, whatIf);
    const real = G.current(model);
    // E32: Canvas's own % when it's reliable; projections always use the engine.
    const useCanvas = g.useCanvas !== false && !g.whatIfOn && canvasReliable(course, cfg, profileActive);
    const cur = useCanvas ? { ...engineCur, pct: course.score } : engineCur;
    const estimates = [];
    if (scaleSource === 'estimate') estimates.push('Grading scale estimated');
    if (creditsAssumed) estimates.push(`Credits assumed (${usualCredits(g)})`);
    if (model.unmatched?.length) estimates.push(`${model.unmatched.length} assignment${model.unmatched.length === 1 ? '' : 's'} not sorted`);
    const rng = G.range(model, whatIf);
    const gp = (p) => (scale && p != null ? G.gradeFromPercent(scale, p) : null);
    const req = G.required(model, threshold, whatIf);
    const likelyGp = gp(rng.likely);
    const curGp = gp(cur.pct);
    // E15: below target now, or heading there.
    // No grade until Canvas has graded something (or you're trying what-if scores): built-in
    // assumptions like ACCTG's professionalism or an on-pace estimate alone would show 100%.
    const noGradesYet = !items.some((i) => i.courseId === course.id && i.source === 'canvas' && i.kind === 'assignment' && i.sub?.state === 'graded' && (i.sub.score != null || i.sub.grade != null)) && !(g.whatIfOn && items.some((i) => i.courseId === course.id && whatIf[i.canvasId] != null));
    const atRisk = !noGradesYet && threshold != null && cur.pct != null && (curGp < target - 1e-9 || (likelyGp != null && likelyGp < target - 1e-9));
    return {
      course,
      cfg,
      model,
      scale,
      scaleConfirmed: !!cfg.scale?.confirmed || scaleSource === 'profile',
      scaleSource,
      scaleNote,
      profile: profileActive ? profile : null,
      profileAvailable: profile,
      pctSource: useCanvas ? 'canvas' : 'dashboard',
      paceBased: G.paceBased(model),
      estimates,
      unmatched: model.unmatched || [],
      credits,
      creditsAssumed,
      grading: cfg.grading || 'numeric',
      target,
      threshold,
      noGradesYet,
      pct: noGradesYet ? null : cur.pct,
      realPct: noGradesYet ? null : real.pct,
      groups: cur.groups,
      gp: noGradesYet ? null : curGp,
      canvasPct: course.score,
      mismatch: !profileActive && !g.whatIfOn && course.score != null && real.pct != null && Math.abs(course.score - real.pct) > 0.5,
      range: { ...rng, bestGp: gp(rng.best), worstGp: gp(rng.worst), likelyGp },
      required: req,
      available: G.available(model, whatIf),
      pending: G.pending(model),
      lost: G.pointsLost(model),
      atRisk,
      excluded: exclusionReason(course, cfg),
    };
  });

  const counted = courses.filter((c) => !c.excluded && c.gp != null);
  const entries = counted.map((c) => ({ credits: c.credits, gp: c.gp, name: c.course.autoNick, id: c.course.id }));
  const rangeEntries = (key) => counted.map((c) => ({ credits: c.credits, gp: c.range[key] ?? c.gp }));
  const quarter = G.gpaOf(entries);
  const cum = G.cumulative(g.past, entries);
  const totalCredits = counted.reduce((s, c) => s + c.credits, 0);

  // E14: upcoming work ranked by GPA impact.
  const impact = courses
    .flatMap((c) =>
      c.model.items
        .filter((e) => e.state === 'open' && e.possible > 0 && !whatIf[e.id])
        .map((e) => {
          const share = G.itemShare(c.model, e);
          return { c, e, share, impact: share * (totalCredits && c.credits ? c.credits / totalCredits : 0) };
        })
    )
    .filter((x) => x.share > 0)
    .sort((a, b) => b.impact - a.impact || b.share - a.share);

  // E18 across courses
  const lost = courses.flatMap((c) => c.lost.map((x) => ({ ...x, c }))).sort((a, b) => b.cost - a.cost);

  // E21
  const coreIds = new Set(core.map((c) => c.id));
  const byId = Object.fromEntries(courses.map((c) => [c.course.id, c]));
  const shareOf = (i) => {
    const c = byId[i.courseId];
    const e = c?.model.items.find((x) => x.id === i.canvasId);
    return c && e ? G.itemShare(c.model, e) : 0;
  };
  const mine = items.filter((i) => i.source === 'canvas' && i.kind === 'assignment' && coreIds.has(i.courseId));
  const missing = mine.filter((i) => i.sub?.missing && i.sub.state !== 'excused' && i.sub.state !== 'graded').map((i) => ({ i, cost: shareOf(i) * 100 }));
  const late = mine.filter((i) => i.sub?.late).map((i) => ({ i, deducted: i.sub.pointsDeducted }));
  const excused = mine.filter((i) => i.sub?.state === 'excused').map((i) => ({ i }));

  // E24
  const since = now - g.recentDays * 86400000;
  const recent = mine
    .filter((i) => i.sub?.state === 'graded' && i.sub.gradedAt && new Date(i.sub.gradedAt).getTime() >= since)
    .sort((a, b) => new Date(b.sub.gradedAt) - new Date(a.sub.gradedAt))
    .map((i) => ({ i, unseen: g.seen[i.canvasId] !== i.sub.gradedAt }));

  return {
    g,
    whatIfOn: g.whatIfOn,
    courses,
    quarter: {
      gpa: quarter,
      entries,
      range: { best: G.gpaOf(rangeEntries('bestGp')), likely: G.gpaOf(rangeEntries('likelyGp')), worst: G.gpaOf(rangeEntries('worstGp')) },
      gap: quarter != null ? quarter - g.targetGpa : null,
      drag: G.biggestDrag(entries, g.targetGpa),
    },
    cumulative: {
      ...cum,
      gap: cum.projected != null ? cum.projected - g.targetGpa : null,
      range: {
        best: G.cumulative(g.past, rangeEntries('bestGp')).projected,
        likely: G.cumulative(g.past, rangeEntries('likelyGp')).projected,
        worst: G.cumulative(g.past, rangeEntries('worstGp')).projected,
      },
    },
    needsSetup: [],
    estimated: courses.filter((c) => c.estimates.length),
    atRisk: courses.filter((c) => c.atRisk),
    impact,
    lost,
    missing,
    late,
    excused,
    recent,
    regrades: Object.entries(g.regrades).map(([id, r]) => ({ id, ...r, i: mine.find((x) => x.canvasId === id) })).filter((r) => r.i),
    credits: G.credits(g.past, courses.filter((c) => c.credits > 0).reduce((s, c) => s + c.credits, 0)),
    history: G.quarterHistory(g.past, { name: cache?.courses?.[0]?.term || `This ${termWord(settings, cache?.courses)}`, entries }),
    subjects: G.subjects([...G.pastGpaEntries(g.past), ...entries]),
    system: G.systemOf(g), // K3: how grades are written
    termWord: termWord(settings, cache?.courses), // K4
  };
}

// E1: % needed for each grade from target down, for the scale editor preview.
export function describeScale(scale) {
  return G.sortedRows(scale).map((r) => `${r.min}% → ${r.gp.toFixed(1)}`);
}
