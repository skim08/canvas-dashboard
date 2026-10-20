// Grades (Phase 2). Three tabs keep it uncluttered:
//   This quarter — GPA, classes, what to focus on (E7–E18, E21–E24)
//   Trends       — charts over time (E20)
//   History      — past quarters, cumulative GPA, credits, subjects (E5, E26–E28)

import { h } from '../dom.js';
import { term, Term, terms } from '../term.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { ui, setUi, openDrawer } from '../actions.js';
import { dot, emptyState, loadingText, sectionHeader, feat, segmented, button, itemRow, tag } from '../components.js';
import { waitingForGrade } from '../../lib/model.js';
import { formatDate, relativeAgo } from '../../lib/time.js';
import { lineChart } from '../charts.js';
import * as F from '../fmt.js';
import { toggleWhatIf, resetWhatIf, saveScenario, loadScenario, deleteScenario, addQuarter } from '../gradeActions.js';
import { archiveSection } from '../archiveView.js';

const TABS = [
  ['quarter', 'This term'], // K4: relabeled per school below
  ['trends', 'Trends'],
  ['history', 'History'],
];

export function renderGrades(ctx) {
  const tabs = TABS.filter(([id]) => (id === 'trends' ? feat('gradeTrends') : id === 'history' ? feat('gpaHistory') : true)).map(([id, label]) => [id, id === 'quarter' ? `This ${term()}` : label]);
  const tab = tabs.some(([id]) => id === ui.gradesTab) ? ui.gradesTab : 'quarter';
  const body = tab === 'trends' ? trendsTab(ctx) : tab === 'history' ? historyTab(ctx) : quarterTab(ctx);
  return h(
    'div',
    { class: 'page' },
    h(
      'div',
      { class: 'page-head' },
      h('h1', { class: 'page-title' }, 'Grades'),
      tabs.length > 1 ? segmented(tabs, tab, (v) => setUi({ gradesTab: v }), 'gtab') : null
    ),
    body
  );
}

// ---------- This quarter ----------

function quarterTab(ctx) {
  const S = ctx.grades;
  if (!ctx.courses.length) return emptyState(state.cache ? 'No classes found.' : loadingText());
  return [whatIfBar(S), gpaCard(S, ctx), courseList(S, ctx), impactSection(S, ctx), recentSection(S, ctx), waitingSection(S, ctx), lostSection(S, ctx), missingSection(S, ctx), regradeSection(S, ctx)];
}

// E16
function whatIfBar(S) {
  if (!feat('whatIf')) return null;
  if (!S.whatIfOn) {
    return h('div', { class: 'whatif-off' }, button('What-if mode', toggleWhatIf, { iconName: 'flask', key: 'whatif-on', kind: 'ghost' }), h('span', { class: 'caption' }, 'Try hypothetical scores without touching your real grades.'));
  }
  const count = Object.keys(S.g.whatIf).length;
  return h(
    'div',
    { class: 'whatif-bar' },
    h('div', { class: 'whatif-top' }, icon('flask'), h('strong', null, 'What-if mode'), h('span', null, count ? `${count} hypothetical score${count === 1 ? '' : 's'} included. Real grades aren’t changed.` : 'Open a class and type scores on its Assignments tab.')),
    h(
      'div',
      { class: 'whatif-actions' },
      S.g.scenarios.length
        ? h(
            'select',
            { 'data-key': 'scenario', 'aria-label': 'Load a saved scenario', onchange: (e) => e.target.value && loadScenario(e.target.value) },
            h('option', { value: '' }, 'Load scenario…'),
            S.g.scenarios.map((s) => h('option', { value: s.id }, s.name))
          )
        : null,
      h(
        'form',
        {
          class: 'inline-form',
          onsubmit: (e) => {
            e.preventDefault();
            saveScenario(e.target.elements.name.value);
            e.target.reset();
          },
        },
        h('input', { name: 'name', class: 'text-input', placeholder: 'Name this scenario', 'data-key': 'scenario-name', autocomplete: 'off' }),
        button('Save', null, { type: 'submit', key: 'scenario-save', disabled: !count })
      ),
      button('Reset', resetWhatIf, { key: 'whatif-reset', disabled: !count }),
      button('Exit', toggleWhatIf, { key: 'whatif-off', kind: 'ghost' })
    ),
    S.g.scenarios.length
      ? h('div', { class: 'scenario-list' }, S.g.scenarios.map((s) => h('span', { class: 'chip' }, s.name, h('button', { class: 'chip-x', 'aria-label': `Delete ${s.name}`, 'data-key': `sc-del:${s.id}`, onclick: () => deleteScenario(s.id) }, icon('x', 12)))))
      : null
  );
}

