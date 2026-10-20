// K4: "quarter" or "semester" (or "term") for the text on every screen.

import { state } from './store.js';
import { termWord, capital } from '../lib/term.js';

export const term = () => termWord(state.settings, state.cache?.courses);
export const Term = () => capital(term());
export const terms = () => `${term()}s`;
export const Terms = () => `${Term()}s`;
