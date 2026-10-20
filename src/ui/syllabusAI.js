// K5: Chrome's on-device AI (when this computer has it) reads the syllabus too, and
// adds what the patterns missed. It runs inside Chrome; nothing is sent anywhere.
// Everything it finds still goes to the review screen (K6).

import { aiStatus } from './localAI.js';

const LANGS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };

export async function aiReady() {
  return (await aiStatus()) === 'available';
}

const SCHEMA = {
  type: 'object',
  properties: {
    exams: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, room: { type: 'string' } }, required: ['title', 'date'] } },
    deadlines: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' } }, required: ['title', 'date'] } },
    daysOff: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, reason: { type: 'string' } }, required: ['date'] } },
  },
  required: ['exams', 'deadlines', 'daysOff'],
};

const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isTime = (s) => /^\d{2}:\d{2}$/.test(s || '');
const same = (a, b) => a.day === b.day && a.title.toLowerCase().replace(/\W/g, '') === b.title.toLowerCase().replace(/\W/g, '');

export async function aiExtract(text, ctx, found) {
  const session = await globalThis.LanguageModel.create({
    ...LANGS,
    initialPrompts: [{ role: 'system', content: 'You read college syllabi and list exams, quizzes, assignment deadlines and days with no class. Use YYYY-MM-DD dates and 24-hour HH:MM times. Only list what the text says; never guess.' }],
  });
  try {
    const year = (ctx.termStart || ctx.today).slice(0, 4);
    const reply = await session.prompt(`The term starts ${ctx.termStart || 'around now'} (year ${year}).\n\nSyllabus:\n${text.slice(0, 12000)}`, { responseConstraint: SCHEMA });
    const ai = JSON.parse(reply);
    const out = structuredClone(found);
    const note = 'Found by Chrome’s on-device AI';
    for (const e of ai.exams || []) {
      const item = { id: `ai-${Math.random().toString(36).slice(2, 8)}`, title: String(e.title || '').trim(), type: /quiz/i.test(e.title) ? 'quiz' : 'exam', day: e.date, start: isTime(e.start) ? e.start : null, end: isTime(e.end) ? e.end : null, where: e.room || null, inClass: false, line: note };
      if (item.title && isDay(item.day) && !out.exams.some((x) => same(x, item))) out.exams.push(item);
    }
    for (const d of ai.deadlines || []) {
      const item = { id: `ai-${Math.random().toString(36).slice(2, 8)}`, title: String(d.title || '').trim(), day: d.date, time: isTime(d.time) ? d.time : null, line: note };
      if (item.title && isDay(item.day) && !out.deadlines.some((x) => same(x, item))) out.deadlines.push(item);
    }
    for (const n of ai.daysOff || []) {
      if (isDay(n.date) && !out.noClass.some((x) => x.day === n.date)) out.noClass.push({ day: n.date, title: n.reason ? `No class · ${n.reason}` : 'No class', line: note });
    }
    for (const list of Object.values(out)) list.sort((a, b) => (a.day || '').localeCompare(b.day || ''));
    return out;
  } finally {
    session.destroy?.();
  }
}
