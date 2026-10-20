# Landing site (K17)

Static pages for GitHub Pages: `index.html`, `privacy.html`, `terms.html`, `support.html`, `style.css` and `img/`. There's no build step, no analytics and no outside fonts or scripts.

## Before publishing, replace these placeholders everywhere

- `[BETA FORM LINK]`: the Google Form address.
- `[SUPPORT EMAIL]`: the support address.
- `[DATE]`: the "last updated" date on the privacy policy and terms.

Then remove the "Draft for review" boxes once you've reviewed both documents. They aren't legal advice.

## Hosting on GitHub Pages

In the repository on GitHub, go to Settings → Pages, choose **Deploy from a branch**, branch `main`, folder **`/docs`**, and save. After a minute the site is at `https://<your-username>.github.io/<repository-name>/`.

Then put the site address in `src/lib/env.js` as `SITE_URL`. The extension's About screen links to `privacy.html` and `terms.html` there.

The screenshots in `img/` come from demo mode (800×500). Replace them with your own 1280×800 captures if you like.
