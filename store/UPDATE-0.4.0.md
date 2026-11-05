# Publishing Neko 0.4.0

Everything for the Chrome Web Store update, in the order of the tabs in the developer dashboard (chrome.google.com/webstore/devconsole → Neko). Copy the text in the grey boxes as it is.

## Before you upload

1. Reload the unpacked extension in `chrome://extensions` and try it once with your real Canvas: open a message, star and archive it, send yourself one, and check the Grades tab.
2. Make sure `dist/neko-0.4.0.zip` exists. If you changed anything since, rebuild it:
   `/usr/bin/python3 tools/build_zip.py`

## How an update works

- You don't create a new item. You upload a new package to the **same** Neko item, and the version number must be higher than the live one (0.4.0 is).
- Users keep all their data. Chrome updates installed copies on its own within a few hours to a day after the update is approved.
- **New permission:** this version asks for `cookies` again, so messages can be sent. If Chrome treats that as a new permission warning, it pauses the extension for existing users until they click to accept it. Otherwise it updates quietly. Either way, tell friends who already use it to look out for a prompt.
- Review usually takes a few days. A new permission can mean a closer review.

## Steps

1. **Publish the new privacy policy first.** The website is published from `main`, and the reviewer will read the policy. In GitHub Desktop: push `after-launch`, then Branch → Merge into current branch (with `main` checked out, merge `after-launch`), then Push. Wait a minute and check that https://skim08.github.io/canvas-dashboard/privacy.html says "Last updated: November 5, 2026".
2. **Package** tab → **Upload new package** → choose `dist/neko-0.4.0.zip`.
3. Update **Store listing**, **Privacy** and **Test instructions** with the text below. Check **Distribution** (nothing changes).
4. Click **Submit for review**. If it asks whether to publish automatically after approval, choose yes unless you want to press Publish yourself.

---

## Store listing tab

**Description** (replace the whole box):

```
Neko is a calm, private dashboard for your Canvas classes. It opens in every new tab and shows what's due, how your grades are doing and what's coming up this week, all in one clean place. It works with any school's Canvas, using the login you already have.

WHAT'S DUE
• Everything due across your classes in one list: overdue, today and the week ahead
• Countdowns ("due in 3h"), checkboxes, your own to-dos, pins and subtasks
• Reminders before deadlines and a morning summary, if you want them

GRADES AND GPA
• Your grade in every class, with letter grades or a 4.0 scale
• Your projected GPA and what you need on the rest of the term to hit your goal
• What-if mode: try scores and watch your grade and GPA change
• Classes that post assignments late aren't counted as failing

CALENDAR
• Day, week, month and term views
• Your class times, exams and syllabus deadlines as blocks on the calendar
• Add your own events: readings, study sessions and anything Canvas doesn't list

INBOX AND GROUPS (new)
• Read your Canvas messages in their own tab, with Unread, Starred, Sent and Archived views
• Message your instructors, TAs and classmates, and reply, without opening Canvas
• Your Canvas groups (project teams, study groups) each get their own page

SYLLABUS IMPORT
• Add a syllabus as a PDF, Word file or pasted text. Neko finds exams, deadlines and class times, and you check everything before it's saved
• No syllabus? Type the details in yourself

MAKE IT YOURS
• Five animal themes, each with its own mascot: Neko the cat, Kero the frog, Nami the shark, Yumi the polar bear and Hachi the shiba
• Light and dark mode, roomy or compact lists, and a quick setup that asks about your goals
• Ask your mascot questions like "what's due tomorrow?"; answers are worked out on your computer

PRIVATE BY DESIGN
• No account, no ads, no tracking and no analytics
• Your data stays on your computer. The only site Neko talks to is your own school's Canvas
• Neko only changes things in Canvas when you ask it to send or manage a message

Try it first with sample data: on the first screen, choose "Try it with sample data". No Canvas account needed.

Neko works with Canvas. It isn't affiliated with, endorsed by or sponsored by Instructure or any school. Grades and GPA are estimates; always check Canvas and your school's records.
```

**Category:** Education (same as before). **Language:** English.

**Graphic assets:**

