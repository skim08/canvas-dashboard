// F17 + F18: inbox actions. Each one updates what you see right away, then tells Canvas;
// if Canvas says no, the change is undone and you're told why.

import { state, notify } from './store.js';
import { toast } from './actions.js';
import { canvasReady, refreshContent, readLocally, loadedContent, forgetRead } from './content.js';
import * as msg from '../lib/canvasMessages.js';
import { HttpError, AuthError, OfflineError, ReadOnlyError } from '../lib/canvas.js';

export function describeMessageError(e) {
  if (e instanceof AuthError) return 'Your Canvas sign-in expired. Sign in to Canvas, then try again. Your text is still here.';
  if (e instanceof OfflineError) return 'You’re offline. Nothing was sent; your text is still here.';
  if (e instanceof ReadOnlyError) return 'This version of Neko can’t do that.';
  if (e instanceof HttpError) return `Canvas didn’t accept it${e.detail ? `: ${e.detail}` : ''}. Your text is still here.`;
  return `Something went wrong (${e.message}). Your text is still here.`;
}

// Patch one conversation everywhere it's shown (the synced list and each inbox view),
// and return an undo.
function patchCached(id, fn) {
  const lists = [state.cache?.conversations || [], ...loadedContent('conversations'), ...loadedContent('conversation').map((c) => [c])];
  const hits = lists.flatMap((l) => (Array.isArray(l) ? l : []).filter((x) => x?.id === String(id)));
  const before = hits.map((c) => ({ ...c }));
  hits.forEach(fn);
  notify();
  return () => (hits.forEach((c, i) => Object.assign(c, before[i])), notify());
}

function refreshAll(id) {
  for (const scope of msg.SCOPES) refreshContent('conversations', null, scope);
  if (id) refreshContent('conversation', null, String(id));
}

async function update(id, change, apply, done) {
  const undo = patchCached(id, apply);
  try {
    await canvasReady();
    await change();
    if (done) toast(done);
    refreshAll(id);
  } catch (e) {
    undo();
    toast(describeMessageError(e));
  }
}

// Read what to change before the screen is updated (that updates `c` too).
export function star(c) {
  const on = !c.starred;
  return update(c.id, () => msg.setStarred(c.id, on), (x) => (x.starred = on), on ? 'Starred' : 'Unstarred');
}
export const archive = (c) => update(c.id, () => msg.setState(c.id, 'archived'), (x) => (x.archived = true), 'Archived. Find it under Archived.');
export const unarchive = (c) => update(c.id, () => msg.setState(c.id, 'read'), (x) => (x.archived = false), 'Moved back to your inbox');
export function markUnread(c) {
  forgetRead('conv', c.id); // so it shows as new again here too
  return update(c.id, () => msg.setState(c.id, 'unread'), (x) => (x.unread = true), 'Marked unread');
}
export const markRead = (c) => (readLocally('conv', c.id), update(c.id, () => msg.setState(c.id, 'read'), (x) => (x.unread = false), null));

// Returns true when sent (so the caller can clear the draft and close the box).
export async function sendNew({ recipients, subject, body, contextCode }) {
  try {
    await canvasReady();
    await msg.sendMessage({ recipients, subject, body, contextCode });
    toast('Message sent');
    refreshAll(null);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describeMessageError(e) };
  }
}

export async function sendReply(id, body) {
  try {
    await canvasReady();
    await msg.reply(id, body);
    patchCached(id, (x) => ((x.lastMessage = body), (x.lastAt = new Date().toISOString())));
    toast('Reply sent');
    refreshAll(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describeMessageError(e) };
  }
}

export async function findRecipients(context, search) {
  await canvasReady();
  return msg.searchRecipients(context, search);
}