// E8, E9, E10, E12
function gpaCard(S, ctx) {
  const q = S.quarter;
  const target = S.g.targetGpa;
  return h(
    'section',
    { class: ['gpa-card', S.whatIfOn && 'is-whatif'] },
    h(
      'div',
      { class: 'gpa-main' },
      h('div', { class: 'gpa-label' }, `${Term()} GPA · ${S.whatIfOn ? 'what-if' : 'projected'}`),
      h('div', { class: 'gpa-hero' }, F.gpa(q.gpa)),
      h('div', { class: 'gpa-estimate' }, 'Estimate · official grades are on Canvas and your transcript'), // K12
      q.gap != null ? h('div', { class: ['gpa-gap', q.gap >= -0.005 ? 'tone-green' : 'tone-red'] }, F.gapText(q.gap, target)) : h('div', { class: 'gpa-gap tone-muted' }, 'Set up your classes to see your GPA')
    ),
    h(
      'dl',
      { class: 'gpa-facts' },
      h('dt', null, 'Cumulative'),
      h('dd', null, F.gpa(S.cumulative.projected), S.cumulative.official != null ? h('span', { class: 'muted' }, ` · official so far ${F.gpa(S.cumulative.official)}`) : null),
      h('dt', { title: 'Worst: 0% on everything left. Best: 100% on everything left. Likely: you keep your current averages.' }, 'Possible range'),
      h('dd', null, q.range.worst != null ? `${F.gpa(q.range.worst)} – ${F.gpa(q.range.best)}` : '—', q.range.likely != null ? h('span', { class: 'muted' }, ` · likely ${F.gpa(q.range.likely)}`) : null),
      h('dt', null, 'Target'),
      h('dd', null, target.toFixed(2), S.cumulative.gap != null ? h('span', { class: 'muted' }, ` · cumulative ${F.gapText(S.cumulative.gap, target)}`) : null)
    ),
    q.drag
      ? h('p', { class: 'gpa-note' }, h('strong', null, ctx.nickOf(q.drag.id)), ` is pulling you down most (${q.drag.gp.toFixed(1)} vs your ${target.toFixed(1)} target).`)
      : q.gpa != null
        ? h('p', { class: 'gpa-note tone-green' }, 'Every class is at or above your target.')
        : null,
    // E33: nothing to set up; guesses are named so you know what's estimated.
    S.estimated.length
      ? h(
          'p',
          { class: 'gpa-setup' },
          icon('alert'),
          h('span', null, `Includes estimates: ${S.estimated.map((c) => `${ctx.nickOf(c.course.id)} (${c.estimates.join(', ').toLowerCase()})`).join('; ')}.`),
          button('Details', () => openGradeDrawer(S.estimated[0].course.id, 'setup'), { key: 'gpa-setup' })
        )
      : null
  );
}

export function openGradeDrawer(courseId, tab = 'overview') {
  ui.gradeTab = tab;
  openDrawer('grade', courseId);
}

