// Grade drawers (Phase 2): one class's grade details and setup, full lists
// (impact, recently graded, points lost) and the past-quarter editor.

import { h } from './dom.js';
import { term, Term } from './term.js';
import { icon } from './icons.js';
import { state } from './store.js';
import { ui, setUi, openDrawer } from './actions.js';
import { dot, tag, button, iconButton, segmented, toggle, emptyState, feat } from './components.js';
import { sanitizeHtml } from '../lib/sanitize.js';
import { findScale } from '../lib/scaleParse.js';
import { describeProfile } from '../lib/profiles.js';
import * as G from '../lib/grades.js';
import * as F from './fmt.js';
import { setCourseCfg, setCourseNested, setWhatIf, markAllSeen, updateQuarter, deleteQuarter, addPastCourse, updatePastCourse, deletePastCourse, flagRegrade, updateRegrade, removeRegrade } from './gradeActions.js';
import { impactRow, recentRow, lostRow } from './pages/grades.js';

const num = (v) => (v === '' || v == null ? null : Number(v));

export function gradeDrawerTitle(type) {
  return { grade: 'Class grade', impact: 'Biggest impact coming up', recent: 'Recently graded', lost: 'Where you lost points', quarter: `Past ${term()}` }[type];
}

export function renderGradeDrawer(type, id, ctx) {
  if (type === 'grade') {
    const c = ctx.grades.courses.find((x) => x.course.id === id);
    return c ? classDrawer(c, ctx) : emptyState('Class not found.');
  }
  if (type === 'impact') return h('div', { class: 'rows' }, ctx.grades.impact.map((x) => impactRow(x, ctx)));
  if (type === 'recent') {
    const list = ctx.grades.recent;
    return [
      list.some((r) => r.unseen) ? button('Mark all as seen', () => markAllSeen(list), { key: 'seen-all' }) : null,
      list.length ? h('div', { class: 'rows' }, list.map((r) => recentRow(r, ctx))) : emptyState('Nothing graded recently.'),
    ];
  }
  if (type === 'lost') return lostDrawer(ctx);
  if (type === 'quarter') return quarterEditor(id);
  return null;
}

// ---------- One class ----------

function classDrawer(c, ctx) {
  const tab = ui.gradeTab || 'overview';
  return [
    h(
      'header',
      { class: 'd-header' },
      h('span', { class: 'd-course' }, dot(ctx.colorOf(c.course.id)), ctx.nickOf(c.course.id)),
      h('h2', { class: 'd-title' }, c.course.name),
      h(
        'div',
        { class: 'class-hero' },
        h('span', { class: 'class-pct' }, F.scoreText(c)),
        c.paceBased ? h('span', { class: 'muted' }, c.model.kind === 'outOf' ? `on pace, of ${c.model.outOf}` : 'on pace') : null,
        h('span', { class: 'class-gp' }, c.gp != null ? F.gp(c.gp) : ''),
        c.atRisk ? tag('At risk', 'red') : c.excluded ? tag(c.excluded, 'neutral') : c.gp != null && c.gp >= c.target - 1e-9 ? tag('On track', 'green') : null,
        ctx.grades.whatIfOn ? tag('What-if', 'amber') : null
      )
    ),
    segmented(
      [
        ['overview', 'Overview'],
        ['assignments', 'Assignments'],
        ['setup', 'Setup'],
      ],
      tab,
      (v) => setUi({ gradeTab: v }),
      'ctab'
    ),
    tab === 'assignments' ? assignmentsTab(c, ctx) : tab === 'setup' ? setupTab(c, ctx) : overviewTab(c, ctx),
  ];
}

function block(title, ...children) {
  return h('section', { class: 'd-block' }, title ? h('h3', null, title) : null, ...children);
}

