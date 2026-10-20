# Neko — Spec

*(Formerly "Canvas Dashboard". The name Neko was chosen by the owner on 2026-10-20.)*

A Chrome extension that replaces the Canvas UI for UW courses (`canvas.uw.edu`). It loads unpacked from this folder, takes over the new-tab page, reads Canvas using the existing browser login (no API token), and keeps all data in Chrome on this computer.

**Owner goal:** a clean, uncluttered replacement for Canvas, and staying on top of a 3.9–4.0 GPA.

**Status key:** `[ ]` not started · `[~]` partial · `[x]` done · `[-]` deferred (reason required)

---

## Contents

1. [Technical approach](#technical-approach)
2. [Design principles](#design-principles)
3. [UW grading](#uw-grading)
4. [Known limits](#known-limits)
5. [Phases](#phases)
6. [Features](#features) (A–K)
7. [Coverage table](#coverage-table)

---

## Technical approach

- **Chrome Manifest V3** extension, loaded with *Load unpacked*. Everything runs from files in this folder. MV3 forbids loading remote code, so any library is copied into the folder.
- **Data source:** the Canvas REST API of the school you choose in setup (`/api/v1/...`), called from extension pages with the browser's existing Canvas session cookies. Chrome grants access to that one site at runtime (`optional_host_permissions`, K1); every request is checked against it. Write actions (F13, F14) also need Canvas's CSRF token, read from the session.
- **Storage:** `chrome.storage.local` (plus IndexedDB if data outgrows it). Nothing is sent to any server except your school's Canvas (and Instructure's file storage for uploads, F13).
- **Background work:** an MV3 service worker using `chrome.alarms` for refreshes, reminders and snapshots, and `chrome.notifications` for alerts.
- **Testing:** every feature is tested against realistic sample Canvas data (fixtures) in the browser, then by the owner against real Canvas.

---

## Design principles

The reason this project exists is that Canvas is cluttered. These rules apply to every screen and override convenience.

**Structure**
1. Top-level pages: **Home, Courses, Grades, Calendar**, plus **Other** for non-class courses and events (B11, added 2026-10-01 at the owner's request; it disappears if turned off). Settings sits behind an icon. No other top-level navigation.
2. Home stays small. Since 2026-10-07 (your layout): Due soon in the middle at the top, with a slim alert strip above it only when there's something to act on; a side column with **Grades at a glance** and the **exam countdown** (C16); Mochi's panel (J3) on the right. Medium windows share one side column; narrow windows stack Due soon first.
3. **Details open on click** in a large centered window (about 90% of the screen, like Gmail's expanded compose; your choice, 2026-10-07), with ✕, Esc or a click outside to close. A button in its header switches to the original side panel, and the choice is remembered. Lists show one line per item; everything else lives in the details. No stacked windows.
4. Lists show at most **7 items** before a "Show all" link.
5. Every feature must have an obvious single home. If it doesn't fit a page cleanly, it goes in a detail view, not on the main surface.

**Layout and spacing**
6. Content column max width **1100px**, centered. Generous outer margins.
7. Spacing uses one scale only: **4, 8, 12, 16, 24, 32, 48 px**.
8. Cards and rows use subtle 1px borders or very light backgrounds, not heavy shadows. Corner radius 10px everywhere.

**Typography**
9. **One typeface:** the system font (`-apple-system`, SF Pro on Mac). No web fonts.
10. Type sizes only: **12, 14, 16, 20, 28 px**, plus **11px for calendar blocks and cards only** (your request, 2026-10-07, so more fits at a glance). Two weights only: regular (400) and semibold (600).
11. Numbers use tabular figures so grades and times line up.

**Color**
12. Neutral tones plus **one accent color**. Since Phase 6 (your choice, 2026-10-06) the neutrals are soft-pink tinted and the accent is raspberry pink (J1); the original grays and blue are kept as the Classic color theme.
13. Status colors used only for meaning: **red** = overdue / at risk, **amber** = warning / due soon, **green** = on track / done. Never decorative.
14. **Course colors are used sparingly:** a small dot or 3px left bar next to the course name, never as backgrounds. Exception: calendar blocks use a light tint of the class color so lectures and exams are easy to tell apart (G1).
15. All text meets WCAG AA contrast in both light and dark mode.

**Motion and feel**
16. Transitions 150–200ms. Respect "reduce motion" in macOS settings. Celebrations (J6) and Mochi's little bob and blink are short and stop completely with reduce motion.
17. One icon set (outline style, 16/20px).
18. Every empty state has a short, friendly message ("Nothing due this week"). Happy ones ("You're all caught up") may show Mochi (J7).
19. Loading shows the last saved data immediately, then updates quietly. No full-screen spinners.

---

## UW grading

- UW uses a **4.0 decimal scale**. Course grades run from **4.0 down to 0.7 in 0.1 steps**; anything below 0.7 is **0.0**.
- **Each course sets its own % → grade-point conversion** in its syllabus. Canvas does not know this conversion, so the owner enters it once per course (E1). Until it's entered, that course shows "Scale not set" and is left out of GPA, with a visible note.
- **GPA is weighted by credits:** GPA = Σ(grade points × credits) ÷ Σ(credits) across courses with numeric grades.
- **Not in GPA:** S/NS, CR/NC, W and other non-numeric grades. These count toward credits completed when they earn credit (S, CR), but never toward GPA.
- **Target:** quarter and cumulative GPA of **3.9–4.0**. The default target is **3.9** (editable, E6).
- **Projections are estimates.** Curves, rounding rules and instructor discretion can change the final grade. Every projected number is labeled "projected."
- **Repeated courses:** the owner marks which attempt counts toward GPA, following UW's repeat policy. The app doesn't guess.

---

## Known limits

**Must stay in Canvas**
- **Taking quizzes and exams** (Classic and New Quizzes, proctored exams, LockDown Browser). The dashboard links out (F15).
- **External tools inside Canvas (LTI):** Gradescope, Panopto, Zoom, Ed, Perusall, etc. The dashboard links to them, but can't show their content.
- **Peer reviews, group-set management and conferences.** These link out to Canvas.
- **Submissions that need a special tool** (media recordings, external-tool submissions). F13 covers only file and text submissions.

**Depends on UW or instructor Canvas settings**
- **Session access:** this design assumes UW allows the Canvas API through the normal browser login. If UW blocks it, Phase 1 will reveal this immediately, and the fallback is the Canvas calendar feed (due dates only).
- **Hidden totals:** some instructors hide the course total. The dashboard then computes it from assignments and weights (E3, E4). That calculation may differ from the instructor's real gradebook.
- **Class statistics** (mean, high, low) only appear if the instructor enables them and enough students have been graded (E19).
- **Hidden or unposted grades:** grades held back by the instructor stay hidden until they're posted.
- **Grades kept outside Canvas** (for example, in Gradescope before it syncs) don't appear until they're synced to Canvas.
- **Category weights** come from Canvas only if the instructor set them up there. Otherwise they're entered from the syllabus (E3).
- **Inbox, discussions and files** follow the same permissions you have in Canvas.

**Grades (Phase 2)**
- A category that contains *only* extra credit (no regular points) isn't modeled; Canvas's handling of that case isn't documented. Regular extra-credit assignments count correctly.
- Class statistics, rubric scores, comments and the instructor's grading scheme only appear when Canvas shares them with students. When it doesn't, the dashboard says so instead of guessing.
- Projected grades assume the syllabus scale you entered. Curves and instructor rounding can still change final grades.

**General**
- Canvas has no grade history, so trend charts (E20) only start from the day snapshots begin.
- Background refreshes and notifications only run while Chrome is open.
- If the Canvas login expires, data stops refreshing until you log in again (A5).

---

## Phases

| Phase | Name | Scope |
|---|---|---|
| 1 | Core | Foundation, design system, Home, due dates, submission status, dark mode |
| 2 | Grades and GPA | All of section E. Built and tested with sample data; owner confirmation with real Canvas deferred (see `GPA-CHECKLIST.md`) |
| 3 | Course content | Section F (except F13, F14, F15) |
| 4 | Planning and notifications | Sections G and H, plus C7. Approved by you 2026-10-06 |
| 5 | Extras | Section I, F13, F14, plus D8 and D9 (added 2026-10-06) |
| 6 | Look and feel | Section J (added 2026-10-06 at your request): soft pink theme, Mochi, Ask Mochi, celebrations; plus C16 exam countdown (2026-10-07) |
| 7 | Any student (approved by you 2026-10-20; built 2026-10-20, waiting on your checks and choices) | Section K (added 2026-10-20 at your request): works at any school's Canvas, syllabus import, setup, and what's needed to publish free on the Chrome Web Store |

A feature always lands in the same phase as, or a later phase than, any feature it depends on.

---

## Features

### A. Foundation

#### A1 · Chrome extension loaded from a folder
- **Status:** [x] done (confirmed by you in Chrome on 2026-10-01) · **Phase:** 1
- **What:** A Manifest V3 Chrome extension you load yourself from this folder.
- **Done when:**
  - It loads from `chrome://extensions` → *Load unpacked* with no errors or warnings.
  - All code and libraries are inside the folder; nothing is loaded from the internet except Canvas data.
  - A `README.md` explains how to install, reload and update it in 5 steps or fewer.

#### A2 · New-tab dashboard
- **Status:** [~] partial — verify in Chrome: first render measured at 26ms in test mode; the new-tab override and the "off" redirect only work inside Chrome · **Phase:** 1
- **What:** Every new tab opens the dashboard.
- **Done when:**
  - Opening a new tab shows the dashboard's Home page.
  - The page shows the last saved data in under 300ms, then refreshes.
  - A setting lets you turn the new-tab override off. (Chrome doesn't allow toggling it at runtime, so "off" redirects to Chrome's default new-tab page.)

#### A3 · Toolbar popup
- **Status:** [~] partial — verify in Chrome: popup content tested; opening it from the toolbar icon only works inside Chrome · **Phase:** 1
- **What:** Clicking the extension's toolbar icon opens a quick look.
- **Done when:**
  - The popup shows what's due today and tomorrow, with any overdue items first.
  - It has a button that opens the full dashboard.
  - It follows the same light/dark theme (B5).

#### A4 · Uses your existing Canvas login
- **Status:** [x] done (confirmed by you with real Canvas data on 2026-10-01) · **Phase:** 1
- **What:** Reads Canvas data using your browser's login. No API token.
- **Done when:**
  - While logged into `canvas.uw.edu` in Chrome, the dashboard loads your courses and assignments without asking for any credentials.
  - The extension never asks for, stores or sees your UW password.
  - It only requests data from `canvas.uw.edu`.
- **Found in real use (2026-10-01):** your login works with the API (profile and course list loaded). Some course IDs are too big for JavaScript numbers and were being rounded, which caused a 403. Fixed by asking Canvas for string IDs. Also, one course failing no longer blocks the others; it's skipped and noted in Settings → Courses.

#### A5 · Expired-login detection
- **Status:** [~] partial — verify in Chrome: banner, button and recovery tested with a simulated expired login; a real expiry needs your account · **Phase:** 1
- **What:** Notices when your Canvas login has expired and tells you.
- **Done when:**
  - A 401 response or a redirect to the login page shows a clear banner: "Your Canvas login expired" with a **Log in to Canvas** button.
  - The button opens the Canvas login page in a new tab.
  - After you log in and come back, the banner goes away and data refreshes without reloading the extension.

#### A6 · Automatic refresh
- **Status:** [~] partial — verify in Chrome: refresh-on-open, manual refresh and throttling tested; the 15-minute background refresh runs in Chrome's service worker · **Phase:** 1
- **What:** Refreshes when you open it and every so often in the background.
- **Done when:**
  - Opening the dashboard triggers a refresh if the data is older than 2 minutes.
  - A background refresh runs every 15 minutes while Chrome is open (interval changeable in Settings).
  - A manual **Refresh** control exists, and repeated refreshes are throttled so Canvas isn't flooded with requests.

#### A7 · Data stays on your computer
- **Status:** [x] done · **Phase:** 1
- **What:** All data is stored in Chrome locally; nothing goes anywhere else.
- **Exception (approved by you 2026-10-06):** when you submit a file (F13), the file itself may go to Instructure's file storage (`inst-fs-*.inscloudgate.net`), where Canvas sends uploads. No cookies or Canvas token go with it; any other upload host is refused.
- **Done when:**
  - The manifest's host permissions list only `canvas.uw.edu` (plus Instructure's file storage, for the exception above).
  - No analytics, tracking or third-party requests exist in the code (checked by searching the code for outside URLs).
  - Settings shows a short "Your data" note and a **Clear all data** button.

- **Note (Phase 3):** Phase 3 added the "cookies" permission so F2 can mark announcements read; host permissions are still canvas.uw.edu only.

#### A8 · Offline mode with "last updated"
- **Status:** [x] done · **Phase:** 1
- **What:** Shows the last loaded data when offline, with a timestamp.
- **Done when:**
  - With the network off, the dashboard opens and shows saved data instead of an error.
  - A small "Last updated 10:42 AM" label is always visible, plus an "Offline" tag when offline.
  - When the connection returns, it refreshes automatically.

#### A9 · Settings page
- **Status:** [x] done · **Phase:** 1
- **What:** One settings page for all options.
- **Done when:**
  - It opens from a gear icon and has clear groups (Appearance, Courses, Features, Notifications, Grades, Data).
  - Every setting saves instantly and survives restarting Chrome.
  - Each later feature with options adds them here, under the right group.
- **Note:** Phase 1 has Appearance, Home, Courses, Features, General and Data. The Grades and Notifications groups appear when Phases 2 and 4 add their settings, so there are no empty sections.

#### A10 · Back up and restore
- **Status:** [x] done (hardened 2026-10-20: restore refuses files over 25 MB, drops fields with the wrong shape and says how many, and ignores keys that could tamper with how the app’s objects work) (2026-10-20: syllabi (K8) are included in backup) · **Phase:** 1
- **What:** Export and import your settings and personal data so nothing is lost when reinstalling.
- **Done when:**
  - **Export** downloads one `.json` file with all your settings, notes, checklists, grade scales, past quarters, snapshots and plans.
  - **Import** restores that file after showing a summary and asking for confirmation.
  - The backup never contains Canvas login information. Restoring into a fresh install brings back everything you entered.
- **Note:** this covers data from later phases too. Each phase adds its data to the backup and is checked here.

### B. Design and layout

#### B1 · Four main pages
- **Status:** [x] done · **Phase:** 1
- **What:** Home, Courses, Grades and Calendar.
- **Done when:**
  - A single navigation bar shows exactly these four pages, plus a Settings icon.
  - The current page is clearly highlighted, and the URL changes so the back button works.
  - In Phase 1: Courses lists your courses, Grades shows Canvas's current score per course, and Calendar shows an agenda list of due dates. Later phases fill these pages in.

#### B2 · Minimal Home
- **Status:** [x] done (changed 2026-10-07 at your request: "Needs attention" became a slim alert strip above Due soon for an expired login and unread announcements or messages, shown only when there are any; overdue and missing work are in Due soon's first group; at-risk classes are marked red in Grades at a glance) · **Phase:** 1
- **What:** Home shows only what's due soon, your grades/GPA, and what needs attention.
- **Done when:**
  - Home contains exactly three sections by default: **Due soon**, **Grades**, **Needs attention**.
  - In Phase 1, the Grades section shows Canvas's current score per course. Phase 2 replaces it with projected GPA (checked under E8).
  - Needs attention shows only actionable items (overdue, missing, expired login). If there's nothing, it says so in one line.

#### B3 · Details on click
- **Status:** [x] done (2026-10-07: opens as a large centered window by default; the header button switches to the side panel and back) · **Phase:** 1
- **What:** Lists stay simple; details open in a side panel.
- **Done when:**
  - Clicking any assignment, course or grade row opens a drawer with its details. The list stays visible behind it.
  - The drawer closes with Esc, a close button, or by clicking outside it.
  - List rows show one line of information: name, course, due time and status.

#### B4 · Clean visual system
- **Status:** [x] done · **Phase:** 1
- **What:** One font, consistent spacing, lots of white space, course colors used sparingly.
- **Done when:**
  - All styles come from one set of design tokens (colors, spacing, sizes) defined in one CSS file.
  - A check of the CSS finds no font sizes, spacing values or colors outside the tokens in [Design principles](#design-principles).
  - Course colors appear only as dots or thin bars.

#### B5 · Dark, light or system theme
- **Status:** [x] done · **Phase:** 1
- **What:** Choose the theme.
- **Done when:**
  - Settings has Light / Dark / System. System follows macOS and changes live when macOS switches.
  - Every page, the popup, drawers and charts look correct in both themes, with AA contrast.
  - Opening the page in dark mode never flashes white first.

#### B6 · Compact or card view
- **Status:** [x] done · **Phase:** 1
- **What:** Choose dense rows or roomier cards.
- **Done when:**
  - Settings has Compact / Comfortable. Lists switch between single-line rows and cards.
  - The choice applies to every list in the app and is remembered.

#### B7 · Turn features off completely
- **Status:** [x] done · **Phase:** 1
- **What:** Any optional feature can be hidden, and it disappears completely.
- **Done when:**
  - Settings → Features has a toggle for each optional feature.
  - A turned-off feature leaves no empty space, button, menu item or label behind.
  - Every feature built in later phases registers a toggle here (checked at the end of each phase).

#### B8 · Reorder Home sections
- **Status:** [x] done (since 2026-10-07 the order applies to the side column, Grades at a glance and the exam countdown; Due soon stays in the middle and alerts at the top; every section can still be hidden) · **Phase:** 1
- **What:** Change the order of Home's sections.
- **Done when:**
  - Settings (or an edit mode on Home) lets you drag sections into a new order and hide them.
  - The order is remembered and also works with the keyboard.

#### B9 · Keyboard shortcuts
- **Status:** [x] done · **Phase:** 1
- **What:** Fast navigation from the keyboard.
- **Done when:**
  - At minimum: `1–4` switch pages, `/` focuses search, `j`/`k` move through lists, `Enter` opens details, `Esc` closes, `r` refreshes, `?` shows a shortcut list.
  - Shortcuts never fire while you're typing in a text field.
  - Later phases add their shortcuts to the `?` list.

#### B10 · Course nicknames and colors
- **Status:** [x] done (2026-10-20, K10: nicknames also work for other schools’ course numbers like BIO 1510, MATH-1210 and COMPSCI 61A) · **Phase:** 1
- **What:** Short names and your own colors per course.
- **Done when:**
  - Each course gets an automatic short name (like "CSE 142") from its Canvas course code, which you can edit.
  - You can pick a color per course from a palette that's readable in both themes.
  - Nicknames and colors appear everywhere the course is shown, and you can hide old or irrelevant courses.

- **Note (Phase 2):** course colors are now 8 theme-aware slots validated for colorblind separation in light and dark mode (needed once they became chart lines). Colors you picked yourself are kept.

#### B11 · Separate "Other" tab
- **Status:** [x] done · **Phase:** 1
- **What:** Events and items from non-class courses (orgs, workshops, advising sites) live on their own Other page, out of your main views. *(Added 2026-10-01 at the owner's request.)*
- **Done when:**
  - Items from courses marked Other don't appear on Home, Courses, Grades, Calendar, the popup, busy-week warnings, the progress bar or Needs attention.
  - The Other page lists them by Today / This week / Later, with course filter chips. Search still finds them.
  - Turning the feature off in Settings → Features puts everything back in the main views and removes the tab.

#### B12 · Classes vs. other courses
- **Status:** [x] done (2026-10-20, K10: 4-digit and dashed course numbers count as classes too) · **Phase:** 1
- **What:** Each course is a Class or Other. It's detected automatically, and you can change it. *(Added 2026-10-01.)*
- **Done when:**
  - Courses with a class code (like "CSE 142" or "BIO 180") are Classes. Others ("Foster Undergraduates") are Other.
  - Settings → Courses has a Class / Other switch on every course, and your choice always wins.

### C. Assignments and due dates

#### C1 · Today / This week / Later
- **Status:** [x] done · **Phase:** 1
- **What:** Upcoming work grouped by when it's due.
- **Done when:**
  - Assignments are grouped into **Today**, **This week** (the next 7 days) and **Later**, sorted by due time.
  - It includes assignments, quizzes, graded discussions and calendar events with due dates from all active courses.
  - Items with no due date appear in a collapsed "No due date" group.

#### C2 · Overdue at the top
- **Status:** [x] done · **Phase:** 1
- **What:** Overdue work comes first, in red.
- **Done when:**
  - Items past due and not submitted appear in an **Overdue** group above Today, marked in red.
  - Submitted items never show as overdue.
  - Items still accepting late submissions say so; items that are closed say "Closed."

#### C3 · Countdowns
- **Status:** [x] done · **Phase:** 1
- **What:** Plain-language time left.
- **Done when:**
  - Under 24h: "due in 3h" or "due in 45m." Otherwise: "due tomorrow 11:59 PM" or "due Fri 5:00 PM." Beyond a week: the date.
  - Countdowns update every minute without reloading, using the time zone from your Canvas profile (normally Pacific).
  - Items due within 24h use amber; overdue items use red.

#### C4 · Filter and sort by course
- **Status:** [x] done · **Phase:** 1
- **What:** Narrow lists to certain courses and change the order.
- **Done when:**
  - A course filter (multi-select chips) works on every assignment list.
  - Sort options: due date (default), course, points, type.
  - The filter state is remembered between sessions.

#### C5 · Type labels
- **Status:** [x] done (fixed 2026-10-07: homework that Canvas sets up as a quiz, like an accounting class's auto-graded chapter homework, is labeled Homework, not Quiz. Changed 2026-10-07 at your request: a quiz you take online on your own time, like a syllabus quiz, is labeled Assignment; only quizzes given at a set time and place, like accounting's in-section quizzes, are labeled Quiz) · **Phase:** 1
- **What:** Separate labels for assignments, quizzes, exams, discussions and readings.
- **Done when:**
  - Each item shows a small type label: Assignment, Quiz, Exam, Discussion or Reading.
  - Type is detected from Canvas (quiz, discussion, submission types). Exams and readings are detected by name or assignment group ("Midterm", "Final", "Exam", "Reading").
  - You can correct the type of any item, and the correction is remembered.

#### C6 · Busy-week warning
- **Status:** [–] removed at your request (2026-10-07): no busy-week banners, no amber shading on any Calendar view, and no switch or threshold in Settings. The ID is kept so numbering doesn't change. · **Phase:** 1
- **What:** Warns when deadlines bunch up.
- **Done when:**
  - Any 7-day window with more than a set number of items (default 6) or 2+ exams shows a "Busy week" warning on Home and Calendar.
  - The warning lists which items cause it.
  - The threshold can be changed in Settings.

#### C7 · Quarter timeline
- **Status:** [x] done — Calendar → Quarter: one row per course, weeks across, exams as diamonds, a today line (busy-week shading removed with C6), opens scrolled to today; click a mark for details · **Phase:** 4
- **What:** A view of the whole quarter at once.
- **Done when:**
  - A horizontal timeline shows every week of the quarter, with each course on its own row and items as markers.
  - Exams stand out, and busy weeks (C6) are highlighted.
  - Clicking a marker opens the item's details (B3), and the timeline scrolls to today.

#### C8 · Links straight to Canvas
- **Status:** [x] done · **Phase:** 1
- **What:** One click to submit or take a quiz in Canvas.
- **Done when:**
  - Every item's details have an **Open in Canvas** button that goes to the exact assignment, quiz or discussion page.
  - It opens in a new tab.

#### C9 · Full assignment page
- **Status:** [x] done · **Phase:** 1
- **What:** Everything about an assignment, without opening Canvas.
- **Done when:**
  - The details show instructions (formatted text and images from Canvas, made safe), points, due date, available-from and until dates, and accepted submission types.
  - Attached files are listed with download links, and the rubric is shown as a clean table if there is one.
  - Your submission status, attempt number and late/missing flags are shown.

#### C10 · Pin items
- **Status:** [x] done · **Phase:** 1
- **What:** Keep important items at the top.
- **Done when:**
  - Any item can be pinned from its row or details.
  - Pinned items appear in a **Pinned** group above Today until you unpin them, or optionally until submitted.

#### C11 · Hide or snooze items
- **Status:** [x] done · **Phase:** 1
- **What:** Remove noise from your lists.
- **Done when:**
  - **Hide** removes an item from lists until you unhide it in a "Hidden" view.
  - **Snooze** hides an item until a chosen time (later today, tomorrow, a date), then brings it back.
  - Hidden and snoozed items still count in grade calculations.

#### C12 · Search assignments
- **Status:** [x] done · **Phase:** 1
- **What:** Find any assignment instantly.
- **Done when:**
  - Typing in search filters assignments from all courses by name as you type (under 100ms on 500 items).
  - Results show course, due date and status. `/` focuses the search box.

#### C13 · Add to Home
- **Status:** [x] done · **Phase:** 1
- **What:** Pick individual events or items from the Other tab to show on Home with your classes. *(Added 2026-10-01.)*
- **Done when:**
  - Every item on the Other page, and its details drawer, has an **Add to Home** button. Added items appear in all main views with a small home icon.
  - Added items show in an "On Home" group on the Other page and can be removed the same way, with Undo.
  - Your choices are included in backups (A10).

#### C14 · Event wording
- **Status:** [x] done (2026-10-07: in-person quizzes "start" like in-person exams, so they appear as timed blocks in the calendar, not in the due row) · **Phase:** 1
- **What:** Events say when they start instead of "due." *(Added 2026-10-01.)*
- **Done when:**
  - Events (and in-person exams) read "starts in 16m," "starts tomorrow 5:00 PM," "starts Oct 14." Assignments keep "due."
  - The details drawer says "Starts … – [end time]," and events don't show a "Not submitted" tag.

#### C15 · Office hours kept separate
- **Status:** [x] done · **Phase:** 1
- **What:** Office hours are optional, so they stay off your to-do list and calendar until you choose a session. *(Added 2026-10-01.)*
- **Done when:**
  - Class events named like office hours ("Office Hours", "TA OH", "student hours", "drop-in hours") don't appear on Home, Calendar, the popup or in busy-week counts.
  - The Courses page has an Office hours section: the next 14 days, one collapsed group per class.
  - Each session has **Add to calendar & to-dos**. Added sessions appear on Home and Calendar with a checkbox, and can be removed again. Can be turned off in Settings → Features.
- **Note:** F10 (Phase 3) adds office hours you type in yourself; those will use this same section.

#### C16 · Exam countdown
- **Status:** [x] done — Home's side column lists your next five exams and in-person quizzes (from Canvas and your syllabi) within two months, soonest first, with the class, the day and a days-left badge colored like "Not planned yet" (red ≤ 1 day, amber 2–3, yellow-green 4–6, green 7+). "Show All" at the top right of the section (where Grades has its own Show All) lists every remaining quiz and exam this quarter, and "Show Less" goes back to five. Online quizzes and deadlines aren't exams. Click one for its details; hover for time and room. Turn it off in Settings → Features, or hide or move it in Settings → Home · **Phase:** 6
- **What:** How many days until each exam. *(Added 2026-10-07 at the owner's request.)*
- **Done when:**
  - Home shows upcoming exams and in-person quizzes with days to go, soonest first.
  - Finished or past ones drop off; online quizzes and assignment deadlines aren't included.

### D. Progress tracking

#### D1 · Submission status
- **Status:** [x] done · **Phase:** 1
- **What:** Shows whether each item is submitted, according to Canvas.
- **Done when:**
  - Each item shows one status: Not submitted, Submitted, Graded, or Excused.
  - Status comes from Canvas submission data and updates on refresh.
  - When you submit in Canvas and come back, the status updates on the next refresh.

#### D2 · Your own checklist
- **Status:** [x] done · **Phase:** 1
- **What:** Tick things off, including items Canvas doesn't track.
- **Done when:**
  - Each Canvas item has a checkbox that's yours, separate from Canvas status. Submitted items are checked automatically, but you can uncheck them.
  - You can add your own to-dos (like "Read ch. 4" or "Study for midterm") with an optional course and due date, and they appear in the same lists.
  - Checked items move to a collapsed "Done" group.

#### D3 · Missing and late flags
- **Status:** [x] done · **Phase:** 1
- **What:** Clear flags for missing and late work.
- **Done when:**
  - Items that Canvas marks missing or late show a **Missing** or **Late** tag.
  - Missing items also appear under Needs attention on Home.

#### D4 · Weekly progress bar
- **Status:** [x] done · **Phase:** 1
- **What:** "5 of 8 done" for this week.
- **Done when:**
  - A thin progress bar shows done vs. total for items due this week (Mon–Sun), counting both Canvas items and your own to-dos.
  - Hidden items don't count, and the bar updates instantly when you check something off.

#### D5 · Subtasks
- **Status:** [x] done · **Phase:** 1
- **What:** Break an assignment into smaller steps.
- **Done when:**
  - In any item's details, you can add, reorder, check off and delete subtasks.
  - The row shows "2/4" when an item has subtasks.

#### D6 · Notes
- **Status:** [x] done (fixed 2026-10-06: saved notes were stored but the box showed empty when reopened) · **Phase:** 1
- **What:** Your notes on any assignment.
- **Done when:**
  - Each item's details have a notes box that saves automatically as you type.
  - Items with notes show a small note icon in lists, and notes are included in backups (A10).

#### D7 · Submitted, waiting for a grade
- **Status:** [x] done · **Phase:** 1
- **What:** A list of work you've turned in that hasn't been graded.
- **Done when:**
  - A view lists every submitted, ungraded item across courses, with how long it's been waiting.
  - It's grouped by course, and the count appears on the Grades page.

#### D8 · Completed
- **Status:** [x] done — Home → "N completed" opens a Completed page: everything you've turned in or checked off (assignments, quizzes, discussions, readings, your own to-dos), newest first, grouped by week, with a class filter. Each row says how and when it was finished ("Turned in · Oct 6", "Graded · 18/20", "Checked off"). Can be turned off in Settings → Features · **Phase:** 5
- **What:** One place to see everything you've finished. *(Added 2026-10-06 at the owner's request.)*
- **Done when:**
  - A Completed view lists every item that's submitted, graded, excused or checked off, newest first, grouped by week, filterable by class.
  - Each shows when it was finished and how (turned in, turned in late, graded with score, excused, checked off).
  - Unchecking something there puts it back in your lists.

#### D9 · Daily streak
- **Status:** [x] done — a streak chip on Home next to the weekly progress bar ("5-day streak"); click for the current and best streak, how many are left today, and a 5-week calendar (green: everything done; red: something missed or late; gray: nothing due). A day counts when everything due that day was turned in (Canvas's late flag counts as late) or checked off by midnight. Days with nothing due are skipped; today never breaks it. Events, lectures and in-person exams aren't tasks. When you check something off is now saved, for this · **Phase:** 5
- **What:** How many days in a row you finished everything due. *(Added 2026-10-06 at the owner's request.)*
- **Done when:**
  - Home shows your current streak; details show the best streak, today's progress and recent days.
  - A day counts only if everything due that day was finished on time. Days with nothing due don't break it; today only counts once everything due today is done.
  - Can be turned off in Settings → Features; check-off times are in backups (A10).

### E. Grades and GPA

**Setup**

#### E1 · Course grading scale
- **Status:** [x] done (2026-10-20, K3: Canvas letter-grade schemes are imported as well; templates follow your grading system) · **Phase:** 2
- **What:** Each course's % → UW 4.0 conversion, entered once from the syllabus.
- **Done when:**
  - Each course has a scale editor: a list of "at least X% → grade point Y" rows (Y from 0.0 to 4.0 in 0.1 steps), plus an option for linear interpolation between points if the syllabus says so.
  - Courses without a scale show "Scale not set" and are left out of GPA with a visible note. Optional templates are labeled "not from your syllabus" until confirmed.
  - The conversion is tested: given a scale and a %, it returns the expected grade point for at least 10 sample cases, including exact boundaries.
- **Approved suggestion (2026-10-01):** make setup faster in three ways. (1) If the instructor set up a grading scheme in Canvas, import it automatically and ask you to confirm it. (2) Show the course's syllabus (F6 data) next to the scale editor, so you can copy values without switching tabs. (3) Highlight lines in the syllabus that look like a grading scale (for example "93% … 4.0"), but never fill them in without your confirmation.

- **Superseded in part by E33:** classes are no longer left out of GPA for a missing scale or credits; they get an automatic, labeled estimate instead.

#### E2 · Credits per course
- **Status:** [x] done · **Phase:** 2
- **What:** How many credits each course is worth.
- **Done when:**
  - Each course has a credits field (0.5 steps) and a grading option: numeric or S/NS / CR/NC.
  - Courses without credits, or with S/NS or CR/NC, are left out of GPA with a visible note.

#### E3 · Category weights
- **Status:** [x] done · **Phase:** 2
- **What:** Category weights read from Canvas, and editable.
- **Done when:**
  - When a course weights its assignment groups in Canvas, the weights are read automatically.
  - You can override any weight or enter weights for courses that don't use them in Canvas. A warning appears if weights don't total 100%.
  - Points-based (unweighted) courses are handled correctly.

#### E4 · Drop-lowest and extra credit
- **Status:** [x] done · **Phase:** 2
- **What:** Grade calculations follow drop rules and count extra credit correctly.
- **Done when:**
  - Canvas's drop-lowest, drop-highest and never-drop rules are applied. You can also add drop rules manually.
  - Extra credit (assignments with 0 points possible, or items you mark as extra credit) adds points without increasing the total possible.
  - When Canvas shows a course total, the computed % matches it within 0.1 points on test data covering weighted, unweighted, drop-lowest and extra credit cases.

#### E5 · Past quarters
- **Status:** [x] done · **Phase:** 2
- **What:** Enter earlier quarters' grades once.
- **Done when:**
  - You can add quarters (like "Autumn 2025") with courses: name, credits and grade (0.0–4.0, or S/NS/CR/NC/W/I).
  - The data is editable, saved locally and included in backups (A10).
  - Repeated courses can be marked so only the counting attempt is in GPA.

#### E6 · Targets
- **Status:** [x] done · **Phase:** 2
- **What:** Your target GPA and a target grade per course.
- **Done when:**
  - Target GPA defaults to 3.9 and can be changed (0.0–4.0).
  - Each course has a target grade, which defaults to the target GPA. Changing either updates every calculation that uses it (E10, E11, E15).

**Where you stand**

#### E7 · Current grade per course
- **Status:** [x] done (changed 2026-10-06 at your request: a class shows "N/A" and stays out of GPA and at-risk warnings until Canvas has graded at least one assignment, so built-in assumptions like the accounting class's professionalism points can't show 100% on their own). Grades → a class → Assignments opens on a **Graded** filter (2026-10-07): every graded assignment with score and %, and the raw points total; **All** shows everything · **Phase:** 2
- **What:** Current % and UW grade in every course.
- **Done when:**
  - Each course shows its current % (graded work only) and the matching UW grade point, using its scale (E1).
  - If Canvas shows a total that differs from the computed one by more than 0.5 points, both appear with a short explanation.

#### E8 · Projected quarter GPA
- **Status:** [x] done · **Phase:** 2
- **What:** This quarter's GPA, weighted by credits.
- **Done when:**
  - Quarter GPA = Σ(grade point × credits) ÷ Σ(credits) over courses with a scale, credits and numeric grading. It's labeled "projected."
  - It appears on the Grades page and replaces the Phase 1 grades summary on Home (B2).
  - It's verified with at least 3 hand-calculated test cases.

#### E9 · Cumulative GPA
- **Status:** [x] done · **Phase:** 2
- **What:** Past quarters plus this one.
- **Done when:**
  - Cumulative GPA combines past quarters (E5) with this quarter's projection, weighted by credits, excluding non-numeric grades.
  - It shows both "official so far" (past quarters only) and "projected with this quarter."

#### E10 · Gap to goal
- **Status:** [x] done · **Phase:** 2
- **What:** How far above or below your target you are, and which course is pulling you down most.
- **Done when:**
  - It shows the gap as a signed number (like "+0.04 above 3.9" or "−0.08 below 3.9") for both quarter and cumulative GPA.
  - It names the course costing the most GPA: the largest credits × (target − course grade). If none, it says you're on track.

**Staying ahead**

#### E11 · What you need
- **Status:** [x] done · **Phase:** 2
- **What:** The average needed on remaining work in each course to hit your target.
- **Done when:**
  - For each course: "You need X% on the remaining work to get a [target]," using weights and remaining points.
  - Special cases have clear messages: "Already secured" (even 0% keeps the target), "Not reachable" (needs more than 100%, plus the best grade still possible), and "No remaining work."
  - It updates whenever a grade posts, and is checked against hand-calculated test cases.

#### E12 · Best / worst / likely
- **Status:** [x] done · **Phase:** 2
- **What:** The range of grades still possible, per course and for GPA.
- **Done when:**
  - For each course: **best** (100% on everything remaining), **worst** (0% on everything remaining), **likely** (your current average continues), each as a % and a UW grade.
  - A GPA range (best / likely / worst) is shown for the quarter and cumulative GPA.

#### E13 · Points still available
- **Status:** [x] done · **Phase:** 2
- **What:** How much of each grade is still up for grabs.
- **Done when:**
  - Each course shows remaining points and what share of the final grade they're worth, by category and in total.
  - Past-due items you can no longer submit aren't counted as available.

#### E14 · Highest-impact assignments
- **Status:** [x] done · **Phase:** 2
- **What:** Upcoming work ranked by how much it can move your GPA.
- **Done when:**
  - Upcoming, ungraded items are ranked by how much they can change your GPA. Each item's impact = its share of the course grade × the course's share of quarter credits.
  - Each item shows "Worth up to X% of your [course] grade."
  - The top 3 appear on the Grades page, with the full list in details.

#### E15 · Risk alert
- **Status:** [x] done · **Phase:** 2
- **What:** A warning when a course drops below your target line.
- **Done when:**
  - When a course's current or likely grade falls below its target grade (E6), it shows a red "At risk" tag and appears in Needs attention on Home.
  - The alert says by how much and what's needed to recover (from E11).
  - It clears automatically when the course is back on track.

#### E16 · What-if mode
- **Status:** [x] done · **Phase:** 2
- **What:** Try hypothetical scores and see the results.
- **Done when:**
  - You can type a hypothetical score for any assignment, graded or not, and the course %, UW grade, quarter GPA and cumulative GPA update instantly.
  - What-if values are clearly marked and never mixed up with real grades. A single **Reset** clears them.
  - What-if scenarios can be saved by name.

**Understanding your grades**

#### E17 · Category breakdown
- **Status:** [x] done · **Phase:** 2
- **What:** How you're doing in each category, with weights.
- **Done when:**
  - Each course shows each category's weight, your %, points earned out of possible, and how much it contributes to your final grade.
  - Your weakest category in each course is highlighted.

#### E18 · Points lost
- **Status:** [x] done · **Phase:** 2
- **What:** Every assignment where you lost points, sorted by cost.
- **Done when:**
  - The list shows every graded item where you lost points, sorted by how much it lowered your final course grade (not just raw points).
  - It's filterable by course and category. Each row opens the assignment's feedback and rubric.

#### E19 · Class statistics
- **Status:** [x] done · **Phase:** 2
- **What:** Your score next to the class mean, high and low.
- **Done when:**
  - When Canvas provides statistics, each graded item shows your score next to the mean, high and low on a small bar.
  - When Canvas doesn't, the item says "Class stats not shared" and nothing else.

#### E20 · Grade trends
- **Status:** [x] done · **Phase:** 2
- **What:** Charts of your grades over time, from saved snapshots.
- **Done when:**
  - A snapshot of each course's % and grade, plus quarter and cumulative GPA, is saved at least once a day and whenever grades change.
  - Line charts show each course and GPA over time, with your target as a reference line. Hovering shows exact values.
  - Snapshots are included in backups (A10).
- **Approved suggestion (2026-10-01):** start recording snapshots in Phase 1 (just storing them, no charts), so you have weeks of history when Phase 2 ships.
- **Progress:** snapshot recording shipped in Phase 1 (one per day, plus one on every score change). Charts come in Phase 2.

#### E21 · Missing, late and excused costs
- **Status:** [x] done · **Phase:** 2
- **What:** These items and what each one costs you.
- **Done when:**
  - Lists every missing, late or excused item by course.
  - Missing items show how much they lower your course grade if they stay at 0, and late items show the points the late penalty took off.
  - Excused items are shown as not counted.

#### E22 · Pending grades
- **Status:** [x] done · **Phase:** 2
- **What:** Graded work that hasn't come back yet.
- **Done when:**
  - Each course shows submitted-but-ungraded items and the share of the grade they represent.
  - Projections (E11, E12) treat them as unknown and say so ("2 items pending, worth 8% of the grade").
- **Suggestion:** this overlaps with D7. D7 is the list; E22 adds how pending work affects grade projections.

#### E23 · Regrade checklist
- **Status:** [x] done · **Phase:** 2
- **What:** Keep track of scores you want to ask about.
- **Done when:**
  - Any graded item can be flagged for regrade, with a note about why.
  - Flagged items appear in a list with a status: To ask → Asked → Resolved.

#### E24 · Recently graded feed
- **Status:** [x] done · **Phase:** 2
- **What:** New grades with instructor comments and feedback.
- **Done when:**
  - A feed shows items graded in the last 14 days (changeable), newest first, with score, %, and instructor comments.
  - New grades you haven't seen are marked until you open them.

#### E25 · Rubric scores
- **Status:** [x] done · **Phase:** 2
- **What:** How you scored on each rubric line.
- **Done when:**
  - Graded items with rubrics show each criterion's points earned and possible, the rating given, and any comments.
  - It appears both in the assignment page (C9) and in grade details.

**Long term**

#### E26 · GPA by quarter
- **Status:** [x] done · **Phase:** 2
- **What:** GPA history across your whole time at UW.
- **Done when:**
  - A chart and table show GPA for each quarter (from E5) and the current projected quarter, plus cumulative GPA over time.
  - Your target appears as a reference line.

#### E27 · Credits completed
- **Status:** [x] done · **Phase:** 2
- **What:** Your credit totals.
- **Done when:**
  - Shows credits completed (passing and S/CR grades from E5), credits in progress this quarter, and GPA credits (numeric grades only).
  - Optional: a credits goal (default 180) with a progress bar.

#### E28 · Strongest and weakest subjects
- **Status:** [x] done · **Phase:** 2
- **What:** Which subjects you do best and worst in.
- **Done when:**
  - Courses are grouped by department code (CSE, MATH, etc.), with a credit-weighted average grade per subject.
  - The top and bottom subjects are shown. Subjects with only one course are labeled as such.

#### E29 · Custom grade total
- **Status:** [x] done · **Phase:** 2
- **What:** Classes graded out of a fixed number of points (the owner's real estate class: out of 600, with 700 available). *(Added 2026-10-01 at the owner's request.)*
- **Done when:**
  - The grade is points earned ÷ the class total (e.g. 600), extra points still count, and the syllabus scale is used exactly as written.
  - Current standing is shown as "on pace for X%", and "what you need" uses the class total. Checked against hand-calculated cases.

#### E30 · Grades that aren't on Canvas
- **Status:** [x] done · **Phase:** 2
- **What:** Categories the syllabus counts but Canvas doesn't (the owner's accounting class: professionalism, 5%), plus conditional rules like "drop the lowest quiz only once all 3 are graded". *(Added 2026-10-01.)*
- **Done when:**
  - A category can exist without Canvas assignments, with an assumed score (default 100%) you can change.
  - Drop rules can require a minimum number of graded items before dropping. Both are covered by hand-calculated tests.

#### E31 · Statistics-class grading formula
- **Status:** [x] done · **Phase:** 2
- **What:** Completion categories worth 0–15% each by how much you complete; exams split the rest 2/7, 2/7, 3/7. *(Added 2026-10-01.)*
- **Done when:**
  - Grades match the syllabus formula, including its two worked examples (exams worth 20/20/30% and about 24/24/36%).
  - Projections, what-if and "what you need" work with the formula.

#### E32 · Use Canvas's grade when it's reliable
- **Status:** [x] done · **Phase:** 2
- **What:** When Canvas's current % can be trusted, show it instead of recalculating. *(Added 2026-10-01.)*
- **Done when:**
  - Canvas's % is used when it's shown, the class has no special syllabus rules, and you haven't overridden weights or drops. Projections still use the dashboard's math.
  - Classes whose syllabus Canvas can't represent always use the dashboard's math. A setting turns this on or off (default on).

#### E33 · Automatic grading setup
- **Status:** [x] done · **Phase:** 2
- **What:** No setup needed: credits, scale, weights and rules apply automatically. *(Added 2026-10-01; supersedes the "Scale not set → left out of GPA" behavior in E1/E2.)*
- **Done when:**
  - Built-in setups written from the owner's syllabi (accounting, statistics and real estate, Autumn 2026) are matched by course code and applied automatically, with assignments sorted into syllabus categories by name. Anything that can't be matched is listed, never silently dropped.
  - Other classes use, in order: your own setup → the instructor's Canvas scale → a scale found in the Canvas syllabus → the common UW scale. Credits default to 5. Every guess is labeled "Estimated".
  - You can still override anything, or turn the automatic setup off per class.

### F. Course content

#### F1 · Course home page
- **Status:** [x] done · **Phase:** 3
- **What:** A clean home page for each class.
- **Done when:**
  - The Courses page lists your courses. Each opens a course page with upcoming work, current grade, latest announcement, and quick links (F9).
  - The course page has tabs for that course's content (Assignments, Announcements, Modules, Pages, Files, Syllabus, Discussions, People), and tabs the course doesn't use are hidden.

#### F2 · Unified announcements
- **Status:** [x] done (2026-10-20, K15: in the public build, opening an announcement marks it read on your computer only) · **Phase:** 3
- **What:** Announcements from every class in one feed.
- **Done when:**
  - One feed shows announcements from all courses, newest first, with course name and date.
  - Unread announcements are highlighted, and opening one marks it as read in Canvas as well.
  - The count of unread announcements appears in Needs attention on Home.

- **Note (Phase 3):** Marking read in Canvas needs Canvas's CSRF token, read with Chrome's "cookies" permission (canvas.uw.edu only). This is the dashboard's only write to Canvas.

#### F3 · Modules
- **Status:** [x] done · **Phase:** 3
- **What:** Course modules, cleanly laid out.
- **Done when:**
  - Each course's modules are shown in order, with collapsible sections and each item's type and completion status.
  - Items open in the dashboard when possible (pages, assignments, files) and otherwise link to Canvas.
  - Locked items show when they unlock.

#### F4 · Course pages
- **Status:** [x] done (hardened 2026-10-20: images in Canvas content only load from Canvas itself; images hosted elsewhere become a link, so outside sites can’t see when you open a page; applies everywhere Canvas HTML is shown) · **Phase:** 3
- **What:** Read Canvas pages in the dashboard.
- **Done when:**
  - Course pages are listed and display with clean formatting, including images and links. The HTML is cleaned to be safe.
  - Links to other Canvas pages open inside the dashboard when possible.

#### F5 · Files
- **Status:** [x] done · **Phase:** 3
- **What:** Browse and download course files.
- **Done when:**
  - Each course's files can be browsed by folder, with name, size, date and type icon.
  - Clicking downloads or opens a preview (PDFs and images open in a new tab).
  - When the instructor hides the Files section, it says so instead of showing an error.

#### F6 · Syllabus
- **Status:** [x] done · **Phase:** 3
- **What:** The course syllabus.
- **Done when:**
  - The syllabus displays with clean formatting.
  - When the syllabus is a file or external link, there's a link to it.

#### F7 · Discussions
- **Status:** [x] done · **Phase:** 3
- **What:** Read course discussions.
- **Done when:**
  - Discussions are listed per course with unread counts, due dates (if graded) and last activity.
  - Opening one shows the posts and replies as a readable thread, with unread posts marked.

#### F8 · Inbox
- **Status:** [x] done · **Phase:** 3
- **What:** Your Canvas messages.
- **Done when:**
  - Conversations are listed with sender, subject, course and date. Unread ones are highlighted.
  - Opening one shows the full thread, including attachments.
  - Unread messages appear in Needs attention on Home, and there's a link to reply in Canvas. (Replying from the dashboard isn't part of F8.)

#### F9 · Quick links
- **Status:** [x] done (hardened 2026-10-20: your links are checked again when shown, so only ordinary web addresses work, even from a restored backup) · **Phase:** 3
- **What:** One-click links per course.
- **Done when:**
  - Each course shows links to Zoom, the syllabus, files and modules, plus external tools found in the course navigation.
  - You can add, edit, reorder and remove your own links, like a Zoom link from the syllabus.

#### F10 · Instructors, TAs and office hours
- **Status:** [x] done · **Phase:** 3
- **What:** Who teaches the course and when they're available.
- **Done when:**
  - Instructors and TAs are listed from Canvas, with their roles and a button to message them in Canvas.
  - You can add office hours (days, times, location or Zoom link) for each person, and they appear on the course page.

- **Note (Phase 3):** Office hours from the owner's syllabi (accounting and real estate) are built in, like the grading setups (E33), and can be removed or added to. Weekly times become sessions in the C15 Office hours section for the next 14 days.

#### F11 · Study groups
- **Status:** [x] done · **Phase:** 3
- **What:** Your study group for each course.
- **Done when:**
  - Each course has a study group list you fill in: names, contact info, meeting times and notes.
  - Canvas groups you belong to are shown automatically when the course uses them.

#### F12 · Search everything
- **Status:** [x] done · **Phase:** 3
- **What:** One search across assignments, announcements, pages and files.
- **Done when:**
  - The search box (C12) now also searches announcements, pages and file names, with results grouped by type.
  - Results appear as you type, and each one opens in the dashboard.

#### F13 · Submit from the dashboard
- **Status:** [~] partial — verify in Chrome on a practice assignment: file uploads and text entry submit after a review-and-confirm step, status turns Submitted with Canvas's attempt and time, errors show Canvas's reason with a "Submit in Canvas instead" link, and your files and text are kept. Tested with sample data only. Uploads go to canvas.uw.edu or to Instructure's file storage (allowed 2026-10-06, see A7), then are confirmed on canvas.uw.edu; any other host is refused and links to Canvas (2026-10-20, K15: owner build only; left out of the public build) · **Phase:** 5
- **What:** Turn in file uploads and text answers without opening Canvas.
- **Done when:**
  - For assignments that accept file uploads or text entry, the details offer **Submit**. You attach files or type text, then confirm.
  - After submitting, the status updates to Submitted and the Canvas confirmation is shown. Errors show clearly, with a link to submit in Canvas instead.
  - Other submission types link to Canvas.
- **Suggestion:** test this on a low-stakes or practice assignment first, since a failed submission close to a deadline would be costly.

#### F14 · Reply to discussions
- **Status:** [~] partial — verify in Chrome: reply to a topic or to any post (inline box under it), with bold, italic, lists and links; your post appears in the thread right away; a failed post keeps your text and links to Canvas. Locked discussions and announcements say so instead. Tested with sample data only (2026-10-20, K15: owner build only; left out of the public build) · **Phase:** 5
- **What:** Post discussion replies from the dashboard.
- **Done when:**
  - You can write and post a reply to a topic or to another post, with basic formatting.
  - Your post appears in the thread right after posting. If posting fails, your text is kept and a link to Canvas is shown.

#### F15 · Quizzes and exams link out
- **Status:** [x] done · **Phase:** 1
- **What:** Quizzes and exams open in Canvas.
- **Done when:**
  - Quizzes and exams show their details (due date, time limit, attempts allowed, points) and a **Take in Canvas** button.
  - The dashboard never tries to show or run a quiz itself.
- **Note:** placed in Phase 1 instead of 3 because quizzes appear in the Phase 1 due-date lists and need this behavior from the start.

### G. Planning and time

#### G1 · Weekly calendar
- **Status:** [x] done — Calendar → Week: a 24-hour grid (Apple Calendar style) with 7 day columns, so free time between things is visible. Classes, events and timed plans are blocks; things with no time sit in an all-day row; deadlines are listed in a "due" row at the end of each day. Lectures/sections, quizzes/exams, events, planned work and deadlines each look different (legend under the grid). Opens at your first thing of the day; ‹ › and Today, shortcuts [ ] t; Long titles end at a whole line with "…", time and room show when there's room, and the full text appears on hover in a soft-pink popup that survives redraws (2026-10-07). "Not planned yet" below: one column per class, soonest due first, each with its due date and days left colored by urgency (red: late or due within a day, amber: 2–3 days, yellow-green: 4–6, green: a week or more); online quizzes you take on your own time are listed, in-person quizzes and exams aren't (2026-10-07) · **Phase:** 4
- **What:** A week-at-a-glance view.
- **Done when:**
  - The Calendar page has a week view with each day as a column, showing due items by time, course color dots and plan blocks (G6).
  - You can move between weeks and jump back to today.

#### G2 · Monthly calendar
- **Status:** [x] done — Calendar → Month: 6-week grid with dots and counts (busy-day highlighting removed with C6), click a day to list its items · **Phase:** 4
- **What:** A month view.
- **Done when:**
  - A month grid shows the number of items per day with dots or short labels. Busy days (C6) stand out.
  - Clicking a day shows its items.

#### G3 · Time estimates
- **Status:** [x] done — estimate in item details (15-minute steps, to-dos too); shown on week cards and in Next up; time spent shown next to the estimate · **Phase:** 4
- **What:** How long you think each item will take.
- **Done when:**
  - Any item, including your own to-dos, can have a time estimate (15-minute steps).
  - Estimates show in details and in calendar views.
  - Optional: after a focus session (G7), the time actually spent is shown next to the estimate.

#### G4 · Daily workload
- **Status:** [x] done — each week-view day shows its hours (plans count on their days, otherwise the estimate counts on the due day); days over the limit (Settings → Planning, default 6h) are highlighted · **Phase:** 4
- **What:** Total planned hours per day.
- **Done when:**
  - Each day in the week view shows total estimated hours for items due or planned that day.
  - Days over a limit you set (default 6 hours) are highlighted.

#### G5 · Suggested work order
- **Status:** [x] done — Home → Due soon → Next up: pinned, then overdue work you can still turn in, then least slack, then grade impact; one-line reason; pin and Skip (until tomorrow). Closed overdue work is left out, and so is anything whose time has passed without being overdue, like an in-person exam that already happened (fixed 2026-10-06) · **Phase:** 4
- **What:** What to work on next.
- **Done when:**
  - A "Next up" list orders unfinished work by due date, time estimate and grade impact (E14).
  - Each suggestion gives a one-line reason, like "Due tomorrow, ~3h."
  - You can pin or skip suggestions.

#### G6 · Plan blocks
- **Status:** [x] done — work you plan for a day shows under Today on Home that day, tagged "Planned today" and moved from its usual group so it's never listed twice (something already due today, overdue or pinned stays where it is; 2026-10-07); drag onto a time in the week or day grid (snaps to 15 minutes) or onto the all-day row for any time that day, or add from item details (Today, Tomorrow, any date, optional start time); several per item; move by dragging or editing; delete with undo; in backups · **Phase:** 4
- **What:** Drag assignments onto the days you'll work on them.
- **Done when:**
  - In the week view, you can drag an item onto a day (and optionally a time) to plan when you'll work on it. An item can have several plan blocks.
  - Planned blocks show on that day separately from due dates.
  - Plan blocks can be moved and deleted, and are included in backups (A10).

#### G7 · Focus timer
- **Status:** [~] partial — verify in Chrome: a length menu next to Start focus picks 15–90 minutes for that session (default from Settings → Planning, added 2026-10-06); timer, work→break switch and time logging tested in test mode; running after the tab closes and the end-of-session notification use Chrome alarms and notifications · **Phase:** 4
- **What:** A Pomodoro timer tied to an assignment.
- **Done when:**
  - You can start a timer from any item: 25 minutes of work, 5 minutes of break by default (changeable).
  - The timer keeps running if the tab closes, and a notification signals the end of each session.
  - Time spent is saved per item and shown in details.

#### G8 · Calendar export
- **Status:** [x] done — Settings → Calendar export: .ics download with course filter and optional plans; Google and Apple import steps; copy button for the Canvas calendar feed. Importing into Google or Apple is yours to try · **Phase:** 4
- **What:** Due dates in Google or Apple Calendar.
- **Done when:**
  - **Export** downloads an `.ics` file of due dates (and optionally plan blocks), filterable by course. Google Calendar and Apple Calendar can import it.
  - Settings explains how to import, and also links to the Canvas calendar feed as an always-updating option.

#### G9 · Day view
- **Status:** [x] done — Calendar → Day: the same 24-hour grid for one day, with a now-line, all-day row, and everything due that day listed underneath (with checkboxes). Overlapping blocks sit side by side · **Phase:** 4
- **What:** One day, hour by hour. *(Added 2026-10-01 at the owner's request, next to G1 week and G2 month.)*
- **Done when:**
  - The Calendar page has Day / Week / Month switches. Day view shows a time grid with events at their times, plus everything due that day.
  - You can step to the previous or next day and jump back to today.

#### G10 · Dates from your syllabi
- **Status:** [x] done — Statistics: Exam 1 (Fri 10/30), Exam 2 (Fri 11/20) and the final (Thu 12/17, 2:30 PM) with times and room. Real estate: all 9 chapter deadlines (11:59 PM; Chapter 7 on Mon 11/30). No duplicates when Canvas lists the same thing; if Canvas dates an exam on a different day, both show and the details explain the difference. the accounting class (from the separate schedule file; quizzes are given in your quiz section, so they show at quiz-section time with "Your quiz section room" and a QUIZ tag): Quiz 1 (10/14), Exam 1 (10/22), Quiz 2 (11/6), Exam 2 (11/17), optional Quiz 3 (12/4), final (Sat 12/12, 8:30–10:20 AM) and 12 Canvas homework deadlines. The schedule file lists no meeting times; you gave them on 2026-10-06 (lecture 10:00–11:20, quiz section 12:30–1:20), so midterms are at lecture time in the lecture hall and quizzes at quiz-section time. A quiz or exam Canvas already shows as graded isn't added again · **Phase:** 4
- **What:** Exams and deadlines from the built-in syllabi show up even when Canvas doesn't list them. *(Added 2026-10-06 at the owner's request.)*
- **Done when:**
  - Exams and deadlines from the syllabi appear on Home, every calendar view and the timeline, with time and room, and are typed correctly (exams as exams).
  - No duplicates: a Canvas item on the same day replaces the syllabus one, an undated Canvas exam gets the syllabus date, and a syllabus deadline is skipped when Canvas has work due that day.
  - Details say the date came from the syllabus. Can be turned off in Settings → Features.

#### G11 · Class meetings and weekly topics
- **Status:** [~] partial — verify in Chrome: statistics lectures (Wed/Fri 3:30, in the lecture hall) and quiz sections (Tue/Thu at your section's time and room) show in Day and Week with that week's topics and chapters; no-class days (11/11, 11/26, 11/27) and the 10/9 video lecture are marked; exam days replace the lecture. the accounting class: every lecture and quiz section with its topic (Ch 1 – Financial Statements, etc.), holidays and the async Exam 2 review marked; at lecture (Tue/Thu 10:00–11:20) and quiz-section (Wed/Fri 12:30–1:20) times. Your quiz section is read from Canvas; that needs a check with your real account. If it can't be found, quiz sections are left out rather than guessed · **Phase:** 4
- **What:** Lectures and sections on the calendar, with what each week covers. *(Added 2026-10-06 at the owner's request.)*
- **Done when:**
  - Class meetings show in the Day and Week views at the right times and places, styled quieter than deadlines, and stay off Home, Next up, notifications and the class page.
  - Each meeting shows that week's topics; its details list the chapters to read.
  - Cancelled days are marked. Overlapping blocks in the Day view sit side by side. Can be turned off in Settings → Features.
  - A date with no time shows as all-day ("time not listed") instead of a made-up time, in lists, the Day view's All-day row, details and the calendar export.

### H. Notifications

#### H1 · Deadline reminders
- **Status:** [~] partial — verify in Chrome: timing, once-per-item, skipping submitted/hidden/excused and quiet hours are tested; showing the notification and opening the item on click only work inside Chrome · **Phase:** 4
- **What:** Reminders before things are due, at times you choose.
- **Done when:**
  - Chrome notifications fire at the times you set (defaults: 24h and 2h before due) for unsubmitted items.
  - Clicking a notification opens the item in the dashboard.
  - Each reminder fires only once per item, and none fire for submitted, hidden or excused items. Quiet hours are supported.

#### H2 · Icon badge
- **Status:** [~] partial — verify in Chrome: count and red-when-overdue tested (if nothing is due today but something is overdue, it shows the overdue count in red); setting the icon badge only works inside Chrome · **Phase:** 4
- **What:** A count of what's due today on the extension icon.
- **Done when:**
  - The badge shows the number of unsubmitted items due today. It turns red when anything is overdue.
  - It updates on every refresh and is hidden when the count is 0.

#### H3 · Morning summary
- **Status:** [~] partial — verify in Chrome: once a day from your chosen time until noon, skipped in quiet hours, tested; the notification itself only works inside Chrome · **Phase:** 4
- **What:** A daily summary.
- **Done when:**
  - Once a day at a time you choose (default 8:00 AM), a notification summarizes what's due today, anything overdue and any at-risk courses.
  - Clicking it opens Home. If Chrome was closed at that time, it shows the next time Chrome opens that morning.

#### H4 · New assignment alerts
- **Status:** [~] partial — verify in Chrome: new-item detection, grouping and silent first load tested; the notification only works inside Chrome · **Phase:** 4
- **What:** Alerts when assignments are posted.
- **Done when:**
  - When a refresh finds an assignment that wasn't there before, a notification shows its name, course and due date.
  - Several new items at once are grouped into one notification. No alerts fire on the first-ever load.

#### H5 · New announcement alerts
- **Status:** [~] partial — verify in Chrome: detection and per-class mutes tested; the notification and opening the announcement on click only work inside Chrome · **Phase:** 4
- **What:** Alerts when instructors post announcements.
- **Done when:**
  - New announcements trigger a notification with course and title. Clicking opens the announcement (F2).
  - Can be turned off per course.

#### H6 · New grade alerts
- **Status:** [~] partial — verify in Chrome: new/changed grade detection, course-grade change and hide-scores tested; the notification and opening the grade on click only work inside Chrome · **Phase:** 4
- **What:** Alerts when a grade is posted.
- **Done when:**
  - When a new or changed grade is found, a notification shows the item and score, plus how the course grade changed.
  - Clicking opens the grade's details. Can be turned off, or set to hide scores in the notification itself.

#### H7 · GPA risk alerts
- **Status:** [~] partial — verify in Chrome: fires once when a course newly becomes at risk (tested); the notification only works inside Chrome · **Phase:** 4
- **What:** A notification when a course becomes at risk (E15).
- **Done when:**
  - When a course newly becomes at risk, a notification says which course, by how much, and what's needed to recover.
  - It fires once per change, not on every refresh.

### I. Extras

#### I1 · Past quarter archive
- **Status:** [x] done — on each refresh, classes whose quarter ended (a day after the term end date) are saved to an archive: final % and grade, credits, every assignment score, your notes and the grade trend; then they leave the current lists. A class Canvas stops listing after its term is saved from the previous refresh; a dropped class (term not over) isn't. Browse on Grades → History → Archive (read-only); "Add to GPA history" adds the quarter to Past quarters in one click. The archive is in backups · **Phase:** 5
- **What:** A browsable archive of past quarters.
- **Done when:**
  - When a quarter ends, its courses, final grades, assignments, notes and snapshots are saved to an archive by quarter.
  - Past quarters can be browsed read-only and don't clutter current lists.
  - Final grades from archived quarters can be added to past quarters (E5) with one click.

#### I2 · Pin, notes and hide everywhere
- **Status:** [x] done — pin, hide and notes on announcements, pages, files, discussions, messages, modules and classes (files and modules have a details panel for this; hiding a class uses the Settings → Courses switch). Hidden things leave their lists and appear in Home → "hidden or snoozed" to undo. Home → "N pinned" opens one Pinned page with everything you've pinned, grouped by kind. All of it is in backups · **Phase:** 5
- **What:** Pin (C10), notes (D6) and hide (C11) work on everything, not just assignments.
- **Done when:**
  - Announcements, pages, files, discussions, messages, modules and courses can be pinned, hidden and given notes.
  - Pinned items from any type appear in one Pinned view, and all of this is included in backups (A10).


### J. Look and feel

*(Phase 6, added 2026-10-06 at the owner's request.)*

#### J1 · Soft pink theme
- **Status:** [x] done — soft-pink tinted backgrounds, a raspberry-pink accent and class colors softened to match, in light and dark. Every text color passes WCAG AA in both (tools/contrast.py checks pink and Classic, light and dark). Settings → Appearance → Color theme switches back to Classic. No flash of the wrong colors on open · **Phase:** 6
- **What:** A soft pink color scheme.
- **Done when:**
  - The whole app uses the pink palette in light and dark mode, with all text meeting AA contrast.
  - The original look stays available as "Classic" in Settings → Appearance.

#### J2 · Rounded headings
- **Status:** [x] done — page titles, section headings, drawer titles and big numbers use the Mac's built-in rounded system font (SF Pro Rounded); nothing is downloaded. Can be turned off in Settings → Features · **Phase:** 6
- **What:** A friendlier, rounded font for titles and numbers.
- **Done when:** Headings and big numbers use the system's rounded font where the Mac has it, falling back to the normal system font.

#### J3 · Mochi's daily greeting
- **Status:** [x] done — Mochi, an original cat drawn in code (no image files), greets you at the top of Home ("Good morning, Sam!") with up to three lines from your own data, in priority order: overdue work, a quiz or exam in the next 3 days, what's due today (or "Everything due today is done"), your next class with room, your streak, classes at risk. Mood follows your day: worried (overdue or a test within a day), celebrating (today's work done), happy (on a streak), sleepy (late night). On Home she's a panel in the right column with the chat built in (J4). On wide windows the panel is exactly as tall as the Grades + Exams column, so both sides weigh the same; the chat fills the space and scrolls inside it. There's no hide button (your choice, 2026-10-07); Settings → Features turns her off. Gentle bob and blink, off with reduce motion · **Phase:** 6
- **What:** A cute cat mascot who greets you with a tiny summary of your day.
- **Done when:**
  - Home shows Mochi with a greeting and 1–3 lines about today, written from your data with no AI and nothing sent anywhere.
  - Her mood matches your day; she can be hidden for the day or turned off in Settings → Features.

#### J4 · Ask Mochi: built-in answers
- **Status:** [x] done — a chat built into Mochi's panel on Home (and a full-size version with m) that answers from your data instantly and privately: what's due (today, tomorrow, a weekday, next week, 11/27, Nov 26…), next exams or quizzes, when and where a lecture or quiz section is, why there's no class or section (holidays, async days, a quiz or exam taking that slot, or "it only meets Wednesdays and Fridays"; all from your syllabi; fixed 2026-10-07 to count quizzes and to read "next week on Wednesday" as that day), grades and GPA, overdue work, office hours, what to work on next, what you finished, your streak. Understands class names, codes and everyday words ("accounting", "stats", "real estate"). Answers link to the items. Example questions are picked from your data and only shown when they apply (a cancelled class coming up, your next in-person quiz or exam, overdue work, your lowest class), and Mochi can answer each one (2026-10-07). The conversation isn't saved · **Phase:** 6
- **What:** Ask questions about your schedule and assignments, like "Why don't I have a quiz section next week?"
- **Done when:**
  - Common questions about dates, classes, exams, grades and work get exact answers from your data.
  - Questions it doesn't recognize go to J5, or get a friendly list of example questions.

#### J5 · Ask Mochi: on-device AI
- **Status:** [~] partial — verify in Chrome: questions the built-in answers don't recognize go to Chrome's built-in AI (Gemini Nano, the Prompt API), which runs on your Mac. It gets a short summary of your next 14 days, grades and class meetings and is told to answer only from it; answers are labeled "On-device AI · double-check important details". If the model isn't downloaded yet, Mochi offers a one-time download (done by Chrome itself); if your Mac can't run it, Mochi sticks to J4. Tested with sample data up to the download offer; real answers depend on your Mac · **Phase:** 6
- **What:** Natural conversation for anything the built-in answers don't cover, without your data leaving your computer.
- **Done when:**
  - When Chrome's on-device model is available, unrecognized questions are answered from your schedule, streaming in, labeled as AI.
  - Nothing is sent anywhere by the extension; when the model isn't available, it says so and falls back to J4.

#### J6 · Celebrations
- **Status:** [x] done — ticking something off makes its checkbox fill and pop before it moves to Done; finishing the last thing due today sets off a short confetti burst and "That's everything due today." (plus your streak at 3, 7, 14, 21, 30, 50, 75, 100 days). Only for what you just did, never on page load. None of it runs with reduce motion · **Phase:** 6
- **What:** Small moments of delight.
- **Done when:** Checking off shows a quick pop; completing the day shows confetti once; reduce motion turns it all off; can be turned off in Settings → Features.

#### J7 · Mochi in empty states
- **Status:** [x] done — happy empty states show Mochi: Home's "You're all caught up", Next up's "Nothing left to work on", Calendar's "Nothing due", Completed and Pinned when empty. Follows the Mochi switch · **Phase:** 6
- **What:** Friendly empty states.
- **Done when:** Happy empty states show a small Mochi with the message.

---

### K. Any student

*(Phase 7, added 2026-10-20 at the owner's request and approved the same day, together with the rule 7 change below. The goal is a free extension any student can install from the Chrome Web Store, at any school that uses Canvas.)*

**Approved 2026-10-20:** K1 changes project rule 7 from "only `canvas.uw.edu`" to "only the Canvas address you chose during setup" (plus the existing upload exception). Nothing else would be contacted.

#### K1 · Choose your school
- **Status:** [~] partial — built and tested with sample data. Setup asks for your school’s Canvas address (typed, pasted or `*.instructure.com`), checks it really is Canvas and whether you’re signed in, and asks Chrome for that one site only. The manifest names no school. Every request is checked against your school before it’s sent, and `tools/check_extension.py` fails if a school address is hard-coded. Settings → General → School → Change school keeps your data and reloads Canvas data. **Check in Chrome:** after reloading the extension you’ll see setup once; type `canvas.uw.edu`, choose Allow, and your dashboard comes back as before · **Phase:** 7
- **What:** Works with any school's Canvas, not just UW.
- **Done when:**
  - Setup asks for your school's Canvas address (e.g. `canvas.asu.edu`, or a custom domain), checks that it's a Canvas site, and asks Chrome for access to that one site only.
  - The manifest no longer names `canvas.uw.edu`; every request goes only to the chosen address (and Instructure's upload storage for F13). The extension check (`tools/check_extension.py`) enforces this.
  - The school can be changed later in Settings; changing it clears cached Canvas data but keeps your own data.

#### K2 · Your time zone
- **Status:** [x] done — dates and times use your computer’s time zone (Canvas’s profile zone only if the computer doesn’t give one). Tested with Eastern time across the November daylight-saving change · **Phase:** 7
- **What:** Dates and times use your computer's time zone instead of Pacific time.
- **Done when:** All dates, "due today", calendars, reminders and syllabus times use the computer's time zone, with tests for a non-Pacific zone and a daylight-saving change.

#### K3 · Grading scale presets
- **Status:** [x] done — Settings → Grades → Grading system: letter grades with + and −, letters without, or UW 4.0 decimal. Grades show as letters (A−) in letter systems everywhere: Home, Grades, class details, Mochi, alerts. "Need 91.2% for an A−" uses letters too. Canvas letter schemes (A, A-, B+ …) are imported. Usual credits per class and credits to graduate default to the system’s norm (3 and 120, or 5 and 180), labeled "assumed". P/NP added to pass/fail. Your existing data stays UW decimal with 180 credits. Hand-calculated tests: cutoffs at 93/92.99/87/80/70/60/59.99, letters without +/−, percent needed, and a 3-class GPA (3.12) · **Phase:** 7
- **What:** Common grading systems, not just UW's.
- **Done when:**
  - Presets: UW 4.0 decimal, US letter grades with plus/minus (A = 4.0, A− = 3.7, …), letter grades without plus/minus, and custom. Chosen once for your school, changeable per class.
  - GPA rules (rounding, pass/fail, credits) are settings with sensible defaults, all labeled "assumed" until you confirm them.
  - Grade and GPA math for every preset has tests with hand-calculated answers.

#### K4 · Semesters and quarters
- **Status:** [x] done — the kind of term is detected from Canvas’s term names (Autumn/Winter → quarters, "Semester" → semesters) or else term length (98+ days → semester), or chosen in Settings → General → Terms. Wording follows it everywhere: "Semester GPA", "Calendar → Semester", "This semester", "Past semesters", the archive and Mochi. With no clue it says "term" · **Phase:** 7
- **What:** Works with semester schools as well as quarter schools.
- **Done when:** Term type (quarter, semester, trimester) is detected from Canvas term dates or chosen in setup, and the archive (I1), quarter timeline (C7), GPA wording and "this quarter" text all follow it.

#### K5 · Syllabus import
- **Status:** [~] partial — reads Word (.docx) and PDF files on your computer with nothing downloaded (no libraries; tested with a Word file and a compressed PDF like Word’s own export), the Canvas syllabus page, or pasted text. Pattern matching finds class meetings (MWF/TTh/“Tuesdays”, times, rooms), exams and quizzes (with “in class”), deadlines (including table “Due” columns), days off (and ranges like Nov 26–27) and topics, each with the line it came from. When Chrome’s on-device AI is available it adds what the patterns missed. **Not yet checked:** the AI step (needs Chrome with on-device AI) and real syllabi from other classes. Scanned PDFs (pictures of pages) can’t be read; the screen says to paste text instead · **Phase:** 7
- **What:** Bring in your own syllabi instead of having them typed into the code.
- **Done when:**
  - You can add a syllabus per class by uploading a PDF or Word file, using the class's Canvas syllabus page, or pasting text.
  - Exams, quizzes, deadlines, class meeting times and rooms, and weekly topics are pulled out on your computer (Chrome's built-in AI when available, pattern matching otherwise). The file never leaves the computer.
  - Everything found goes to the review screen (K6) first; nothing is added automatically.

#### K6 · Review imported dates
- **Status:** [x] done — after importing, every class meeting, exam, deadline, day off and topic is listed with the line of the syllabus it came from. Edit any field, remove what doesn’t belong, add what’s missing, then Save to calendar. Nothing is saved before that · **Phase:** 7
- **What:** Check what was found before it reaches your calendar.
- **Done when:** A review screen lists every date and meeting found, each with the line of the syllabus it came from. You can edit, remove or add entries, then confirm. Entries stay marked "from your syllabus" (as G10 does today).

#### K7 · Class meeting editor
- **Status:** [x] done — the same screen edits class meetings by hand (name, day buttons, start, end, room) and days off; a class page’s **Syllabus dates** button opens it, and saved dates can be edited later. Meetings missing days or a start time are flagged and left off the calendar · **Phase:** 7
- **What:** Enter or fix class times, rooms and your section by hand.
- **Done when:** Each class has an editor for meetings (lecture, section, lab: days, times, room, dates, cancelled days), feeding the calendar (G11) and Ask Mochi.

#### K8 · Your syllabi become your data
- **Status:** [~] partial — the three hand-written syllabi moved out of the code into `owner-data/syllabi.js`. On first run they’re copied into your saved data (storage key `syllabi`, included in backup), so the published zip contains no one’s schedule (a test checks this). Saved syllabi for one Canvas course win over course-code matches. **Check in Chrome:** after reloading, your calendar, exams and grades look the same as before · **Phase:** 7
- **What:** Move the owner's three built-in syllabi out of the code.
- **Done when:** The owner's accounting, statistics and real estate schedules, grading setups and office hours (currently in `profiles.js`) are converted to saved data, you see the same calendar and grades as before, and they're included in backup (A10). The published extension contains no one's personal schedule.

#### K9 · First-run setup
- **Status:** [x] done — new installs get: school (K1) → which courses are classes → grading system and terms → add syllabi (optional), with Back/Next, step numbers and “Skip setup for now”. Every choice can be changed later in Settings. People who used the dashboard before skip the optional steps · **Phase:** 7
- **What:** A short welcome for new students.
- **Done when:** First launch walks through: choose school (K1), sign in to Canvas in a normal tab, pick which classes count, choose a grading scale (K3), and optionally import syllabi (K5). Every step can be skipped and redone from Settings. Screens with no data yet explain what will appear.

#### K10 · Other schools' Canvas setups
- **Status:** [~] partial — a second sample school (`?scenario=otherschool`: semester terms, letter-grade Canvas scheme, hidden course total, a class with no categories, a quiz in an outside tool, a combined ECON 2105/2106 class, a class with no assignments or syllabus) loads on every page with no errors and correct numbers (tested). Found and fixed: 4-digit and dashed course numbers (BIO 1510, MATH-1210, CS101) weren’t recognized as classes. **Still needed:** real accounts from at least two other schools (volunteers) · **Phase:** 7
- **What:** Handle what other schools and instructors turn off or set up differently.
- **Done when:** Tested with sample data covering hidden grades and totals, no assignment groups, quizzes in outside tools, cross-listed and combined sections, and courses without a syllabus. Each shows a clear note instead of an error or a wrong number. Then checked with real accounts from at least two other schools (volunteers).

#### K11 · Name and wording
- **Status:** [x] done — the name is **Neko** (your choice, 2026-10-20), set in one place (`APP_NAME` in `src/lib/env.js`, plus `manifest.json`), the site and the store notes. “Canvas” isn’t part of the name; UW-only wording is gone from screens (only the “UW 4.0 decimal” grading choice names UW); the manifest says “works with Canvas” and “Not affiliated with Instructure” · **Phase:** 7
- **What:** A new name and text without anyone else's trademarks.
- **Done when:** The name, icon, descriptions and in-app text no longer use "Canvas" as part of the name, "UW", or university logos. "for Canvas" may appear only as a description. *(You choose the name.)*

#### K12 · About and disclaimers
- **Status:** [~] partial — Settings → About says: not affiliated with Instructure or any school; grades, GPA and syllabus dates are estimates, so check Canvas and your transcript; all data stays on this computer. The GPA card says “Estimate · official grades are on Canvas and your transcript”. **Waiting for:** your privacy policy and terms pages (set `PRIVACY_URL` and `TERMS_URL`) · **Phase:** 7
- **What:** A short About screen.
- **Done when:** Settings → About states: not affiliated with Instructure or any school; grades and GPA are estimates, so always check Canvas for deadlines and official grades; all data stays on this computer. It links to the privacy policy and terms (web pages you publish) and gives a contact email. The same disclaimer appears once next to projected GPA.

#### K13 · Report a problem
- **Status:** [~] partial — Settings → About → Report a problem opens your email app to the support address with the version and Chrome version filled in and nothing else. **Waiting for:** the support email (`SUPPORT_EMAIL`) · **Phase:** 7
- **What:** An easy way to send feedback.
- **Done when:** Settings → About has "Report a problem", which opens your email app addressed to the support address, with the extension version filled in. No grades, names or course data are included unless the student adds them.

#### K14 · Chrome Web Store package
- **Status:** [~] partial — `tools/build_zip.py` builds `dist/<name>-<version>.zip` (87 files, 234 KB), leaving out tests, sample data, tools, `owner-data/` and notes, and checks that everything it ships still loads and contains no one’s syllabus. `store/LISTING.md` has the single-purpose statement, a reason for every permission, the privacy answers and store text. **Waiting for:** the name, screenshots (sample data only) and your account steps (2026-10-20, K15: the zip is now the read-only public build with a generated manifest; `tools/test_builds.py` checks it) · **Phase:** 7
- **What:** Everything the Chrome Web Store asks for.
- **Done when:** Only the permissions in use are requested, each with a written reason; a single-purpose statement; data-use answers that match the privacy policy; store text and screenshots made with sample data only; and a zip built without tests, fixtures or tools.

#### K15 · Read-only public build
- **Status:** [x] done — every write to Canvas lives in `src/lib/canvasWrite.js` (owner build). The public zip replaces it with a stub that refuses, its `src/build.js` says “public”, and every write is refused before anything is sent, including with sample data. Submit (F13) and replies (F14) disappear from screens and Settings → Features. Opening an announcement marks it read on this computer only (F2). The generated public manifest drops `cookies` and Instructure’s upload host. Tests: browser tests switch to the public build and check that writes are refused, the features are gone and mark-read stays local; `tools/test_builds.py` builds the public and beta zips and checks their manifests, stubs and contents, and that your owner build still has everything · **Phase:** 7
- **What:** The public build only reads from Canvas. Your owner build keeps every feature. *(Added 2026-10-20 at the owner's request; changes F2, F13, F14 and K14 for the public build only.)*
- **Done when:**
  - The public zip leaves out assignment submission (F13) and discussion replies (F14). Their switches don't appear, and nothing in the zip can send a write request to Canvas.
  - Marking announcements read (F2) works in the public build by remembering read state on your computer, without Canvas's security token.
  - `tools/build_zip.py` generates the public manifest, which asks only for what the public build uses (no `cookies` and no upload host). `store/LISTING.md` gives a reason for each permission.
  - Tests cover both builds.

#### K16 · Demo mode
- **Status:** [~] partial — “Try it with sample data” on the first setup screen and in Settings → General. Demo mode loads a made-up student (CSE 143, MATH 126, PSYCH 101, ENGL 131, with class times, weekly topics and finals) and shows a “Demo — sample data” banner with Exit demo. Its data lives under separate `demo:` keys, never mixes with yours, and is deleted on exit, which returns to setup or your dashboard. It points at a school that can’t exist and loads nothing over the network. Your three classes and real instructor names moved out of the sample into `owner-data/fixtures.js` (test mode only). Every page and calendar view tested in test mode with no errors and no outside requests; reviewer instructions are in `store/LISTING.md`. **Check in Chrome:** try demo mode in the real extension once · **Phase:** 7
- **What:** Try the whole dashboard with a realistic sample student, without a Canvas account (also for Chrome Web Store reviewers, store screenshots and demo videos).
- **Done when:**
  - "Try it with sample data" appears on the first setup screen and in Settings.
  - Demo mode shows a clear "Demo — sample data" banner, makes no network requests, and keeps its data apart from real data. Exiting returns to setup (or to your dashboard, if you'd already set it up).
  - Every page works in demo mode. The sample contains none of the owner's classes or real people's names.
  - `store/LISTING.md` has reviewer instructions for seeing every feature in demo mode.

#### K17 · Landing site
- **Status:** [~] partial — `docs/` (renamed from `site/` so GitHub Pages can publish it) has a home page (pitch, 3 demo screenshots, Join the beta, features, FAQ), a privacy policy and terms (both marked “Draft for review”, not legal advice: data stays in the browser, no analytics, no server, FERPA, not affiliated), a support page, and `docs/README.md`. It uses one accent color, the system font and the spacing scale, light and dark, and has no horizontal scroll at phone width. `SITE_URL` in `src/lib/env.js` feeds `PRIVACY_URL` and `TERMS_URL`. Named Neko. **Waiting for:** the form link, the support email, your review of the drafts, and hosting · **Phase:** 7
- **What:** A static site in `docs/` for free GitHub Pages hosting.
- **Done when:**
  - It has the name and a one-line pitch, 3 screenshots from demo mode, and a "Join the beta" button (Google Form link supplied by the owner).
  - A short FAQ answers: is it safe, is it allowed, is it affiliated with Canvas, and what data it keeps.
  - It has privacy policy, terms and support pages. The policy and terms are marked as drafts for the owner's review and aren't legal advice. They cover: data stays in the browser, no analytics, no server, student privacy (FERPA) and not affiliated with Instructure.
  - Placeholders mark the name, form link and support email. `PRIVACY_URL` and `TERMS_URL` point to the site's pages.
  - It follows the design principles: one accent color, the system font and the spacing scale.

#### K18 · Feedback prompt
- **Status:** [~] partial — Home shows a one-time “How’s it going?” card once you’ve opened the dashboard on 7 different days, with Share feedback and Rate it links. Dismissing it (or using a link) hides it for good. Days are counted in your settings on this computer only (never in demo mode), and there’s a switch in Settings → Features. Tested, including with a preview-only link. **Waiting for:** the form link (`FEEDBACK_URL`) and store listing (`STORE_URL`); the card stays hidden until at least one is set · **Phase:** 7
- **What:** One gentle request for feedback, with no tracking.
- **Done when:**
  - After 7 days of use, Home shows a one-time "How's it going?" card with links to the feedback form and to rating on the Chrome Web Store.
  - Dismissing it hides it forever.
  - Days are counted on this computer only, and nothing is sent anywhere.
  - It has a switch in Settings → Features.

#### K19 · Beta build
- **Status:** [x] done — `python3 tools/build_zip.py --beta` writes `dist/<name>-<version>-beta.zip` (read-only like the public build, named “(Beta)”) plus a 5-step `INSTALL.md`. A small “Beta” label shows in the top bar of beta builds only · **Phase:** 7
- **What:** A build for beta testers to load unpacked.
- **Done when:** `tools/build_zip.py --beta` produces a zip plus a 5-step `INSTALL.md`, and the app shows a small "Beta" label.

#### K20 · What's new
- **Status:** [x] done — version 0.2.0, `CHANGELOG.md` started, and `src/lib/changelog.js` holds the same notes for the app (a test keeps the manifest, changelog and app versions in step). After an update, Settings shows “What’s new in 0.2.0” once and “Got it” hides it. You’ll see it once; new installs don’t · **Phase:** 7
- **What:** Tell people what changed after an update.
- **Done when:** The version is bumped, `CHANGELOG.md` is started, and after an update Settings shows a one-time "What's new" note from the changelog.

#### K21 · Git repository
- **Status:** [x] done — repository on branch `main` with a `.gitignore` for `owner-data/`, `dist/`, zips, `GPA-CHECKLIST.md` and system files. The repo copy is generic (your choice, 2026-10-20): tests use a renamed copy of your classes in `src/tests/sample/` (made-up codes, people, rooms and Zoom IDs), the spec says “your accounting class” instead of course codes, and the real words to keep out live in `owner-data/private-words.txt`. First commit made after you approved the list (121 files, scanned for personal details). Nothing pushed · **Phase:** 7
- **What:** Version history for the project, ready for GitHub.
- **Done when:** A git repository with a `.gitignore` that leaves out `owner-data/`, `dist/` and anything personal. The owner sees the file list before the first commit. Nothing is pushed.

#### K22 · "Works with Canvas" wording
- **Status:** [x] done — the name is Neko. The manifest says “A clean, private dashboard that works with Canvas. Not affiliated with Instructure or any school.” The store text, site, setup, About and beta INSTALL.md say “works with Canvas” and carry the not-affiliated note; wording rules are in `store/LISTING.md`; `tools/check_extension.py` enforces the manifest and site notes. No Canvas logo anywhere · **Phase:** 7
- **What:** Describe the product without implying it's affiliated with Instructure.
- **Done when:**
  - The name stays a placeholder until the owner chooses.
  - Descriptions say "works with Canvas", the Canvas logo is never used, and the not-affiliated note appears everywhere the name appears (extension, store listing, site).

**Your tasks before publishing (not features, listed so they aren't forgotten):**
- Choose the name (K11).
- Publish a privacy policy page and a terms page (Claude can draft them; a free student legal clinic can review them).
- Read Instructure's Acceptable Use Policy and API terms.
- Turn on 2-step verification (security key or authenticator app) for the Google account that will publish the extension, and keep it the only account with access.
- Pay the $5 Chrome Web Store developer fee and answer the trader question.
- Find 2–3 testers at other schools (K10).

---

## Coverage table

| ID | Feature | Phase | Status |
|---|---|---|---|
| A1 | Chrome extension loaded from a folder | 1 | [x] |
| A2 | New-tab dashboard | 1 | [~] |
| A3 | Toolbar popup | 1 | [~] |
| A4 | Uses your existing Canvas login | 1 | [x] |
| A5 | Expired-login detection | 1 | [~] |
| A6 | Automatic refresh | 1 | [~] |
| A7 | Data stays on your computer | 1 | [x] |
| A8 | Offline mode with "last updated" | 1 | [x] |
| A9 | Settings page | 1 | [x] |
| A10 | Back up and restore | 1 | [x] |
| B1 | Four main pages | 1 | [x] |
| B2 | Minimal Home | 1 | [x] |
| B3 | Details on click | 1 | [x] |
| B4 | Clean visual system | 1 | [x] |
| B5 | Dark, light or system theme | 1 | [x] |
| B6 | Compact or card view | 1 | [x] |
| B7 | Turn features off completely | 1 | [x] |
| B8 | Reorder Home sections | 1 | [x] |
| B9 | Keyboard shortcuts | 1 | [x] |
| B10 | Course nicknames and colors | 1 | [x] |
| B11 | Separate "Other" tab | 1 | [x] |
| B12 | Classes vs. other courses | 1 | [x] |
| C1 | Today / This week / Later | 1 | [x] |
| C2 | Overdue at the top | 1 | [x] |
| C3 | Countdowns | 1 | [x] |
| C4 | Filter and sort by course | 1 | [x] |
| C5 | Type labels | 1 | [x] |
| C6 | Busy-week warning | 1 | [–] removed |
| C7 | Quarter timeline | 4 | [x] |
| C8 | Links straight to Canvas | 1 | [x] |
| C9 | Full assignment page | 1 | [x] |
| C10 | Pin items | 1 | [x] |
| C11 | Hide or snooze items | 1 | [x] |
| C12 | Search assignments | 1 | [x] |
| C13 | Add to Home | 1 | [x] |
| C14 | Event wording | 1 | [x] |
| C15 | Office hours kept separate | 1 | [x] |
| C16 | Exam countdown | 6 | [x] |
| D1 | Submission status | 1 | [x] |
| D2 | Your own checklist | 1 | [x] |
| D3 | Missing and late flags | 1 | [x] |
| D4 | Weekly progress bar | 1 | [x] |
| D5 | Subtasks | 1 | [x] |
| D6 | Notes | 1 | [x] |
| D7 | Submitted, waiting for a grade | 1 | [x] |
| D8 | Completed | 5 | [x] |
| D9 | Daily streak | 5 | [x] |
| E1 | Course grading scale | 2 | [x] |
| E2 | Credits per course | 2 | [x] |
| E3 | Category weights | 2 | [x] |
| E4 | Drop-lowest and extra credit | 2 | [x] |
| E5 | Past quarters | 2 | [x] |
| E6 | Targets | 2 | [x] |
| E7 | Current grade per course | 2 | [x] |
| E8 | Projected quarter GPA | 2 | [x] |
| E9 | Cumulative GPA | 2 | [x] |
| E10 | Gap to goal | 2 | [x] |
| E11 | What you need | 2 | [x] |
| E12 | Best / worst / likely | 2 | [x] |
| E13 | Points still available | 2 | [x] |
| E14 | Highest-impact assignments | 2 | [x] |
| E15 | Risk alert | 2 | [x] |
| E16 | What-if mode | 2 | [x] |
| E17 | Category breakdown | 2 | [x] |
| E18 | Points lost | 2 | [x] |
| E19 | Class statistics | 2 | [x] |
| E20 | Grade trends | 2 | [x] |
| E21 | Missing, late and excused costs | 2 | [x] |
| E22 | Pending grades | 2 | [x] |
| E23 | Regrade checklist | 2 | [x] |
| E24 | Recently graded feed | 2 | [x] |
| E25 | Rubric scores | 2 | [x] |
| E26 | GPA by quarter | 2 | [x] |
| E27 | Credits completed | 2 | [x] |
| E28 | Strongest and weakest subjects | 2 | [x] |
| E29 | Custom grade total | 2 | [x] |
| E30 | Grades that aren't on Canvas | 2 | [x] |
| E31 | Statistics-class grading formula | 2 | [x] |
| E32 | Use Canvas's grade when it's reliable | 2 | [x] |
| E33 | Automatic grading setup | 2 | [x] |
| F1 | Course home page | 3 | [x] |
| F2 | Unified announcements | 3 | [x] |
| F3 | Modules | 3 | [x] |
| F4 | Course pages | 3 | [x] |
| F5 | Files | 3 | [x] |
| F6 | Syllabus | 3 | [x] |
| F7 | Discussions | 3 | [x] |
| F8 | Inbox | 3 | [x] |
| F9 | Quick links | 3 | [x] |
| F10 | Instructors, TAs and office hours | 3 | [x] |
| F11 | Study groups | 3 | [x] |
| F12 | Search everything | 3 | [x] |
| F13 | Submit from the dashboard | 5 | [~] |
| F14 | Reply to discussions | 5 | [~] |
| F15 | Quizzes and exams link out | 1 | [x] |
| G1 | Weekly calendar | 4 | [x] |
| G2 | Monthly calendar | 4 | [x] |
| G3 | Time estimates | 4 | [x] |
| G4 | Daily workload | 4 | [x] |
| G5 | Suggested work order | 4 | [x] |
| G6 | Plan blocks | 4 | [x] |
| G7 | Focus timer | 4 | [~] |
| G8 | Calendar export | 4 | [x] |
| G9 | Day view | 4 | [x] |
| G10 | Dates from your syllabi | 4 | [x] |
| G11 | Class meetings and weekly topics | 4 | [~] |
| H1 | Deadline reminders | 4 | [~] |
| H2 | Icon badge | 4 | [~] |
| H3 | Morning summary | 4 | [~] |
| H4 | New assignment alerts | 4 | [~] |
| H5 | New announcement alerts | 4 | [~] |
| H6 | New grade alerts | 4 | [~] |
| H7 | GPA risk alerts | 4 | [~] |
| I1 | Past quarter archive | 5 | [x] |
| I2 | Pin, notes and hide everywhere | 5 | [x] |
| J1 | Soft pink theme | 6 | [x] |
| J2 | Rounded headings | 6 | [x] |
| J3 | Mochi's daily greeting | 6 | [x] |
| J4 | Ask Mochi: built-in answers | 6 | [x] |
| J5 | Ask Mochi: on-device AI | 6 | [~] |
| J6 | Celebrations | 6 | [x] |
| J7 | Mochi in empty states | 6 | [x] |
| K1 | Choose your school | 7 | [~] |
| K2 | Your time zone | 7 | [x] |
| K3 | Grading scale presets | 7 | [x] |
| K4 | Semesters and quarters | 7 | [x] |
| K5 | Syllabus import | 7 | [~] |
| K6 | Review imported dates | 7 | [x] |
| K7 | Class meeting editor | 7 | [x] |
| K8 | Your syllabi become your data | 7 | [~] |
| K9 | First-run setup | 7 | [x] |
| K10 | Other schools' Canvas setups | 7 | [~] |
| K11 | Name and wording | 7 | [x] |
| K12 | About and disclaimers | 7 | [~] |
| K13 | Report a problem | 7 | [~] |
| K14 | Chrome Web Store package | 7 | [~] |
| K15 | Read-only public build | 7 | [x] |
| K16 | Demo mode | 7 | [~] |
| K17 | Landing site | 7 | [~] |
| K18 | Feedback prompt | 7 | [~] |
| K19 | Beta build | 7 | [x] |
| K20 | What's new | 7 | [x] |
| K21 | Git repository | 7 | [x] |
| K22 | "Works with Canvas" wording | 7 | [x] |

**Total: 144 features** (99 original + B11, B12, C13, C14, C15, G9, E29–E33 added 2026-10-01; G10, G11, D8, D9, J1–J7 added 2026-10-06; C16 added 2026-10-07; K1–K14 added and approved 2026-10-20; K15–K22 added 2026-10-20) — Phase 1: 44 · Phase 2: 33 · Phase 3: 12 · Phase 4: 19 · Phase 5: 6 · Phase 6: 8 · Phase 7: 22 · Done: 117 · Partial: 26 (16 waiting on your Chrome check; 10 in Phase 7 waiting on your Chrome check, your choices or volunteers) · Removed at your request: 1 (C6) · Not started: 0
