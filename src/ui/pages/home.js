// Home (B2): Needs attention, Due soon, Grades. Nothing else.

import { h } from '../dom.js';
import { Term } from '../term.js';
import { icon } from '../icons.js';
import { state, updateSettings } from '../store.js';
import { ui, setUi, openDrawer } from '../actions.js';
import { group, sectionHeader, progressBar, filterBar, feat, emptyState, loadingText, button, dot, itemRow, segmented, iconButton } from '../components.js';
import { groupItems, weekProgress, applyFilter } from '../../lib/model.js';
import { formatKeyRange, dayKey, formatDate, formatTime } from '../../lib/time.js';
import { CANVAS_ORIGIN, FEEDBACK_URL, STORE_URL, isDemo } from '../../lib/env.js';
import { openGradeDrawer } from './grades.js';
import { nextUp, upcomingTests } from '../../lib/planning.js';
import { toggleNextPin, skipNext } from '../planActions.js';
import { unreadAnnouncements } from './announcements.js';
import { unreadMessages } from './inbox.js';
import * as F from '../fmt.js';
import { pinnedEverything, hiddenMarks } from '../../lib/marks.js';
import { streakChip } from '../streak.js';
import { mochiPanel, mochiEmpty, mochiSvg, mascotName } from '../mochi.js';
import { syllabusSetupCard } from '../syllabusDrawer.js';
import { feedbackDue } from '../../lib/feedback.js';
import { completedCount } from './completed.js';

// Wide windows: Mochi's panel matches the height of the Grades + Exams column, so both
// sides carry the same weight. Elsewhere it sizes to its content.
export function balanceHome() {
  const left = document.querySelector('.home-left');
  const panel = document.querySelector('.home-right .mochi-panel');
  if (!panel) return;
  const sideBySide = left && matchMedia('(min-width: 1240px)').matches;
  panel.style.height = sideBySide ? `${Math.max(left.offsetHeight, 420)}px` : '';
}

export function renderHome(ctx) {
  // Due soon in the middle (alerts above it only when there are any); the side column
  // shows Grades at a glance and the exam countdown in your order (B8); Mochi on the right.
  const secs = state.settings.homeSections;
  const shown = (id) => secs.find((x) => x.id === id)?.visible !== false;
  const side = secs
    .filter((x) => x.visible && (x.id === 'grades' || x.id === 'exams'))
    .map((x) => (x.id === 'grades' ? gradesGlance(ctx) : feat('examCountdown') ? examCountdown(ctx) : null))
    .filter(Boolean);
  return h(
    'div',
    { class: 'page page-home' },
    h(
      'div',
      { class: 'home-layout' },
      h('div', { class: 'home-main' }, feat('syllabusDates') || feat('classSchedule') ? syllabusSetupCard(ctx) : null, feedbackCard(), shown('attention') ? alertStrip(ctx) : null, shown('due') ? dueSection(ctx) : null),
      side.length ? h('aside', { class: 'home-left', 'aria-label': 'Grades and exams' }, side) : null,
      feat('mochi') ? h('aside', { class: 'home-right', 'aria-label': mascotName() }, mochiPanel(ctx)) : null
    )
  );
}

// Alerts: only things that need action and aren't shown elsewhere (overdue work is in
// Due soon, at-risk classes in Grades at a glance). Nothing to show, nothing drawn.
// K18: once, after a week of use. Dismissing hides it for good.
function feedbackCard() {
  const usage = state.settings.usage;
  if (isDemo() || !feedbackDue(usage, { enabled: feat('feedbackPrompt'), links: [FEEDBACK_URL, STORE_URL] })) return null;
  const dismiss = () => updateSettings({ usage: { ...usage, dismissed: true } });
  return h(
    'section',
    { class: 'feedback-card', role: 'note' },
    feat('mochi') ? mochiSvg('happy', 40) : null,
    h('div', { class: 'feedback-text' }, h('strong', null, 'How’s it going?'), h('span', null, 'You’ve used the dashboard for a week. A minute of feedback helps make it better.')),
    h(
      'div',
      { class: 'feedback-actions' },
      FEEDBACK_URL ? h('a', { class: 'btn btn-primary btn-sm', href: FEEDBACK_URL, target: '_blank', rel: 'noopener', 'data-key': 'feedback-form', onclick: dismiss }, 'Share feedback') : null,
      STORE_URL ? h('a', { class: 'btn btn-secondary btn-sm', href: STORE_URL, target: '_blank', rel: 'noopener', 'data-key': 'feedback-rate', onclick: dismiss }, 'Rate it') : null
    ),
    iconButton('x', 'Don’t show this again', dismiss, { key: 'feedback-dismiss' })
  );
}

