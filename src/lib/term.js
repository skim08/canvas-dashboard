// K4: quarters, semesters or trimesters. Detected from Canvas's term names and dates
// (or chosen in Settings → General), so wording and the archive follow your school.

export const TERM_TYPES = { quarter: 'Quarters', semester: 'Semesters', trimester: 'Trimesters' };

// Courses: [{ term, termStart, termEnd }]. → 'quarter' | 'semester' | 'trimester' | null
export function detectTermType(courses) {
  const names = (courses || []).map((c) => String(c.term || '')).join(' ');
  if (/trimester/i.test(names)) return 'trimester';
  if (/semester/i.test(names)) return 'semester';
  if (/quarter|\bautumn\b|\bwinter\b/i.test(names)) return 'quarter';
  const lengths = (courses || [])
    .map((c) => (c.termStart && c.termEnd ? (new Date(c.termEnd) - new Date(c.termStart)) / 86400000 : null))
    .filter((d) => d != null && d > 20 && d < 200)
    .sort((a, b) => a - b);
  if (!lengths.length) return null;
  const median = lengths[Math.floor(lengths.length / 2)];
  return median >= 98 ? 'semester' : 'quarter';
}

// The word to use: your choice, else detected, else the neutral "term".
export function termWord(settings, courses) {
  return settings?.termType || detectTermType(courses) || 'term';
}

export const capital = (w) => w.charAt(0).toUpperCase() + w.slice(1);
