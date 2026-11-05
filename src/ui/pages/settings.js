// Settings (A9). Every setting saves instantly.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { state, updateSettings, requestSync, describeSync, startDemo, exitDemo } from '../store.js';
import { ui, setUi, toast, openDrawer } from '../actions.js';
import { segmented, toggle, button, dot, iconButton } from '../components.js';
import { FEATURES, HOME_SECTIONS, COURSE_COLORS } from '../../lib/defaults.js';
import { canWrite } from '../../build.js';
import { courseRole } from '../../lib/model.js';
import { setGradeSetting } from '../gradeActions.js';
import * as G from '../../lib/grades.js';
import { buildIcs } from '../../lib/ics.js';
import { makeBackup, parseBackup, summarize, MAX_BACKUP_BYTES } from '../../lib/backup.js';
import * as storage from '../../lib/storage.js';
import { CANVAS_ORIGIN, APP_NAME, PRIVACY_URL, TERMS_URL, SUPPORT_EMAIL, isDemo } from '../../lib/env.js';
import { hostOf } from '../../lib/school.js';
import { startSchoolChange } from './setup.js';
import { themeOf } from '../mascots.js';
import { startPersonalize } from '../personalize.js';
import { needsSyllabus } from '../syllabusDrawer.js';
import { findProfile } from '../../lib/profiles.js';
import { TERM_TYPES } from '../../lib/term.js';
import { unseen, VERSION } from '../../lib/changelog.js';
import { terms } from '../term.js';

// K20: once after an update; "Got it" hides it until the next one.
function whatsNew() {
  const list = unseen(state.settings.seenVersion);
  if (!list.length || isDemo()) return null;
  return h(
    'section',
    { class: 'whats-new', role: 'status' },
    h('div', { class: 'whats-new-head' }, h('strong', null, list.length > 1 ? 'What’s new since you last looked' : `What’s new in ${list[0].version}`), button('Got it', () => updateSettings({ seenVersion: VERSION }), { key: 'whats-new-ok', kind: 'secondary' })),
    list.map((c) => [list.length > 1 ? h('p', { class: 'whats-new-version' }, `Version ${c.version}`) : null, h('ul', { class: 'plain-list' }, c.items.map((t) => h('li', null, t)))])
  );
}

// K23: every class, with its syllabus status, in one place.
function syllabusSettings(ctx) {
  const missing = new Set(needsSyllabus(ctx).map((c) => c.id));
  const classes = ctx.courses.filter((c) => !c.unavailable);
  if (!classes.length) return [h('p', { class: 'field-desc' }, 'Your classes will appear here once they load from Canvas.')];
  return classes.map((c) => {
    const p = findProfile(c);
    const typed = (state.userdata.classTimes?.[c.id] || []).length;
    const status = missing.has(c.id) ? (p ? 'Syllabus added, but no class times yet' : 'No syllabus yet') : state.userdata.syllabusSkip?.[c.id] ? `${p ? 'Syllabus added · ' : ''}No class meetings` : `${p ? 'Syllabus added' : 'No syllabus'} · ${typed ? 'class times typed in' : 'class times from the syllabus'}`;
    return field(
      c.nick,
      status,
      h('span', { class: 'set-syl-btns' }, button('Syllabus', () => openDrawer('syllabus', c.id), { key: `set-syl:${c.id}`, kind: missing.has(c.id) && !p ? 'primary' : 'secondary' }), button('Class times', () => openDrawer('classTimes', c.id), { key: `set-ct:${c.id}`, kind: missing.has(c.id) && p ? 'primary' : 'secondary' }))
    );
  });
}