function courseList(S, ctx) {
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Classes'),
    h(
      'div',
      { class: 'grade-list' },
      S.courses.map((c) => {
        const need = F.needText(c);
        return h(
          'button',
          { class: 'grade-row grade-row-rich', 'data-key': `grades:${c.course.id}`, 'data-row': `grades:${c.course.id}`, onclick: () => openGradeDrawer(c.course.id) },
          dot(ctx.colorOf(c.course.id)),
          h(
            'span',
            { class: 'grade-main' },
            h('span', { class: 'grade-nick' }, ctx.nickOf(c.course.id)),
            need ? h('span', { class: 'grade-need' }, need) : null
          ),
          c.estimates.length ? h('span', { class: 'tag tag-neutral', title: c.estimates.join(' · ') }, 'Estimated') : null,
          c.atRisk ? tag('At risk', 'red') : c.excluded ? tag(c.excluded, 'neutral') : c.gp != null && c.gp >= c.target - 1e-9 ? tag('On track', 'green') : null,
          h('span', { class: 'grade-score', title: c.paceBased ? `Where your current pace lands at the end of the ${term()}` : null }, F.scoreText(c), c.paceBased && !c.noGradesYet ? h('span', { class: 'grade-score-sub' }, 'on pace') : null),
          h('span', { class: 'grade-gp' }, c.noGradesYet ? '' : F.gp(c.gp))
        );
      }),
      h('p', { class: 'caption' }, S.whatIfOn ? 'Includes your what-if scores.' : 'Current grades from graded work. Click a class for details and setup.')
    )
  );
}

function itemList(rows) {
  return h('div', { class: 'rows' }, rows);
}

function compactRow({ key, title, meta, right, onclick }) {
  return h(
    'button',
    { class: 'row compact-row', 'data-key': key, 'data-row': key, onclick },
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, title), meta ? h('span', { class: 'row-meta' }, meta) : null),
    right ? h('span', { class: 'row-due row-right' }, right) : null
  );
}

// E14
function impactSection(S, ctx) {
  if (!feat('gradeImpact') || !S.impact.length) return null;
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Biggest impact coming up', S.impact.length > 3 ? h('button', { class: 'link-btn', 'data-key': 'impact-all', onclick: () => openDrawer('impact') }, `All ${S.impact.length}`) : null),
    itemList(S.impact.slice(0, 3).map((x) => impactRow(x, ctx)))
  );
}

export function impactRow(x, ctx) {
  const i = x.e.item;
  return compactRow({
    key: `impact:${i.id}`,
    title: i.title,
    meta: [dot(ctx.colorOf(i.courseId)), ctx.nickOf(i.courseId), ` · ${i.dueAt ? `due ${formatDate(i.dueAt, ctx.tz)}` : 'no due date'}`],
    right: `Worth up to ${(x.share * 100).toFixed(1)}% of your ${ctx.nickOf(i.courseId)} grade`,
    onclick: () => openDrawer('item', i.id),
  });
}

// E24
function recentSection(S, ctx) {
  if (!feat('recentGrades')) return null;
  const list = S.recent;
  const unseen = list.filter((r) => r.unseen).length;
  return h(
    'section',
    { class: 'section' },
    sectionHeader(`Recently graded${unseen ? ` · ${unseen} new` : ''}`, list.length > 5 ? h('button', { class: 'link-btn', 'data-key': 'recent-all', onclick: () => openDrawer('recent') }, `All ${list.length}`) : null),
    list.length ? itemList(list.slice(0, 5).map((r) => recentRow(r, ctx))) : emptyState(`Nothing graded in the last ${S.g.recentDays} days.`)
  );
}

export function recentRow({ i, unseen }, ctx) {
  const score = i.sub.score != null && i.points ? `${F.pts(i.sub.score)} / ${F.pts(i.points)} · ${F.pct((i.sub.score / i.points) * 100, 0)}` : i.sub.grade || 'Graded';
  const comments = i.sub.comments?.length || 0;
  return compactRow({
    key: `recent:${i.id}`,
    title: [i.title, unseen ? tag('New', 'accent') : null],
    meta: [dot(ctx.colorOf(i.courseId)), ctx.nickOf(i.courseId), ` · graded ${relativeAgo(i.sub.gradedAt, ctx.now)}`, comments ? ` · ${comments} comment${comments === 1 ? '' : 's'}` : ''],
    right: score,
    onclick: () => openDrawer('item', i.id),
  });
}

