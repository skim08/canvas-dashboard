// J8: every mascot in every mood, for reviewing the art (test page only).
import { MASCOTS, MASCOT_MOODS, mascotMarkup } from '../ui/mascots.js';

const sheet = document.getElementById('sheet');
const head = document.createElement('div');
head.className = 'row head';
head.innerHTML = `<div></div>${MASCOT_MOODS.map((m) => `<div class="cell">${m}</div>`).join('')}`;
sheet.append(head);
for (const [id, m] of Object.entries(MASCOTS)) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<div class="name"><strong>${m.name}</strong><span>${m.animal}</span></div>${MASCOT_MOODS.map((mood) => `<div class="cell">${mascotMarkup(id, mood, 96)}</div>`).join('')}`;
  sheet.append(row);
}
