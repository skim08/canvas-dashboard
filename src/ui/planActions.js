// G3, G5, G6: estimates, Next-up pins and skips, plan blocks.

import { state, updateUser } from './store.js';
import { toast } from './actions.js';
import { newPlan } from '../lib/planning.js';

export function setEstimate(itemId, minutes) {
  return updateUser((ud) => {
    ud.estimates ||= {};
    if (!minutes) delete ud.estimates[itemId];
    else ud.estimates[itemId] = minutes;
  });
}

export function addPlan(itemId, day, opts = {}) {
  const minutes = opts.minutes ?? state.userdata.estimates?.[itemId] ?? 60;
  const p = newPlan(itemId, day, { start: opts.start ?? null, minutes });
  updateUser((ud) => {
    (ud.plans ||= []).push(p);
  });
  return p;
}

export function updatePlan(planId, patch) {
  return updateUser((ud) => {
    const p = (ud.plans || []).find((x) => x.id === planId);
    if (p) Object.assign(p, patch);
  });
}

export function deletePlan(planId) {
  const p = (state.userdata.plans || []).find((x) => x.id === planId);
  updateUser((ud) => {
    ud.plans = (ud.plans || []).filter((x) => x.id !== planId);
  });
  if (p) toast('Plan removed', () => updateUser((ud) => (ud.plans ||= []).push(p)));
}

export function toggleNextPin(itemId) {
  return updateUser((ud) => {
    ud.nextPinned ||= {};
    if (ud.nextPinned[itemId]) delete ud.nextPinned[itemId];
    else ud.nextPinned[itemId] = Date.now();
  });
}

export function skipNext(itemId, hours = 24) {
  updateUser((ud) => {
    (ud.nextSkipped ||= {})[itemId] = Date.now() + hours * 3600000;
  });
  toast('Skipped until tomorrow', () => updateUser((ud) => delete ud.nextSkipped[itemId]));
}
