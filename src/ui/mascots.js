// J3 + J8: the mascots, one per theme, drawn here in code (no image files, nothing
// downloaded). Every animal shares the same face kit, so each has the same five moods:
// neutral, happy, worried, sleepy, celebrate.

// J8: the themes on the Themes tab. `palette` matches [data-palette] in tokens.css;
// `swatch` previews the light colors on the theme's card.
export const THEMES = [
  { id: 'pink', mascot: 'cat', title: 'Blush', blurb: 'Soft pink, with Neko the cat.', swatch: ['#fdf5f7', '#fbe4ed', '#b03867'] },
  { id: 'matcha', mascot: 'frog', title: 'Matcha', blurb: 'Calm greens, with Kero the frog.', swatch: ['#f4f8f1', '#e3f0dc', '#376f34'] },
  { id: 'ocean', mascot: 'shark', title: 'Ocean', blurb: 'Blues and seafoam, with Nami the shark.', swatch: ['#f2f8fb', '#dff0f8', '#1f6f99'] },
  { id: 'polar', mascot: 'bear', title: 'Polar', blurb: 'Minimal white, grey and black, with Yumi the polar bear.', swatch: ['#f6f6f6', '#e8e8e8', '#2a2a2a'] },
  { id: 'honey', mascot: 'shiba', title: 'Honey', blurb: 'Warm golds, with Hachi the shiba.', swatch: ['#fdf8ef', '#f9ebd4', '#93550f'] },
  { id: 'classic', mascot: 'cat', title: 'Classic', blurb: 'The original look: neutral, with a blue accent.', swatch: ['#f7f7f5', '#e9ecfb', '#4255c9'] },
];
export const themeOf = (palette) => THEMES.find((t) => t.id === palette) || THEMES[0];

export const MASCOTS = {
  cat: { name: 'Neko', animal: 'cat' },
  frog: { name: 'Kero', animal: 'frog' },
  shark: { name: 'Nami', animal: 'shark' },
  bear: { name: 'Yumi', animal: 'polar bear' },
  shiba: { name: 'Hachi', animal: 'shiba' },
};

// ---------- the shared face kit ----------