function overviewTab(c, ctx) {
  const r = c.range;
  const weakest = c.groups.filter((g) => g.pct != null && g.possible > 0).sort((a, b) => a.pct - b.pct)[0];
  const need = F.needText(c);
  const pendingCount = c.pending.items.length;
  return [
    // E7
    c.mismatch
      ? h(
          'p',
          { class: 'note' },
          `Canvas shows ${F.pct(c.canvasPct)}; the dashboard calculates ${F.pct(c.realPct)}. This usually means your weight or drop-rule changes, extra-credit marks, or assignments your instructor hides from students.`
        )
      : null,
    c.excluded ? h('p', { class: 'note' }, `${c.excluded}, so this class isn’t in your GPA.`) : null,
    howGraded(c),
    // E11 + E15
    need || c.atRisk
      ? block(
          'What you need',
          need ? h('p', { class: c.atRisk ? 'tone-red' : null }, need, c.required.status === 'needed' && c.threshold != null ? ` (${F.pct(c.threshold)} overall).` : '.') : null,
          c.atRisk ? h('p', { class: 'caption' }, `You’re ${c.gp != null ? `at ${F.gp(c.gp)}` : 'below'} against a ${c.target.toFixed(1)} target${c.range.likelyGp != null ? `, heading for ${c.range.likelyGp.toFixed(1)} at your current pace` : ''}.`) : null,
          pendingCount ? h('p', { class: 'caption' }, `${pendingCount} item${pendingCount === 1 ? ' is' : 's are'} turned in but not graded (worth ${(c.pending.share * 100).toFixed(1)}% of the grade). For this, they’re assumed to score like the rest of your work.`) : null
        )
      : null,
    // E12
    block(
      'Where this could end up',
      h(
        'table',
        { class: 'mini-table' },
        h('tbody', null, [
          ['Best', 'You get 100% on everything left', r.best, r.bestGp],
          ['Likely', 'You keep your current average', r.likely, r.likelyGp],
          ['Worst', 'You get 0% on everything left', r.worst, r.worstGp],
        ].map(([k, d, p, g]) => h('tr', null, h('th', null, k), h('td', { class: 'muted' }, d), h('td', { class: 'num' }, F.pct(p)), h('td', { class: 'num strong' }, F.gp(g)))))
      ),
      pendingCount ? h('p', { class: 'caption' }, `Includes ${pendingCount} pending item${pendingCount === 1 ? '' : 's'} as unknown.`) : null
    ),
    // E13
    block(
      'Still up for grabs',
      c.available.points
        ? [
            h('p', null, `${F.pts(c.available.points)} points, worth ${(c.available.share * 100).toFixed(1)}% of your final grade.`),
            h('ul', { class: 'plain-list' }, c.available.byGroup.map((g) => h('li', null, h('span', null, g.name), h('span', { class: 'num muted' }, `${F.pts(g.points)} pts · ${(g.share * 100).toFixed(1)}%`)))),
          ]
        : h('p', { class: 'muted' }, 'Nothing left to earn. Past-due work you can’t submit any more isn’t counted.')
    ),
    // E17
    block(
      'Categories',
      h(
        'table',
        { class: 'mini-table' },
        h('thead', null, h('tr', null, h('th', null, 'Category'), h('th', { class: 'num' }, 'Weight'), h('th', { class: 'num' }, 'Score'), h('th', { class: 'num' }, '%'), h('th', { class: 'num' }, 'Adds'))),
        h(
          'tbody',
          null,
          c.groups.map((g) =>
            h(
              'tr',
              { class: weakest && g.id === weakest.id && c.groups.filter((x) => x.pct != null).length > 1 ? 'is-weak' : null },
              h('td', null, g.name, weakest && g.id === weakest.id && c.groups.filter((x) => x.pct != null).length > 1 ? h('span', { class: 'tag tag-amber' }, 'Weakest') : null, g.dropped.length ? h('span', { class: 'muted' }, ` · ${g.dropped.length} dropped`) : null),
              h('td', { class: 'num' }, c.model.weighted ? `${F.pts(g.weight)}%` : '—'),
              h('td', { class: 'num' }, g.possible ? `${F.pts(Math.round(g.earned * 100) / 100)} / ${F.pts(g.possible)}` : '—'),
              h('td', { class: 'num' }, F.pct(g.pct)),
              h('td', { class: 'num' }, g.possible ? `${g.contribution.toFixed(1)}%` : '—')
            )
          )
        )
      ),
      h('p', { class: 'caption' }, c.model.weighted ? '“Adds” is how much each category contributes to your current grade. Empty categories are left out and the weights rescale, like Canvas.' : 'This class is points-based: every point counts the same.')
    ),
  ];
}

// E29–E33: where the number comes from, in plain language.
function howGraded(c) {
  const lines = [];
  if (c.profile) lines.push(`Set up automatically from your ${c.profile.source}.`);
  if (c.pctSource === 'canvas') lines.push('Current grade is Canvas’s own number. Projections use the same rules Canvas does.');
  else if (c.paceBased) lines.push(c.model.kind === 'outOf' ? `Graded out of ${c.model.outOf} points, so Canvas’s % (${c.canvasPct != null ? F.pct(c.canvasPct) : 'hidden'}) understates you. The score shown is where your current pace lands.` : 'Your exam weights depend on how much completion work you do, so the score shown is where your current pace lands.');
  else if (c.profile) lines.push(`Calculated from the syllabus rules${c.canvasPct == null ? ' (Canvas doesn’t show a total for this class)' : ''}.`);
  if (c.scaleNote) lines.push(c.scaleNote);
  return block(
    'How this is calculated',
    lines.map((l) => h('p', { class: 'caption caption-tight' }, l)),
    c.unmatched.length
      ? h('p', { class: 'note note-amber' }, `Not counted, because the syllabus doesn’t mention them: ${c.unmatched.map((e) => e.item.title).join(', ')}. If one should count, the class setup needs a small update.`)
      : null
  );
}