function alertStrip(ctx) {
  const pills = [];
  if (state.auth.state === 'expired') {
    pills.push(h('a', { class: 'alert-pill tone-red', href: `${CANVAS_ORIGIN}/login`, target: '_blank', rel: 'noopener', 'data-key': 'alert:auth' }, icon('alert', 14), 'Your Canvas login expired. Log in'));
  }
  const anns = feat('announcementsFeed') ? unreadAnnouncements(ctx) : [];
  if (anns.length) pills.push(h('a', { class: 'alert-pill', href: '#/announcements', 'data-key': 'alert:ann', 'data-tip': anns.slice(0, 3).map((a) => `${ctx.nickOf(a.courseId)}: ${a.title}`).join('\n') }, icon('megaphone', 14), `${anns.length} unread announcement${anns.length === 1 ? '' : 's'}`));
  const msgs = feat('inbox') ? unreadMessages() : [];
  if (msgs.length) pills.push(h('a', { class: 'alert-pill', href: '#/inbox', 'data-key': 'alert:inbox', 'data-tip': msgs.slice(0, 3).map((m) => m.subject).join('\n') }, icon('mail', 14), `${msgs.length} unread message${msgs.length === 1 ? '' : 's'}`));
  return pills.length ? h('div', { class: 'alert-strip', role: 'status' }, pills) : null;
}

// G6: work you planned for today is listed under Today, once. Something due later moves
// up (tagged "Planned today"); something already due today, overdue or pinned stays put.
export function withPlannedToday(g, today) {
  if (!feat('planning')) return g;
  const planned = new Set((state.userdata.plans || []).filter((p) => p.day === today).map((p) => p.itemId));
  if (!planned.size) return g;
  const stay = new Set([...g.pinned, ...g.overdue, ...g.today].map((i) => i.id));
  const moved = [];
  const pull = (list) => list.filter((i) => (planned.has(i.id) && !stay.has(i.id) && !i.done ? (moved.push({ ...i, plannedToday: true }), false) : true));
  return { ...g, week: pull(g.week), later: pull(g.later), nodate: pull(g.nodate), today: [...g.today.map((i) => (planned.has(i.id) ? { ...i, plannedToday: true } : i)), ...moved] };
}

