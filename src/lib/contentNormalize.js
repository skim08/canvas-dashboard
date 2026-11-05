// Phase 3: turn Canvas course-content responses into the app's own shapes.
// Pure functions, testable, usable in the background worker.

import { abs } from './normalize.js';
import { CANVAS_ORIGIN } from './env.js';

// F2
export function normalizeAnnouncement(a) {
  const courseId = String(a.context_code || '').replace(/^course_/, '');
  return {
    id: `ann:${a.id}`,
    canvasId: String(a.id),
    courseId,
    title: a.title || 'Announcement',
    html: a.message || '',
    author: a.author?.display_name || a.user_name || '',
    postedAt: a.posted_at || a.delayed_post_at || a.created_at || null,
    read: a.read_state === 'read',
    url: abs(a.html_url) || `${CANVAS_ORIGIN}/courses/${courseId}/discussion_topics/${a.id}`,
  };
}

// F8
export function normalizeConversation(c) {
  return {
    id: String(c.id),
    subject: c.subject || '(no subject)',
    unread: c.workflow_state === 'unread',
    lastMessage: c.last_message || '',
    lastAt: c.last_message_at || c.last_authored_message_at || null,
    participants: (c.participants || []).map((p) => p.name).filter(Boolean),
    // F17: everyone but you (Canvas's "audience" leaves you out).
    audience: Array.isArray(c.audience) ? (c.participants || []).filter((p) => c.audience.map(String).includes(String(p.id))).map((p) => p.name).filter(Boolean) : null,
    context: c.context_name || '',
    courseId: c.context_code?.startsWith('course_') ? c.context_code.slice(7) : null,
    groupId: c.context_code?.startsWith('group_') ? c.context_code.slice(6) : null, // F17
    count: c.message_count || 0,
    starred: !!c.starred,
    archived: c.workflow_state === 'archived', // F17
  };
}

export function normalizeConversationDetail(c) {
  const people = Object.fromEntries((c.participants || []).map((p) => [String(p.id), p.name]));
  return {
    ...normalizeConversation(c),
    messages: (c.messages || [])
      .map((m) => ({
        id: String(m.id),
        author: people[String(m.author_id)] || 'Someone',
        at: m.created_at,
        body: m.body || '',
        attachments: (m.attachments || []).map((f) => ({ name: f.display_name || f.filename || 'Attachment', url: f.url })),
      }))
      .reverse(), // Canvas sends newest first; read oldest first
  };
}

// F1, F9: the course navigation tabs Canvas shows students.
const TAB_IDS = ['home', 'announcements', 'assignments', 'discussions', 'grades', 'people', 'pages', 'files', 'syllabus', 'modules', 'quizzes', 'outcomes', 'collaborations', 'conferences'];
export function normalizeTabs(tabs) {
  const visible = (tabs || []).filter((t) => !t.hidden);
  return {
    sections: visible.map((t) => t.id).filter((id) => TAB_IDS.includes(id)),
    tools: visible
      .filter((t) => t.type === 'external' || String(t.id).startsWith('context_external_tool'))
      .map((t) => ({ id: String(t.id), label: t.label, url: abs(t.html_url) })),
  };
}

// F10
export function normalizePerson(u) {
  const roles = (u.enrollments || []).map((e) => e.type || e.role);
  const role = roles.some((r) => /Teacher/.test(r)) ? 'Instructor' : roles.some((r) => /Ta/.test(r)) ? 'TA' : 'Staff';
  return { id: String(u.id), name: u.name || u.short_name || 'Unknown', role, pronouns: u.pronouns || null };
}

// F11
export function normalizeGroup(g) {
  return { id: String(g.id), name: g.name, courseId: g.course_id != null ? String(g.course_id) : null, members: g.members_count ?? null, url: `${CANVAS_ORIGIN}/groups/${g.id}` };
}

// F3
const MODULE_ITEM_KIND = { Page: 'page', Assignment: 'assignment', Quiz: 'quiz', Discussion: 'discussion', File: 'file', ExternalUrl: 'link', ExternalTool: 'tool', SubHeader: 'header' };
export function normalizeModules(mods) {
  return (mods || [])
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((m) => ({
      id: String(m.id),
      name: m.name,
      state: m.state || null, // locked, unlocked, started, completed
      unlockAt: m.unlock_at || null,
      items: (m.items || []).map((it) => ({
        id: String(it.id),
        kind: MODULE_ITEM_KIND[it.type] || 'link',
        title: it.title,
        indent: it.indent || 0,
        contentId: it.content_id != null ? String(it.content_id) : null,
        pageUrl: it.page_url || null,
        url: abs(it.html_url) || it.external_url || null,
        externalUrl: it.external_url || null,
        completed: it.completion_requirement ? !!it.completion_requirement.completed : null,
        requirement: it.completion_requirement?.type || null,
        locked: !!it.content_details?.locked_for_user,
        unlockAt: it.content_details?.unlock_at || null,
        lockExplanation: it.content_details?.lock_explanation || null,
        dueAt: it.content_details?.due_at || null,
        points: it.content_details?.points_possible ?? null,
      })),
    }));
}

