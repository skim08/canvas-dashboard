# How Neko was built

Neko was built with [Claude Code](https://claude.com/claude-code) as an AI pair programmer. I set the direction, wrote and approved the requirements, made the product and design decisions, and tested it with my real Canvas account. Claude wrote the code and the tests, working from a written spec and a short set of rules. It went from idea to a published Chrome Web Store extension in about a month.

## By the numbers

| | |
|---|---|
| Features in the spec | 144, each with acceptance criteria |
| Build phases | 7, each approved before the next started |
| Automated tests | 325 browser tests plus build checks |
| Code | about 13,500 lines of plain JavaScript, no dependencies |
| Network hosts contacted | 1: the Canvas site the user picks |

## The process

**1. Spec first.** [`SPEC.md`](SPEC.md) is the source of truth. Every feature has an ID (like `E30`), a plain-language description, "Done when" acceptance criteria, a phase and a status. New ideas get new IDs at the end of their section. Nothing is removed or renumbered without my OK, so the history of decisions stays readable.

**2. Rules for the AI.** [`CLAUDE.md`](CLAUDE.md) holds the rules Claude follows in every session:

- Read the spec first.
- Build one phase at a time.
- Keep all data local.
- Test every acceptance criterion.
- Check light and dark mode.
- End each phase with a report that lists every feature ID as done, partial or deferred.

The rules turned "build me a dashboard" into a sequence of small, checkable steps.

**3. Phases with a sign-off.** Each phase ended with a status table. I reviewed it, tried the features with my own classes, and asked for changes before approving the next phase.

| Phase | What it covered |
|---|---|
| 1 | Core: due dates, design system, dark mode |
| 2 | Grades and GPA |
| 3 | Course content |
| 4 | Planning and notifications |
| 5 | Extras |
| 6 | Look and feel: theme, mascot |
| 7 | Making it work for any student, and publishing |

**4. Tests the AI can't fake.** Grade and GPA math is tested against values I worked out by hand. Examples: a weighted course with a dropped quiz, a class graded out of 600 points, and a 3-class GPA of 3.12. Tools check the rest:

- **Design:** only design tokens are allowed, and every color pair must pass WCAG AA contrast.
- **Privacy:** no code may contact any host except the chosen Canvas site.
- **Published zip:** it's read-only and contains nothing personal.

**5. Real-world feedback.** I used it daily with my own classes and reported what was wrong or confusing, often with screenshots. Each report became a fix, a new acceptance criterion, or a new feature ID. For example:

- quizzes you take online shouldn't be labeled like in-class exams
- the busy-week shading was confusing, so it was removed
- details should open in a large window, not a narrow side panel

## Decisions I made, and why

- **Everything stays on the computer.** No server, no account, no analytics. Grades are private, and the simplest way to protect them is to never collect them.
- **Read-only public version.** My own copy can submit assignments and post replies. The published version only reads. That way it asks Chrome for fewer permissions, and a bug can never change anything on a student's Canvas.
- **Works at any school.** It started hard-wired to UW. Phase 7 added choosing your school, letter or decimal grades, semesters or quarters, and syllabus import, so the code no longer assumes my classes.
- **Demo mode.** Chrome Web Store reviewers (and anyone curious) can't log in to my Canvas, so a made-up student shows every feature with no network access.
- **A friendly face.** Neko, a cat drawn in code, greets you with a summary of your day and answers questions about your schedule.

## Problems worth mentioning

- **Personal data in sample data.** Before publishing, a build check caught that the sample data still contained my real classes and real instructors' names. They were moved to a private folder that's never committed or published. The tests now run on a renamed copy, so every rule stays tested in this repository.
- **A privacy rule with a gap.** The read-only guard first sat only on the real network path, so the sample-data connection could skip it. A test that flips the app into "public build" mode caught it, and the guard now sits on every request.
- **Syllabi without libraries.** Chrome extensions can't load remote code, so PDF and Word syllabi are read with the browser's built-in decompressor and a small hand-written parser. Every date found is shown with the line it came from, so the student can check it before it's saved.
- **Course codes outside UW.** Testing a made-up semester school showed that 4-digit course numbers (like BIO 1510) weren't recognized as classes. The detector was widened before launch.

## What I learned

- An AI pair programmer is fast, but a clear spec, small phases and tests with known answers are what make the result trustworthy.
- Writing acceptance criteria forced me to decide what "done" means before any code existed.
- Privacy has to be checked by tools, not remembered.
