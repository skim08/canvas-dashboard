// G7: Pomodoro focus timer. Pure state transitions; the background worker
// (or the page in test mode) calls advance() when a session ends.

export function startFocus(item, now, { work = 25, brk = 5 } = {}) {
  return { itemId: item.id, title: item.title, phase: 'work', startedAt: now, endsAt: now + work * 60000, work, brk, cycles: 0 };
}

// Ends the current session. Returns the next state, seconds of work to log, and a notification.
export function advance(focus, now) {
  if (!focus || now < focus.endsAt) return { focus, logged: 0, note: null };
  if (focus.phase === 'work') {
    return {
      focus: { ...focus, phase: 'break', startedAt: focus.endsAt, endsAt: focus.endsAt + focus.brk * 60000, cycles: focus.cycles + 1 },
      logged: Math.round((focus.endsAt - focus.startedAt) / 1000),
      note: { key: `focus:${now}`, title: 'Break time', message: `Nice work on ${focus.title}. Take ${focus.brk} minutes.`, target: `#/open/item/${focus.itemId}` },
    };
  }
  return {
    focus: { ...focus, phase: 'work', startedAt: focus.endsAt, endsAt: focus.endsAt + focus.work * 60000 },
    logged: 0,
    note: { key: `focus:${now}`, title: 'Back to it', message: `${focus.work} minutes on ${focus.title}.`, target: `#/open/item/${focus.itemId}` },
  };
}

// Stopping mid-work still counts the time you spent.
export function stopFocus(focus, now) {
  if (!focus) return 0;
  return focus.phase === 'work' ? Math.max(0, Math.round((Math.min(now, focus.endsAt) - focus.startedAt) / 1000)) : 0;
}
