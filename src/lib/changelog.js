// K20: what changed in each version, newest first. Settings shows the newest entry once
// after an update. Keep this in step with CHANGELOG.md and manifest.json (a test checks).

export const CHANGES = [
  {
    version: '0.3.0',
    date: '2026-11-05',
    items: [
      'Themes tab (palette icon, top right): pick Neko the cat, Kero the frog, Nami the shark, Yumi the polar bear or Hachi the shiba, each with its own colors.',
      'Our cat mascot is now called Neko.',
      'Your own events: click + Event on the Calendar (or an empty time slot) for pre-class readings, study sessions and more. They can repeat weekly.',
      'Adding syllabi is now front and center: Home, the Calendar and Settings show which classes still need their class times.',
      'No class times in your syllabus? Type them in (Lecture, Quiz section, Lab…) and they show as blocks every week.',
      'Fixed a background error that could appear on chrome://extensions after reloading.',
      'Long details in compact lists now shorten neatly instead of overlapping.',
      'The search bar is gone from the top bar, for a cleaner look.',
      'Make Neko yours: six quick, skippable questions (study buddy, your name, GPA goal, workload, reminders, look) in setup and in Settings.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-20',
    items: [
      'Works with any school’s Canvas: choose yours in setup (Settings → General → School).',
      'Letter grades (A, A−, B+…) or a 4.0 decimal scale, and semesters as well as quarters.',
      'Import a syllabus (PDF, Word or text) on a class page → Syllabus dates. You check every date before it’s saved.',
      'Try it with sample data: a demo mode with a made-up student.',
      'Settings → About: disclaimers and a way to report problems.',
      'Public build: read-only (no submitting or posting), so it asks Chrome for fewer permissions.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-10-07',
    items: ['First version: due dates, grades and GPA, calendar, course content, reminders and Mochi.'],
  },
];

export const VERSION = CHANGES[0].version;

// Which notes you haven't seen: entries newer than `seen` (a version string).
const num = (v) => String(v || '0').split('.').map((x) => Number(x) || 0);
export function newer(a, b) {
  const [x, y] = [num(a), num(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
export const unseen = (seen) => CHANGES.filter((c) => newer(c.version, seen));
