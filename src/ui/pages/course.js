// F1: one page per class, with tabs for everything Canvas has.
// Tabs the class doesn't use (per Canvas's own navigation) are hidden.

import { h } from '../dom.js';
import { needsSyllabus } from '../syllabusDrawer.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { ui, setUi, openDrawer } from '../actions.js';
import { dot, emptyState, sectionHeader, itemRow, feat, button, tag, iconButton } from '../components.js';
import { MARK_KEY } from '../../lib/marks.js';
import { markButtons, markNotes, notHidden, pinMark } from '../marks.js';
import { listable, sortItems, officeHourSlots } from '../../lib/model.js';
import { formatDate, formatDateTime, relativeAgo } from '../../lib/time.js';
import { sanitizeHtml, htmlToText, webUrl } from '../../lib/sanitize.js';
import { folderTree, fileKind, formatSize } from '../../lib/contentNormalize.js';
import { CANVAS_ORIGIN } from '../../lib/env.js';
import { useContent, isRead } from '../content.js';
import { openGradeDrawer } from './grades.js';
import * as F from '../fmt.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'announcements', label: 'Announcements', nav: 'announcements' },
  { id: 'modules', label: 'Modules', nav: 'modules' },
  { id: 'pages', label: 'Pages', nav: 'pages' },
  { id: 'files', label: 'Files', nav: 'files' },
  { id: 'syllabus', label: 'Syllabus', nav: 'syllabus' },
  { id: 'discussions', label: 'Discussions', nav: 'discussions' },
  { id: 'people', label: 'People', nav: 'people' },
];

export function courseTabs(course) {
  const sections = course.nav?.sections;
  return TABS.filter((t) => {
    if (!t.nav || !sections) return true; // unknown → show
    if (t.id === 'people' && course.staff?.length) return true; // staff list still useful if the tab is hidden
    if (t.id === 'syllabus' && course.syllabusHtml) return true;
    return sections.includes(t.nav);
  });
}

export function renderCourse(ctx, courseId, tabId) {
  const course = ctx.allCourses.find((c) => c.id === courseId);
  if (!course) return h('div', { class: 'page' }, emptyState(state.cache ? 'Class not found.' : 'Loading…'));
  const tabs = courseTabs(course);
  const tab = tabs.find((t) => t.id === tabId) ? tabId : 'overview';
  const color = ctx.colorOf(course.id);
  const body = {
    overview: overviewTab,
    assignments: assignmentsTab,
    announcements: announcementsTab,
    modules: modulesTab,
    pages: pagesTab,
    files: filesTab,
    syllabus: syllabusTab,
    discussions: discussionsTab,
    people: peopleTab,
  }[tab](ctx, course);

  return h(
    'div',
    { class: 'page page-course' },
    h('a', { class: 'back-link', href: '#/courses', 'data-key': 'back-courses' }, icon('back', 14), 'Courses'),
    h(
      'header',
      { class: 'course-head' },
      h('div', null, h('h1', { class: 'page-title course-title' }, dot(color), ctx.nickOf(course.id)), h('p', { class: 'muted course-sub' }, course.name, course.term ? ` · ${course.term}` : '')),
      h(
        'div',
        { class: 'course-head-actions' },
        ...markButtons(MARK_KEY.course(course.id), { type: 'course', title: ctx.nickOf(course.id), courseId: course.id, ref: course.id }, { afterHide: null }), // I2
        // K5–K7; K23: a primary "Add syllabus" until the class has its times.
        feat('syllabusDates') || feat('classSchedule') ? (needsSyllabus(ctx).some((c) => c.id === course.id) ? button('Add syllabus', () => openDrawer('syllabus', course.id), { key: 'course-syllabus', iconName: 'clock', kind: 'primary' }) : button('Syllabus dates', () => openDrawer('syllabus', course.id), { key: 'course-syllabus', iconName: 'clock' })) : null,
        h('a', { class: 'btn btn-secondary', href: course.url, target: '_blank', rel: 'noopener', 'data-key': 'course-canvas' }, 'Open in Canvas', icon('external'))
      )
    ),
    h(
      'nav',
      { class: 'tabs', 'aria-label': 'Class sections' },
      tabs.map((t) => h('a', { href: `#/course/${course.id}/${t.id}`, class: ['tab', t.id === tab && 'is-active'], 'aria-current': t.id === tab ? 'page' : null, 'data-key': `ctab:${t.id}` }, t.label))
    ),
    body
  );
}