// K12 + K13
const version = () => (typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : 'test');
function aboutSection() {
  const link = (href, text, key) => (href ? h('a', { class: 'link-btn', href, target: '_blank', rel: 'noopener', 'data-key': key }, text) : null);
  const report = SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} problem`)}&body=${encodeURIComponent(`What happened:\n\n\nWhat you expected:\n\n\nVersion ${version()} · Chrome ${(navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || ''}\n(Please don’t include grades or other private details unless you want to.)`)}` : null;
  return [
    h(
      'div',
      { class: 'data-note about-note' },
      h('div', { class: 'field-label' }, `${APP_NAME} · version ${version()}`),
      h('p', { class: 'field-desc' }, 'Not affiliated with Instructure (the makers of Canvas) or with any school.'),
      h('p', { class: 'field-desc' }, 'Grades, GPA and syllabus dates here are estimates worked out on your computer. Always check Canvas for deadlines and official grades, and your transcript for your GPA.'),
      h('p', { class: 'field-desc' }, 'All your data stays in Chrome on this computer. Nothing is collected, sold or shared.'),
      h('div', { class: 'about-links' }, link(PRIVACY_URL, 'Privacy policy', 'about-privacy'), link(TERMS_URL, 'Terms of use', 'about-terms'), !PRIVACY_URL && !TERMS_URL ? h('span', { class: 'caption' }, 'Privacy policy and terms: coming before public release.') : null)
    ),
    field('Report a problem', SUPPORT_EMAIL ? 'Opens an email to the developer with the version filled in. Nothing else is sent.' : 'A support email will be added before public release.', report ? h('a', { class: 'btn btn-secondary', href: report, 'data-key': 'report-problem' }, 'Report a problem') : null),
  ];
}

