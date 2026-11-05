# Neko — rules for Claude

(Formerly "Canvas Dashboard"; the name was chosen on 2026-10-20. Neko works with Canvas and isn't affiliated with Instructure.)

A Chrome extension (Manifest V3) that works with any school's Canvas: the student picks their school's Canvas site during setup. It started as a UW-only tool (`canvas.uw.edu`); Phase 7 made it work for any student, and the public, read-only build is published on the Chrome Web Store. **`SPEC.md` is the source of truth** for every feature, its acceptance criteria, its phase and its status.

## Every session

1. **Read `SPEC.md` first**, before starting any phase or doing any work in a new session. Re-read the section for the phase you're working on before writing code for it.
2. Check the coverage table to see what's done, partial, deferred or not started.
3. Check **`GPA-CHECKLIST.md`**: open items for Phase 2 that the owner chose to come back to later. Phase 2 isn't confirmed until those are resolved.

## Building

4. **Build one phase at a time.** Don't start the next phase until the owner has approved the current one.
5. Only work on features in the current phase. If something from a later phase is needed early, ask first.
6. Follow the **Design principles** in `SPEC.md` on every screen. A clean, uncluttered UI is the whole point of the project.
7. All data stays local. Never add requests to any host other than **the one school Canvas address the user chose during setup** (K1, approved by the owner on 2026-10-20; access is granted at runtime for that site only), analytics or remote code. One exception, approved by the owner on 2026-10-06: submission file uploads (F13) may go to Instructure's file storage (`inst-fs-*.inscloudgate.net`), with no cookies or token. Don't widen either.
8. Every piece of data the owner enters (settings, notes, scales, plans, etc.) must be included in backup and restore (A10).
9. Every optional feature must register a toggle under Settings → Features (B7) and any shortcuts in the `?` list (B9).

## Testing

10. **Test every feature in the phase against each of its acceptance criteria** before calling it done, using realistic sample Canvas data in the browser. Grade and GPA math (section E) must also have automated tests with hand-calculated expected values.
11. Check both light and dark mode, and both compact and comfortable views.
12. The owner tests with real Canvas data; Claude can't log into their Canvas.

## Reporting

13. **At the end of each phase, give a report listing every ID in that phase** with one status: **done**, **partial** (what's missing), or **deferred** (with a reason). No ID may be left out of the report. Include the count of IDs reported and the count expected for the phase.
14. **Update `SPEC.md` as things are finished:** the status line under each feature and the coverage table, including the totals line.

## Changing the spec

15. **Never remove a feature from the spec without asking the owner first.** Never merge, rename or renumber IDs.
16. Suggestions go in a **Suggestion:** note under the feature. They only become part of the spec once the owner approves them.
17. New features the owner asks for get new IDs at the end of their section (like C13) and are added to the coverage table.