// ---------- Overview ----------

function overviewTab(ctx, course) {
  const g = ctx.grades.courses.find((c) => c.course.id === course.id);
  const mine = listable(ctx.allItems).filter((i) => i.courseId === course.id && i.area !== 'officeHours' && i.area !== 'classes');
  const upcoming = sortItems(mine.filter((i) => !i.done && !i.overdue && i.dueAt && new Date(i.dueAt).getTime() >= ctx.now), 'due').slice(0, 5);
  const overdue = mine.filter((i) => i.overdue);
  const latest = (state.cache?.announcements || []).filter(notHidden((a) => MARK_KEY.announcement(a.id))).find((a) => a.courseId === course.id);
  return h(
    'div',
    { class: 'course-overview' },
    g
      ? h(
          'button',
          { class: 'course-grade', 'data-key': 'course-grade', onclick: () => openGradeDrawer(course.id) },
          h('span', { class: 'muted' }, g.noGradesYet ? 'Current grade' : g.paceBased ? 'On pace for' : 'Current grade'),
          h('strong', null, F.scoreText(g)),
          g.noGradesYet ? null : h('span', { class: 'grade-gp' }, F.gp(g.gp)),
          g.atRisk ? tag('At risk', 'red') : g.gp != null && g.gp >= g.target - 1e-9 ? tag('On track', 'green') : null,
          F.needText(g) ? h('span', { class: 'muted course-grade-need' }, F.needText(g)) : null
        )
      : null,
    overdue.length ? h('section', { class: 'section' }, sectionHeader('Overdue'), h('div', { class: 'rows' }, overdue.map((i) => itemRow(i, { now: ctx.now, tz: ctx.tz, showCourse: false, showLate: true })))) : null,
    h('section', { class: 'section' }, sectionHeader('Coming up', h('a', { class: 'link-btn', href: `#/course/${course.id}/assignments` }, 'All')), upcoming.length ? h('div', { class: 'rows' }, upcoming.map((i) => itemRow(i, { now: ctx.now, tz: ctx.tz, showCourse: false }))) : emptyState('Nothing coming up.')),
    latest && feat('announcementsFeed')
      ? h(
          'section',
          { class: 'section' },
          sectionHeader('Latest announcement', h('a', { class: 'link-btn', href: `#/course/${course.id}/announcements` }, 'All')),
          announcementRow(latest, ctx)
        )
      : null,
    feat('quickLinks') ? quickLinks(ctx, course) : null,
    feat('people') ? peopleSummary(ctx, course) : null,
    feat('studyGroups') ? studyGroupSummary(course) : null,
    markNotes(MARK_KEY.course(course.id)) // I2: notes on the class itself
  );
}

// F9
export function defaultLinks(course) {
  const out = [];
  const tools = course.nav?.tools || [];
  const zoom = tools.find((t) => /zoom/i.test(t.label));
  if (zoom) out.push({ id: zoom.id, label: 'Zoom', url: zoom.url, icon: 'video' });
  const has = (s) => !course.nav || course.nav.sections.includes(s);
  if (has('syllabus') || course.syllabusHtml) out.push({ id: 'syllabus', label: 'Syllabus', href: `#/course/${course.id}/syllabus`, icon: 'book' });
  if (has('modules')) out.push({ id: 'modules', label: 'Modules', href: `#/course/${course.id}/modules`, icon: 'book' });
  if (has('files')) out.push({ id: 'files', label: 'Files', href: `#/course/${course.id}/files`, icon: 'folder' });
  for (const t of tools) if (t !== zoom) out.push({ id: t.id, label: t.label, url: t.url, icon: 'external' });
  return out;
}

