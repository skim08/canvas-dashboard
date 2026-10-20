// Phase 3 drawers: pages, announcements, discussions, messages, and the
// editors for quick links (F9), office hours (F10) and study groups (F11).

import { h } from './dom.js';
import { icon } from './icons.js';
import { state, updateUser } from './store.js';
import { dot, emptyState, button, iconButton, feat } from './components.js';
import { sanitizeHtml, webUrl } from '../lib/sanitize.js';
import { formatDateTime, relativeAgo } from '../lib/time.js';
import { officeHourSlots } from '../lib/model.js';
import { findProfile } from '../lib/profiles.js';
import { CANVAS_ORIGIN } from '../lib/env.js';
import { useContent, markAnnouncementRead, readLocally, postReply } from './content.js';
import { slotText, openFile, openModuleItem } from './pages/course.js';
import { ui, setUi, toast } from './actions.js';
import { notify } from './store.js';
import { markButtons, markNotes } from './marks.js';
import { composer, draft, setDraft } from './composer.js';
import { MARK_KEY } from '../lib/marks.js';
import { toHtml, isBlank } from '../lib/richtext.js';
import { fileKind, formatSize } from '../lib/contentNormalize.js';

const TITLES = { page: 'Page', announcement: 'Announcement', discussion: 'Discussion', conversation: 'Message', file: 'File', module: 'Module', links: 'Your links', officehours: 'Office hours', studygroup: 'Study group' };
export const contentDrawerTitle = (type) => TITLES[type];

export function renderContentDrawer(type, id, ctx) {
  if (type === 'page') return pageView(id, ctx);
  if (type === 'announcement') return announcementView(id, ctx);
  if (type === 'discussion') return discussionView(id, ctx);
  if (type === 'conversation') return conversationView(id, ctx);
  if (type === 'file') return fileView(id, ctx);
  if (type === 'module') return moduleView(id, ctx);
  if (type === 'links') return linksEditor(id, ctx);
  if (type === 'officehours') return officeHoursEditor(id, ctx);
  if (type === 'studygroup') return studyGroupEditor(id, ctx);
  return null;
}

const prose = (html, courseId) => h('article', { class: 'prose' }, sanitizeHtml(html, { courseId }).fragment);
const header = (ctx, courseId, title, sub) =>
  h('header', { class: 'd-header' }, courseId ? h('span', { class: 'd-course' }, dot(ctx.colorOf(courseId)), ctx.nickOf(courseId)) : null, h('h2', { class: 'd-title' }, title), sub ? h('p', { class: 'd-due' }, sub) : null);
const canvasLink = (url, label = 'Open in Canvas', kind = 'secondary') => (url ? h('a', { class: `btn btn-${kind}`, href: url, target: '_blank', rel: 'noopener', 'data-key': 'open-canvas' }, label, icon('external')) : null);
const canvasButton = (url, label) => (url ? h('div', { class: 'd-actions' }, canvasLink(url, label)) : null);
// I2: Canvas link plus pin and hide, in one row.
const actions = (url, label, key, meta) => h('div', { class: 'd-actions' }, canvasLink(url, label), ...markButtons(key, meta));
const loading = (r, what) => (r.status === 'loading' ? h('p', { class: 'empty' }, `Loading ${what}…`) : r.status === 'hidden' ? emptyState(`This ${what} isn’t available to students.`) : emptyState(`Couldn’t load this ${what}.`));

// F4
function pageView(id, ctx) {
  const [courseId, url] = id.split('|');
  const r = useContent('page', courseId, url);
  if (r.status !== 'ready') return loading(r, 'page');
  const p = r.data;
  const key = MARK_KEY.page(courseId, url);
  return [
    header(ctx, courseId, p.title, p.updatedAt ? `Updated ${formatDateTime(p.updatedAt, ctx.tz)}` : null),
    actions(p.link, 'Open in Canvas', key, { type: 'page', title: p.title, courseId, ref: id }),
    p.html ? prose(p.html, courseId) : emptyState('This page is empty.'),
    markNotes(key),
  ];
}

