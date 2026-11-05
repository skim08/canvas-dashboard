// G10: exams, quizzes and deadlines from your syllabi. G11: lectures and quiz sections
// with what each one covers. Built in (profiles.js); nothing to type in.
//
// No duplicates: a Canvas item on the same day replaces the syllabus one, an undated
// Canvas exam or quiz gets the syllabus date, and a syllabus deadline is skipped when
// Canvas already has something due that day. If Canvas dates an exam on another day,
// the syllabus exam stays and its details point out the difference.
//
// When a syllabus gives a date but no time (some don't list meeting times),
// the item is all-day: `allDay` is true and `dueAt` is 11:59 PM that day, so it stays
// "upcoming" until the day is over.

import { findProfile } from './profiles.js';
import { addDays, dayKey, instantAt, weekdayOfKey, formatDate, DEFAULT_TZ } from './time.js';

const hm = (t) => t.split(':').map(Number);
const at = (key, t, tz) => instantAt(key, ...hm(t), tz);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const para = (...lines) => lines.filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join('');

export const mondayOf = (key) => addDays(key, -((new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7));

// "BIO 180 AF" or "BIO 180 A AF Au 26" → "AF", if it's one of the syllabus's sections.
export function quizSectionOf(course, sections) {
  const codes = new Set(Object.keys(sections || {}));
  for (const name of course.sections || []) {
    const hit = String(name).toUpperCase().split(/[^A-Z0-9]+/).find((t) => codes.has(t));
    if (hit) return hit;
  }
  return null;
}

export function weekTopics(schedule, key) {
  return (schedule.weeks || []).find((w) => w.start === mondayOf(key)) || null;
}

const topicLine = (w) => w.topics.map(([name, read]) => `${name} (${read})`).join('; ');

// A class's meeting details for you: its own fields plus your section's (time, room, TA).
function slotOf(course, c) {
  if (!c.sections) return { ...c, code: null };
  const code = quizSectionOf(course, c.sections);
  return { ...c, ...(code ? c.sections[code] || {} : {}), code };
}

// Start/end on a day, or all-day when the time isn't known.
function when(key, start, end, tz) {
  if (!start) return { dueAt: at(key, '23:59', tz), endAt: null, allDay: true, day: key };
  return { dueAt: at(key, start, tz), endAt: end ? at(key, end, tz) : null, allDay: false, day: key };
}

function base(course, profile, extra) {
  return {
    source: 'syllabus',
    syllabusOf: profile.source,
    courseId: course.id,
    url: null,
    sub: null,
    points: null,
    expectsSubmission: false,
    submissionTypes: [],
    rubric: [],
    groupName: null,
    endAt: null,
    location: null,
    descriptionHtml: '',
    ...extra,
  };
}

// G13: classTimes are the class times you typed in (userdata.classTimes), for classes
// whose syllabus doesn't list them. They're added to the syllabus's own meetings.
export function syllabusSchedule(courses, canvasItems, { tz = DEFAULT_TZ, dates = true, classes = true, classTimes = {} } = {}) {
  const add = [];
  const patch = {};
  for (const course of courses) {
    const found = findProfile(course);
    const typed = (classTimes?.[course.id] || []).filter((x) => x.days?.length && x.start && x.from && x.until).map((x) => ({ ...x, id: `ct-${x.id}` }));
    if (!found?.schedule && !typed.length) continue;
    const profile = found?.schedule ? found : { source: 'your class times', schedule: {} };
    const s = typed.length ? { ...profile.schedule, classes: [...(profile.schedule.classes || []), ...typed] } : profile.schedule;
    const mine = canvasItems.filter((i) => i.courseId === course.id && i.source === 'canvas');
    const slots = Object.fromEntries((s.classes || []).map((c) => [c.id, slotOf(course, c)]));

    if (dates) {
      for (const e of s.exams || []) {
        const slot = e.in ? slots[e.in] : null;
        const t = when(e.day, e.start || slot?.start, e.end || (e.start ? null : slot?.end), tz);
        // Held in a class meeting: same time and room as that meeting (the room may be unknown).
        const where = e.where || (e.in ? slot?.where || `Your ${slot.name.toLowerCase()} room` : null) || null;
        const hits = e.match ? mine.filter((i) => e.match.test(i.title || '')) : [];
        if (hits.some((i) => i.dueAt && dayKey(i.dueAt, tz) === e.day)) continue; // Canvas agrees: no duplicate.
        if (hits.some((i) => ['graded', 'submitted', 'excused'].includes(i.sub?.state))) continue; // already taken
        const elsewhere = hits.find((i) => i.dueAt);
        if (hits.length && !elsewhere) {
          for (const i of hits) patch[i.id] = { ...t, location: i.location || where, dateFrom: 'syllabus', syllabusOf: profile.source };
          continue;
        }
        // Canvas shows another day: keep the syllabus date and say so, rather than guess which is right.
        const clash = elsewhere ? `Canvas lists “${elsewhere.title}” on ${formatDate(elsewhere.dueAt, tz)}. Your syllabus says ${formatDate(t.dueAt, tz)}; check with your instructor if unsure.` : null;
        const meetingName = e.in ? (slot.code ? `${slot.name.toLowerCase()} (${slot.code})` : slot.name.toLowerCase()) : null;
        const timeNote = e.in ? (t.allDay ? `During your ${meetingName}. The syllabus doesn’t list the time.` : `Given during your ${meetingName}: same time and room as usual.`) : null;
        add.push(
          base(course, profile, {
            id: `syl:${course.id}:${e.id}`,
            kind: 'event',
            syllabusType: e.type || 'exam',
            title: e.title,
            ...t,
            location: where,
            canvasDate: elsewhere?.dueAt || null,
            descriptionHtml: para(clash, timeNote, e.note),
          })
        );
      }
      for (const d of s.deadlines || []) {
        if (mine.some((i) => i.dueAt && dayKey(i.dueAt, tz) === d.day)) continue; // Canvas lists that day's work.
        add.push(
          base(course, profile, {
            id: `syl:${course.id}:${d.id}`,
            kind: 'note',
            syllabusType: 'assignment', // a deadline, even when its name mentions quizzes
            title: `${d.title}${s.deadlineSuffix || ''}`,
            dueAt: at(d.day, d.time || s.deadlineTime || '23:59', tz),
            descriptionHtml: para(s.deadlineWhat && `Due: ${s.deadlineWhat}.`, s.deadlineNote, d.note),
          })
        );
      }
    }

    if (classes) {
      const canvasEvents = mine.filter((i) => i.kind === 'event' && i.dueAt);
      const clashes = (start) => canvasEvents.some((i) => Math.abs(new Date(i.dueAt).getTime() - new Date(start).getTime()) < 30 * 60000);
      const meeting = (c, slot, key, { title, cancelled = false, keep = false, notes = [] }) => {
        const t = when(key, slot.start, slot.end, tz);
        if (!t.allDay && clashes(t.dueAt)) return;
        add.push(
          base(course, profile, {
            id: `syl:${course.id}:${c.id}:${key}`,
            kind: 'event',
            classMeeting: true,
            meeting: c.name, // "Lecture" | "Quiz section" (J4 answers by kind, even for cancelled days)
            cancelled,
            title,
            ...t,
            location: cancelled || keep ? null : slot.where || null,
            descriptionHtml: cancelled ? '' : para(...notes, slot.staff && `With ${slot.staff}.`, c.note),
          })
        );
      };

      // Weekly classes: same days every week, topics by week (or by day, K5).
      for (const c of (s.classes || []).filter((x) => x.days)) {
        const slot = slots[c.id];
        if (c.sections && !slot.code) continue; // Your section isn't known, so its time isn't either.
        if (!slot.from || !slot.until || !slot.start) continue; // K7: not enough to place it yet
        for (let key = slot.from; key <= slot.until; key = addDays(key, 1)) {
          if (!slot.days.includes(weekdayOfKey(key))) continue;
          if ((s.exams || []).some((e) => e.day === key && e.replaces === c.id)) continue; // the exam is in that slot
          const off = (s.noClass || []).find((n) => n.day === key && (!n.only || n.only.includes(c.id)));
          const week = weekTopics(s, key);
          const name = slot.code ? `${c.name} ${slot.code}` : c.name;
          // K5: a topic for this very day (from an imported schedule) beats the week's list.
          const dayTopic = (s.topics || []).find((t) => t.day === key && (!t.in || t.in === c.id));
          const topics = dayTopic ? dayTopic.text : week ? week.topics.map(([t]) => t).join(' + ') : null;
          const title = off ? (off.keep && topics ? `${off.title} · ${topics}` : off.title) : topics ? `${name} · ${topics}` : name;
          meeting(c, slot, key, {
            title,
            cancelled: !!off && !off.keep,
            keep: !!off?.keep,
            notes: [off?.note, week && `${week.label}: ${topicLine(week)}.`, week && s.textbook && `Textbook: ${s.textbook}.`],
          });
        }
      }

      // Dated sessions: each meeting listed with its own topic.
      for (const m of s.sessions || []) {
        const c = (s.classes || []).find((x) => x.id === m.in);
        const slot = slots[m.in];
        const name = slot.code ? `${c.name} ${slot.code}` : c.name;
        meeting(c, slot, m.day, {
          title: m.off ? m.topic : m.keep ? m.topic : `${name} · ${m.topic}`,
          cancelled: !!m.off,
          keep: !!m.keep,
          notes: [m.note, !slot.start ? 'The syllabus doesn’t list the time.' : null],
        });
      }
    }
  }
  return { add, patch };
}