function quickLinks(ctx, course) {
  const own = state.userdata.links?.[course.id] || [];
  // Your links are checked again here: a restored backup could hold anything.
  const mine = own.map((l) => ({ id: l.id, label: String(l.label || ''), url: webUrl(l.url), icon: 'link', mine: true })).filter((l) => l.url);
  const links = [...defaultLinks(course), ...mine];
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Quick links', h('button', { class: 'link-btn', 'data-key': 'edit-links', onclick: () => openDrawer('links', course.id) }, own.length ? 'Edit your links' : 'Add a link')),
    h(
      'div',
      { class: 'quick-links' },
      links.map((l) =>
        l.href
          ? h('a', { class: 'quick-link', href: l.href, 'data-key': `ql:${l.id}` }, icon(l.icon), l.label)
          : h('a', { class: 'quick-link', href: l.url, target: '_blank', rel: 'noopener', 'data-key': `ql:${l.id}` }, icon(l.icon), l.label)
      )
    )
  );
}

// F10
function slotText(s) {
  const t = (hm) => {
    const [hh, mm] = hm.split(':').map(Number);
    const ap = hh >= 12 ? 'PM' : 'AM';
    return `${((hh + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${ap}`;
  };
  return `${s.days.join(' & ')} ${t(s.start)}–${t(s.end || s.start)}${s.where ? ` · ${s.where}` : ''}`;
}

const sameName = (a, b) => {
  const last = (n) => String(n || '').trim().split(/\s+/).pop().toLowerCase();
  return last(a) && last(a) === last(b);
};

function peopleSummary(ctx, course) {
  const staff = course.staff || [];
  const slots = officeHourSlots(course, state.userdata);
  if (!staff.length && !slots.length) return null;
  const instructors = staff.filter((p) => p.role === 'Instructor');
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Instructors and office hours', h('a', { class: 'link-btn', href: `#/course/${course.id}/people` }, 'All')),
    h(
      'div',
      { class: 'grade-list' },
      (instructors.length ? instructors : staff.slice(0, 2)).map((p) => personRow(course, p, slots.filter((s) => sameName(s.person, p.name)))),
      slots.filter((s) => !staff.some((p) => sameName(s.person, p.name))).slice(0, 3).map((s) => h('div', { class: 'grade-row' }, h('span', { class: 'grade-nick' }, s.person), h('span', { class: 'grade-name' }, slotText(s))))
    )
  );
}

function personRow(course, p, slots) {
  return h(
    'div',
    { class: 'person-row' },
    h('div', { class: 'person-main' }, h('strong', null, p.name), h('span', { class: 'muted' }, ` · ${p.role}${p.pronouns ? ` · ${p.pronouns}` : ''}`), slots.length ? slots.map((s) => h('div', { class: 'muted person-oh' }, slotText(s))) : null),
    h(
      'div',
      { class: 'person-actions' },
      h('a', { class: 'btn btn-sm btn-secondary', href: `${CANVAS_ORIGIN}/conversations?context_id=course_${course.id}&user_id=${p.id}&user_name=${encodeURIComponent(p.name)}`, target: '_blank', rel: 'noopener', 'data-key': `msg:${p.id}` }, icon('mail', 14), 'Message'),
      button('Office hours', () => openDrawer('officehours', `${course.id}|${p.name}`), { key: `oh:${p.id}`, kind: 'ghost' })
    )
  );
}

// F11
function studyGroupSummary(course) {
  const sg = state.userdata.studyGroups?.[course.id];
  const canvasGroups = (state.cache?.groups || []).filter((g) => g.courseId === course.id);
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Study group', h('button', { class: 'link-btn', 'data-key': 'edit-sg', onclick: () => openDrawer('studygroup', course.id) }, sg ? 'Edit' : 'Add')),
    sg?.members?.length || sg?.meets
      ? h('div', { class: 'note' }, sg.members?.length ? h('div', null, sg.members.map((m) => m.name).join(', ')) : null, sg.meets ? h('div', { class: 'muted' }, `Meets: ${sg.meets}`) : null)
      : h('p', { class: 'caption' }, 'Keep your study group’s names, contact info and meeting time here.'),
    canvasGroups.length ? h('div', { class: 'quick-links' }, canvasGroups.map((g) => h('a', { class: 'quick-link', href: g.url, target: '_blank', rel: 'noopener' }, icon('users'), `${g.name} (Canvas group)`))) : null
  );
}

// ---------- Assignments ----------