// E16, E19, E23 in one list.
function assignmentsTab(c, ctx) {
  const whatIfOn = ctx.grades.whatIfOn;
  // Graded (default): everything your grade is built from. All: every assignment.
  const show = whatIfOn ? 'all' : ui.gradedOnly === false ? 'all' : 'graded';
  const isGraded = (e) => e.state === 'graded' || e.state === 'excused';
  const byGroup = c.model.groups.map((g) => ({ g, items: c.model.items.filter((e) => e.groupId === g.id && (show === 'all' || isGraded(e))) })).filter((x) => x.items.length);
  const graded = c.model.items.filter((e) => e.state === 'graded' && !e.manual); // built-in assumptions (ACCTG professionalism) aren't graded work
  const earned = graded.reduce((s, e) => s + (e.score || 0), 0);
  const possible = graded.reduce((s, e) => s + (e.possible || 0), 0);
  return [
    whatIfOn ? null : segmented([['graded', `Graded (${graded.length})`], ['all', 'All']], show, (v) => setUi({ gradedOnly: v === 'graded' }), 'gfilter'),
    show === 'graded' && graded.length ? h('p', { class: 'caption' }, `${graded.length} graded so far: ${F.pts(Math.round(earned * 100) / 100)} of ${F.pts(possible)} points (${F.pct(possible ? (earned / possible) * 100 : null)} raw, before category weights and drops).`) : null,
    show === 'graded' && !graded.length ? h('p', { class: 'empty' }, 'Nothing has been graded in this class yet.') : null,
    whatIfOn ? h('p', { class: 'note note-amber' }, 'What-if mode: type any score to see how it changes this class and your GPA. Leave a box empty to use the real score.') : feat('whatIf') ? h('p', { class: 'caption' }, 'Turn on What-if mode on the Grades page to try hypothetical scores here.') : null,
    byGroup.map(({ g, items }) =>
      block(
        `${g.name}${c.model.weighted ? ` · ${F.pts(g.weight)}%` : ''}`,
        h(
          'div',
          { class: 'assign-list' },
          items.map((e) => {
            // A category the syllabus grades outside Canvas (e.g. ACCTG professionalism): no assignment to open.
            if (e.manual) {
              return h(
                'div',
                { class: 'assign-row' },
                h('span', { class: 'assign-title is-static' }, g.name, h('span', { class: 'muted' }, ' · not on Canvas · assumed')),
                h('span', { class: 'assign-score' }, `${F.pts(e.score)}%`)
              );
            }
            const i = e.item;
            const wi = ctx.grades.g.whatIf[e.id];
            const scoreText = e.state === 'excused' ? 'Excused' : e.state === 'graded' ? `${F.pts(e.score)} / ${F.pts(e.possible)}${e.possible ? ` · ${F.pct((e.score / e.possible) * 100, 0)}` : ''}` : e.state === 'pending' ? `Pending / ${F.pts(e.possible)}` : e.state === 'closed' ? `0 / ${F.pts(e.possible)} (closed)` : `— / ${F.pts(e.possible)}`;
            return h(
              'div',
              { class: 'assign-row' },
              h('button', { class: 'assign-title', 'data-key': `ga:${i.id}`, onclick: () => openDrawer('item', i.id) }, i.title, e.extraCredit ? h('span', { class: 'muted' }, ' · extra credit') : null, ctx.grades.g.regrades[e.id] ? h('span', { class: 'muted' }, ' · regrade') : null),
              feat('classStats') && i.stats && e.state === 'graded' ? statsBar(i, e.score) : null,
              whatIfOn && e.state !== 'excused'
                ? h('label', { class: 'whatif-input' }, h('input', {
                    type: 'number',
                    step: 'any',
                    min: '0',
                    class: ['num-input', wi != null && 'is-whatif'],
                    value: wi != null ? String(wi) : '',
                    placeholder: e.score != null ? F.pts(e.score) : '—',
                    'aria-label': `What-if score for ${i.title}`,
                    'data-key': `wi:${e.id}`,
                    onchange: (ev) => setWhatIf(e.id, num(ev.target.value)),
                  }), h('span', { class: 'muted' }, `/ ${F.pts(e.possible)}`))
                : h('span', { class: 'assign-score' }, scoreText)
            );
          })
        )
      )
    ),
  ];
}

// E19: min–max track, mean tick, your score dot.
export function statsBar(i, score) {
  const s = i.stats;
  const lo = Math.min(s.min, score);
  const hi = Math.max(s.max, score, i.points || 0);
  const at = (v) => `${hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50}%`;
  return h(
    'span',
    { class: 'stats', title: `You ${F.pts(score)} · Mean ${F.pts(Math.round(s.mean * 10) / 10)} · High ${F.pts(s.max)} · Low ${F.pts(s.min)}` },
    h('span', { class: 'stats-track' }, h('span', { class: 'stats-range', style: { left: at(s.min), width: `calc(${at(s.max)} - ${at(s.min)})` } }), h('span', { class: 'stats-mean', style: { left: at(s.mean) } }), h('span', { class: 'stats-you', style: { left: at(score) } }))
  );
}

// ---------- Setup (E1, E2, E3, E4, E6) ----------

function setupTab(c, ctx) {
  const id = c.course.id;
  if (c.profile) return autoSetup(c, ctx);
  return manualSetup(c, ctx);
}