// F2
function announcementView(id, ctx) {
  const a = (state.cache?.announcements || []).find((x) => x.id === id);
  if (!a) return emptyState('Announcement not found.');
  queueMicrotask(() => markAnnouncementRead(a)); // marks it read here and in Canvas
  const key = MARK_KEY.announcement(a.id);
  return [
    header(ctx, a.courseId, a.title, [a.author, a.postedAt ? formatDateTime(a.postedAt, ctx.tz) : null].filter(Boolean).join(' · ')),
    actions(a.url, 'Open in Canvas', key, { type: 'announcement', title: a.title, courseId: a.courseId, ref: a.id }),
    prose(a.html, a.courseId),
    markNotes(key),
  ];
}

// F7, F14
function entryView(e, t, depth = 0) {
  const replying = feat('discussionReplies') && ui.replyTo === `${t.topicId}|${e.id}`;
  return h(
    'li',
    { class: ['entry', e.unread && 'is-unread'] },
    h(
      'div',
      { class: 'entry-head' },
      h('strong', null, e.author),
      h('span', { class: 'muted' }, ` · ${relativeAgo(e.at, Date.now())}`),
      e.unread ? h('span', { class: 'tag tag-accent' }, 'New') : null,
      feat('discussionReplies') && t.canReply && !replying ? h('button', { class: 'link-btn entry-reply', 'data-key': `reply:${e.id}`, onclick: () => setUi({ replyTo: `${t.topicId}|${e.id}` }) }, 'Reply') : null
    ),
    prose(e.html, t.courseId),
    replying ? replyBox(t, e.id, e.author) : null,
    e.replies.length ? h('ul', { class: ['entries', depth >= 2 && 'entries-flat'] }, e.replies.map((r) => entryView(r, t, depth + 1))) : null
  );
}

// F14: posting state per reply box; the text itself is kept in the composer's drafts.
const posting = {}; // boxKey -> { busy, error }
function replyBox(t, parentId, toName) {
  const boxKey = `reply:${t.topicId}:${parentId || 'topic'}`;
  const st = posting[boxKey] || {};
  const send = async () => {
    const text = draft(boxKey);
    if (isBlank(text)) return;
    posting[boxKey] = { busy: true };
    notify();
    try {
      await postReply(t.courseId, t.topicId, parentId, toHtml(text));
      setDraft(boxKey, '');
      delete posting[boxKey];
      if (parentId) setUi({ replyTo: null });
      toast('Reply posted');
    } catch (e) {
      posting[boxKey] = { error: e.detail ? `Couldn’t post: ${e.detail}.` : `Couldn’t post your reply (${e.message}). Your text is still here.` };
    }
    notify();
  };
  return h(
    'div',
    { class: ['reply-box', parentId && 'is-nested'] },
    composer(boxKey, { placeholder: parentId ? `Reply to ${toName}…` : 'Write a reply…', rows: parentId ? 3 : 5, label: parentId ? `Reply to ${toName}` : 'Your reply', disabled: st.busy }),
    st.error ? h('div', { class: 'submit-error', role: 'alert' }, h('p', null, st.error), canvasLink(t.url, 'Reply in Canvas instead', 'link')) : null,
    h(
      'div',
      { class: 'd-actions' },
      button(st.busy ? 'Posting…' : 'Post reply', send, { kind: 'primary', key: `post:${boxKey}`, disabled: st.busy || isBlank(draft(boxKey)) }),
      parentId ? button('Cancel', () => setUi({ replyTo: null }), { kind: 'ghost', key: `cancel:${boxKey}`, disabled: st.busy }) : null
    )
  );
}