| Field | File |
|---|---|
| Store icon (128×128) | `src/icons/icon128.png` (the new cat icon) |
| Screenshots (1280×800), in this order | `store/screenshots/0.4.0/1-home.png`, `2-calendar.png`, `3-grades.png`, `4-inbox.png`, `5-themes.png` |
| Small promo tile (440×280) | `store/promo-tile-440x280.png` |

Delete the old screenshots in the dashboard first (the trash icon on each), then add the five new ones. All were taken in demo mode, with the made-up student, so nothing in them is real.

---

## Privacy tab

**Single purpose:**

```
Neko shows a Canvas student's own courses, deadlines, grades, calendar and messages in one dashboard on their new tab page, using their existing Canvas login, and lets them reply to and send Canvas messages from it.
```

**Permission justifications** (one box per permission):

| Permission | Paste this |
|---|---|
| `storage` | `Saves the student's settings, notes, to-dos, events and a copy of their Canvas data on their own computer, so the dashboard opens instantly and works offline.` |
| `unlimitedStorage` | `A full term of courses, assignments, grades and syllabi can be larger than Chrome's default 10 MB local storage limit. Everything stays on the student's computer.` |
| `alarms` | `Refreshes the student's Canvas data in the background and checks every few minutes whether a deadline reminder is due.` |
| `notifications` | `Deadline reminders, a morning summary, and alerts for new grades and announcements. Each can be turned off in Settings.` |
| `cookies` | `Used only to read Canvas's security (CSRF) token cookie on the student's own school Canvas site, which Canvas requires before it accepts a message the student chooses to send, reply to, star, archive or mark read or unread. No other cookie is read, and the token is never stored or sent anywhere else.` |
| Host permission (optional, `https://*/*`) | `Requested at runtime for one site only: the Canvas address the student types in during setup (each school has its own Canvas domain, so it can't be listed in advance). Neko reads the student's courses from that site with their existing login. It never contacts any other site.` |

**Are you using remote code?** No.

```
No. All code is included in the package. The content security policy is script-src 'self'.
```

**Data usage**: tick these three:

- **Personally identifiable information**: the student's name, from Canvas.
- **Personal communications**: their Canvas inbox messages, which Neko shows and can send.
- **Website content**: courses, assignments, grades and announcements from Canvas.

Leave the rest unticked (health, financial, authentication, location, web history and user activity). Then tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** `https://skim08.github.io/canvas-dashboard/privacy.html` (unchanged). The page's text is updated for messages; it goes live with step 1 above.

---

## Distribution tab

No changes: free, **Public**, all regions.

---

## Test instructions tab

```
You don't need a Canvas account. Open a new tab (the extension replaces the new-tab page) and click "Try it with sample data" on the first screen. Demo mode loads a made-up student and makes no network requests. A "Demo — sample data" banner stays at the bottom.

To see every feature:
- Home: due soon, grades at a glance, the exam countdown, and the mascot's daily summary (try asking "what's due tomorrow?").
- Inbox (top tab, new in this version): open a message, reply, star or archive it. Click "New message", pick CSE 143 and "CSE 143 instructors", and send. In demo mode nothing is sent anywhere; the message just appears under Sent.
- Courses → Your groups → PA Team 4 (new): a Canvas group's announcements, discussions, pages, files and members.
- Calendar: Day, Week (class times and topics), Month, Quarter and List. Click "New event" or an empty time slot to add your own event.
- Courses → CSE 143: Modules, Pages, Files, Discussions, Syllabus and People tabs, and the "Syllabus dates" button (paste any syllabus text to see the review screen).
- Grades: class details, What-if mode, Trends and History.
- Themes (palette icon, top right): five animal themes, each with its own mascot.
- Settings: light or dark, density, features, backup, and "Make Neko yours".

Click any item to open its details. Press ? for keyboard shortcuts. "Exit demo" in the banner (or Settings → General) deletes the sample data.

About the cookies permission: with a real school, the extension asks for access to that one Canvas site. The only changes it makes there are Canvas messages the student chooses to send, reply to, star, archive or mark read or unread; the cookies permission is used solely to read Canvas's CSRF token for those requests.
```

---

## After it's live

- Check the listing page shows the new icon and screenshots.
- Update the extension in your own Chrome from the store (or keep using your unpacked owner copy, which has every feature).