// E33: the built-in setup from your syllabus. Nothing to fill in.
function autoSetup(c, ctx) {
  const id = c.course.id;
  const p = c.profile;
  const manualCats = (p.model.categories || []).filter((x) => x.manual);
  const rows = G.sortedRows(c.scale);
  return [
    h('p', { class: 'note' }, h('strong', null, 'Set up automatically'), ` from your ${p.source}. Nothing to fill in.`),
    block(
      'Target',
      h(
        'label',
        { class: 'field-row' },
        h('span', null, 'Target grade in this class'),
        h('input', { type: 'number', step: '0.1', min: '0', max: '4', class: 'num-input', value: c.cfg.target != null ? String(c.cfg.target) : '', placeholder: ctx.grades.g.targetGpa.toFixed(1), 'data-key': 'cfg-target', onchange: (e) => setCourseCfg(id, { target: num(e.target.value) }) })
      ),
      c.threshold != null ? h('p', { class: 'caption' }, `${c.target.toFixed(1)} takes ${F.pct(c.threshold)}${c.model.kind === 'outOf' ? ` (${Math.ceil((c.threshold / 100) * c.model.outOf)} of ${c.model.outOf} points)` : ''}.`) : null
    ),
    block('How it’s graded', h('ul', { class: 'plain-list rules' }, [`Credits: ${c.credits}`, ...describeProfile(p)].map((l) => h('li', null, l)))),
    manualCats.length
      ? block(
          'Not on Canvas',
          manualCats.map((m) =>
            h(
              'label',
              { class: 'field-row' },
              h('span', null, `${m.name} (${m.weight}%)`),
              h('span', null, h('input', { type: 'number', min: '0', max: '100', step: '1', class: 'num-input', value: String(c.cfg.manual?.[m.id] ?? m.manual.assume), 'aria-label': `${m.name} score`, 'data-key': `manual:${m.id}`, onchange: (e) => setCourseNested(id, 'manual', m.id, num(e.target.value)) }), ' %')
            )
          ),
          h('p', { class: 'caption' }, manualCats.map((m) => m.note).filter(Boolean).join(' '))
        )
      : null,
    block(
      'Grading scale',
      h('p', { class: 'caption' }, c.scaleSource === 'estimate' ? c.scaleNote : `From the syllabus: ${rows[0].min}% = ${rows[0].gp.toFixed(1)}, down to ${rows[rows.length - 1].min}% = ${rows[rows.length - 1].gp.toFixed(1)}.`),
      ...(c.scale.notes || []).map((n) => h('p', { class: 'caption caption-tight' }, n))
    ),
    h('button', { class: 'link-btn', 'data-key': 'auto-off', onclick: () => setCourseCfg(id, { auto: false }) }, 'Use my own setup instead'),
  ];
}

