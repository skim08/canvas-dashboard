// Hover text for anything with data-tip (calendar blocks and cards).
// Chrome's own title tooltips vanish when the page redraws (every minute, for countdowns);
// this one lives outside the page and survives redraws.

let tip = null;
let current = null;

function show(el) {
  const text = el.getAttribute('data-tip');
  if (!text) return hide();
  tip ||= Object.assign(document.createElement('div'), { className: 'tip', role: 'tooltip' });
  if (!tip.isConnected) document.body.append(tip);
  tip.textContent = text;
  const r = el.getBoundingClientRect();
  tip.style.left = '0px';
  tip.style.top = '0px';
  tip.classList.add('is-on');
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  const top = r.bottom + 6 + h > innerHeight ? r.top - h - 6 : r.bottom + 6;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  current = el.getAttribute('data-key') || text;
}

function hide() {
  tip?.classList.remove('is-on');
  current = null;
}

export function installTooltips() {
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) return hide();
    if ((el.getAttribute('data-key') || el.getAttribute('data-tip')) !== current || !tip?.classList.contains('is-on')) show(el);
  });
  document.addEventListener('mouseleave', hide);
  document.addEventListener('scroll', hide, true);
  addEventListener('scroll', hide, true);
  addEventListener('wheel', hide, { passive: true });
  addEventListener('blur', hide);
  document.addEventListener('mousedown', hide);
  document.addEventListener('dragstart', hide);
}
