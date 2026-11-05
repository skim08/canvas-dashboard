// J8: the Themes tab. Each theme is a card with its mascot and colors; one click applies it.

import { h } from '../dom.js';
import { state, updateSettings } from '../store.js';
import { toast } from '../actions.js';
import { THEMES, MASCOTS, mascotMarkup } from '../mascots.js';

function card(t, current) {
  const on = t.id === current;
  const m = MASCOTS[t.mascot];
  const art = h('span', { class: 'theme-art', 'aria-hidden': 'true' });
  art.innerHTML = mascotMarkup(t.mascot, on ? 'celebrate' : 'happy', 88);
  return h(
    'button',
    {
      class: ['theme-card', on && 'is-on'],
      role: 'radio',
      'aria-checked': String(on),
      'data-key': `theme:${t.id}`,
      onclick: () => {
        if (on) return;
        updateSettings({ palette: t.id });
        toast(t.id === 'classic' ? 'Theme: Classic' : `Theme: ${t.title}. Say hi to ${m.name}!`);
      },
    },
    h('span', { class: 'theme-preview', style: { background: t.swatch[0] } }, art, h('span', { class: 'theme-dots' }, t.swatch.map((c) => h('span', { class: 'theme-dot', style: { background: c } })))),
    h('span', { class: 'theme-text' }, h('strong', null, t.title, on ? h('span', { class: 'theme-current' }, 'Current') : null), h('span', null, t.blurb))
  );
}

export function renderThemes() {
  const current = THEMES.some((t) => t.id === state.settings.palette) ? state.settings.palette : 'pink';
  return h(
    'div',
    { class: 'page page-themes' },
    h('h1', { class: 'page-title' }, 'Themes'),
    h('p', { class: 'page-lead' }, 'Pick a look. Each theme has its own mascot, who greets you on Home and answers your questions. Light and dark mode both follow the theme.'),
    h('div', { class: 'theme-grid', role: 'radiogroup', 'aria-label': 'Theme' }, THEMES.map((t) => card(t, current)))
  );
}