function manualSetup(c, ctx) {
  const id = c.course.id;
  const cfg = c.cfg;
  const scale = cfg.scale;
  const rows = scale?.rows || [];
  const problems = scale ? G.scaleProblems(scale) : [];
  const setScale = (patch) => setCourseCfg(id, { scale: { mode: 'step', round: 'none', ...(scale || {}), ...patch } });
  const editRows = (fn) => {
    const next = rows.map((r) => ({ ...r }));
    fn(next);
    setScale({ rows: next, source: 'syllabus', confirmed: true });
  };
  const syllabusFound = c.course.syllabusHtml ? findScale(c.course.syllabusHtml) : null;
  const sourceNote = {
    template: 'Starting point only, not from your syllabus. Check every row, then confirm.',
    canvas: 'From your instructor’s Canvas settings. Check it against the syllabus, then confirm.',
    parsed: 'Read from text you gave it. Check every row, then confirm.',
  }[scale?.source];
  const usingCanvasDefault = !rows.length && c.course.canvasScale;
  const autoNote =
    !rows.length && c.scaleSource !== 'canvas'
      ? h('p', { class: 'note' }, c.scaleSource === 'syllabus-auto' ? 'Using the scale found in this class’s Canvas syllabus. ' : `${c.scaleNote} `, 'You don’t need to change anything, but you can set it below.')
      : null;

  return [
    // E6
    block(
      'Target',
      h(
        'label',
        { class: 'field-row' },
        h('span', null, 'Target grade in this class'),
        h('input', { type: 'number', step: '0.1', min: '0', max: '4', class: 'num-input', value: cfg.target != null ? String(cfg.target) : '', placeholder: ctx.grades.g.targetGpa.toFixed(1), 'data-key': 'cfg-target', onchange: (e) => setCourseCfg(id, { target: num(e.target.value) }) })
      ),
      h('p', { class: 'caption' }, `Leave empty to use your overall target (${ctx.grades.g.targetGpa.toFixed(1)}).${c.threshold != null ? ` With this scale, ${c.target.toFixed(1)} takes ${F.pct(c.threshold)}.` : ''}`)
    ),
    // E2
    block(
      'Credits and grading',
      h('label', { class: 'field-row' }, h('span', null, 'Credits'), h('input', { type: 'number', step: '0.5', min: '0', max: '25', class: 'num-input', value: cfg.credits != null ? String(cfg.credits) : '', placeholder: String(c.credits), 'data-key': 'cfg-credits', onchange: (e) => setCourseCfg(id, { credits: num(e.target.value) }) })),
      h('div', { class: 'field-row' }, h('span', null, 'Graded as'), segmented([['numeric', 'Graded'], ['sn', 'S/NS'], ['crnc', 'CR/NC'], ['pnp', 'P/NP']], c.grading, (v) => setCourseCfg(id, { grading: v }), 'cfg-grading')),
      h('p', { class: 'caption' }, `${c.creditsAssumed ? `Assumed ${c.credits} credits (your usual credits per class, set in Settings → Grades). Change it if your transcript says otherwise. ` : ''}Pass/fail classes (S/NS, CR/NC, P/NP) never count toward GPA.`)
    ),
    // E1
    block(
      'Grading scale',
      usingCanvasDefault ? h('p', { class: 'note' }, 'Using your instructor’s scale from Canvas. ', button('Edit it', () => setCourseCfg(id, { scale: { ...c.course.canvasScale } }), { key: 'scale-from-canvas-edit' })) : autoNote,
      scale && sourceNote && !scale.confirmed
        ? h('p', { class: 'note note-amber' }, sourceNote, ' ', button('Looks right, confirm', () => setScale({ confirmed: true }), { key: 'scale-confirm', kind: 'primary' }))
        : null,
      rows.length
        ? h(
            'table',
            { class: 'scale-table' },
            h('thead', null, h('tr', null, h('th', null, 'At least'), h('th', null, 'Grade'), h('th', null, ''))),
            h(
              'tbody',
              null,
              G.sortedRows(scale).map((r) => {
                const idx = rows.findIndex((x) => x.min === r.min && x.gp === r.gp);
                return h(
                  'tr',
                  null,
                  h('td', null, h('input', { type: 'number', step: 'any', class: 'num-input', value: String(r.min), 'aria-label': 'Minimum percent', 'data-key': `sr-min:${idx}`, onchange: (e) => editRows((list) => (list[idx].min = Number(e.target.value))) }), ' %'),
                  h('td', null, h('input', { type: 'number', step: '0.1', min: '0', max: '4', class: 'num-input', value: r.gp.toFixed(1), 'aria-label': 'Grade point', 'data-key': `sr-gp:${idx}`, onchange: (e) => editRows((list) => (list[idx].gp = Number(e.target.value))) })),
                  h('td', null, iconButton('trash', 'Remove row', () => editRows((list) => list.splice(idx, 1)), { key: `sr-del:${idx}` }))
                );
              })
            )
          )
        : null,
      problems.length ? h('ul', { class: 'problems' }, problems.map((p) => h('li', null, p))) : null,
      h(
        'div',
        { class: 'd-actions' },
        button('Add row', () => editRows((list) => list.push({ min: rows.length ? Math.min(...rows.map((r) => r.min)) - 1 : 95, gp: rows.length ? Math.max(0, Math.round((Math.min(...rows.map((r) => r.gp)) - 0.1) * 10) / 10) : 4 })), { iconName: 'plus', key: 'sr-add' }),
        !rows.length ? button(G.systemOf(state.grades) === 'uw' ? 'Start from the common UW scale' : 'Start from a common letter scale', () => setCourseCfg(id, { scale: G.scaleTemplate(G.systemOf(state.grades)) }), { key: 'scale-template' }) : null,
        c.course.canvasScale && scale?.source !== 'canvas' ? button('Use instructor’s Canvas scale', () => setCourseCfg(id, { scale: { ...c.course.canvasScale } }), { key: 'scale-canvas' }) : null,
        rows.length ? button('Clear', () => setCourseCfg(id, { scale: null }), { key: 'scale-clear', kind: 'ghost' }) : null
      ),
      rows.length
        ? h(
            'div',
            { class: 'field-grid' },
            h('div', { class: 'field-row' }, h('span', null, 'Between rows'), segmented([['step', 'Use the row below'], ['linear', 'Interpolate']], scale.mode || 'step', (v) => setScale({ mode: v }), 'scale-mode')),
            h('div', { class: 'field-row' }, h('span', null, 'Round your % first'), segmented([['none', 'No'], ['tenth', 'To 0.1'], ['whole', 'To 1']], scale.round || 'none', (v) => setScale({ round: v }), 'scale-round'))
          )
        : null,
      // Approved E1 suggestion: syllabus next to the editor + highlighted scale lines.
      syllabusHelper(c, syllabusFound)
    ),
    weightsBlock(c),
    dropsBlock(c),
    extraCreditBlock(c),
    c.profileAvailable ? h('button', { class: 'link-btn', 'data-key': 'auto-on', onclick: () => setCourseCfg(id, { auto: true }) }, `Go back to the automatic setup from your ${c.profileAvailable.source}`) : null,
  ];
}

function syllabusHelper(c, found) {
  const id = c.course.id;
  const open = !!(ui.syllabusOpen || {})[id];
  const paste = (ui.scalePaste || {})[id] || '';
  const parsed = paste ? findScale(paste) : null;
  return h(
    'div',
    { class: 'syllabus-helper' },
    found
      ? h(
          'div',
          { class: 'found' },
          h('p', null, h('strong', null, 'Found in your syllabus:'), ' these lines look like a grading scale.'),
          h('ul', { class: 'found-lines' }, found.lines.slice(0, 12).map((l) => h('li', null, h('mark', null, l)))),
          button('Copy these into the editor', () => setCourseCfg(id, { scale: { rows: found.rows, mode: 'step', round: 'none', source: 'parsed', confirmed: false } }), { key: 'scale-from-syllabus' })
        )
      : null,
    c.course.syllabusHtml
      ? h('button', { class: 'link-btn', 'data-key': 'toggle-syllabus', onclick: () => setUi({ syllabusOpen: { ...(ui.syllabusOpen || {}), [id]: !open } }) }, open ? 'Hide syllabus' : 'Show syllabus from Canvas')
      : h('p', { class: 'caption' }, 'This class has no syllabus text on Canvas (it may be a PDF). Paste the grading scale below instead.'),
    open ? h('div', { class: 'prose syllabus-box' }, sanitizeHtml(c.course.syllabusHtml, { courseId: id }).fragment) : null,
    h(
      'label',
      { class: 'form-field' },
      h('span', null, 'Or paste the grading scale from your syllabus'),
      h('textarea', { class: 'notes', rows: '4', placeholder: '95–100%  4.0\n94%  3.9\n…', value: paste, 'data-key': `paste:${id}`, oninput: (e) => setUi({ scalePaste: { ...(ui.scalePaste || {}), [id]: e.target.value } }) })
    ),
    paste
      ? parsed
        ? h('div', { class: 'd-actions' }, h('span', { class: 'caption' }, `Found ${parsed.rows.length} rows (${parsed.rows[0].min}% → ${parsed.rows[0].gp.toFixed(1)} … ${parsed.rows[parsed.rows.length - 1].min}% → ${parsed.rows[parsed.rows.length - 1].gp.toFixed(1)}).`), button('Copy into the editor', () => (setCourseCfg(id, { scale: { rows: parsed.rows, mode: 'step', round: 'none', source: 'parsed', confirmed: false } }), setUi({ scalePaste: { ...(ui.scalePaste || {}), [id]: '' } })), { key: 'paste-use', kind: 'primary' }))
        : h('p', { class: 'caption' }, 'Couldn’t find a scale in that yet. Each line needs a % and a grade point, like “94% 3.9”.')
      : null
  );
}

