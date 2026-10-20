// F13: turn in text and file uploads without opening Canvas.
// Files follow Canvas's three steps: ask where to upload, upload, then submit the file ids.
// Uploads only go to your school's Canvas (A7, K1) or Instructure's upload storage; anything else stops with ForeignHostError.

import * as canvas from './canvas.js';
import * as write from './canvasWrite.js';
import { toHtml } from './richtext.js';
import { CANVAS_ORIGIN } from './env.js';

export const SUBMITTABLE = ['online_upload', 'online_text_entry'];

// What can be submitted from here for this assignment, or why not.
export function submitOptions(item, now = Date.now()) {
  if (item.kind !== 'assignment' || item.source !== 'canvas') return null;
  const modes = SUBMITTABLE.filter((t) => item.submissionTypes.includes(t));
  if (!modes.length) return item.expectsSubmission ? { modes, reason: 'other' } : null; // nothing to turn in online
  if (item.lockedForUser) return { modes: [], reason: 'locked' };
  if (item.lockAt && new Date(item.lockAt).getTime() < now) return { modes: [], reason: 'closed' };
  if (item.unlockAt && new Date(item.unlockAt).getTime() > now) return { modes: [], reason: 'notYet' };
  const used = item.sub?.attempt || 0;
  const allowed = item.allowedAttempts ?? -1;
  if (allowed > 0 && used >= allowed) return { modes: [], reason: 'noAttempts' };
  return { modes, reason: null, attemptsLeft: allowed > 0 ? allowed - used : null, resubmit: used > 0 || ['submitted', 'graded'].includes(item.sub?.state) };
}

const base = (item) => `/api/v1/courses/${item.courseId}/assignments/${item.canvasId}/submissions`;

export async function submitText(item, text) {
  return write.post(base(item), { 'submission[submission_type]': 'online_text_entry', 'submission[body]': toHtml(text) });
}

// onStep(i, total) reports progress as each file uploads.
export async function submitFiles(item, files, onStep = () => {}) {
  const ids = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onStep(i + 1, files.length);
    const slot = await write.post(`${base(item)}/self/files`, { name: f.name, size: f.size, content_type: f.type || 'application/octet-stream', on_duplicate: 'rename' });
    const uploaded = await write.uploadFile(slot.upload_url, slot.upload_params, f);
    const id = await fileIdOf(uploaded);
    if (id == null) throw new Error(`Canvas didn’t confirm the upload of ${f.name}.`);
    ids.push(id);
  }
  return write.post(base(item), { 'submission[submission_type]': 'online_upload', 'submission[file_ids][]': ids });
}

// Step 3: the uploaded file's id. Canvas answers with the file; Instructure's storage
// answers with a Location on your school's Canvas, which confirms the upload when fetched.
export async function fileIdOf(uploaded) {
  if (uploaded?.id != null) return String(uploaded.id);
  if (uploaded?.attachment?.id != null) return String(uploaded.attachment.id);
  if (!uploaded?.location) return null;
  const u = new URL(uploaded.location, CANVAS_ORIGIN);
  if (u.origin !== CANVAS_ORIGIN) return null; // never follow a link anywhere else
  const f = await canvas.get(u.pathname + u.search);
  return f?.id != null ? String(f.id) : null;
}

// The status Canvas reports back, in the shape items use (so lists update right away).
export function subFromResponse(prev, res, now = Date.now()) {
  return { ...(prev || {}), state: 'submitted', submittedAt: res?.submitted_at || new Date(now).toISOString(), attempt: res?.attempt ?? (prev?.attempt || 0) + 1, missing: false };
}

export function describeError(e) {
  if (e instanceof canvas.ForeignHostError) return `${e.message} Submit this one in Canvas.`;
  if (e instanceof canvas.AuthError) return 'Your Canvas login expired. Log in to Canvas, then try again. Nothing was submitted.';
  if (e instanceof canvas.OfflineError) return 'You’re offline. Nothing was submitted.';
  if (e instanceof canvas.HttpError) return `Canvas refused the submission${e.detail ? `: ${e.detail}` : ` (error ${e.status})`}.`;
  return e?.message || 'Something went wrong. Nothing was submitted.';
}
