// Every change to your grade settings (Phase 2) goes through here.

import { term } from './term.js';
import { state, updateGrades } from './store.js';
import { toast } from './actions.js';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// E1–E4, E6: per-course setup
export function setCourseCfg(courseId, patch) {
  return updateGrades((g) => {
    g.courses[courseId] = { ...(g.courses[courseId] || {}), ...patch };
  });
}
export function setCourseNested(courseId, key, id, value) {
  return updateGrades((g) => {
    const c = (g.courses[courseId] ||= {});
    c[key] = { ...(c[key] || {}) };
    if (value == null || value === '') delete c[key][id];
    else c[key][id] = value;
  });
}

// E6 + settings
export function setGradeSetting(key, value) {
  return updateGrades((g) => {
    g[key] = value;
  });
}

// E16: what-if
export function toggleWhatIf() {
  return updateGrades((g) => {
    g.whatIfOn = !g.whatIfOn;
  });
}
export function setWhatIf(assignmentId, value) {
  return updateGrades((g) => {
    if (value == null || value === '' || Number.isNaN(value)) delete g.whatIf[assignmentId];
    else g.whatIf[assignmentId] = value;
  });
}
export function resetWhatIf() {
  updateGrades((g) => {
    g.whatIf = {};
  });
  toast('What-if scores cleared');
}
export function saveScenario(name) {
  const scores = { ...state.grades.whatIf };
  updateGrades((g) => {
    g.scenarios.push({ id: uid(), name: name.trim() || `Scenario ${g.scenarios.length + 1}`, scores, at: Date.now() });
  });
  toast(`Saved “${name.trim() || 'scenario'}”`);
}
export function loadScenario(id) {
  return updateGrades((g) => {
    const s = g.scenarios.find((x) => x.id === id);
    if (s) {
      g.whatIf = { ...s.scores };
      g.whatIfOn = true;
    }
  });
}
export function deleteScenario(id) {
  return updateGrades((g) => {
    g.scenarios = g.scenarios.filter((x) => x.id !== id);
  });
}

// E23
export function flagRegrade(id, note = '') {
  return updateGrades((g) => {
    g.regrades[id] = { note, status: 'ask', at: Date.now() };
  });
}
export function updateRegrade(id, patch) {
  return updateGrades((g) => {
    if (g.regrades[id]) g.regrades[id] = { ...g.regrades[id], ...patch };
  });
}
export function removeRegrade(id) {
  return updateGrades((g) => {
    delete g.regrades[id];
  });
}

// E24
export function markSeen(id, gradedAt) {
  if (state.grades.seen[id] === gradedAt) return;
  return updateGrades((g) => {
    g.seen[id] = gradedAt;
  });
}
export function markAllSeen(list) {
  return updateGrades((g) => {
    for (const { i } of list) g.seen[i.canvasId] = i.sub.gradedAt;
  });
}

// E5: past quarters
export function addQuarter(name) {
  const id = uid();
  updateGrades((g) => {
    g.past.push({ id, name: name || `New ${term()}`, courses: [] });
  });
  return id;
}
export function updateQuarter(id, patch) {
  return updateGrades((g) => {
    const q = g.past.find((x) => x.id === id);
    if (q) Object.assign(q, patch);
  });
}
export function deleteQuarter(id) {
  const q = state.grades.past.find((x) => x.id === id);
  updateGrades((g) => {
    g.past = g.past.filter((x) => x.id !== id);
  });
  if (q) toast(`Deleted ${q.name}`, () => updateGrades((g) => g.past.push(q)));
}
export function addPastCourse(qid) {
  return updateGrades((g) => {
    g.past.find((x) => x.id === qid)?.courses.push({ id: uid(), name: '', credits: 5, grade: 4.0, counts: true });
  });
}
export function updatePastCourse(qid, cid, patch) {
  return updateGrades((g) => {
    const c = g.past.find((x) => x.id === qid)?.courses.find((x) => x.id === cid);
    if (c) Object.assign(c, patch);
  });
}
export function deletePastCourse(qid, cid) {
  return updateGrades((g) => {
    const q = g.past.find((x) => x.id === qid);
    if (q) q.courses = q.courses.filter((x) => x.id !== cid);
  });
}