// E3
function weightsBlock(c) {
  const id = c.course.id;
  const cfg = c.cfg;
  const mode = cfg.weighting || 'auto';
  const groups = c.course.groups || [];
  if (!groups.length) return null;
  const weighted = c.model.weighted;
  const total = c.model.groups.filter((g) => g.id !== '__other').reduce((s, g) => s + (g.weight || 0), 0);
  return block(
    'Category weights',
    h('div', { class: 'field-row' }, h('span', null, 'How this class is graded'), segmented([['auto', `Like Canvas (${c.course.weighted ? 'weighted' : 'points'})`], ['weighted', 'Weighted'], ['points', 'Points']], mode, (v) => setCourseCfg(id, { weighting: v }), 'cfg-weighting')),
    weighted
      ? h(
          'table',
          { class: 'mini-table' },
          h('thead', null, h('tr', null, h('th', null, 'Category'), h('th', { class: 'num' }, 'Canvas'), h('th', { class: 'num' }, 'Yours'))),
          h(
            'tbody',
            null,
            groups.map((g) =>
              h(
                'tr',
                null,
                h('td', null, g.name),
                h('td', { class: 'num muted' }, `${F.pts(g.weight)}%`),
                h('td', { class: 'num' }, h('input', { type: 'number', step: 'any', min: '0', class: 'num-input', value: cfg.weights?.[g.id] != null ? String(cfg.weights[g.id]) : '', placeholder: F.pts(g.weight), 'aria-label': `Weight for ${g.name}`, 'data-key': `w:${g.id}`, onchange: (e) => setCourseNested(id, 'weights', g.id, num(e.target.value)) }), ' %')
              )
            )
          ),
          h('tfoot', null, h('tr', null, h('td', null, 'Total'), h('td', null), h('td', { class: ['num', Math.abs(total - 100) > 0.01 && 'tone-amber'] }, `${F.pts(Math.round(total * 100) / 100)}%`)))
        )
      : h('p', { class: 'caption' }, 'Points-based: every point counts the same, so there are no weights.'),
    weighted && Math.abs(total - 100) > 0.01 ? h('p', { class: 'note note-amber' }, `Weights add up to ${F.pts(Math.round(total * 100) / 100)}%, not 100%. Check them against the syllabus.`) : null
  );
}

// E4
function dropsBlock(c) {
  const id = c.course.id;
  const groups = c.course.groups || [];
  if (!groups.length) return null;
  return block(
    'Drop rules',
    h(
      'table',
      { class: 'mini-table' },
      h('thead', null, h('tr', null, h('th', null, 'Category'), h('th', { class: 'num' }, 'Drop lowest'), h('th', { class: 'num' }, 'Drop highest'))),
      h(
        'tbody',
        null,
        groups.map((g) => {
          const own = c.cfg.drops?.[g.id] || {};
          const set = (k, v) => setCourseNested(id, 'drops', g.id, { ...own, [k]: num(v) });
          return h(
            'tr',
            null,
            h('td', null, g.name),
            h('td', { class: 'num' }, h('input', { type: 'number', min: '0', step: '1', class: 'num-input', value: own.lowest != null ? String(own.lowest) : '', placeholder: String(g.rules.dropLowest), 'aria-label': `Drop lowest in ${g.name}`, 'data-key': `dl:${g.id}`, onchange: (e) => set('lowest', e.target.value) })),
            h('td', { class: 'num' }, h('input', { type: 'number', min: '0', step: '1', class: 'num-input', value: own.highest != null ? String(own.highest) : '', placeholder: String(g.rules.dropHighest), 'aria-label': `Drop highest in ${g.name}`, 'data-key': `dh:${g.id}`, onchange: (e) => set('highest', e.target.value) }))
          );
        })
      )
    ),
    h('p', { class: 'caption' }, 'Gray numbers come from Canvas. Type a number to override. Dropping picks the scores that help you most, like Canvas does.')
  );
}