export function renderSettings(ctx) {
  const s = state.settings;
  return h(
    'div',
    { class: 'page page-settings' },
    h('h1', { class: 'page-title' }, 'Settings'),
    whatsNew(),
    group('Appearance', [
      field('Make Neko yours', 'Six quick questions: your study buddy, your name, GPA goal, daily workload, reminders and look.', button('Answer the questions', () => (startPersonalize(), openDrawer('personalize')), { key: 'personalize', iconName: 'note' })), // K24
      field('Color theme', `${themeOf(s.palette).title}. Pick an animal theme (or Classic) on the Themes tab.`, h('a', { class: 'btn btn-secondary', href: '#/themes', 'data-key': 'go-themes' }, 'Open Themes')), // J8 // J1
      field('Theme', 'Light, dark, or match your Mac.', segmented([['light', 'Light'], ['dark', 'Dark'], ['system', 'System']], s.theme, (v) => updateSettings({ theme: v }), 'theme')),
      field('Density', 'Compact rows or roomier cards.', segmented([['compact', 'Compact'], ['comfortable', 'Comfortable']], s.density, (v) => updateSettings({ density: v }), 'density')),
    ]),
    group('Home', [homeOrder(s)]),
    group('Courses', [coursesEditor(ctx)]),
    group('Features', [
      h('p', { class: 'group-note' }, 'Turn off anything you don’t use. It disappears completely.'),
      ...FEATURES.filter((f) => !f.group && (!f.writes || canWrite())).map((f) => field(f.label, f.desc, toggle(s.features[f.id] !== false, (v) => updateSettings((x) => ((x.features[f.id] = v), x)), f.label, `feat:${f.id}`))),
      h('div', { class: 'group-note strong' }, 'Notifications'),
      ...FEATURES.filter((f) => f.group === 'notifications').map((f) => field(f.label, f.desc, toggle(s.features[f.id] !== false, (v) => updateSettings((x) => ((x.features[f.id] = v), x)), f.label, `feat:${f.id}`))),
    ]),
    group('Notifications', notificationSettings(ctx, s)),
    group('Planning', [
      field('Daily workload limit', 'Days with more planned and due work than this are highlighted in the week view.', h('select', { 'data-key': 'workload-limit', onchange: (e) => updateSettings({ workloadLimit: Number(e.target.value) }) }, [3, 4, 5, 6, 7, 8, 10].map((n) => h('option', { value: n, selected: s.workloadLimit === n }, `${n} hours`)))),
      field('Focus sessions', 'Work and break length for the focus timer.', h('div', { class: 'time-row' }, h('select', { 'aria-label': 'Work minutes', 'data-key': 'focus-work', onchange: (e) => updateSettings({ focusWork: Number(e.target.value) }) }, [15, 20, 25, 30, 45, 50, 60, 90].map((n) => h('option', { value: n, selected: s.focusWork === n }, `${n} min work`))), h('select', { 'aria-label': 'Break minutes', 'data-key': 'focus-break', onchange: (e) => updateSettings({ focusBreak: Number(e.target.value) }) }, [5, 10, 15, 20].map((n) => h('option', { value: n, selected: s.focusBreak === n }, `${n} min break`))))),
    ]),
    s.features.calendarExport !== false ? group('Calendar export', exportSettings(ctx)) : null,
    group('Grades', [
      field('Target GPA', 'Used for every class unless you set a class target on the Grades page.', h('input', { type: 'number', step: '0.01', min: '0', max: '4', class: 'num-input', value: String(state.grades.targetGpa), 'data-key': 'target-gpa', onchange: (e) => { const v = Number(e.target.value); if (v >= 0 && v <= 4) setGradeSetting('targetGpa', v); } })),
      field('Use Canvas’s grade when it’s reliable', 'For classes with standard grading, show Canvas’s own current %. Classes with special syllabus rules (like a fixed points total or a self-weighted formula) always use the syllabus math.', toggle(state.grades.useCanvas !== false, (v) => setGradeSetting('useCanvas', v), 'Use Canvas’s grade when it’s reliable', 'use-canvas')),
      field('Recently graded', 'How far back the Recently graded list looks.', h('select', { 'data-key': 'recent-days', onchange: (e) => setGradeSetting('recentDays', Number(e.target.value)) }, [7, 14, 30].map((d) => h('option', { value: d, selected: state.grades.recentDays === d }, `${d} days`)))),
      field('Grading system', 'How your school writes grades. Grades are shown this way everywhere; GPA math is the same.', h('select', { 'data-key': 'grade-system', onchange: (e) => setGradeSetting('system', e.target.value) }, Object.entries(G.SYSTEMS).map(([id, sys]) => h('option', { value: id, selected: G.systemOf(state.grades) === id }, sys.label)))),
      field('Usual credits per class', `Used when a class’s credits aren’t set (always labeled “assumed”). Leave empty for ${G.SYSTEMS[G.systemOf(state.grades)].credits}.`, h('input', { type: 'number', step: '0.5', min: '0', max: '25', class: 'num-input', value: state.grades.defaultCredits != null ? String(state.grades.defaultCredits) : '', placeholder: String(G.SYSTEMS[G.systemOf(state.grades)].credits), 'data-key': 'usual-credits', onchange: (e) => setGradeSetting('defaultCredits', e.target.value === '' ? null : Number(e.target.value) || null) })),
      field('Credits to graduate', `Shown as a progress bar on Grades → History. Leave empty for ${G.SYSTEMS[G.systemOf(state.grades)].gradTotal}, typical for your grading system.`, h('input', { type: 'number', step: '1', min: '0', class: 'num-input', value: String(state.grades.creditsGoal ?? ''), placeholder: String(G.SYSTEMS[G.systemOf(state.grades)].gradTotal), 'data-key': 'credits-goal', onchange: (e) => setGradeSetting('creditsGoal', e.target.value === '' ? null : Number(e.target.value) || null) })),
      field('Grading scales and credits', 'Set per class: Grades → click a class → Setup.', h('a', { class: 'btn btn-secondary', href: '#/grades', 'data-key': 'go-grades' }, 'Open Grades')),
    ]),
    group('General', [
      field(
        'Terms',
        `Your school uses ${terms()}${s.termType ? '' : ' (detected from Canvas)'}. This changes wording, GPA labels and the archive.`,
        h('select', { 'data-key': 'term-type', onchange: (e) => updateSettings({ termType: e.target.value || null }) }, h('option', { value: '', selected: !s.termType }, 'Detect from Canvas'), Object.entries(TERM_TYPES).map(([v, label]) => h('option', { value: v, selected: s.termType === v }, label)))
      ),
      isDemo()
        ? field('Demo mode', 'You’re looking at a made-up student. Exiting deletes the demo data and takes you back to your own dashboard (or setup).', button('Exit demo', exitDemo, { key: 'settings-exit-demo' }))
        : field('Demo mode', 'Look around with a made-up student’s classes. Your own data isn’t touched.', button('Try it with sample data', startDemo, { key: 'settings-demo' })), // K16
      field('School', `Your Canvas: ${hostOf(CANVAS_ORIGIN)}. Changing school keeps everything you entered; Canvas data reloads from the new school.`, button('Change school', startSchoolChange, { key: 'change-school' })),
      field('Use as new-tab page', 'When off, new tabs open Chrome’s normal page. The dashboard stays one click away on the toolbar icon.', toggle(s.newTab, (v) => updateSettings({ newTab: v }), 'Use as new-tab page', 'newtab')),
      field(
        'Background refresh',
        'How often to check Canvas while Chrome is open.',
        h(
          'select',
          { 'data-key': 'refresh', onchange: (e) => updateSettings({ refreshMinutes: Number(e.target.value) }) },
          [5, 10, 15, 30, 60].map((m) => h('option', { value: m, selected: s.refreshMinutes === m }, `Every ${m} minutes`))
        )
      ),
      field('Unpin after submitting', 'Pinned items drop back into the list once they’re done.', toggle(s.unpinOnSubmit, (v) => updateSettings({ unpinOnSubmit: v }), 'Unpin after submitting', 'unpin')),
      field('Keyboard shortcuts', 'Press ? anywhere to see them.', button('Show shortcuts', () => openDrawer('help'), { key: 'show-help', iconName: 'keyboard' })),
    ]),
    group('Syllabi & class times', syllabusSettings(ctx)), // K23
    group('Data', [dataSection()]),
    group('About', aboutSection())
  );
}