function dueSection(ctx) {
  const { items, now, tz, courses } = ctx;
  const s = state.settings;
  const filtered = applyFilter(items, s.filterCourses);
  const g = withPlannedToday(groupItems(filtered, { now, tz, sort: s.sort, unpinOnSubmit: s.unpinOnSubmit, pinsEnabled: feat('pins') }), dayKey(now, tz));
  const prog = feat('progress') ? weekProgress(filtered, { now, tz }) : null;
  const hiddenCount = Object.keys(state.userdata.hidden).length + Object.values(state.userdata.snoozed).filter((u) => new Date(u).getTime() > now).length + hiddenMarks(state.userdata).length;
  const pinnedCount = feat('pins') ? pinnedEverything(state.userdata, ctx.allItems).length : 0; // I2
  const doneCount = feat('completedList') ? completedCount(ctx) : 0; // D8
  const rowCtx = { now, tz };
  const anyUpcoming = g.pinned.length + g.overdue.length + g.today.length + g.week.length + g.later.length + g.nodate.length;
  const showNext = feat('nextUp') && s.homeDueView === 'next';

  return h(
    'section',
    { class: 'section' },
    sectionHeader(
      showNext ? 'Next up' : 'Due soon',
      feat('nextUp') ? segmented([['date', 'By date'], ['next', 'Next up']], s.homeDueView, (v) => updateSettings({ homeDueView: v }), 'dueview') : null,
      prog ? progressBar(prog) : null,
      streakChip(ctx), // D9
      feat('checklist') ? button('To-do', () => openDrawer('todo-new'), { iconName: 'plus', key: 'add-todo', kind: 'ghost' }) : null
    ),
    filterBar(courses, s, updateSettings, { sort: !showNext }),
    showNext ? nextUpList(ctx, filtered) : null,
    // C6 removed at your request (2026-10-07): no busy-week banners or shading anywhere.
    showNext
      ? null
      : [
          group('pinned', 'Pinned', g.pinned, rowCtx, { showLate: true }),
          group('overdue', 'Overdue', g.overdue, rowCtx, { tone: 'red', showLate: true }),
          group('today', 'Today', g.today, rowCtx),
          group('week', 'This week', g.week, rowCtx),
          group('later', 'Later', g.later, rowCtx),
          group('nodate', 'No due date', g.nodate, rowCtx, { collapsed: true }),
          group('done', 'Done', g.done, rowCtx, { collapsed: true }),
        ],
    showNext
      ? null
      : !anyUpcoming && !g.done.length
      ? emptyState(state.cache ? (s.filterCourses.length ? 'Nothing due for these courses.' : 'Nothing due. Enjoy it.') : loadingText('Loading your courses…'))
      : !anyUpcoming
        ? emptyState('Nothing left to do. Nice.')
        : null,
    doneCount || pinnedCount || (feat('hideSnooze') && hiddenCount)
      ? h(
          'div',
          { class: 'due-foot' },
          doneCount ? h('a', { class: 'link-btn', href: '#/completed', 'data-key': 'show-completed' }, `${doneCount} completed`) : null,
          pinnedCount ? h('a', { class: 'link-btn', href: '#/pinned', 'data-key': 'show-pinned' }, `${pinnedCount} pinned`) : null,
          feat('hideSnooze') && hiddenCount ? h('button', { class: 'link-btn', 'data-key': 'show-hidden', onclick: () => openDrawer('hidden') }, `${hiddenCount} hidden or snoozed`) : null
        )
      : null
  );
}

// G5: a suggested order, with a one-line reason for each.
function nextUpList(ctx, items) {
  const impact = Object.fromEntries((ctx.grades?.impact || []).map((x) => [x.e.item.id, x.share]));
  const list = nextUp(items, state.userdata, { now: ctx.now, tz: ctx.tz, impact });
  if (!list.length) return mochiEmpty('Nothing left to work on. Nice.', 'celebrate') || emptyState('Nothing left to work on. Nice.');
  return h(
    'div',
    { class: 'rows' },
    list.map((x, idx) => {
      const actions = h(
        'span',
        { class: 'next-actions' },
        iconButton('pin', x.pinned ? 'Unpin from the top' : 'Pin to the top of Next up', (e) => (e.stopPropagation(), toggleNextPin(x.item.id)), { class: x.pinned ? 'is-on' : '', key: `np:${x.item.id}` }),
        h('button', { class: 'btn btn-sm btn-ghost', 'data-key': `ns:${x.item.id}`, title: 'Hide from Next up until tomorrow', onclick: (e) => (e.stopPropagation(), skipNext(x.item.id)) }, 'Skip')
      );
      const row = itemRow(x.item, { now: ctx.now, tz: ctx.tz, action: actions });
      row.querySelector('.row-due').remove();
      const meta = row.querySelector('.row-meta');
      meta.prepend(h('span', { class: 'next-rank' }, `${idx + 1}`));
      row.querySelector('.row-main').append(h('span', { class: 'next-reason', title: x.reason }, x.reason));
      return row;
    })
  );
}