function assignmentsTab(ctx, course) {
  const mine = listable(ctx.allItems).filter((i) => i.courseId === course.id && i.kind !== 'event' && i.area !== 'officeHours');
  const rowCtx = { now: ctx.now, tz: ctx.tz, showCourse: false };
  const upcoming = sortItems(mine.filter((i) => !i.overdue && !i.done && (!i.dueAt || new Date(i.dueAt).getTime() >= ctx.now)), 'due');
  const overdue = mine.filter((i) => i.overdue);
  const past = sortItems(mine.filter((i) => !upcoming.includes(i) && !overdue.includes(i)), 'due').reverse();
  return h(
    'div',
    { class: 'section' },
    overdue.length ? [h('div', { class: 'group-head tone-red' }, 'Overdue'), h('div', { class: 'rows' }, overdue.map((i) => itemRow(i, { ...rowCtx, showLate: true })))] : null,
    h('div', { class: 'group-head' }, `Upcoming · ${upcoming.length}`),
    upcoming.length ? h('div', { class: 'rows' }, upcoming.map((i) => itemRow(i, rowCtx))) : emptyState('Nothing upcoming.'),
    past.length ? [h('div', { class: 'group-head' }, `Past · ${past.length}`), h('div', { class: 'rows' }, past.map((i) => itemRow(i, { ...rowCtx, plain: true })))] : null
  );
}

// ---------- Announcements (F2) ----------

export function announcementRow(a, ctx, showCourse = false) {
  const unread = !a.read && !isRead('ann', a.canvasId);
  return h(
    'button',
    { class: ['row', 'ann-row', unread && 'is-unread'], 'data-key': `ann:${a.canvasId}`, 'data-row': `ann:${a.canvasId}`, onclick: () => openDrawer('announcement', a.id) },
    h(
      'span',
      { class: 'row-main' },
      h('span', { class: 'row-title' }, pinMark(MARK_KEY.announcement(a.id)), a.title, unread ? tag('New', 'accent') : null),
      h('span', { class: 'row-meta' }, showCourse ? [dot(ctx.colorOf(a.courseId)), ctx.nickOf(a.courseId), ' · '] : null, a.author ? `${a.author} · ` : '', a.postedAt ? relativeAgo(a.postedAt, ctx.now) : ''),
      h('span', { class: 'ann-snippet' }, htmlToText(a.html).slice(0, 160))
    )
  );
}

function announcementsTab(ctx, course) {
  const list = (state.cache?.announcements || []).filter((a) => a.courseId === course.id).filter(notHidden((a) => MARK_KEY.announcement(a.id)));
  return list.length ? h('div', { class: 'rows' }, list.map((a) => announcementRow(a, ctx))) : emptyState('No announcements in the last 60 days.');
}

// ---------- Modules (F3) ----------

const KIND_ICON = { page: 'book', assignment: 'note', quiz: 'note', discussion: 'chat', file: 'file', link: 'link', tool: 'external', header: null };

export function openModuleItem(course, it, ctx) {
  if (it.kind === 'page' && it.pageUrl) return openDrawer('page', `${course.id}|${it.pageUrl}`);
  if ((it.kind === 'assignment' || it.kind === 'quiz') && it.contentId) {
    const found = ctx.allItems.find((i) => i.courseId === course.id && (i.canvasId === it.contentId || i.quizId === it.contentId));
    if (found) return openDrawer('item', found.id);
  }
  if (it.kind === 'discussion' && it.contentId) return openDrawer('discussion', `${course.id}|${it.contentId}`);
  const url = it.externalUrl || it.url;
  if (url) window.open(url, '_blank', 'noopener');
}