// H1–H7 details (the on/off switches live under Features).
const REMINDER_OPTIONS = [72, 24, 6, 2, 1];
function notificationSettings(ctx, s) {
  const n = s.notify;
  const setN = (patch) => updateSettings((x) => ((x.notify = { ...x.notify, ...patch }), x));
  const hours = new Set(n.reminderHours);
  return [
    h('p', { class: 'group-note' }, 'Notifications appear while Chrome is open. If none show up, allow Chrome in macOS System Settings → Notifications.'),
    field(
      'Deadline reminders',
      'How long before something is due. Only for work you haven’t turned in.',
      h('div', { class: 'day-chips' }, REMINDER_OPTIONS.map((hr) => h('button', { class: ['chip', hours.has(hr) && 'is-on'], 'aria-pressed': String(hours.has(hr)), 'data-key': `rem:${hr}`, onclick: () => setN({ reminderHours: hours.has(hr) ? n.reminderHours.filter((x) => x !== hr) : [...n.reminderHours, hr].sort((a, b) => b - a) }) }, hr >= 24 ? `${hr / 24} day${hr === 24 ? '' : 's'}` : `${hr}h`)))
    ),
    field('Quiet hours', 'No reminders in this window. Anything due later still gets its reminder after.', h('div', { class: 'time-row' }, h('input', { type: 'time', value: n.quietStart, 'aria-label': 'Quiet from', 'data-key': 'quiet-start', onchange: (e) => setN({ quietStart: e.target.value }) }), h('span', { class: 'muted' }, 'to'), h('input', { type: 'time', value: n.quietEnd, 'aria-label': 'Quiet until', 'data-key': 'quiet-end', onchange: (e) => setN({ quietEnd: e.target.value }) }))),
    field('Morning summary', 'Today’s plan, once a day. If Chrome is closed then, it shows when you open Chrome that morning.', h('input', { type: 'time', value: n.morningTime, 'aria-label': 'Morning summary time', 'data-key': 'morning-time', onchange: (e) => setN({ morningTime: e.target.value }) })),
    field('Hide scores in grade alerts', 'Say a grade was posted without showing it, until you open it.', toggle(!!n.hideScores, (v) => setN({ hideScores: v }), 'Hide scores in grade alerts', 'hide-scores')),
    h('div', { class: 'group-note strong' }, 'Announcement alerts by class'),
    ...ctx.courses.map((c) => field(c.nick, null, toggle(!n.mutedAnnouncementCourses[c.id], (v) => setN({ mutedAnnouncementCourses: { ...n.mutedAnnouncementCourses, [c.id]: !v || undefined } }), `Announcement alerts for ${c.nick}`, `annmute:${c.id}`))),
  ];
}