// D7 + E22
function waitingSection(S, ctx) {
  if (!feat('waiting')) return null;
  const waiting = waitingForGrade(ctx.items, ctx.now).filter((i) => ctx.courses.some((c) => c.id === i.courseId));
  if (!waiting.length) return null;
  return h(
    'section',
    { class: 'section' },
    sectionHeader(`Waiting for a grade · ${waiting.length}`),
    S.courses
      .filter((c) => c.pending.items.length)
      .map((c) => h('p', { class: 'caption' }, `${ctx.nickOf(c.course.id)}: ${c.pending.items.length} item${c.pending.items.length === 1 ? '' : 's'} pending, worth ${(c.pending.share * 100).toFixed(1)}% of the grade. Projections treat ${c.pending.items.length === 1 ? 'it' : 'them'} as unknown.`)),
    itemList(
      waiting.slice(0, 7).map((i) => {
        const row = itemRow(i, { now: ctx.now, tz: ctx.tz, plain: true });
        row.querySelector('.row-due').textContent = i.waitingDays == null ? 'Submitted' : i.waitingDays === 0 ? 'Submitted today' : `Waiting ${i.waitingDays} day${i.waitingDays === 1 ? '' : 's'}`;
        return row;
      })
    )
  );
}

// E18
function lostSection(S, ctx) {
  if (!feat('pointsLost') || !S.lost.length) return null;
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Where you lost points', h('button', { class: 'link-btn', 'data-key': 'lost-all', onclick: () => openDrawer('lost') }, `All ${S.lost.length}`)),
    itemList(S.lost.slice(0, 5).map((x) => lostRow(x, ctx)))
  );
}

export function lostRow(x, ctx) {
  const i = x.e.item;
  return compactRow({
    key: `lost:${i.id}`,
    title: i.title,
    meta: [dot(ctx.colorOf(i.courseId)), ctx.nickOf(i.courseId), ` · ${i.groupName || 'Other'} · ${F.pts(i.sub.score)} / ${F.pts(i.points)}`],
    right: `−${x.cost.toFixed(2)}% of grade`,
    onclick: () => openDrawer('item', i.id),
  });
}

// E21
function missingSection(S, ctx) {
  const rows = [
    ...S.missing.map(({ i, cost }) => compactRow({ key: `miss:${i.id}`, title: i.title, meta: [tag('Missing', 'red'), ' ', dot(ctx.colorOf(i.courseId)), ctx.nickOf(i.courseId)], right: `−${cost.toFixed(2)}% if it stays 0`, onclick: () => openDrawer('item', i.id) })),
    ...S.late.map(({ i, deducted }) => compactRow({ key: `late:${i.id}`, title: i.title, meta: [tag('Late', 'amber'), ' ', dot(ctx.colorOf(i.courseId)), ctx.nickOf(i.courseId)], right: deducted ? `−${F.pts(deducted)} pts late penalty` : 'No penalty applied', onclick: () => openDrawer('item', i.id) })),
    ...S.excused.map(({ i }) => compactRow({ key: `exc:${i.id}`, title: i.title, meta: [tag('Excused', 'neutral'), ' ', dot(ctx.colorOf(i.courseId)), ctx.nickOf(i.courseId)], right: 'Not counted', onclick: () => openDrawer('item', i.id) })),
  ];
  if (!rows.length) return null;
  return h('section', { class: 'section' }, sectionHeader('Missing, late and excused'), itemList(rows));
}

// E23
export const REGRADE_LABEL = { ask: 'To ask', asked: 'Asked', resolved: 'Resolved' };
function regradeSection(S, ctx) {
  if (!feat('regrades') || !S.regrades.length) return null;
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Regrades'),
    itemList(
      S.regrades.map((r) =>
        compactRow({
          key: `rg:${r.id}`,
          title: r.i.title,
          meta: [dot(ctx.colorOf(r.i.courseId)), ctx.nickOf(r.i.courseId), r.note ? ` · ${r.note}` : ''],
          right: tag(REGRADE_LABEL[r.status], r.status === 'resolved' ? 'green' : r.status === 'asked' ? 'amber' : 'neutral'),
          onclick: () => openDrawer('item', r.i.id),
        })
      )
    )
  );
}

