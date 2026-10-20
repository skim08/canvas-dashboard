# Chrome Web Store listing (K14)

What to paste into the Chrome Web Store developer dashboard for **Neko**.

## Build

1. Run `python3 tools/check_extension.py`.
2. Run `python3 tools/test_builds.py` (checks the owner, public and beta builds).
3. Run `python3 tools/build_zip.py`, which creates `dist/<name>-<version>.zip`: the public, read-only build.

The zip leaves out the tests, tools, `owner-data/` (your personal syllabi and classes), the landing site (`docs/`) and these notes. It includes the made-up sample student for demo mode (K16). Upload that zip.

## Single purpose

> A cleaner, private dashboard that works with Canvas. It shows the deadlines, grades, calendar and syllabus dates for the courses you're enrolled in, in one place, using your existing Canvas login.

## Permission reasons (public build)

The public build only reads from Canvas (K15). Assignment submission and discussion replies are left out. The zip's generated manifest asks for just these:

| Permission | Why it's needed |
|---|---|
| `storage`, `unlimitedStorage` | Keeps your settings, notes, to-dos and a copy of your Canvas data on your computer. A full term of courses can be more than Chrome's default 10 MB. |
| `alarms` | Refreshes your Canvas data in the background and checks for deadline reminders every few minutes. |
| `notifications` | Deadline reminders and new-grade and announcement alerts, which you can turn off in Settings. |
| Optional host access (`https://*/*`) | Asked for at runtime for **one site only**: the Canvas address you type in during setup. The extension reads your courses from that site with your existing login and never changes anything there. Announcements you open are marked read on your computer only. |
| `chrome_url_overrides.newtab` | The dashboard opens in new tabs. You can turn this off in Settings. |

It doesn't ask for `cookies` or any always-on host access. No remote code is loaded: everything ships in the package (content security policy `script-src 'self'`).

## Privacy practices tab

- **Data collected:** answer that personally identifiable information, educational records and website content are *handled*, but kept only on your device.
- **Certify:**
  - Data isn't sold to third parties.
  - Data isn't used or transferred for purposes unrelated to the single purpose.
  - Data isn't used to determine creditworthiness or for lending.
- **Privacy policy URL:** your published policy page. Set the same address in `src/lib/env.js` as `PRIVACY_URL`.

## Name and wording rules (K22)

- The name is **Neko** (`APP_NAME` in `src/lib/env.js` and `manifest.json`). Store title idea: “Neko: a calm dashboard for your classes”.
- Say "works with Canvas", never "Canvas Dashboard", "official" or "for Canvas by…". Don't use "Canvas" as part of the name.
- Never use the Canvas or Instructure logo or colors. The icon is the extension's own.
- Wherever the name appears, say it isn't affiliated: the manifest description, the store text, the site footer, setup, Settings → About and the beta INSTALL.md.

## Store text

**Short description** (132 characters max):

> A clean, private dashboard that works with Canvas: deadlines, grades, GPA and syllabus dates in one place. Not affiliated with Instructure.

**Long description** (outline):

- **Everything due, in one list:** overdue work, today and the week ahead.
- **Grades and GPA:** your grading scale (letters or a 4.0 decimal), what you need on what's left, and what-if scores.
- **Calendar:** day, week, month and term views, with your class times and exams.
- **Syllabus import:** PDF or Word files, read on your computer. You review everything before it's saved.
- **Mochi:** a friendly cat who answers questions about your schedule.
- **Private by design:** no account, no tracking, and nothing leaves your computer except requests to your own school's Canvas.
- **Disclaimer:** "Not affiliated with Instructure or any school. Grades and GPA are estimates; always check Canvas."

## Test instructions for reviewers

Paste this into **Test instructions** in the developer dashboard:

> You don't need a Canvas account. Open a new tab (the extension replaces the new-tab page) and click **Try it with sample data** on the first screen. Demo mode loads a made-up student and makes no network requests. A "Demo — sample data" banner stays at the bottom.
>
> To see every feature:
> - **Home:** due soon, Next up, grades at a glance, the exam countdown, and Mochi (type "what's due tomorrow?").
> - **Courses:** pick CSE 143. Try the Modules, Pages, Files, Discussions, Syllabus and People tabs, and the **Syllabus dates** button (paste any syllabus text to see the review screen).
> - **Grades:** class details, What-if mode, Trends and History.
> - **Calendar:** Day, Week (class times and topics), Month, Quarter and List.
> - **Settings:** themes, density, features, backup.
>
> Click any item to open its details. Press `?` for keyboard shortcuts. **Exit demo** in the banner (or Settings → General) deletes the sample data.
>
> With a real school, the extension asks for access to that one Canvas site and only reads from it.

## Screenshots

Take 1280×800 screenshots and demo videos in **demo mode** (Try it with sample data). Never use your real Canvas.

## Still needed from you

- [x] Name (K11): Neko.
- [ ] Privacy policy and terms pages. Put their addresses in `PRIVACY_URL` and `TERMS_URL`.
- [ ] Support email, in `SUPPORT_EMAIL`.
- [ ] 2-step verification on the publishing Google account.
- [ ] $5 developer fee and the trader question.