function discussionView(id, ctx) {
  const [courseId, topicId] = id.split('|');
  const fromList = useContent('topics', courseId).data?.find((t) => t.id === topicId);
  const fromAnn = (state.cache?.announcements || []).find((a) => a.canvasId === topicId);
  const single = fromList || fromAnn ? null : useContent('topic', courseId, topicId);
  const topic = fromList || (fromAnn && { title: fromAnn.title, html: fromAnn.html, author: fromAnn.author, postedAt: fromAnn.postedAt, url: fromAnn.url }) || single?.data;
  const thread = useContent('thread', courseId, topicId);
  if (!topic) return single ? loading(single, 'discussion') : emptyState('Discussion not found.');
  const count = (list) => list.reduce((s, e) => s + 1 + count(e.replies), 0);
  const key = MARK_KEY.discussion(courseId, topicId);
  const isAnnouncement = !!fromAnn && !fromList;
  const t = { courseId, topicId, url: topic.url, canReply: !topic.locked && !isAnnouncement };
  const canReply = feat('discussionReplies') && t.canReply;
  return [
    header(ctx, courseId, topic.title, [topic.author, topic.postedAt ? formatDateTime(topic.postedAt, ctx.tz) : null, topic.dueAt ? `Due ${formatDateTime(topic.dueAt, ctx.tz)}` : null].filter(Boolean).join(' · ')),
    actions(topic.url, canReply ? 'Open in Canvas' : 'Reply in Canvas', key, { type: 'discussion', title: topic.title, courseId, ref: id }),
    topic.html ? prose(topic.html, courseId) : null,
    thread.status === 'ready'
      ? thread.data.length
        ? h('section', { class: 'd-block' }, h('h3', null, `${count(thread.data)} repl${count(thread.data) === 1 ? 'y' : 'ies'}`), h('ul', { class: 'entries' }, thread.data.map((e) => entryView(e, t))))
        : h('p', { class: 'caption' }, 'No replies yet.')
      : thread.status === 'loading'
        ? h('p', { class: 'caption' }, 'Loading replies…')
        : h('p', { class: 'caption' }, 'Replies aren’t visible yet (some discussions show them only after you post).'),
    canReply ? h('section', { class: 'd-block' }, h('h3', null, 'Your reply'), replyBox(t, null)) : topic.locked ? h('p', { class: 'caption' }, 'This discussion is closed for replies.') : null,
    markNotes(key),
  ];
}

// F8
function conversationView(id, ctx) {
  const r = useContent('conversation', null, id);
  if (r.status !== 'ready') return loading(r, 'message');
  const c = r.data;
  queueMicrotask(() => readLocally('conv', id)); // Canvas marked it read when we opened it
  const key = MARK_KEY.conversation(id);
  return [
    header(ctx, c.courseId, c.subject, [c.participants.join(', '), c.context].filter(Boolean).join(' · ')),
    h(
      'div',
      { class: 'd-actions' },
      h('a', { class: 'btn btn-primary', href: `${CANVAS_ORIGIN}/conversations`, target: '_blank', rel: 'noopener', 'data-key': 'reply-canvas' }, 'Reply in Canvas', icon('external')),
      ...markButtons(key, { type: 'conversation', title: c.subject, courseId: c.courseId || null, ref: id })
    ),
    h(
      'ul',
      { class: 'comments' },
      c.messages.map((m) =>
        h(
          'li',
          null,
          h('div', { class: 'comment-head' }, h('strong', null, m.author), h('span', { class: 'muted' }, ` · ${formatDateTime(m.at, ctx.tz)}`)),
          h('div', { class: 'message-body' }, m.body),
          m.attachments.length ? h('ul', { class: 'files' }, m.attachments.map((f) => h('li', null, h('a', { href: f.url, target: '_blank', rel: 'noopener' }, icon('file'), h('span', null, f.name), icon('download'))))) : null
        )
      )
    ),
    markNotes(key),
  ];
}