// G8
function exportSettings(ctx) {
  const chosen = new Set(ui.exportCourses || ctx.courses.map((c) => c.id));
  const feed = state.cache?.profile?.calendarFeed;
  return [
    h('p', { class: 'group-note' }, 'Download your due dates as a file that Google Calendar and Apple Calendar can import. Re-export to pick up changes.'),
    h('div', { class: 'chips' }, ctx.courses.map((c) => h('button', { class: ['chip', chosen.has(c.id) && 'is-on'], 'aria-pressed': String(chosen.has(c.id)), 'data-key': `exp:${c.id}`, onclick: () => { const next = new Set(chosen); next.has(c.id) ? next.delete(c.id) : next.add(c.id); setUi({ exportCourses: [...next] }); } }, dot(c.color), c.nick))),
    field('Include your plan blocks', 'Work sessions you planned in Calendar → Week.', toggle(!!ui.exportPlans, (v) => setUi({ exportPlans: v }), 'Include plan blocks', 'exp-plans')),
    h('div', { class: 'd-actions' }, button('Download .ics', () => exportIcs(ctx, chosen, !!ui.exportPlans), { iconName: 'download', kind: 'primary', key: 'exp-download' })),
    h('p', { class: 'field-desc' }, h('strong', null, 'Google Calendar: '), 'Settings → Import & export → Import, then pick the file. ', h('strong', null, 'Apple Calendar: '), 'File → Import.'),
    feed
      ? h('p', { class: 'field-desc' }, 'Want it to stay up to date on its own? Subscribe to Canvas’s calendar feed instead (it has due dates but not your plans): ', h('button', { class: 'link-btn', 'data-key': 'copy-feed', onclick: () => navigator.clipboard.writeText(feed).then(() => toast('Feed link copied')) }, 'Copy feed link'), '. In Google Calendar use “From URL”; in Apple Calendar use File → New Calendar Subscription.')
      : null,
  ];
}

function exportIcs(ctx, courses, withPlans) {
  const from = ctx.now - 7 * 86400000;
  const items = ctx.items.filter((i) => i.dueAt && courses.has(i.courseId) && new Date(i.dueAt).getTime() >= from && i.area === 'main');
  const ids = new Set(items.map((i) => i.id));
  const plans = withPlans ? (state.userdata.plans || []).filter((p) => ids.has(p.itemId) || ctx.allItems.some((i) => i.id === p.itemId && courses.has(i.courseId))) : [];
  const text = buildIcs({ items, plans, nickOf: ctx.nickOf, titleOf: (id) => ctx.allItems.find((i) => i.id === id)?.title || 'Planned work', now: ctx.now });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  a.download = 'canvas-dashboard.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${items.length} due date${items.length === 1 ? '' : 's'}${plans.length ? ` and ${plans.length} plan${plans.length === 1 ? '' : 's'}` : ''}`);
}

function group(title, children) {
  return h('section', { class: 'settings-group' }, h('h2', null, title), h('div', { class: 'settings-card' }, children));
}

function field(label, desc, control) {
  return h('div', { class: 'field' }, h('div', { class: 'field-text' }, h('div', { class: 'field-label' }, label), desc ? h('div', { class: 'field-desc' }, desc) : null), h('div', { class: 'field-control' }, control));
}