// E4: extra credit marks
function extraCreditBlock(c) {
  const id = c.course.id;
  const open = !!(ui.ecOpen || {})[id];
  const items = c.model.items.filter((e) => !e.manual && e.item?.points > 0);
  const marked = Object.keys(c.cfg.extraCredit || {}).length;
  return block(
    'Extra credit',
    h('p', { class: 'caption' }, 'Assignments worth 0 points already count as extra credit. Mark others that your syllabus says are extra credit: their points add to your score but not to the total.'),
    h('button', { class: 'link-btn', 'data-key': 'ec-toggle', onclick: () => setUi({ ecOpen: { ...(ui.ecOpen || {}), [id]: !open } }) }, open ? 'Done' : marked ? `${marked} marked · Edit` : 'Mark assignments'),
    open
      ? h(
          'ul',
          { class: 'plain-list' },
          items.map((e) =>
            h('li', null, h('span', null, e.item.title), toggle(!!c.cfg.extraCredit?.[e.id], (v) => setCourseNested(id, 'extraCredit', e.id, v ? true : null), `Extra credit: ${e.item.title}`, `ec:${e.id}`))
          )
        )
      : null
  );
}

// ---------- Lists ----------

function lostDrawer(ctx) {
  const f = ui.lostFilter || {};
  const list = ctx.grades.lost.filter((x) => (!f.course || x.c.course.id === f.course) && (!f.group || x.e.item.groupName === f.group));
  const groups = [...new Set(ctx.grades.lost.filter((x) => !f.course || x.c.course.id === f.course).map((x) => x.e.item.groupName || 'Other'))];
  return [
    h(
      'div',
      { class: 'd-actions' },
      h('select', { 'data-key': 'lost-course', 'aria-label': 'Class', onchange: (e) => setUi({ lostFilter: { course: e.target.value || null, group: null } }) }, h('option', { value: '' }, 'All classes'), ctx.grades.courses.map((c) => h('option', { value: c.course.id, selected: f.course === c.course.id }, ctx.nickOf(c.course.id)))),
      h('select', { 'data-key': 'lost-group', 'aria-label': 'Category', onchange: (e) => setUi({ lostFilter: { ...f, group: e.target.value || null } }) }, h('option', { value: '' }, 'All categories'), groups.map((g) => h('option', { value: g, selected: f.group === g }, g)))
    ),
    h('p', { class: 'caption' }, 'Sorted by how much each one lowered your course grade, not raw points.'),
    list.length ? h('div', { class: 'rows' }, list.map((x) => lostRow(x, ctx))) : emptyState('No lost points here.'),
  ];
}

// ---------- E5: past quarter editor ----------

// K3: the grades your system uses, then pass/fail and the like.
const gradeOptions = () => [...G.gradeChoices(G.systemOf(state.grades)), ...G.NON_NUMERIC.slice(0, 8)];

function quarterEditor(qid) {
  const q = state.grades.past.find((x) => x.id === qid);
  if (!q) return emptyState(`${Term()} not found.`);
  const entries = G.pastGpaEntries([q]);
  return [
    h('label', { class: 'form-field' }, h('span', null, Term()), h('input', { class: 'text-input', value: q.name, placeholder: term() === 'quarter' ? 'Autumn 2025' : 'Fall 2025', 'data-key': 'q-name', onchange: (e) => updateQuarter(qid, { name: e.target.value.trim() }) })),
    h('p', { class: 'caption' }, `GPA for this term: ${F.gpa(G.gpaOf(entries))}. Copy grades from your unofficial transcript.`),
    h(
      'table',
      { class: 'mini-table past-table' },
      h('thead', null, h('tr', null, h('th', null, 'Class'), h('th', { class: 'num' }, 'Credits'), h('th', null, 'Grade'), h('th', null, 'Counts'), h('th', null, ''))),
      h(
        'tbody',
        null,
        q.courses.map((c) =>
          h(
            'tr',
            null,
            h('td', null, h('input', { class: 'text-input', value: c.name, placeholder: 'CSE 142', 'aria-label': 'Class', 'data-key': `pc-name:${c.id}`, onchange: (e) => updatePastCourse(qid, c.id, { name: e.target.value.trim() }) })),
            h('td', { class: 'num' }, h('input', { type: 'number', step: '0.5', min: '0', class: 'num-input', value: String(c.credits ?? ''), 'aria-label': 'Credits', 'data-key': `pc-cr:${c.id}`, onchange: (e) => updatePastCourse(qid, c.id, { credits: num(e.target.value) }) })),
            h(
              'td',
              null,
              h(
                'select',
                { 'aria-label': 'Grade', 'data-key': `pc-gr:${c.id}`, onchange: (e) => updatePastCourse(qid, c.id, { grade: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) }) },
                gradeOptions().map((g) => h('option', { value: String(g), selected: String(c.grade) === String(g) }, typeof g === 'number' ? F.gp(g) : g))
              )
            ),
            h('td', null, toggle(c.counts !== false, (v) => updatePastCourse(qid, c.id, { counts: v }), 'Counts toward GPA (turn off for a repeated attempt that doesn’t count)', `pc-counts:${c.id}`)),
            h('td', null, iconButton('trash', 'Remove class', () => deletePastCourse(qid, c.id), { key: `pc-del:${c.id}` }))
          )
        )
      )
    ),
    h('p', { class: 'caption' }, 'Turn off “Counts” for a repeated class whose grade your school no longer counts in your GPA.'),
    h('div', { class: 'd-actions' }, button('Add class', () => addPastCourse(qid), { iconName: 'plus', key: 'pc-add' }), button(`Delete ${term()}`, () => (deleteQuarter(qid), setUi({ drawer: null })), { kind: 'danger-ghost', key: 'q-delete' })),
  ];
}