// ---------- Trends (E20) ----------

function chartToggle(key) {
  return {
    onToggleTable: () => setUi({ chartTables: { ...(ui.chartTables || {}), [key]: !(ui.chartTables || {})[key] } }),
    tableOpen: !!(ui.chartTables || {})[key],
    tableKey: key,
  };
}

function trendsTab(ctx) {
  const S = ctx.grades;
  const byDay = new Map();
  for (const s of state.snapshots || []) byDay.set(s.date, s); // latest snapshot per day
  const days = [...byDay.values()];
  const dayMs = (s) => new Date(`${s.date}T12:00:00Z`).getTime();
  const fx = (x) => formatDate(x, 'UTC');
  const target = S.g.targetGpa;

  const gpaChart = lineChart(
    [
      { name: `${Term()} GPA`, color: 'var(--c1)', points: days.map((s) => ({ x: dayMs(s), y: s.gpa?.quarter ?? null })) },
      { name: 'Cumulative', color: 'var(--c7)', points: days.map((s) => ({ x: dayMs(s), y: s.gpa?.cumulative ?? null })) },
    ],
    { title: 'GPA over time', yFormat: (v) => v.toFixed(2), xFormat: fx, refs: [{ y: target, label: `Target ${target.toFixed(1)}` }], minSpan: 0.4, clampMax: 4.0, emptyText: 'GPA history starts once your classes are set up. A point is recorded every day.', ...chartToggle('gpa') }
  );

  const courseCharts = S.courses.map((c) => {
    const id = c.course.id;
    const pts = days.map((s) => ({ x: dayMs(s), y: s.courses?.[id]?.pct ?? s.courses?.[id]?.score ?? null }));
    return h(
      'div',
      { class: 'chart-card' },
      h('div', { class: 'chart-card-head' }, dot(ctx.colorOf(id)), h('strong', null, ctx.nickOf(id)), h('span', { class: 'muted' }, `now ${F.pct(c.realPct)}`)),
      lineChart([{ name: ctx.nickOf(id), color: ctx.colorOf(id), points: pts }], {
        title: `${ctx.nickOf(id)} grade over time`,
        height: 170,
        width: 320,
        yFormat: (v) => `${v.toFixed(0)}%`,
        xFormat: fx,
        refs: c.threshold != null ? [{ y: c.threshold, label: c.target.toFixed(1) }] : [],
        minSpan: 6,
        ...chartToggle(id),
      })
    );
  });

  return [
    h('section', { class: 'section' }, sectionHeader('GPA over time'), h('div', { class: 'chart-card' }, gpaChart)),
    h(
      'section',
      { class: 'section' },
      sectionHeader('Each class'),
      h('p', { class: 'caption' }, 'Dashed line: the % you need for your target grade in that class. Canvas doesn’t keep history, so these start from the day the dashboard began recording.'),
      h('div', { class: 'chart-grid-2' }, courseCharts)
    ),
  ];
}

// ---------- History (E5, E26, E27, E28) ----------