// I2: a file's details, so it can be pinned, hidden and given notes.
function fileView(id, ctx) {
  const [courseId, fileId] = id.split('|');
  const r = useContent('files', courseId);
  if (r.status !== 'ready') return loading(r, 'file');
  const f = r.data.files.find((x) => String(x.id) === fileId);
  if (!f) return emptyState('This file is no longer in Canvas.');
  const k = fileKind(f);
  const key = MARK_KEY.file(courseId, fileId);
  return [
    header(ctx, courseId, f.name, [formatSize(f.size), f.updatedAt ? `Updated ${formatDateTime(f.updatedAt, ctx.tz)}` : null].filter(Boolean).join(' · ')),
    h(
      'div',
      { class: 'd-actions' },
      button(k === 'pdf' || k === 'image' ? 'Open' : 'Download', () => openFile(courseId, f), { kind: 'primary', iconName: k === 'pdf' || k === 'image' ? 'external' : 'download', key: 'file-open' }),
      ...markButtons(key, { type: 'file', title: f.name, courseId, ref: id })
    ),
    markNotes(key),
  ];
}

// I2: a module's details: its items, plus pin, hide and notes.
function moduleView(id, ctx) {
  const [courseId, moduleId] = id.split('|');
  const r = useContent('modules', courseId);
  if (r.status !== 'ready') return loading(r, 'module');
  const m = r.data.find((x) => String(x.id) === moduleId);
  if (!m) return emptyState('This module is no longer in Canvas.');
  const course = ctx.allCourses.find((c) => c.id === courseId) || { id: courseId };
  const key = MARK_KEY.module(courseId, moduleId);
  return [
    header(ctx, courseId, m.name, `${m.items.filter((i) => i.kind !== 'header').length} items`),
    h('div', { class: 'd-actions' }, ...markButtons(key, { type: 'module', title: m.name, courseId, ref: id })),
    h(
      'ul',
      { class: 'module-items' },
      m.items.map((it) => (it.kind === 'header' ? h('li', { class: 'module-sub' }, it.title) : h('li', null, h('button', { class: 'module-item', 'data-key': `dmi:${it.id}`, onclick: () => openModuleItem(course, it, ctx) }, h('span', { class: 'module-item-title' }, it.title)))))
    ),
    markNotes(key),
  ];
}

// ---------- Editors ----------

const uid = () => Math.random().toString(36).slice(2, 10);
const safeUrl = webUrl;

// F9
function linksEditor(courseId, ctx) {
  const list = state.userdata.links?.[courseId] || [];
  const edit = (fn) =>
    updateUser((ud) => {
      ud.links ||= {};
      const l = (ud.links[courseId] ||= []);
      fn(l);
      if (!l.length) delete ud.links[courseId];
    });
  return [
    header(ctx, courseId, 'Your links', 'Add links you use for this class, like a Zoom room from the syllabus or a course website.'),
    list.length
      ? h(
          'ul',
          { class: 'edit-list' },
          list.map((l, i) =>
            h(
              'li',
              null,
              h('input', { class: 'text-input', value: l.label, 'aria-label': 'Label', 'data-key': `ll:${l.id}`, onchange: (e) => edit((arr) => (arr[i].label = e.target.value.trim() || arr[i].label)) }),
              h('input', { class: 'text-input', value: l.url, 'aria-label': 'Link', 'data-key': `lu:${l.id}`, onchange: (e) => { const u = safeUrl(e.target.value); if (u) edit((arr) => (arr[i].url = u)); else e.target.value = l.url; } }),
              iconButton('up', 'Move up', () => edit((arr) => i > 0 && ([arr[i - 1], arr[i]] = [arr[i], arr[i - 1]])), { key: `lup:${l.id}` }),
              iconButton('down', 'Move down', () => edit((arr) => i < arr.length - 1 && ([arr[i + 1], arr[i]] = [arr[i], arr[i + 1]])), { key: `ldn:${l.id}` }),
              iconButton('trash', 'Remove link', () => edit((arr) => arr.splice(i, 1)), { key: `ldel:${l.id}` })
            )
          )
        )
      : null,
    h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          const f = e.target.elements;
          const url = safeUrl(f.url.value);
          if (!f.label.value.trim()) return f.label.focus();
          if (!url) {
            f.url.setCustomValidity('Enter a full link starting with https://');
            f.url.reportValidity();
            return;
          }
          edit((arr) => arr.push({ id: uid(), label: f.label.value.trim(), url }));
          e.target.reset();
        },
      },
      h('label', { class: 'form-field' }, h('span', null, 'Label'), h('input', { name: 'label', class: 'text-input', placeholder: 'Zoom lecture room', 'data-key': 'new-link-label', autocomplete: 'off' })),
      h('label', { class: 'form-field' }, h('span', null, 'Link'), h('input', { name: 'url', class: 'text-input', placeholder: 'https://…', 'data-key': 'new-link-url', autocomplete: 'off', oninput: (e) => e.target.setCustomValidity('') })),
      h('div', { class: 'd-actions' }, button('Add link', null, { kind: 'primary', type: 'submit', key: 'add-link' }))
    ),
  ];
}

