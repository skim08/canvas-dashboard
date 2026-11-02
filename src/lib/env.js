// Where the code is running. Outside Chrome's extension system (e.g. a local
// dev server) the app switches to test mode: localStorage + sample Canvas data.

export const isExtension =
  typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;

export const isDev = !isExtension;

// K16: demo mode (sample data, no network). Kept in this page's own storage so it's
// known before anything loads; the background worker never runs the demo.
const DEMO_KEY = 'cd:demoMode';
export function isDemo() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}
export function setDemoFlag(on) {
  try {
    if (on) localStorage.setItem(DEMO_KEY, '1');
    else localStorage.removeItem(DEMO_KEY);
  } catch {
    /* private window: demo can't start */
  }
}
// The demo's pretend school (".example" addresses never exist, so nothing can reach one).
export const DEMO_ORIGIN = 'https://canvas.example.edu';

// K11: the app's name, in one place (plus manifest.json). Chosen by the owner 2026-10-20.
// It never uses "Canvas" (Instructure's trademark): descriptions say "works with Canvas".
export const APP_NAME = 'Neko';

// K12 + K13 + K17: set these before publishing. SITE_URL is where the landing site in
// docs/ is hosted (GitHub Pages); the privacy policy and terms are pages there. Until
// they're set, About says they're coming.
export const SITE_URL = 'https://skim08.github.io/canvas-dashboard';
export const PRIVACY_URL = SITE_URL ? `${SITE_URL}/privacy.html` : null;
export const TERMS_URL = SITE_URL ? `${SITE_URL}/terms.html` : null;
export const SUPPORT_EMAIL = null;
export const FEEDBACK_URL = null; // K18: the beta / feedback Google Form
export const STORE_URL = null; // K18: the Chrome Web Store listing, once it exists

// K1: your school's Canvas, chosen during setup (settings.canvasOrigin). Every module
// reads this live binding, so it changes everywhere at once. Test mode uses the
// sample data's school unless you're trying out setup (?scenario=setup).
export const SAMPLE_ORIGIN = 'https://canvas.uw.edu';
const fallbackOrigin = () => (isDemo() ? DEMO_ORIGIN : isDev && devScenario() !== 'setup' ? SAMPLE_ORIGIN : null);
export let CANVAS_ORIGIN = fallbackOrigin();
export function setCanvasOrigin(origin) {
  CANVAS_ORIGIN = isDemo() ? DEMO_ORIGIN : origin || fallbackOrigin(); // the demo never points at a real school
}

// Sample data instead of Canvas: test mode (dev server) or demo mode (K16).
export const usesSample = () => isDev || isDemo();

export function devScenario() {
  if (!isDev || typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('scenario');
}

export function dashboardUrl() {
  return isExtension ? chrome.runtime.getURL('src/newtab.html?app=1') : 'newtab.html?app=1';
}
