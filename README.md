# Neko

A clean, private dashboard that works with Canvas. It's a Chrome extension that replaces the new-tab page with one calm view of everything due, your grades and GPA, a real calendar and your syllabus dates. It reads Canvas with the login you already have and keeps everything on your computer: no account, no server, no analytics.

**Install:** [Chrome Web Store](https://chromewebstore.google.com/detail/neko/ibclpkpjchlbpmfackdopopoghoecaeo) · **Website:** [skim08.github.io/canvas-dashboard](https://skim08.github.io/canvas-dashboard/) · **How it was built with AI:** [BUILDING.md](BUILDING.md)

*Not affiliated with Instructure (the makers of Canvas) or any school.*

![Home: what's due, your grades and upcoming exams, with Neko's daily summary](docs/img/1-home.jpg)

| Calendar | Grades |
|---|---|
| ![Week calendar in dark mode, with class times and your own events](docs/img/2-calendar.jpg) | ![Grades and projected GPA, with what you need on what's left](docs/img/3-grades.jpg) |

| Inbox | Themes |
|---|---|
| ![Inbox: read and reply to Canvas messages](docs/img/4-inbox.jpg) | ![Themes: five animal mascots, each with its own colors](docs/img/5-themes.jpg) |

*Screenshots show demo mode: a made-up student, no real data. They're regenerated for every release by `tools/make_screenshots.py` (the zip won't build if they're out of date), so they always match the current version.*

## What it does

- **Due soon:** overdue work, today and the week ahead across every class, with checklists, notes, pins and snooze.
- **Grades and GPA:** the course grade math Canvas uses (weights, dropped scores, extra credit), plus syllabus rules Canvas can't express. Letter or 4.0-decimal grading, what you need on what's left, what-if scores, trends and history.
- **Calendar:** day, week (hour blocks like Apple Calendar), month, term timeline and list views, with class meetings and exams.
- **Syllabus import:** reads PDF and Word syllabi on your computer with no libraries, finds exams, deadlines, class times and days off, and lets you review each one before it's saved.
- **Course content:** announcements, modules, pages, files, discussions and your Canvas groups, without leaving the dashboard.
- **Inbox:** read, star, archive and send Canvas messages to your instructors, TAs and classmates.
- **Neko and friends:** a cat mascot (or a frog, shark, polar bear or shiba, with matching color themes) who answers schedule questions from your own data, optionally using Chrome's on-device AI.
- **Your own events:** add pre-class readings, study sessions or anything Canvas doesn't list, including weekly repeats.
- **Works at any school:** you pick your school's Canvas during setup. Quarters or semesters, letter or decimal grades.
- **Demo mode:** try everything with a made-up student, no Canvas account needed.

## How it's built

- **Plain JavaScript modules, no build step and no dependencies.** A tiny DOM helper, whole-app rendering and Chrome Manifest V3.
- **Private by design:**
  - Talks only to the one Canvas site you choose, checked on every request.
  - The public build only reads from Canvas, except for messages you choose to send or manage, and asks Chrome for the minimum permissions.
  - A strict content security policy, and Canvas HTML is sanitized before it's shown.
- **Tested:**
  - 354 browser tests, including hand-calculated grade and GPA math.
  - Build tests that check the published zip.
  - Design checks: design tokens only, and WCAG AA contrast in every theme.
- **Spec-driven:** [`SPEC.md`](SPEC.md) lists every feature with acceptance criteria and status. [`CLAUDE.md`](CLAUDE.md) holds the working rules.
- Built with [Claude Code](https://claude.com/claude-code) as an AI pair programmer, from a written spec with acceptance criteria and automated tests. The process, decisions and lessons are in [BUILDING.md](BUILDING.md).

## Try it

**Load it in Chrome:**

1. Download this repository.
2. Open `chrome://extensions`, turn on **Developer mode** and click **Load unpacked**.
3. Choose this folder.
4. Open a new tab, then pick your school or choose **Try it with sample data**.

**Test mode (no Chrome extension needed):**

1. Run `python3 tools/devserver.py 5319 .`
2. Open `http://localhost:5319/src/newtab.html`.

It uses sample data. Add `?scenario=setup`, `otherschool`, `expired`, `offline` or `empty` to the address to try those cases.

## Checks and builds

| Command | What it does |
|---|---|
| Open `http://localhost:5319/src/tests/index.html` | Runs the browser tests |
| `python3 tools/check_extension.py` | Checks the manifest, that imports resolve, and that no outside hosts are contacted |
| `python3 tools/lint_css.py` | Checks that only design tokens are used |
| `python3 tools/contrast.py` | Checks WCAG AA contrast |
| `python3 tools/test_builds.py` | Checks the owner, public and beta builds |
| `python3 tools/make_screenshots.py` | Retakes every screenshot (store, website and this README) from the current code, in demo mode |
| `python3 tools/make_icons.py` | Redraws the extension icon at every size |
| `python3 tools/build_zip.py` | Builds the public Chrome Web Store zip (read-only except Canvas messages) (`--beta` for a beta zip plus install steps) |

## Project layout

| Path | What's there |
|---|---|
| `src/lib/` | Canvas client, sync, grade engine, syllabus import, models (no DOM) |
| `src/ui/` | Screens and components |
| `src/tests/` | Browser tests and sample data |
| `docs/` | Landing site on GitHub Pages, with the privacy policy and terms |
| `store/` | Chrome Web Store listing notes |
| `tools/` | Checks, build and dev server |

## Privacy

Everything stays in Chrome on your computer. The extension never sees your password, has no server and sends nothing to the developer or anyone else. See the [privacy policy](https://skim08.github.io/canvas-dashboard/privacy.html).