// ---------- Item drawer: grade details (E16, E19, E23, E24, E25) ----------

export function itemGradeBlocks(item, ctx) {
  if (item.kind !== 'assignment' || item.source !== 'canvas') return [];
  const S = ctx.grades;
  const c = S.courses.find((x) => x.course.id === item.courseId);
  const e = c?.model.items.find((x) => x.id === item.canvasId);
  const graded = item.status === 'graded' && item.sub.score != null;
  const out = [];
  const wi = S.g.whatIf[item.canvasId];

  if (graded || (S.whatIfOn && e)) {
    out.push(
      block(
        'Your score',
        h(
          'div',
          { class: 'score-line' },
          graded ? h('span', { class: 'class-pct' }, `${F.pts(item.sub.score)} / ${F.pts(item.points)}`) : h('span', { class: 'muted' }, 'Not graded yet'),
          graded && item.points ? h('span', { class: 'muted' }, F.pct((item.sub.score / item.points) * 100)) : null,
          item.sub.pointsDeducted ? tag(`−${F.pts(item.sub.pointsDeducted)} late penalty`, 'amber') : null
        ),
        S.whatIfOn && e
          ? h('label', { class: 'field-row' }, h('span', null, 'What-if score'), h('input', { type: 'number', step: 'any', min: '0', class: ['num-input', wi != null && 'is-whatif'], value: wi != null ? String(wi) : '', placeholder: graded ? F.pts(item.sub.score) : '—', 'data-key': `d-wi:${item.canvasId}`, onchange: (ev) => setWhatIf(item.canvasId, num(ev.target.value)) }))
          : null,
        e && c ? h('p', { class: 'caption' }, `Worth ${(G.itemShare(c.model, e) * 100).toFixed(1)}% of your ${ctx.nickOf(item.courseId)} grade.`) : null,
        // E19
        graded && feat('classStats')
          ? item.stats
            ? h('div', { class: 'stats-block' }, statsBar(item, item.sub.score), h('p', { class: 'caption' }, `You ${F.pts(item.sub.score)} · Mean ${F.pts(Math.round(item.stats.mean * 10) / 10)} · High ${F.pts(item.stats.max)} · Low ${F.pts(item.stats.min)}`))
            : h('p', { class: 'caption' }, 'Class stats not shared.')
          : null
      )
    );
  }
  // E25
  if (graded && item.rubric?.length && item.sub.rubric) {
    out.push(
      block(
        'Rubric scores',
        h(
          'table',
          { class: 'rubric' },
          h('thead', null, h('tr', null, h('th', null, 'Criterion'), h('th', null, 'Rating'), h('th', { class: 'num' }, 'Pts'))),
          h(
            'tbody',
            null,
            item.rubric.map((r) => {
              const a = item.sub.rubric[r.id] || {};
              const rating = (a.rating_id != null && r.ratings.find((x) => x.id === a.rating_id)) || r.ratings.find((x) => x.points === a.points);
              const full = a.points != null && a.points >= r.points;
              return h(
                'tr',
                null,
                h('td', null, h('div', { class: 'rubric-name' }, r.description), a.comments ? h('div', { class: 'rubric-long' }, `“${a.comments}”`) : null),
                h('td', null, rating ? rating.description : '—'),
                h('td', { class: ['num', !full && a.points != null && 'tone-amber'] }, a.points != null ? `${F.pts(a.points)} / ${F.pts(r.points)}` : `— / ${F.pts(r.points)}`)
              );
            })
          )
        )
      )
    );
  }
  // E24
  if (item.sub?.comments?.length) {
    out.push(block('Comments', h('ul', { class: 'comments' }, item.sub.comments.map((cm) => h('li', null, h('div', { class: 'comment-head' }, h('strong', null, cm.author), cm.at ? h('span', { class: 'muted' }, ` · ${new Date(cm.at).toLocaleDateString()}`) : null), h('div', null, cm.text))))));
  }
  // E23
  if (graded && feat('regrades')) out.push(regradeBlock(item, S));
  return out;
}

function regradeBlock(item, S) {
  const r = S.g.regrades[item.canvasId];
  if (!r) return block('Regrade', h('p', { class: 'caption' }, 'Think this score is wrong? Keep track of it here.'), button('Flag for regrade', () => flagRegrade(item.canvasId, ''), { key: 'rg-flag', iconName: 'flag' }));
  return block(
    'Regrade',
    segmented([['ask', 'To ask'], ['asked', 'Asked'], ['resolved', 'Resolved']], r.status, (v) => updateRegrade(item.canvasId, { status: v }), 'rg-status'),
    h('textarea', { class: 'notes', rows: '3', placeholder: 'What should be regraded, and why?', value: r.note || '', 'data-key': `rg-note:${item.canvasId}`, onchange: (e) => updateRegrade(item.canvasId, { note: e.target.value }) }),
    h('button', { class: 'link-btn', 'data-key': 'rg-remove', onclick: () => removeRegrade(item.canvasId) }, 'Remove from list')
  );
}