function modulesTab(ctx, course) {
  const r = useContent('modules', course.id);
  if (r.status !== 'ready') return statusView(r, 'modules');
  const mods = r.data.filter(notHidden((m) => MARK_KEY.module(course.id, m.id)));
  if (!mods.length) return emptyState(r.data.length ? 'All modules here are hidden.' : 'This class has no modules.');
  const open = ui.modulesOpen?.[course.id] || {};
  return h(
    'div',
    { class: 'modules' },
    mods.map((m, idx) => {
      const isOpen = open[m.id] ?? idx === firstOpenModule(mods);
      const done = m.items.filter((i) => i.completed).length;
      const req = m.items.filter((i) => i.completed != null).length;
      return h(
        'section',
        { class: 'module' },
        h(
          'div',
          { class: 'module-head-row' },
          h(
            'button',
            { class: 'module-head', 'aria-expanded': String(isOpen), 'data-key': `mod:${m.id}`, onclick: () => setUi({ modulesOpen: { ...(ui.modulesOpen || {}), [course.id]: { ...open, [m.id]: !isOpen } } }) },
            icon(isOpen ? 'chevronDown' : 'chevron', 14),
            pinMark(MARK_KEY.module(course.id, m.id)),
            h('span', { class: 'module-name' }, m.name),
            m.state === 'locked' ? h('span', { class: 'muted module-meta' }, icon('lock', 14), m.unlockAt ? `Unlocks ${formatDateTime(m.unlockAt, ctx.tz)}` : 'Locked') : null,
            req ? h('span', { class: 'muted module-meta' }, `${done}/${req} done`) : null
          ),
          iconButton('more', 'Pin, hide or add notes', () => openDrawer('module', `${course.id}|${m.id}`), { key: `mod-more:${m.id}`, class: 'row-more' })
        ),
        isOpen
          ? h(
              'ul',
              { class: 'module-items' },
              m.items.map((it) =>
                it.kind === 'header'
                  ? h('li', { class: 'module-sub' }, it.title)
                  : h(
                      'li',
                      { style: { paddingLeft: `calc(${it.indent} * var(--s5))` } },
                      h(
                        'button',
                        { class: ['module-item', it.locked && 'is-locked'], 'data-key': `mi:${it.id}`, onclick: () => openModuleItem(course, it, ctx) },
                        it.completed != null ? h('span', { class: ['check', 'check-static', it.completed && 'is-done'], 'aria-label': it.completed ? 'Completed' : 'Not completed' }, icon('check', 14)) : h('span', { class: 'check-spacer' }),
                        icon(KIND_ICON[it.kind] || 'file'),
                        h('span', { class: 'module-item-title' }, it.title),
                        it.locked ? h('span', { class: 'muted module-meta' }, icon('lock', 14), it.unlockAt ? `Unlocks ${formatDate(it.unlockAt, ctx.tz)}` : 'Locked') : it.dueAt ? h('span', { class: 'muted module-meta' }, `Due ${formatDate(it.dueAt, ctx.tz)}`) : null
                      )
                    )
              )
            )
          : null
      );
    })
  );
}

function firstOpenModule(mods) {
  const i = mods.findIndex((m) => m.items.some((it) => it.completed === false) && m.state !== 'locked');
  return i < 0 ? 0 : i;
}

function statusView(r, what) {
  if (r.status === 'loading') return h('p', { class: 'empty' }, `Loading ${what}…`);
  if (r.status === 'hidden') return emptyState(`Your instructor hasn’t shared ${what} with students for this class.`);
  return emptyState(`Couldn’t load ${what} from Canvas. Try again later.`);
}

// ---------- Pages (F4) ----------

function pagesTab(ctx, course) {
  const r = useContent('pages', course.id);
  if (r.status !== 'ready') return statusView(r, 'pages');
  if (!r.data.length) return emptyState('This class has no pages.');
  const list = r.data.filter(notHidden((p) => MARK_KEY.page(course.id, p.url))).sort((a, b) => (b.front ? 1 : 0) - (a.front ? 1 : 0) || a.title.localeCompare(b.title));
  return h(
    'div',
    { class: 'rows' },
    list.map((p) =>
      h(
        'button',
        { class: 'row compact-row', 'data-key': `pg:${p.url}`, 'data-row': `pg:${p.url}`, onclick: () => openDrawer('page', `${course.id}|${p.url}`) },
        icon('book'),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, pinMark(MARK_KEY.page(course.id, p.url)), p.title, p.front ? tag('Front page', 'neutral') : null), p.updatedAt ? h('span', { class: 'row-meta' }, `Updated ${formatDate(p.updatedAt, ctx.tz)}`) : null)
      )
    )
  );
}

// ---------- Files (F5) ----------

const FILE_ICON = { pdf: 'file', image: 'file', video: 'video', sheet: 'file', slides: 'file', doc: 'file', zip: 'folder', file: 'file' };
const FILE_LABEL = { pdf: 'PDF', image: 'Image', video: 'Video', sheet: 'Spreadsheet', slides: 'Slides', doc: 'Document', zip: 'Zip', file: 'File' };

