// Cleans Canvas HTML (assignment instructions, pages) so it's safe to show
// and matches the app's look: no scripts, styles, iframes or event handlers.

import { CANVAS_ORIGIN } from './env.js';

const ALLOWED = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small', 'mark',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'img', 'span', 'div', 'hr', 'figure', 'figcaption',
]);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'noscript', 'svg', 'math', 'video', 'audio']);
const ATTRS = { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height', 'title'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'] };

// A link you or a backup file typed in: only ordinary web addresses (no javascript: and the like).
export function webUrl(value) {
  try {
    const u = new URL(String(value).trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(value, CANVAS_ORIGIN);
    if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') return u.toString();
  } catch {
    /* ignore */
  }
  return null;
}

// Returns { fragment, files } where files are Canvas file links found in the HTML.
export function sanitizeHtml(html, { courseId } = {}) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  const files = [];
  const seen = new Set();

  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) {
        // Keep a link for embedded media/tools instead of the embed itself.
        if (tag === 'iframe' && safeUrl(child.getAttribute('src'))) {
          const a = doc.createElement('a');
          a.setAttribute('href', safeUrl(child.getAttribute('src')));
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
          a.textContent = 'Open embedded content';
          child.replaceWith(a);
        } else {
          child.remove();
        }
        continue;
      }
      if (!ALLOWED.has(tag)) {
        walk(child);
        child.replaceWith(...child.childNodes);
        continue;
      }
      const keep = ATTRS[tag] || [];
      for (const attr of [...child.attributes]) {
        if (!keep.includes(attr.name)) child.removeAttribute(attr.name);
      }
      if (tag === 'a') {
        const href = safeUrl(child.getAttribute('href'));
        if (!href) child.removeAttribute('href');
        else {
          child.setAttribute('href', href);
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
          const m = href.match(/\/files\/(\d+)/);
          if (m && !seen.has(m[1])) {
            seen.add(m[1]);
            const base = courseId ? `${CANVAS_ORIGIN}/courses/${courseId}` : CANVAS_ORIGIN;
            files.push({ id: m[1], name: child.textContent.trim() || child.getAttribute('title') || `File ${m[1]}`, url: `${base}/files/${m[1]}/download?download_frd=1`, viewUrl: `${base}/files/${m[1]}` });
          }
        }
      }
      if (tag === 'img') {
        const src = safeUrl(child.getAttribute('src'));
        if (!src) child.remove();
        else if (new URL(src).origin !== CANVAS_ORIGIN) {
          // Images from other sites would tell them you opened this (your IP and the time),
          // so they're never loaded here: a link opens them in a normal tab instead.
          const a = doc.createElement('a');
          a.setAttribute('href', src);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
          const alt = (child.getAttribute('alt') || '').trim();
          a.textContent = `${alt ? `Image: ${alt}` : 'Image'} (from ${new URL(src).hostname})`;
          child.replaceWith(a);
          continue;
        } else {
          child.setAttribute('src', src);
          child.setAttribute('loading', 'lazy');
        }
      }
      walk(child);
    }
  };
  walk(root);

  const empty = !root.textContent.trim() && !root.querySelector('img');
  const fragment = document.createDocumentFragment();
  fragment.append(...root.childNodes);
  return { fragment, files, empty };
}

export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return doc.body.textContent.replace(/\s+/g, ' ').trim();
}