// B2 + E8: projected GPA and each class's UW grade.
// Grades at a glance (side column): quarter GPA against your target, then each class.
function gradesGlance(ctx) {
  const S = ctx.grades;
  const q = S.quarter;
  return h(
    'section',
    { class: 'section glance' },
    sectionHeader('Grades', h('a', { class: 'link-btn', href: '#/grades', 'data-key': 'home-grades-link' }, 'Show All')),
    S.courses.length
      ? [
          h(
            'a',
            { class: 'glance-gpa', href: '#/grades', 'data-key': 'home-gpa' },
            h('span', { class: 'glance-gpa-value' }, F.gpa(q.gpa)),
            h('span', { class: 'glance-gpa-text' }, h('span', null, S.whatIfOn ? `${Term()} GPA · what-if` : `${Term()} GPA · projected`), q.gap != null ? h('span', { class: q.gap >= -0.005 ? 'tone-green' : 'tone-red' }, F.gapText(q.gap, S.g.targetGpa)) : null)
          ),
          h(
            'div',
            { class: 'glance-list' },
            S.courses.map((c) =>
              h(
                'button',
                { class: ['glance-row', c.atRisk && 'is-risk'], 'data-key': `grade:${c.course.id}`, 'data-tip': c.atRisk ? `At risk: ${F.needText(c) || 'below your target'}` : F.needText(c) || null, onclick: () => openGradeDrawer(c.course.id) },
                dot(ctx.colorOf(c.course.id)),
                h('span', { class: 'glance-nick' }, ctx.nickOf(c.course.id)),
                h('span', { class: 'glance-score' }, F.scoreText(c)),
                h('span', { class: 'glance-gp' }, c.noGradesYet ? '' : F.gp(c.gp))
              )
            )
          ),
        ]
      : emptyState(state.cache ? 'No classes found.' : loadingText())
  );
}

// C16: exams and in-person quizzes coming up, with days to go.
function examCountdown(ctx) {
  // The next 5 within two months; "Show All" lists every remaining quiz and exam this quarter.
  const all = upcomingTests(ctx.items, ctx.now, ctx.tz, { days: Infinity, limit: Infinity });
  const open = !!ui.expanded['exams-all'];
  const list = open ? all : upcomingTests(ctx.items, ctx.now, ctx.tz);
  const more = all.length - list.length;
  const badge = (d) => {
    const level = d <= 1 ? 'urgent' : d <= 3 ? 'soon' : d <= 6 ? 'week' : 'later';
    return h('span', { class: ['days-left', `is-${level}`] }, d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`);
  };
  return h(
    'section',
    { class: 'section glance' },
    sectionHeader(
      'Exams',
      more > 0 || open ? h('button', { class: 'link-btn', 'data-key': 'exams-all', onclick: () => setUi({ expanded: { ...ui.expanded, 'exams-all': !open } }) }, open ? 'Show Less' : 'Show All') : null
    ),
    list.length
      ? h(
          'div',
          { class: 'glance-list' },
          list.map(({ item: i, days }) =>
            h(
              'button',
              { class: 'glance-row exam-row', 'data-key': `exam:${i.id}`, 'data-tip': `${i.title} · ${i.nick}\n${formatDate(i.dueAt, ctx.tz, { weekday: 'short' })}${i.allDay ? '' : ` · ${formatTime(i.dueAt, ctx.tz)}`}${i.location ? `\n${i.location}` : ''}`, onclick: () => openDrawer('item', i.id) },
              dot(i.color),
              h('span', { class: 'glance-nick' }, h('span', { class: 'exam-title' }, i.title), h('span', { class: 'exam-when' }, `${i.nick} · ${formatDate(i.dueAt, ctx.tz, { weekday: 'short' })}`)),
              badge(days)
            )
          )
        )
      : h('p', { class: 'caption' }, 'No exams in the next two months.')
  );
}