// F4
export function normalizePage(p) {
  return { url: p.url, title: p.title || 'Untitled page', updatedAt: p.updated_at || null, html: p.body ?? null, front: !!p.front_page, link: abs(p.html_url) };
}

// F5: folders + files → a tree you can browse.
export function normalizeFile(f) {
  return {
    id: String(f.id),
    name: f.display_name || f.filename || 'File',
    size: f.size ?? null,
    updatedAt: f.updated_at || f.created_at || null,
    type: f['content-type'] || f.content_type || '',
    mimeClass: f.mime_class || '',
    folderId: f.folder_id != null ? String(f.folder_id) : null,
    url: f.url || null, // direct download
    locked: !!f.locked_for_user,
  };
}
export function normalizeFolder(f) {
  return { id: String(f.id), name: f.name, fullName: f.full_name || f.name, parentId: f.parent_folder_id != null ? String(f.parent_folder_id) : null, locked: !!f.locked_for_user };
}
export function folderTree(folders, files) {
  const byId = Object.fromEntries(folders.map((f) => [f.id, { ...f, folders: [], files: [] }]));
  let root = folders.find((f) => !f.parentId) ? byId[folders.find((f) => !f.parentId).id] : { id: 'root', name: 'Files', folders: [], files: [] };
  for (const f of Object.values(byId)) if (f.parentId && byId[f.parentId]) byId[f.parentId].folders.push(f);
  for (const file of files) (byId[file.folderId] || root).files.push(file);
  const sort = (node) => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.folders.forEach(sort);
  };
  sort(root);
  return { root, byId };
}

export function fileKind(f) {
  const t = `${f.mimeClass} ${f.type} ${f.name}`.toLowerCase();
  if (/pdf/.test(t)) return 'pdf';
  if (/image|\.png|\.jpe?g|\.gif|\.webp/.test(t)) return 'image';
  if (/video|\.mp4|\.mov/.test(t)) return 'video';
  if (/sheet|excel|\.xlsx?|\.csv/.test(t)) return 'sheet';
  if (/presentation|powerpoint|\.pptx?/.test(t)) return 'slides';
  if (/word|document|\.docx?/.test(t)) return 'doc';
  if (/zip|compressed/.test(t)) return 'zip';
  return 'file';
}

export function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// F7
export function normalizeTopic(t) {
  return {
    id: String(t.id),
    title: t.title || 'Discussion',
    html: t.message || '',
    author: t.author?.display_name || t.user_name || '',
    postedAt: t.posted_at || t.created_at || null,
    lastReplyAt: t.last_reply_at || null,
    replies: t.discussion_subentry_count ?? 0,
    unread: t.unread_count ?? 0,
    read: t.read_state === 'read',
    dueAt: t.assignment?.due_at || null,
    points: t.assignment?.points_possible ?? null,
    locked: !!t.locked_for_user,
    url: abs(t.html_url),
    pinned: !!t.pinned,
  };
}

// GET /discussion_topics/:id/view → a readable thread.
export function normalizeThread(view) {
  const people = Object.fromEntries((view.participants || []).map((p) => [String(p.id), p.display_name || p.name]));
  const unread = new Set((view.unread_entries || []).map(String));
  const walk = (entries) =>
    (entries || [])
      .filter((e) => !e.deleted)
      .map((e) => ({
        id: String(e.id),
        author: people[String(e.user_id)] || 'Someone',
        at: e.created_at,
        html: e.message || '',
        unread: unread.has(String(e.id)),
        replies: walk(e.replies),
      }));
  return walk(view.view);
}

// F1/F2/F3/F4/F7: Canvas links inside content → where they should open in the dashboard.
export function routeCanvasLink(href) {
  let u;
  try {
    u = new URL(href, CANVAS_ORIGIN);
  } catch {
    return null;
  }
  if (u.origin !== CANVAS_ORIGIN) return null;
  let m;
  if ((m = u.pathname.match(/^\/courses\/(\d+)\/pages\/([^/?#]+)$/))) return { type: 'page', courseId: m[1], url: decodeURIComponent(m[2]) };
  if ((m = u.pathname.match(/^\/courses\/(\d+)\/assignments\/(\d+)$/))) return { type: 'assignment', courseId: m[1], id: m[2] };
  if ((m = u.pathname.match(/^\/courses\/(\d+)\/(?:discussion_topics|announcements)\/(\d+)$/))) return { type: 'discussion', courseId: m[1], id: m[2] };
  if ((m = u.pathname.match(/^\/courses\/(\d+)\/files\/(\d+)/))) return { type: 'file', courseId: m[1], id: m[2] };
  if ((m = u.pathname.match(/^\/courses\/(\d+)\/(modules|files|syllabus|announcements|discussion_topics|pages)\/?$/))) return { type: 'tab', courseId: m[1], tab: { discussion_topics: 'discussions', assignments: 'assignments' }[m[2]] || m[2] };
  if ((m = u.pathname.match(/^\/courses\/(\d+)\/assignments\/syllabus$/))) return { type: 'tab', courseId: m[1], tab: 'syllabus' };
  return null;
}