// B8: drag (or use the arrows) to reorder; toggle to hide.
let dragId = null;
function homeOrder(s) {
  const move = (from, to) =>
    updateSettings((x) => {
      const list = x.homeSections;
      if (to < 0 || to >= list.length) return x;
      const [m] = list.splice(from, 1);
      list.splice(to, 0, m);
      return x;
    });
  return h(
    'div',
    { class: 'order-list' },
    h('p', { class: 'group-note' }, 'Due soon stays in the middle and alerts at the top. Drag (or use the arrows) to reorder the side column, and use the switches to hide anything.'),
    s.homeSections.map((sec, i) => {
      const label = HOME_SECTIONS.find((x) => x.id === sec.id)?.label || sec.id;
      return h(
        'div',
        {
          class: 'order-row',
          draggable: 'true',
          'data-key': `order:${sec.id}`,
          ondragstart: (e) => {
            dragId = sec.id;
            e.dataTransfer.effectAllowed = 'move';
          },
          ondragover: (e) => e.preventDefault(),
          ondrop: (e) => {
            e.preventDefault();
            const from = s.homeSections.findIndex((x) => x.id === dragId);
            if (from >= 0 && from !== i) move(from, i);
            dragId = null;
          },
        },
        h('span', { class: 'grip' }, icon('grip')),
        h('span', { class: 'order-label' }, label),
        iconButton('up', `Move ${label} up`, () => move(i, i - 1), { key: `up:${sec.id}` }),
        iconButton('down', `Move ${label} down`, () => move(i, i + 1), { key: `down:${sec.id}` }),
        toggle(sec.visible, (v) => updateSettings((x) => ((x.homeSections[i].visible = v), x)), `Show ${label}`, `vis:${sec.id}`)
      );
    })
  );
}

// B10: nickname, color and visibility per course.
function coursesEditor(ctx) {
  const all = ctx.allCourses;
  if (!all.length) return h('p', { class: 'group-note' }, 'Courses appear here after the first refresh.');
  return h(
    'div',
    { class: 'course-editor' },
    h('p', { class: 'group-note' }, 'Classes appear on Home, Courses, Grades and Calendar. Everything marked Other goes to the Other tab. Short names and colors appear everywhere; hidden courses disappear completely.'),
    all.map((c) => {
      const own = state.settings.courses[c.id] || {};
      const color = ctx.colorOf(c.id);
      const set = (patch) => updateSettings((x) => ((x.courses[c.id] = { ...(x.courses[c.id] || {}), ...patch }), x));
      return h(
        'div',
        { class: ['course-edit', (own.hidden || c.unavailable) && 'is-hidden'] },
        h('div', { class: 'course-edit-top' }, dot(color), h('span', { class: 'course-edit-name' }, c.name)),
        c.unavailable
          ? h('p', { class: 'field-desc' }, `Canvas didn’t share this course’s assignments (${c.unavailable}), so it’s left out of your lists. Everything else still loads.`)
          : null,
        h(
          'div',
          { class: 'course-edit-controls' },
          h('input', {
            class: 'text-input',
            value: own.nickname || '',
            placeholder: c.autoNick,
            maxlength: '24',
            'aria-label': `Nickname for ${c.name}`,
            'data-key': `nick:${c.id}`,
            onchange: (e) => set({ nickname: e.target.value.trim() || undefined }),
          }),
          h(
            'div',
            { class: 'swatches', role: 'radiogroup', 'aria-label': 'Course color' },
            COURSE_COLORS.map((col) =>
              h('button', { class: ['swatch', color === col && 'is-on'], style: { background: col }, role: 'radio', 'aria-checked': String(color === col), 'aria-label': `Color ${COURSE_COLORS.indexOf(col) + 1}`, 'data-key': `sw:${c.id}:${col}`, onclick: () => set({ color: col }) })
            )
          ),
          state.settings.features.otherTab !== false
            ? segmented([['core', 'Class'], ['other', 'Other']], courseRole(c, state.settings), (v) => set({ role: v }), `role:${c.id}`)
            : null,
          h('label', { class: 'inline-toggle' }, toggle(!own.hidden, (v) => set({ hidden: !v }), `Show ${c.name}`, `show:${c.id}`), h('span', null, own.hidden ? 'Hidden' : 'Shown'))
        )
      );
    })
  );
}

