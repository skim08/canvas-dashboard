# Chrome Web Store listing (K14)

What to paste into the Chrome Web Store developer dashboard for **Neko**.

## Build

1. Run `python3 tools/check_extension.py`.
2. Run `python3 tools/test_builds.py` (checks the owner, public and beta builds).
3. Run `python3 tools/build_zip.py`, which creates `dist/<name>-<version>.zip`: the public build (reads only, except Canvas messages).

The zip leaves out the tests, tools, `owner-data/` (your personal syllabi and classes), the landing site (`docs/`) and these notes. It includes the made-up sample student for demo mode (K16). Upload that zip.

## Single purpose

> A cleaner, private dashboard that works with Canvas. It shows the deadlines, grades, calendar and syllabus dates for the courses you're enrolled in, in one place, using your existing Canvas login.

## Permission reasons (public build)

The public build only reads from Canvas (K15), with one exception: the Canvas inbox (K25), so students can message their instructors, TAs and classmates. Assignment submission and discussion replies are left out. The zip's generated manifest asks for just these:

| Permission | Why it's needed |
|---|---|
| `storage`, `unlimitedStorage` | Keeps your settings, notes, to-dos and a copy of your Canvas data on your computer. A full term of courses can be more than Chrome's default 10 MB. |
| `alarms` | Refreshes your Canvas data in the background and checks for deadline reminders every few minutes. |
| `notifications` | Deadline reminders and new-grade and announcement alerts, which you can turn off in Settings. |
| Optional host access (`https://*/*`) | Asked for at runtime for **one site only**: the Canvas address you type in during setup. The extension reads your courses from that site with your existing login. The only things it changes there are Canvas messages you choose to send, reply to, star, archive or mark read or unread. Announcements you open are marked read on your computer only. |
| `cookies` | Used for one thing: reading Canvas's security token (the `_csrf_token` cookie on your school's Canvas site) when you send or manage a message, because Canvas requires it for any change. No other cookie is read, and nothing is stored or sent anywhere else. |
| `chrome_url_overrides.newtab` | The dashboard opens in new tabs. You can turn this off in Settings. |

It doesn't ask for any always-on host access. No remote code is loaded: everything ships in the package (content security policy `script-src 'self'`).

## Privacy practices tab

- **Data collected:** tick personally identifiable information, personal communications (the Canvas inbox) and website content. All of it is kept only on the student's device.
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
- **Neko and friends:** a friendly cat who answers questions about your schedule. Four more animal themes (Kero the frog, Nami the shark, Yumi the polar bear, Hachi the shiba) on the Themes tab.
- **Your own events:** pre-class readings, study sessions and anything Canvas doesn't list, with weekly repeats.
- **Inbox and groups:** read, star, archive and send Canvas messages to your instructors, TAs and classmates, and open your Canvas project groups, all from the dashboard.
- **Private by design:** no account, no tracking, and nothing leaves your computer except requests to your own school's Canvas.
- **Disclaimer:** "Not affiliated with Instructure or any school. Grades and GPA are estimates; always check Canvas."

## Test instructions for reviewers

Paste this into **Test instructions** in the developer dashboard:

> You don't need a Canvas account. Open a new tab (the extension replaces the new-tab page) and click **Try it with sample data** on the first screen. Demo mode loads a made-up student and makes no network requests. A "Demo — sample data" banner stays at the bottom.
>
> To see every feature:
> - **Home:** due soon, Next up, grades at a glance, the exam countdown, and Neko (type "what's due tomorrow?").
> - **Themes** (palette icon, top right): five animal themes, each with its own mascot.
> - **Courses:** pick CSE 143. Try the Modules, Pages, Files, Discussions, Syllabus and People tabs, and the **Syllabus dates** button (paste any syllabus text to see the review screen).
> - **Inbox** (top tab): open a message, reply, star or archive it; click **New message**, pick CSE 143 and **CSE 143 instructors**, and send. In demo mode nothing is sent anywhere; the message just appears under **Sent**.
> - **Courses → Your groups → PA Team 4:** a Canvas group's announcements, discussions, pages, files and members.
> - **Grades:** class details, What-if mode, Trends and History.
> - **Calendar:** Day, Week (class times and topics), Month, Quarter and List. Click **New event** or an empty time slot to add your own event.
> - **Settings:** light or dark, density, features, backup, and **Make Neko yours**.
>
> Click any item to open its details. Press `?` for keyboard shortcuts. **Exit demo** in the banner (or Settings → General) deletes the sample data.
>
> With a real school, the extension asks for access to that one Canvas site. It reads from it, and changes nothing there except Canvas messages the student chooses to send, reply to, star, archive or mark read or unread.

## Screenshots and images

Take 1280×800 screenshots and demo videos in **demo mode** (Try it with sample data). Never use your real Canvas. The current set is in `store/screenshots/0.4.0/`, with the promo tile at `store/promo-tile-440x280.png`. Regenerate the icons with `/usr/bin/python3 tools/make_icons.py`.

For the paste-ready text of the 0.4.0 update (every dashboard tab), see `store/UPDATE-0.4.0.md`.

## Still needed from you

- [x] Name (K11): Neko.
- [x] Privacy policy and terms pages: published Nov 2, 2026 at the landing site (`PRIVACY_URL`, `TERMS_URL`).
- [x] Support email, in `SUPPORT_EMAIL`: neko.dashboard@gmail.com.
- [ ] 2-step verification on the publishing Google account.
- [ ] $5 developer fee and the trader question.