export function openFile(courseId, f) {
  const k = fileKind(f);
  // PDFs and images open in Canvas's viewer in a new tab; everything else downloads.
  const url = k === 'pdf' || k === 'image' ? `${CANVAS_ORIGIN}/courses/${courseId}/files/${f.id}` : f.url || `${CANVAS_ORIGIN}/courses/${courseId}/files/${f.id}/download?download_frd=1`;
  window.open(url, '_blank', 'noopener');
}

function filesTab(ctx, course) {
  const r = useContent('files', course.id);
  if (r.status !== 'ready') return statusView(r, 'files');
  const { root, byId } = folderTree(r.data.folders, r.data.files);
  const currentId = ui.folder?.[course.id];
  const folder = (currentId && byId[currentId]) || root;
  const trail = [];
  for (let f = folder; f; f = f.parentId ? byId[f.parentId] : null) trail.unshift(f);
  const go = (id) => setUi({ folder: { ...(ui.folder || {}), [course.id]: id } });
  const highlight = ui.fileHighlight;
  if (!folder.folders.length && !folder.files.length) return [crumbs(trail, go), emptyState('This folder is empty.')];
  return [
    crumbs(trail, go),
    h(
      'div',
      { class: 'rows files-list' },
      folder.folders.map((f) =>
        h('button', { class: 'row compact-row', 'data-key': `fd:${f.id}`, 'data-row': `fd:${f.id}`, onclick: () => go(f.id) }, icon('folder'), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, f.name), h('span', { class: 'row-meta' }, `${f.folders.length + f.files.length} items`)), f.locked ? icon('lock', 14) : null)
      ),
      folder.files.filter(notHidden((f) => MARK_KEY.file(course.id, f.id))).map((f) => {
        const k = fileKind(f);
        return h(
          'div',
          { class: ['row', 'compact-row', 'file-row', highlight === f.id && 'is-highlight'] },
          h(
            'button',
            { class: 'row-open', 'data-key': `fl:${f.id}`, 'data-row': `fl:${f.id}`, onclick: () => openFile(course.id, f), title: k === 'pdf' || k === 'image' ? 'Opens in a new tab' : 'Downloads' },
            icon(FILE_ICON[k]),
            h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, pinMark(MARK_KEY.file(course.id, f.id)), f.name), h('span', { class: 'row-meta' }, [FILE_LABEL[k], formatSize(f.size), f.updatedAt ? formatDate(f.updatedAt, ctx.tz) : ''].filter(Boolean).join(' · '))),
            icon(k === 'pdf' || k === 'image' ? 'external' : 'download')
          ),
          iconButton('more', 'Pin, hide or add notes', () => openDrawer('file', `${course.id}|${f.id}`), { key: `fl-more:${f.id}`, class: 'row-more' }) // I2
        );
      })
    ),
  ];
}

function crumbs(trail, go) {
  return h(
    'nav',
    { class: 'crumbs', 'aria-label': 'Folder' },
    trail.map((f, i) => [i ? h('span', { class: 'muted' }, ' / ') : null, i === trail.length - 1 ? h('strong', null, i === 0 ? 'Files' : f.name) : h('button', { class: 'link-btn', 'data-key': `crumb:${f.id}`, onclick: () => go(f.id) }, i === 0 ? 'Files' : f.name)])
  );
}

// ---------- Syllabus (F6) ----------

