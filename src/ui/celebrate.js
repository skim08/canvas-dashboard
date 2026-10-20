// J6: little celebrations. A pop when you check something off; confetti when the last
// thing due today is done or your streak reaches a milestone. Respects "Reduce motion".

import { feat } from './components.js';
import { toast } from './actions.js';
import { state } from './store.js';
import { streak } from '../lib/progress.js';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The checkbox you just ticked pops once (the app redraws, so remember which one).
// Returns true when it animated, so the caller can wait a moment before moving the item.
let popped = null;
export function popCheck(id, el = null) {
  if (!feat('celebrations')) return false;
  popped = { id, at: Date.now() };
  setTimeout(() => popped?.id === id && (popped = null), 700);
  if (!el || reduced()) return false;
  el.classList.add('is-done', 'is-popping');
  return true;
}
export const isPopping = (id) => popped?.id === id && Date.now() - popped.at < 700;

const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100];
let last = null; // { day, state, current }

// Called after each redraw. Celebrates changes you just made, never what was already true.
export function watchDay(ctx) {
  if (!feat('celebrations') || !state.cache) return;
  const s = streak(ctx.items, state.userdata, ctx.now, ctx.tz);
  const now = { day: s.today.key, state: s.today.state, current: s.current };
  const prev = last;
  last = now;
  if (!prev || prev.day !== now.day) return;
  if (prev.state === 'open' && now.state === 'done') {
    confetti();
    const m = MILESTONES.includes(now.current) ? ` That’s a ${now.current}-day streak!` : '';
    toast(`That’s everything due today.${m}`);
  }
}

export function confetti() {
  if (reduced() || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  document.body.append(canvas);
  const g = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const colors = ['--accent', '--c1', '--c2', '--c3', '--c4', '--c5', '--c6'].map((v) => css.getPropertyValue(v).trim() || '#e0679a');
  const W = canvas.width;
  const H = canvas.height;
  const bits = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 14 * devicePixelRatio,
    vy: (-Math.random() * 12 - 6) * devicePixelRatio,
    r: (Math.random() * 4 + 3) * devicePixelRatio,
    a: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const step = (t) => {
    const k = (t - start) / 1600;
    g.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.vy += 0.45 * devicePixelRatio;
      b.x += b.vx;
      b.y += b.vy;
      b.a += b.spin;
      g.globalAlpha = Math.max(0, 1 - k);
      g.fillStyle = b.c;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.a);
      g.fillRect(-b.r, -b.r / 2, b.r * 2, b.r);
      g.restore();
    }
    if (k < 1) requestAnimationFrame(step);
    else canvas.remove();
  };
  requestAnimationFrame(step);
}
