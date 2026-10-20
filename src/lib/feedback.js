// K18: one "How's it going?" card after a week of use. Counted on this computer only
// (settings.usage: the number of different days you opened the dashboard); nothing is
// ever sent anywhere.

export const FEEDBACK_AFTER_DAYS = 7;

// The day's first open adds one day. → the new usage record, or null if nothing changed.
export function countDay(usage, today) {
  const u = usage || { days: 0, last: null, dismissed: false };
  if (u.last === today) return null;
  return { ...u, days: (u.days || 0) + 1, last: today };
}

// Show the card? Only after 7 days, only once, and only with somewhere to send people.
export function feedbackDue(usage, { enabled = true, links = [] } = {}) {
  return enabled && !!usage && !usage.dismissed && (usage.days || 0) >= FEEDBACK_AFTER_DAYS && links.some(Boolean);
}