// F10
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function officeHoursEditor(id, ctx) {
  const [courseId, person] = id.split('|');
  const course = ctx.allCourses.find((c) => c.id === courseId);
  if (!course) return emptyState('Class not found.');
  const all = officeHourSlots(course, state.userdata);
  const builtIn = all.filter((s) => s.source === 'syllabus' && (!person || s.person === person));
  const own = state.userdata.officeHours?.[courseId] || [];
  const mine = own.map((s, i) => ({ s, i })).filter(({ s }) => !person || s.person === person);
  const edit = (fn) =>
    updateUser((ud) => {
      ud.officeHours ||= {};
      const l = (ud.officeHours[courseId] ||= []);
      fn(l);
      if (!l.length) delete ud.officeHours[courseId];
    });
  const removed = (findProfile(course)?.officeHours || []).filter((s) => state.userdata.ohHidden?.[s.id] && (!person || s.person === person));
  return [
    header(ctx, courseId, person ? `${person}’s office hours` : 'Office hours', 'Sessions show up on the Courses page for the next two weeks, where you can add any one to your calendar and to-dos.'),
    builtIn.length
      ? h(
          'section',
          { class: 'd-block' },
          h('h3', null, 'From your syllabus'),
          h('ul', { class: 'edit-list' }, builtIn.map((s) => h('li', null, h('span', { class: 'edit-text' }, h('strong', null, s.person), ` · ${slotText(s)}`), button('Remove', () => updateUser((ud) => ((ud.ohHidden ||= {})[s.id] = Date.now())), { key: `ohh:${s.id}`, kind: 'ghost' }))))
        )
      : null,
    removed.length ? h('p', { class: 'caption' }, `${removed.length} removed. `, h('button', { class: 'link-btn', 'data-key': 'oh-restore', onclick: () => updateUser((ud) => removed.forEach((s) => delete ud.ohHidden[s.id])) }, 'Restore')) : null,
    h(
      'section',
      { class: 'd-block' },
      h('h3', null, 'Yours'),
      mine.length
        ? h(
            'ul',
            { class: 'edit-list oh-list' },
            mine.map(({ s, i }) =>
              h(
                'li',
                { class: 'oh-edit' },
                !person ? h('input', { class: 'text-input', value: s.person, placeholder: 'Who', 'aria-label': 'Who', 'data-key': `ohp:${s.id}`, onchange: (e) => edit((l) => (l[i].person = e.target.value.trim() || l[i].person)) }) : null,
                h('div', { class: 'day-chips' }, DAYS.map((d) => h('button', { class: ['chip', s.days.includes(d) && 'is-on'], 'aria-pressed': String(s.days.includes(d)), 'data-key': `ohd:${s.id}:${d}`, onclick: () => edit((l) => (l[i].days = l[i].days.includes(d) ? l[i].days.filter((x) => x !== d) : DAYS.filter((x) => [...l[i].days, d].includes(x)))) }, d))),
                h('div', { class: 'time-row' }, h('input', { type: 'time', value: s.start, 'aria-label': 'Starts', 'data-key': `ohs:${s.id}`, onchange: (e) => edit((l) => (l[i].start = e.target.value)) }), h('span', { class: 'muted' }, 'to'), h('input', { type: 'time', value: s.end, 'aria-label': 'Ends', 'data-key': `ohe:${s.id}`, onchange: (e) => edit((l) => (l[i].end = e.target.value)) })),
                h('input', { class: 'text-input', value: s.where || '', placeholder: 'Where (room or Zoom)', 'aria-label': 'Where', 'data-key': `ohw:${s.id}`, onchange: (e) => edit((l) => (l[i].where = e.target.value.trim())) }),
                button('Remove', () => edit((l) => l.splice(i, 1)), { key: `ohdel:${s.id}`, kind: 'danger-ghost' })
              )
            )
          )
        : h('p', { class: 'caption' }, 'None yet.'),
      button('Add a time', () => edit((l) => l.push({ id: uid(), person: person || 'Instructor', role: '', days: ['Mon'], start: '13:00', end: '14:00', where: '' })), { iconName: 'plus', key: 'oh-new' })
    ),
  ];
}

