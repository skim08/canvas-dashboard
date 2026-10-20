// I1: browse past quarters (read-only). Lives on Grades → History.

import { h } from './dom.js';
import { icon } from './icons.js';
import { state, updateGrades } from './store.js';
import { ui, setUi, openDrawer, toast } from './actions.js';
import { emptyState, sectionHeader, button, feat, tag } from './components.js';
import { archivedTerms, toPastQuarter } from '../lib/archive.js';
import { term, terms } from './term.js';
import * as G from '../lib/grades.js';
import * as F from './fmt.js';
import { formatDate } from '../lib/time.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const termGpa = (t) => G.gpaOf(Object.values(t.courses).filter((c) => c.isClass && typeof c.finalGp === 'number').map((c) => ({ credits: c.credits ?? 5, gp: c.finalGp })));
const inHistory = (t) => state.grades.past.some((q) => q.fromArchive === t.term);

export function archiveSection() {
  if (!feat('archive')) return null;
  const terms = archivedTerms(state.archive);
  return h(
    'section',
    { class: 'section' },
    sectionHeader('Archive'),
    terms.length
      ? h(
          'div',
          { class: 'grade-list' },
          terms.map((t) => {
            const n = Object.keys(t.courses).length;
            return h(
              'button',
              { class: 'grade-row', 'data-key': `arch:${t.term}`, onclick: () => openDrawer('archive', t.term) },
              h('span', { class: 'grade-nick' }, t.term),
              h('span', { class: 'grade-name' }, `${n} class${n === 1 ? '' : 'es'}${inHistory(t) ? ' · in GPA history' : ''}`),
              h('span', { class: 'grade-gp' }, F.gpa(termGpa(t)))
            );
          })
        )
      : emptyState(`When a ${term()} ends, its classes, final grades, assignments and your notes are saved here automatically.`)
  );
}

export function addToHistory(t) {
  if (inHistory(t)) return;
  const q = toPastQuarter(t, uid());
  updateGrades((g) => g.past.push(q));
  toast(`Added ${t.term} to your GPA history`, () => updateGrades((g) => (g.past = g.past.filter((x) => x.id !== q.id))));
}

export function archiveDrawer(term, ctx) {
  const t = state.archive?.[term];
  if (!t) return emptyState(`This ${term()} isn’t in the archive.`);
  const courses = Object.values(t.courses).sort((a, b) => Number(b.isClass) - Number(a.isClass) || a.nick.localeCompare(b.nick));
  const open = ui.archOpen || null;
  const gradable = courses.filter((c) => c.isClass && typeof c.finalGp === 'number');
  return [
    h('header', { class: 'd-header' }, h('h2', { class: 'd-title' }, t.term), h('p', { class: 'd-due' }, [t.termEnd ? `Ended ${formatDate(t.termEnd, ctx.tz, { year: 'numeric' })}` : null, `Quarter GPA ${F.gpa(termGpa(t))}`].filter(Boolean).join(' · '))),
    h(
      'div',
      { class: 'd-actions' },
      inHistory(t)
        ? h('span', { class: 'muted' }, icon('check'), ' In your GPA history')
        : button('Add to GPA history', () => addToHistory(t), { kind: 'primary', iconName: 'plus', key: 'arch-add', disabled: !gradable.length })
    ),
    h('p', { class: 'caption' }, `Saved when the ${term()} ended. Read-only: Canvas data from past ${terms()} can’t change here.`),
    courses.map((c) => {
      const isOpen = open === c.id;
      return h(
        'section',
        { class: 'd-block arch-course' },
        h(
          'button',
          { class: 'arch-head', 'aria-expanded': String(isOpen), 'data-key': `archc:${c.id}`, onclick: () => setUi({ archOpen: isOpen ? null : c.id }) },
          icon(isOpen ? 'chevronDown' : 'chevron', 14),
          h('span', { class: 'arch-nick' }, c.nick),
          !c.isClass ? tag('Not a class', 'neutral') : null,
          h('span', { class: 'arch-grade' }, c.finalPct != null ? `${c.finalPct.toFixed(1)}%` : '—', c.finalGp != null ? h('strong', null, F.gp(c.finalGp)) : null)
        ),
        isOpen
          ? [
              h('p', { class: 'caption caption-tight' }, c.name),
              c.trend.length > 1 ? h('p', { class: 'caption caption-tight' }, `Grade trend: ${c.trend[0].pct.toFixed(1)}% → ${c.trend[c.trend.length - 1].pct.toFixed(1)}% over ${c.trend.length} snapshots`) : null,
              c.assignments.length
                ? h(
                    'table',
                    { class: 'mini-table arch-table' },
                    h('thead', null, h('tr', null, h('th', null, 'Assignment'), h('th', null, 'Due'), h('th', { class: 'num' }, 'Score'))),
                    h(
                      'tbody',
                      null,
                      c.assignments.map((a) =>
                        h(
                          'tr',
                          null,
                          h('td', null, a.title),
                          h('td', { class: 'muted' }, a.dueAt ? formatDate(a.dueAt, ctx.tz) : '—'),
                          h('td', { class: 'num' }, a.excused ? 'Excused' : a.score != null ? `${a.score}${a.points != null ? ` / ${a.points}` : ''}` : a.status === 'submitted' ? 'Submitted' : '—')
                        )
                      )
                    )
                  )
                : h('p', { class: 'caption' }, 'No assignments were saved.'),
              c.courseNote ? h('div', { class: 'arch-note' }, h('h4', null, 'Your notes'), h('p', null, c.courseNote)) : null,
              c.notes.length ? h('div', { class: 'arch-note' }, h('h4', null, 'Notes on assignments'), h('ul', null, c.notes.map((n) => h('li', null, h('strong', null, `${n.title}: `), n.text)))) : null,
            ]
          : null
      );
    }),
  ];
}
