// Line chart (E20, E26). Follows the dataviz rules: 2px lines, end dots with a
// surface ring, hairline grid, legend for 2+ series, crosshair + tooltip on
// hover/focus, a reference line for your target, and a table view.

import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const PAD = { top: 16, right: 56, bottom: 28, left: 44 };

function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children) if (c) el.append(c);
  return el;
}

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 0.5) || raw;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/**
 * series: [{ name, color, points: [{ x, y }] }]  (x: number, y: number|null)
 * opts: { height, yMin, yMax, yFormat, xFormat, xTicks: [x], refs: [{ y, label }], title, tableKey }
 */
export function lineChart(series, opts = {}) {
  const H = opts.height || 200;
  const W = opts.width || 680; // draw at roughly the real size so 12px text stays 12px
  const live = series.filter((s) => s.points.some((p) => p.y != null));
  const wrap = h('div', { class: 'chart' });
  if (!live.length) {
    wrap.append(h('p', { class: 'chart-empty' }, opts.emptyText || 'Not enough history yet. This fills in as grades come in.'));
    return wrap;
  }
  const xs = [...new Set(live.flatMap((s) => s.points.filter((p) => p.y != null).map((p) => p.x)))].sort((a, b) => a - b);
  const ys = live.flatMap((s) => s.points.map((p) => p.y).filter((y) => y != null)).concat((opts.refs || []).map((r) => r.y));
  let yMin = opts.yMin ?? Math.min(...ys);
  let yMax = opts.yMax ?? Math.max(...ys);
  if (yMax - yMin < (opts.minSpan ?? 1)) {
    const mid = (yMax + yMin) / 2;
    yMin = mid - (opts.minSpan ?? 1) / 2;
    yMax = mid + (opts.minSpan ?? 1) / 2;
  }
  if (opts.clampMin != null) yMin = Math.max(opts.clampMin, yMin);
  if (opts.clampMax != null) yMax = Math.min(opts.clampMax, yMax);
  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const sx = (x) => PAD.left + (xMax === xMin ? (W - PAD.left - PAD.right) / 2 : ((x - xMin) / (xMax - xMin)) * (W - PAD.left - PAD.right));
  const sy = (y) => PAD.top + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
  const fy = opts.yFormat || ((v) => String(v));
  const fx = opts.xFormat || ((v) => String(v));

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': opts.title || 'Chart' });
  // grid + y ticks
  for (const t of niceTicks(yMin, yMax)) {
    root.append(svg('line', { x1: PAD.left, x2: W - PAD.right, y1: sy(t), y2: sy(t), class: 'chart-grid' }));
    const label = svg('text', { x: PAD.left - 8, y: sy(t) + 4, class: 'chart-tick', 'text-anchor': 'end' });
    label.textContent = fy(t);
    root.append(label);
  }
  // x ticks
  const xTicks = opts.xTicks || (xs.length <= 6 ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]]);
  for (const x of xTicks) {
    const label = svg('text', { x: sx(x), y: H - 8, class: 'chart-tick', 'text-anchor': x === xMin ? 'start' : x === xMax ? 'end' : 'middle' });
    label.textContent = fx(x);
    root.append(label);
  }
  // reference lines (your target)
  for (const r of opts.refs || []) {
    if (r.y < yMin || r.y > yMax) continue;
    root.append(svg('line', { x1: PAD.left, x2: W - PAD.right, y1: sy(r.y), y2: sy(r.y), class: 'chart-ref' }));
    const t = svg('text', { x: W - PAD.right + 6, y: sy(r.y) + 4, class: 'chart-ref-label' });
    t.textContent = r.label;
    root.append(t);
  }
  // series
  for (const s of live) {
    const pts = s.points.filter((p) => p.y != null);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    root.append(svg('path', { d, class: 'chart-line', style: `stroke:${s.color}` }));
    const last = pts[pts.length - 1];
    root.append(svg('circle', { cx: sx(last.x), cy: sy(last.y), r: 4, class: 'chart-dot', style: `fill:${s.color}` }));
    if (live.length <= 4 && !opts.noEndLabels) {
      const t = svg('text', { x: sx(last.x) + 8, y: sy(last.y) + 4, class: 'chart-end' });
      t.textContent = fy(last.y);
      root.append(t);
    }
  }
  // hover layer
  const cross = svg('line', { y1: PAD.top, y2: H - PAD.bottom, class: 'chart-cross', visibility: 'hidden' });
  root.append(cross);
  const tip = h('div', { class: 'chart-tip', hidden: true });
  let idx = -1;
  const show = (i) => {
    idx = Math.max(0, Math.min(xs.length - 1, i));
    const x = xs[idx];
    cross.setAttribute('x1', sx(x));
    cross.setAttribute('x2', sx(x));
    cross.setAttribute('visibility', 'visible');
    tip.replaceChildren(
      h('div', { class: 'chart-tip-x' }, fx(x)),
      ...live.map((s) => {
        const p = s.points.find((q) => q.x === x);
        return h('div', { class: 'chart-tip-row' }, h('span', { class: 'chart-key', style: { background: s.color } }), h('strong', null, p?.y != null ? fy(p.y) : '—'), h('span', null, s.name));
      })
    );
    tip.hidden = false;
    const pctX = sx(x) / W;
    tip.style.left = `${pctX * 100}%`;
    tip.style.transform = pctX > 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  const hit = svg('rect', { x: PAD.left, y: 0, width: W - PAD.left - PAD.right, height: H, fill: 'transparent' });
  hit.addEventListener('pointermove', (e) => {
    const box = root.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    xs.forEach((x, i) => {
      if (Math.abs(sx(x) - vx) < Math.abs(sx(xs[best]) - vx)) best = i;
    });
    show(best);
  });
  hit.addEventListener('pointerleave', hide);
  root.append(hit);

  const plot = h('div', {
    class: 'chart-plot',
    tabindex: '0',
    'aria-label': `${opts.title || 'Chart'}. Use left and right arrows to read values.`,
    onkeydown: (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        show(idx < 0 ? xs.length - 1 : idx + (e.key === 'ArrowRight' ? 1 : -1));
      } else if (e.key === 'Escape') hide();
    },
    onblur: hide,
  });
  plot.append(root, tip);

  const legend =
    live.length >= 2
      ? h('div', { class: 'chart-legend' }, live.map((s) => h('span', { class: 'chart-legend-item' }, h('span', { class: 'chart-key', style: { background: s.color } }), s.name)))
      : null;

  // Table view (accessibility + exact values)
  const tableOpen = !!opts.tableOpen;
  const table = tableOpen
    ? h(
        'table',
        { class: 'chart-table' },
        h('thead', null, h('tr', null, h('th', null, opts.xLabel || 'Date'), live.map((s) => h('th', { class: 'num' }, s.name)))),
        h('tbody', null, xs.map((x) => h('tr', null, h('td', null, fx(x)), live.map((s) => h('td', { class: 'num' }, (() => {
          const p = s.points.find((q) => q.x === x);
          return p?.y != null ? fy(p.y) : '—';
        })())))))
      )
    : null;
  const toggle = opts.onToggleTable ? h('button', { class: 'link-btn chart-table-toggle', 'data-key': `table:${opts.tableKey || ''}`, onclick: opts.onToggleTable }, tableOpen ? 'Hide table' : 'Show table') : null;

  wrap.append(...[legend, plot, toggle, table].filter(Boolean));
  return wrap;
}
