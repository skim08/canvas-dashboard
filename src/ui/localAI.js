// J5: Chrome's built-in, on-device AI (Gemini Nano, via the Prompt API).
// Runs entirely inside Chrome on this Mac: the extension sends nothing anywhere.
// Chrome downloads the model once, by itself, the first time it's used.

import { systemPrompt } from '../lib/scheduleContext.js';
import { mascot } from './mochi.js';

const LANGS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
const api = () => globalThis.LanguageModel || null;

// 'unsupported' (this Chrome has no Prompt API) | 'unavailable' (this Mac can't run it)
// | 'downloadable' | 'downloading' | 'available'
export async function aiStatus() {
  const LM = api();
  if (!LM?.availability) return 'unsupported';
  try {
    return await LM.availability(LANGS);
  } catch {
    return 'unavailable';
  }
}

let session = null;
let sessionFor = null;

// One session per schedule snapshot; a new context starts a fresh session.
export async function aiSession(context, onProgress = () => {}) {
  const key = `${mascot().name}\n${context}`; // a new theme means a new mascot to answer as
  if (session && sessionFor === key) return session;
  session?.destroy?.();
  session = await api().create({
    ...LANGS,
    initialPrompts: [{ role: 'system', content: `${systemPrompt(mascot().name, mascot().animal)}\n\nSchedule:\n${context}` }],
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => onProgress(e.loaded));
    },
  });
  sessionFor = key;
  return session;
}

// Streams the reply; onText gets the whole answer so far each time.
export async function askAI(context, question, onText, onProgress) {
  const s = await aiSession(context, onProgress);
  let text = '';
  for await (const chunk of s.promptStreaming(question)) {
    text = chunk.startsWith(text) ? chunk : text + chunk; // older Chrome sent the whole text each time
    onText(text);
  }
  return text;
}