// A7 + A10
function dataSection() {
  const preview = ui.importPreview;
  return h(
    'div',
    { class: 'data-section' },
    h(
      'div',
      { class: 'data-note' },
      h('div', { class: 'field-label' }, 'Your data'),
      h(
        'p',
        { class: 'field-desc' },
        `Everything stays in Chrome on this computer. The dashboard only talks to ${hostOf(CANVAS_ORIGIN)}, using the login you already have${canWrite() ? ' (plus Instructure’s file storage when you upload a submission)' : ''}. It never sees your password and sends nothing anywhere else.`
      )
    ),
    field(
      'Last refresh',
      state.syncState.lastResult ? `${new Date(state.syncState.lastResult.at).toLocaleString()} · ${describeSync(state.syncState.lastResult)}` : 'No refresh yet',
      button('Refresh now', async () => toast(describeSync(await requestSync(true))), { iconName: 'refresh', key: 'refresh-now' })
    ),
    field('Back up', 'Download your settings, notes, to-dos, subtasks and grade history as one file.', button('Export backup', exportBackup, { iconName: 'download', key: 'export' })),
    field(
      'Restore',
      'Load a backup file. You’ll see what’s in it before anything changes.',
      h(
        'label',
        { class: 'btn btn-secondary file-btn', 'data-key': 'import' },
        icon('upload'),
        'Import backup',
        h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', onchange: (e) => readImport(e.target.files[0]) })
      )
    ),
    preview ? importPreview(preview) : null,
    field(
      'Clear all data',
      'Removes everything the dashboard stored, including your notes and settings. Export a backup first.',
      ui.confirmClear
        ? h('div', { class: 'confirm' }, h('span', null, 'Are you sure?'), button('Cancel', () => setUi({ confirmClear: false }), { key: 'clear-cancel' }), button('Clear everything', clearAll, { kind: 'danger', key: 'clear-confirm' }))
        : button('Clear all data', () => setUi({ confirmClear: true }), { kind: 'danger-ghost', key: 'clear' })
    )
  );
}

async function exportBackup() {
  const all = await storage.getAll();
  const backup = makeBackup(all);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `canvas-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}

async function readImport(file) {
  if (!file) return;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('That file is too large to be a backup.');
    const parsed = parseBackup(await file.text());
    setUi({ importPreview: { ...parsed, fileName: file.name } });
  } catch (e) {
    setUi({ importPreview: { error: e.message, fileName: file.name } });
  }
}

function importPreview(p) {
  if (p.error) {
    return h('div', { class: 'import-preview tone-red' }, h('p', null, `${p.fileName}: ${p.error}`), button('Dismiss', () => setUi({ importPreview: null }), { key: 'import-dismiss' }));
  }
  return h(
    'div',
    { class: 'import-preview' },
    h('p', { class: 'field-label' }, `Restore from ${p.fileName}?`),
    h('p', { class: 'field-desc' }, `Backup made ${p.exportedAt ? new Date(p.exportedAt).toLocaleString() : 'at an unknown time'}. This replaces your current settings and personal data with:`),
    p.dropped?.length ? h('p', { class: 'field-desc' }, `${p.dropped.length} damaged ${p.dropped.length === 1 ? 'entry was' : 'entries were'} left out.`) : null,
    h('ul', { class: 'summary' }, summarize(p.data).map(([label, n]) => h('li', null, h('span', null, label), h('span', { class: 'num' }, String(n))))),
    h(
      'div',
      { class: 'confirm' },
      button('Cancel', () => setUi({ importPreview: null }), { key: 'import-cancel' }),
      button(
        'Restore',
        async () => {
          await storage.set(p.data);
          setUi({ importPreview: null });
          toast('Backup restored');
        },
        { kind: 'primary', key: 'import-confirm' }
      )
    )
  );
}

async function clearAll() {
  await storage.clear();
  try {
    localStorage.removeItem('boot:theme');
    localStorage.removeItem('boot:newtab');
  } catch {
    /* ignore */
  }
  setUi({ confirmClear: false });
  toast('All data cleared');
  requestSync(true);
}