const eyes = {
  neutral: (k, { l, r, y }) => `<ellipse cx="${l}" cy="${y}" rx="4.5" ry="5.5" fill="${k.ink}"/><ellipse cx="${r}" cy="${y}" rx="4.5" ry="5.5" fill="${k.ink}"/><circle cx="${l + 1.5}" cy="${y - 2}" r="1.5" fill="#fff"/><circle cx="${r + 1.5}" cy="${y - 2}" r="1.5" fill="#fff"/>`,
  happy: (k, { l, r, y }) => `<path d="M${l - 6} ${y + 2} q6 -8 12 0 M${r - 6} ${y + 2} q6 -8 12 0" stroke="${k.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  worried: (k, { l, r, y }) => `<ellipse cx="${l}" cy="${y + 1}" rx="4" ry="5" fill="${k.ink}"/><ellipse cx="${r}" cy="${y + 1}" rx="4" ry="5" fill="${k.ink}"/><path d="M${l - 7} ${y - 9} L${l + 5} ${y - 13} M${r - 5} ${y - 13} L${r + 7} ${y - 9}" stroke="${k.ink}" stroke-width="2.5" stroke-linecap="round"/>`,
  sleepy: (k, { l, r, y }) => `<path d="M${l - 6} ${y} q6 5 12 0 M${r - 6} ${y} q6 5 12 0" stroke="${k.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};
eyes.celebrate = eyes.happy;

const mouths = {
  neutral: (k, y) => `<path d="M52 ${y} q4 5 8 0 q4 5 8 0" stroke="${k.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  worried: (k, y) => `<path d="M53 ${y + 3} q3.5 -3 7 0 q3.5 3 7 0" stroke="${k.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  sleepy: (k, y) => `<path d="M56 ${y + 1} h8" stroke="${k.ink}" stroke-width="2.4" stroke-linecap="round"/>`,
  celebrate: (k, y) => `<path d="M51 ${y - 1} q9 13 18 0 z" fill="${k.tongue}" stroke="${k.ink}" stroke-width="2.4" stroke-linejoin="round"/>`,
};
mouths.happy = mouths.neutral;

const extras = {
  worried: () => `<path d="M100 34 q4 7 0 10 q-4 -3 0 -10z" fill="#9cc9f0"/>`,
  sleepy: (k) => `<text x="96" y="26" font-size="14" font-family="ui-rounded, sans-serif" fill="${k.ink}">z</text><text x="105" y="16" font-size="10" font-family="ui-rounded, sans-serif" fill="${k.ink}">z</text>`,
  celebrate: () => `<path d="M10 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z M108 20 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="#f2c48d"/>`,
};

const cheeks = (k, y = 70, l = 34, r = 86) => `<ellipse cx="${l}" cy="${y}" rx="8" ry="5" fill="${k.cheek}"/><ellipse cx="${r}" cy="${y}" rx="8" ry="5" fill="${k.cheek}"/>`;
const head = (k, cy = 61, rx = 44, ry = 37) => `<ellipse cx="60" cy="${cy}" rx="${rx}" ry="${ry}" fill="${k.fur}" stroke="${k.ink}" stroke-width="3"/>`;
const paws = (k, fill = k.fur) => `<ellipse cx="38" cy="99" rx="11" ry="7" fill="${fill}" stroke="${k.ink}" stroke-width="2.5"/><ellipse cx="82" cy="99" rx="11" ry="7" fill="${fill}" stroke="${k.ink}" stroke-width="2.5"/>`;

// ---------- the animals ----------
// back: drawn before the face kit (body, ears, markings). eyesAt / mouthY: where the face goes.

const ANIMALS = {
  // Neko: the original cat, soft pink.
  cat: {
    k: { ink: '#4a3a40', fur: '#fff8f5', inner: '#f5b3c8', cheek: '#f5b3c8', tongue: '#e77fa0' },
    back: (k) =>
      `<path d="M24 46 L30 10 L55 30 Z M96 46 L90 10 L65 30 Z" fill="${k.fur}" stroke="${k.ink}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M31 37 L33 20 L46 31 Z M89 37 L87 20 L74 31 Z" fill="${k.inner}"/>` +
      paws(k) +
      head(k) +
      `<path d="M55 27 q5 -6 10 0" stroke="${k.ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
      cheeks(k) +
      `<path d="M22 64 L6 60 M22 70 L6 73 M98 64 L114 60 M98 70 L114 73" stroke="${k.ink}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M56 63 h8 l-4 4.5 z" fill="${k.tongue}" stroke="${k.tongue}" stroke-width="1.5" stroke-linejoin="round"/>`,
    eyesAt: { l: 45, r: 75, y: 57 },
    mouthY: 70,
  },
  // Matcha: a round frog with eyes up on top.
  frog: {
    k: { ink: '#2f4030', fur: '#b5dba8', belly: '#eef6dc', cheek: '#f4b6b0', tongue: '#e88a8a' },
    back: (k) =>
      `<ellipse cx="36" cy="100" rx="13" ry="6.5" fill="${k.fur}" stroke="${k.ink}" stroke-width="2.5"/><ellipse cx="84" cy="100" rx="13" ry="6.5" fill="${k.fur}" stroke="${k.ink}" stroke-width="2.5"/>` +
      `<circle cx="40" cy="38" r="17" fill="${k.fur}" stroke="${k.ink}" stroke-width="3"/><circle cx="80" cy="38" r="17" fill="${k.fur}" stroke="${k.ink}" stroke-width="3"/>` +
      head(k, 66, 47, 33) +
      // cover where the eye bumps meet the head, so they read as one shape
      `<ellipse cx="60" cy="50" rx="36" ry="10" fill="${k.fur}"/><circle cx="40" cy="38" r="11" fill="#fff"/><circle cx="80" cy="38" r="11" fill="#fff"/>` +
      `<ellipse cx="60" cy="86" rx="28" ry="11" fill="${k.belly}"/>` +
      cheeks(k, 72, 28, 92) +
      `<circle cx="56" cy="62" r="1.6" fill="${k.ink}"/><circle cx="64" cy="62" r="1.6" fill="${k.ink}"/>`,
    eyesAt: { l: 40, r: 80, y: 39 },
    mouthY: 70,
  },
  // Nami: a friendly blue shark with a fin on top and a pale belly.
  shark: {
    k: { ink: '#22333f', fur: '#9cc3dd', belly: '#f2f8fc', cheek: '#f3b7c4', tongue: '#e88a9c' },
    back: (k) =>
      `<path d="M42 33 Q52 -6 82 29 Z" fill="${k.fur}" stroke="${k.ink}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M22 84 Q4 100 30 98 Z M98 84 Q116 100 90 98 Z" fill="${k.fur}" stroke="${k.ink}" stroke-width="2.5" stroke-linejoin="round"/>` +
      head(k, 62, 46, 36) +
      `<path d="M27 74 Q60 104 93 74 Q60 86 27 74 Z" fill="${k.belly}"/>` +
      `<path d="M24 56 q3 4 0 8 M20 58 q3 4 0 8 M96 56 q-3 4 0 8 M100 58 q-3 4 0 8" stroke="${k.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      cheeks(k, 69, 34, 86),
    eyesAt: { l: 45, r: 75, y: 56 },
    mouthY: 69,
  },
  // Yumi: a minimalist polar bear in white, grey and black.
  bear: {
    k: { ink: '#2a2a2a', fur: '#ffffff', inner: '#d6d6d6', muzzle: '#f1f1f1', cheek: '#e4e4e4', tongue: '#bdbdbd' },
    back: (k) =>
      `<circle cx="28" cy="32" r="13" fill="${k.fur}" stroke="${k.ink}" stroke-width="3"/><circle cx="92" cy="32" r="13" fill="${k.fur}" stroke="${k.ink}" stroke-width="3"/>` +
      `<circle cx="28" cy="32" r="6.5" fill="${k.inner}"/><circle cx="92" cy="32" r="6.5" fill="${k.inner}"/>` +
      paws(k) +
      head(k) +
      `<ellipse cx="60" cy="71" rx="17" ry="12.5" fill="${k.muzzle}" stroke="${k.inner}" stroke-width="1.5"/>` +
      cheeks(k, 68, 30, 90) +
      `<ellipse cx="60" cy="64.5" rx="5.5" ry="3.8" fill="${k.ink}"/>`,
    eyesAt: { l: 44, r: 76, y: 55 },
    mouthY: 71,
  },
  // Hachi: a shiba with a cream muzzle and little dot eyebrows.
  shiba: {
    k: { ink: '#3b2a1e', fur: '#f3b66f', cream: '#fff3e2', cheek: '#f6a3a0', tongue: '#e9878f' },
    back: (k) =>
      `<path d="M21 50 Q22 12 52 27 Z M99 50 Q98 12 68 27 Z" fill="${k.fur}" stroke="${k.ink}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M28 41 Q29 22 45 29 Z M92 41 Q91 22 75 29 Z" fill="${k.cream}"/>` +
      paws(k, k.cream) +
      head(k) +
      `<path d="M24 66 Q30 96 60 97 Q90 96 96 66 Q84 60 74 66 Q66 58 60 60 Q54 58 46 66 Q36 60 24 66 Z" fill="${k.cream}"/>` +
      `<ellipse cx="44" cy="45" rx="4.2" ry="2.6" fill="${k.cream}"/><ellipse cx="76" cy="45" rx="4.2" ry="2.6" fill="${k.cream}"/>` +
      cheeks(k, 72, 32, 88) +
      `<ellipse cx="60" cy="65" rx="5.5" ry="3.8" fill="${k.ink}"/>`,
    eyesAt: { l: 45, r: 75, y: 56 },
    mouthY: 70,
  },
};

const MOODS = ['neutral', 'happy', 'worried', 'sleepy', 'celebrate'];

// The SVG markup for one animal in one mood (no wrapper element).
export function mascotMarkup(animal = 'cat', mood = 'neutral', size = 64) {
  const a = ANIMALS[animal] || ANIMALS.cat;
  const m = MOODS.includes(mood) ? mood : 'neutral';
  const k = a.k;
  return `<svg width="${size}" height="${Math.round(size * 0.92)}" viewBox="0 0 120 110" aria-hidden="true">${a.back(k)}${m === 'neutral' ? `<g class="mochi-eyes">${eyes[m](k, a.eyesAt)}</g>` : eyes[m](k, a.eyesAt)}${mouths[m](k, a.mouthY)}${extras[m] ? extras[m](k) : ''}</svg>`;
}

export const MASCOT_MOODS = MOODS;