// F11
function studyGroupEditor(courseId, ctx) {
  const sg = state.userdata.studyGroups?.[courseId] || { members: [], meets: '', notes: '' };
  const edit = (fn) =>
    updateUser((ud) => {
      ud.studyGroups ||= {};
      const g = (ud.studyGroups[courseId] ||= { members: [], meets: '', notes: '' });
      fn(g);
    });
  const canvasGroups = (state.cache?.groups || []).filter((g) => g.courseId === courseId);
  return [
    header(ctx, courseId, 'Study group', null),
    h(
      'section',
      { class: 'd-block' },
      h('h3', null, 'Members'),
      sg.members.length
        ? h(
            'ul',
            { class: 'edit-list' },
            sg.members.map((m, i) =>
              h(
                'li',
                null,
                h('input', { class: 'text-input', value: m.name, placeholder: 'Name', 'aria-label': 'Name', 'data-key': `sgn:${m.id}`, onchange: (e) => edit((g) => (g.members[i].name = e.target.value.trim())) }),
                h('input', { class: 'text-input', value: m.contact || '', placeholder: 'Phone, email or Discord', 'aria-label': 'Contact', 'data-key': `sgc:${m.id}`, onchange: (e) => edit((g) => (g.members[i].contact = e.target.value.trim())) }),
                iconButton('trash', 'Remove', () => edit((g) => g.members.splice(i, 1)), { key: `sgd:${m.id}` })
              )
            )
          )
        : null,
      button('Add member', () => edit((g) => g.members.push({ id: uid(), name: '', contact: '' })), { iconName: 'plus', key: 'sg-add' })
    ),
    h('label', { class: 'form-field' }, h('span', null, 'When you meet'), h('input', { class: 'text-input', value: sg.meets || '', placeholder: 'Sundays 4 PM, Odegaard 2nd floor', 'data-key': 'sg-meets', onchange: (e) => edit((g) => (g.meets = e.target.value.trim())) })),
    h('label', { class: 'form-field' }, h('span', null, 'Notes'), h('textarea', { class: 'notes', rows: '4', value: sg.notes || '', 'data-key': 'sg-notes', onchange: (e) => edit((g) => (g.notes = e.target.value)) })),
    canvasGroups.length ? h('section', { class: 'd-block' }, h('h3', null, 'Your Canvas groups'), h('ul', { class: 'files' }, canvasGroups.map((g) => h('li', null, h('a', { href: g.url, target: '_blank', rel: 'noopener' }, icon('users'), h('span', null, `${g.name}${g.members ? ` · ${g.members} members` : ''}`), icon('external')))))) : null,
  ];
}