function syllabusTab(ctx, course) {
  // F6: a syllabus that lives in Files (PDF, Word) gets a direct link.
  const syllabusFiles = (state.cache?.index?.files || []).filter((f) => f.courseId === course.id && /syllabus/i.test(f.name));
  const fileLinks = syllabusFiles.length
    ? h('div', { class: 'quick-links' }, syllabusFiles.map((f) => h('button', { class: 'quick-link', 'data-key': `syl:${f.id}`, onclick: () => openFile(course.id, f) }, icon(fileKind(f) === 'pdf' ? 'external' : 'download'), f.name)))
    : null;
  if (!course.syllabusHtml && fileLinks) return h('div', { class: 'section' }, h('p', { class: 'caption' }, 'This class’s syllabus is a file:'), fileLinks);
  if (!course.syllabusHtml) {
    return h('div', { class: 'section' }, emptyState('This class has no syllabus text on Canvas. It may be a file: check Files or Modules.'), h('a', { class: 'link-btn', href: `${CANVAS_ORIGIN}/courses/${course.id}/assignments/syllabus`, target: '_blank', rel: 'noopener' }, 'Open the syllabus page in Canvas'));
  }
  const { fragment, files } = sanitizeHtml(course.syllabusHtml, { courseId: course.id });
  return h(
    'div',
    { class: 'section' },
    files.length ? h('div', { class: 'quick-links' }, files.map((f) => h('a', { class: 'quick-link', href: f.url, target: '_blank', rel: 'noopener' }, icon('download'), f.name))) : null,
    !files.length ? fileLinks : null,
    h('article', { class: 'prose syllabus' }, fragment)
  );
}

// ---------- Discussions (F7) ----------

function discussionsTab(ctx, course) {
  const r = useContent('topics', course.id);
  if (r.status !== 'ready') return statusView(r, 'discussions');
  if (!r.data.length) return emptyState('No discussions in this class.');
  const list = r.data.filter(notHidden((t) => MARK_KEY.discussion(course.id, t.id))).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.lastReplyAt || b.postedAt || 0) - new Date(a.lastReplyAt || a.postedAt || 0));
  return h(
    'div',
    { class: 'rows' },
    list.map((t) =>
      h(
        'button',
        { class: ['row', 'compact-row', t.unread > 0 && 'is-unread'], 'data-key': `dt:${t.id}`, 'data-row': `dt:${t.id}`, onclick: () => openDrawer('discussion', `${course.id}|${t.id}`) },
        icon('chat'),
        h(
          'span',
          { class: 'row-main' },
          h('span', { class: 'row-title' }, pinMark(MARK_KEY.discussion(course.id, t.id)), t.title, t.unread > 0 ? tag(`${t.unread} new`, 'accent') : null),
          h('span', { class: 'row-meta' }, [`${t.replies} repl${t.replies === 1 ? 'y' : 'ies'}`, t.lastReplyAt ? `last activity ${relativeAgo(t.lastReplyAt, ctx.now)}` : null, t.dueAt ? `due ${formatDate(t.dueAt, ctx.tz)}` : null].filter(Boolean).join(' · '))
        )
      )
    )
  );
}

// ---------- People (F10, F11) ----------

function peopleTab(ctx, course) {
  const staff = course.staff || [];
  const slots = officeHourSlots(course, state.userdata);
  const orphan = slots.filter((s) => !staff.some((p) => sameName(s.person, p.name)));
  const profileNote = (() => {
    const p = ctx.grades.courses.find((c) => c.course.id === course.id)?.profileAvailable;
    return p?.officeHoursNote || null;
  })();
  return [
    h(
      'section',
      { class: 'section' },
      sectionHeader('Instructors and TAs'),
      staff.length ? h('div', { class: 'grade-list' }, staff.map((p) => personRow(course, p, slots.filter((s) => sameName(s.person, p.name))))) : emptyState('Canvas doesn’t list instructors for this class.')
    ),
    h(
      'section',
      { class: 'section' },
      sectionHeader('Office hours', button('Add office hours', () => openDrawer('officehours', `${course.id}|`), { iconName: 'plus', kind: 'ghost', key: 'oh-add' })),
      profileNote ? h('p', { class: 'caption' }, profileNote) : null,
      slots.length
        ? h('div', { class: 'grade-list' }, slots.map((s) => h('button', { class: 'grade-row', 'data-key': `slot:${s.id}`, onclick: () => openDrawer('officehours', `${course.id}|${s.person}`) }, h('span', { class: 'grade-nick' }, s.person), h('span', { class: 'grade-name' }, slotText(s)), h('span', { class: 'muted' }, s.source === 'syllabus' ? 'From syllabus' : 'Yours'))))
        : emptyState('No office hours yet. Add them from the syllabus or Canvas.'),
      orphan.length && staff.length ? h('p', { class: 'caption' }, 'Some office hours are for people Canvas doesn’t list as staff (often TAs).') : null
    ),
    feat('studyGroups') ? studyGroupSummary(course) : null,
  ];
}

export { slotText, sameName };