function historyTab(ctx) {
  const S = ctx.grades;
  const target = S.g.targetGpa;
  const hist = S.history;
  const cr = S.credits;
  const goal = S.g.creditsGoal ?? G.SYSTEMS[G.systemOf(S.g)].gradTotal; // K3
  const chart = lineChart(
    [
      { name: `${Term()} GPA`, color: 'var(--c1)', points: hist.map((r, i) => ({ x: i, y: r.gpa })) },
      { name: 'Cumulative', color: 'var(--c7)', points: hist.map((r, i) => ({ x: i, y: r.cumulative })) },
    ],
    { title: `GPA by ${term()}`, yFormat: (v) => v.toFixed(2), xFormat: (i) => `${hist[i]?.name || ''}${hist[i]?.projected ? ' (projected)' : ''}`, xTicks: hist.map((_, i) => i), xLabel: 'Quarter', refs: [{ y: target, label: `Target ${target.toFixed(1)}` }], minSpan: 0.4, clampMax: 4.0, emptyText: 'Add your past quarters below to see your GPA history.', ...chartToggle('hist') }
  );
  const done = cr.completed;
  const pctGoal = goal ? Math.min(100, ((done + cr.inProgress) / goal) * 100) : 0;

  return [
    h('section', { class: 'section' }, sectionHeader(`GPA by ${term()}`), h('div', { class: 'chart-card' }, chart)),
    h(
      'section',
      { class: 'section' },
      sectionHeader('Credits'),
      h('div', { class: 'tiles' }, tile('Completed', String(done), 'Passing grades and S/CR'), tile('In progress', String(cr.inProgress), `This ${term()}`), tile('GPA credits', String(cr.gpaCredits), 'Numeric grades only')),
      goal
        ? h(
            'div',
            { class: 'progress progress-wide', title: `${done + cr.inProgress} of ${goal}` },
            h('span', { class: 'progress-label' }, `${done} done + ${cr.inProgress} in progress, of ${goal} to graduate`),
            h('span', { class: 'progress-track', role: 'progressbar', 'aria-valuenow': String(Math.round(pctGoal)), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('span', { class: 'progress-fill', style: { width: `${pctGoal}%` } }))
          )
        : null
    ),
    subjectsSection(S),
    archiveSection(), // I1
    pastSection(S),
  ];
}

function tile(label, value, sub) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, label), h('div', { class: 'tile-value' }, value), sub ? h('div', { class: 'tile-sub' }, sub) : null);
}

// E28
function subjectsSection(S) {
  const list = S.subjects;
  if (!list.length) return h('section', { class: 'section' }, sectionHeader('Subjects'), emptyState('Subjects appear once you have grades in at least one class.'));
  const top = list[0];
  const bottom = list.length > 1 ? list[list.length - 1] : null;
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Subjects'),
    h('p', { class: 'caption' }, `Strongest: ${top.dept} (${F.gpa(top.gpa)})${top.count === 1 ? ', from one class' : ''}`, bottom ? `. Weakest: ${bottom.dept} (${F.gpa(bottom.gpa)})${bottom.count === 1 ? ', from one class' : ''}.` : '.'),
    h(
      'div',
      { class: 'grade-list' },
      list.map((s) => h('div', { class: 'grade-row' }, h('span', { class: 'grade-nick' }, s.dept), h('span', { class: 'grade-name' }, `${s.count} class${s.count === 1 ? '' : 'es'} · ${s.credits} credits${s.count === 1 ? ' · one class only' : ''}`), h('span', { class: 'grade-gp' }, F.gpa(s.gpa))))
    )
  );
}

// E5
function pastSection(S) {
  return h(
    'section',
    { class: 'section' },
    sectionHeader(`Past ${terms()}`, button(`Add ${term()}`, () => openDrawer('quarter', addQuarter('')), { iconName: 'plus', kind: 'ghost', key: 'add-quarter' })),
    S.g.past.length
      ? h(
          'div',
          { class: 'grade-list' },
          S.g.past.map((q, i) =>
            h(
              'button',
              { class: 'grade-row', 'data-key': `quarter:${q.id}`, onclick: () => openDrawer('quarter', q.id) },
              h('span', { class: 'grade-nick' }, q.name || `Untitled ${term()}`),
              h('span', { class: 'grade-name' }, `${q.courses.length} class${q.courses.length === 1 ? '' : 'es'}`),
              h('span', { class: 'grade-gp' }, F.gpa(S.history[i]?.gpa))
            )
          )
        )
      : emptyState('Add earlier terms once (from your transcript) to see your cumulative GPA.')
  );
}
