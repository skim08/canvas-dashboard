// Sample syllabi for tests (and test mode on a computer without owner-data/): a
// renamed copy of the owner's hand-written syllabi, with made-up course codes, people,
// rooms and Zoom IDs, so every rule they exercise stays tested in the public repository.
// Never published (tools/build_zip.py leaves src/tests out).

const steps = (top, topGp, bottomGp) => {
  const rows = [];
  for (let gp = topGp, min = top; gp >= bottomGp - 1e-9; gp = Math.round((gp - 0.1) * 10) / 10, min -= 1) rows.push({ min, gp });
  return rows;
};

const PROFILES = [
  {
    code: 'ACCT 210',
    term: 'Autumn 2026',
    source: 'ACCT 210 syllabus (Prof. Morgan)',
    credits: 5,
    officeHours: [
      { id: 'acct-matsumoto', person: 'Dana Morgan', role: 'Instructor', days: ['Tue', 'Thu'], start: '13:00', end: '14:00', where: 'BUS 520 (or by appointment)' },
      { id: 'acct-saeteurn', person: 'Taylor Shaw', role: 'TA · sections AA & AB', days: ['Mon'], start: '13:00', end: '14:00', where: 'Location TBD' },
      { id: 'acct-wright', person: 'Jordan West', role: 'TA · sections AC & AD', days: ['Thu'], start: '11:30', end: '12:30', where: 'Location TBD' },
      { id: 'acct-avilez', person: 'Max Avery', role: 'TA · sections BA & BB', days: ['Fri'], start: '14:30', end: '15:30', where: 'Location TBD' },
    ],
    // Syllabus: "Overall course grade will not appear on Canvas", and professionalism isn't graded there.
    canvasReliable: false,
    scale: {
      // "94–100 → 3.9–4.0, 90–93 → 3.5–3.8 …" = 0.1 per 1%, 95% = 4.0. 50–63 → 0.7–0.8 (split assumed at 57).
      rows: [...steps(95, 4.0, 0.9), { min: 57, gp: 0.8 }, { min: 50, gp: 0.7 }],
      mode: 'step',
      round: 'none',
      notes: ['The syllabus gives 94–100% as 3.9–4.0 without saying where 4.0 starts; 95% follows the pattern of every other band and the standard UW scale (your choice, 2026-10-06).', 'Grades may be curved up (never down) to a 2.9–3.1 median.'],
    },
    model: {
      kind: 'weighted',
      categories: [
        { id: 'prof', name: 'Communication & professionalism', weight: 5, manual: { assume: 100 }, note: 'Not graded on Canvas. Nearly everyone gets full credit.' },
        { id: 'mid1', name: 'Midterm 1', weight: 20, priority: true, match: /midterm\s*(#\s*)?(1|one|i)\b/i },
        { id: 'mid2', name: 'Midterm 2', weight: 20, priority: true, match: /midterm\s*(#\s*)?(2|two|ii)\b/i },
        { id: 'final', name: 'Final exam', weight: 30, priority: true, match: /\bfinal\b/i },
        { id: 'quiz', name: 'Quizzes', weight: 15, match: /\bquiz/i, group: /\bquiz/i, dropLowest: 1, dropMinCount: 3, note: 'Lowest dropped only if you take the optional third quiz.' },
        { id: 'hw', name: 'Canvas homework', weight: 10, match: /homework|\bhw\b/i, group: /homework|\bhw\b/i, dropLowest: 1, note: 'Lowest homework score dropped.' },
      ],
    },
    // G10, G11: from "Accounting 210 Syllabus Fall 2026 schedule" (the first table; the
    // second table in that file is last year's). Meeting times aren't in the file; the
    // owner gave them on 2026-10-06: lecture 10:00–11:20, quiz section 12:30–1:20.
    // Midterms are in lecture and quizzes in quiz section, so they get those times.
    schedule: {
      classes: [
        { id: 'lec', name: 'Lecture', start: '10:00', end: '11:20', where: 'BUS 100 (Main Auditorium)', sections: { A: {}, B: {} } },
        {
          id: 'qs',
          name: 'Quiz section',
          start: '12:30',
          end: '13:20',
          note: 'Quizzes must be taken in your registered quiz section.',
          sections: {
            AA: { staff: 'Taylor Shaw' },
            AB: { staff: 'Taylor Shaw' },
            AC: { staff: 'Jordan West' },
            AD: { staff: 'Jordan West' },
            BA: { staff: 'Max Avery' },
            BB: { staff: 'Max Avery' },
            BC: { staff: 'Priya Kapoor' },
            BD: { staff: 'Priya Kapoor' },
          },
        },
      ],
      sessions: [
        { day: '2026-09-30', in: 'qs', topic: 'Syllabus review' },
        { day: '2026-10-01', in: 'lec', topic: 'Ch 1 – Financial Statements' },
        { day: '2026-10-02', in: 'qs', topic: 'Ch 1' },
        { day: '2026-10-06', in: 'lec', topic: 'Ch 2 – Financing and Investing Transactions' },
        { day: '2026-10-07', in: 'qs', topic: 'Ch 2' },
        { day: '2026-10-08', in: 'lec', topic: 'Ch 3 – Operating Transactions' },
        { day: '2026-10-09', in: 'qs', topic: 'Ch 3' },
        { day: '2026-10-13', in: 'lec', topic: 'Ch 4 – Adjustments Part 1' },
        { day: '2026-10-15', in: 'lec', topic: 'Ch 4 – Adjustments Part 2' },
        { day: '2026-10-16', in: 'qs', topic: 'Ch 4' },
        { day: '2026-10-20', in: 'lec', topic: 'Exam 1 review' },
        { day: '2026-10-21', in: 'qs', topic: 'Ch 4 – Adjustments Part 2' },
        { day: '2026-10-23', in: 'qs', topic: 'Quiz section cancelled (day after Exam 1)', off: true },
        { day: '2026-10-27', in: 'lec', topic: 'Ch 6 – Sales and Accounts Receivable' },
        { day: '2026-10-28', in: 'qs', topic: 'Ch 6' },
        { day: '2026-10-29', in: 'lec', topic: 'Ch 7 – Cost of Goods Sold and Inventory' },
        { day: '2026-10-30', in: 'qs', topic: 'Ch 7' },
        { day: '2026-11-03', in: 'lec', topic: 'Ch 8 – Fixed Assets Part 1' },
        { day: '2026-11-04', in: 'qs', topic: 'Ch 8 Part 1' },
        { day: '2026-11-05', in: 'lec', topic: 'Ch 8 – Fixed Assets Part 2' },
        { day: '2026-11-10', in: 'lec', topic: 'Financial Statement Analysis' },
        { day: '2026-11-11', in: 'qs', topic: 'No quiz section · Veterans Day', off: true },
        { day: '2026-11-12', in: 'lec', topic: 'No class · asynchronous Exam 2 review', keep: true },
        { day: '2026-11-13', in: 'qs', topic: 'Financial Statement Analysis' },
        { day: '2026-11-18', in: 'qs', topic: 'Quiz section cancelled (day after Exam 2)', off: true },
        { day: '2026-11-19', in: 'lec', topic: 'Ch 9 – Present Value and Intro to Bonds' },
        { day: '2026-11-20', in: 'qs', topic: 'Ch 9' },
        { day: '2026-11-24', in: 'lec', topic: 'Ch 10 – Bonds' },
        { day: '2026-11-25', in: 'qs', topic: 'Ch 10' },
        { day: '2026-11-26', in: 'lec', topic: 'No class · Thanksgiving', off: true },
        { day: '2026-11-27', in: 'qs', topic: 'No quiz sections · Thanksgiving', off: true },
        { day: '2026-12-01', in: 'lec', topic: 'Ch 11 – Equity' },
        { day: '2026-12-02', in: 'qs', topic: 'Ch 11' },
        { day: '2026-12-03', in: 'lec', topic: 'Ch 12 – Statement of Cash Flows' },
        { day: '2026-12-08', in: 'lec', topic: 'Ch 12 – Statement of Cash Flows (continued)' },
        { day: '2026-12-09', in: 'qs', topic: 'Ch 12' },
        { day: '2026-12-10', in: 'lec', topic: 'Final exam review' },
        { day: '2026-12-11', in: 'qs', topic: 'Final exam review' },
      ],
      exams: [
        { id: 'q1', title: 'Quiz 1', type: 'quiz', day: '2026-10-14', in: 'qs', match: /\bquiz\s*(#\s*)?(1|one|i)\b/i, note: 'Covers Ch 1, 2 and 3. Closed book, closed notes. No makeups; taking the optional Quiz 3 drops your lowest quiz.' },
        { id: 'e1', title: 'Exam 1', day: '2026-10-22', in: 'lec', match: /\b(exam|midterm)\s*(#\s*)?(1|one|i)\b/i, note: 'Covers Chapters 1–4. Closed book, closed notes, simple calculator only. No makeup midterms: if you miss it, the final counts for its 20%.' },
        { id: 'q2', title: 'Quiz 2', type: 'quiz', day: '2026-11-06', in: 'qs', match: /\bquiz\s*(#\s*)?(2|two|ii)\b/i, note: 'Covers Ch 6, 7 and 8 Part 1. Closed book, closed notes.' },
        { id: 'e2', title: 'Exam 2', day: '2026-11-17', in: 'lec', match: /\b(exam|midterm)\s*(#\s*)?(2|two|ii)\b/i, note: 'Covers Chapters 6–8 and Financial Statement Analysis. Closed book, closed notes, simple calculator only.' },
        { id: 'q3', title: 'Optional Quiz 3', type: 'quiz', day: '2026-12-04', in: 'qs', match: /\bquiz\s*(#\s*)?(3|three|iii)\b/i, note: 'Optional. Covers Chapters 9, 10 and 11. If you take all three quizzes, the lowest is dropped.' },
        { id: 'final', title: 'Final exam', day: '2026-12-12', start: '08:30', end: '10:20', match: /\bfinal\b(?!\s*(project|paper|report|essay|draft|presentation|portfolio|reflection))/i, note: 'Cumulative, 1 hour 50 minutes. You must take it to pass the class. The syllabus doesn’t say where.' },
      ],
      deadlineTime: '23:59',
      deadlineSuffix: ' (Canvas)',
      deadlineNote: 'Unlimited attempts; your best attempt before the due date counts. No late submissions. Your lowest homework score is dropped.',
      deadlines: [
        { id: 'hw-ch1', day: '2026-10-09', title: 'Ch 1 homework' },
        { id: 'hw-ch2', day: '2026-10-14', title: 'Ch 2 homework' },
        { id: 'hw-ch3', day: '2026-10-16', title: 'Ch 3 homework' },
        { id: 'hw-ch4', day: '2026-10-21', title: 'Ch 4 homework' },
        { id: 'hw-ch6', day: '2026-11-04', title: 'Ch 6 homework' },
        { id: 'hw-ch7', day: '2026-11-06', title: 'Ch 7 homework' },
        { id: 'hw-ch8', day: '2026-11-13', title: 'Ch 8 homework' },
        { id: 'hw-fsa', day: '2026-11-18', title: 'Financial Statement Analysis homework' },
        { id: 'hw-ch9', day: '2026-11-30', title: 'Ch 9 homework' },
        { id: 'hw-ch10', day: '2026-12-02', title: 'Ch 10 homework' },
        { id: 'hw-ch11', day: '2026-12-09', title: 'Ch 11 homework' },
        { id: 'hw-ch12', day: '2026-12-11', title: 'Ch 12 homework' },
      ],
    },
  },
  {
    code: 'STAT 220',
    term: 'Autumn 2026',
    source: 'STAT 220 syllabus (Dr. Warren)',
    credits: 5,
    officeHoursNote: 'Office hours are on the Office Hours page in Canvas (they change during the quarter).',
    canvasReliable: false, // the weights depend on how much completion work you do
    // Not in the syllabus; confirmed by the course staff (2026-10-02, and the TA again 2026-10-06) as the standard UW scale.
    scale: { rows: steps(95, 4.0, 0.7), mode: 'step', round: 'none', notes: ['Standard UW scale (95% = 4.0, 0.1 less per 1%), confirmed by the course staff.'] },
    model: {
      kind: 'selfWeighted',
      completion: [
        { id: 'section', name: 'Quiz section assignments', max: 15, match: /quiz\s*section|\bsection\b|\blab\b/i, group: /quiz\s*section|\bsection\b|\blab\b/i },
        { id: 'notes', name: 'Notes / lecture participation', max: 15, match: /\bnotes?\b|lecture|particip/i, group: /\bnotes?\b|lecture|particip/i },
        { id: 'hw', name: 'Homework', max: 15, match: /homework|\bhw\b|problem\s*set/i, group: /homework|\bhw\b|problem\s*set/i },
      ],
      exams: [
        { id: 'e1', name: 'Exam 1', share: 2, priority: true, match: /(exam|midterm)\s*(#\s*)?(1|one|i)\b/i },
        { id: 'e2', name: 'Exam 2', share: 2, priority: true, match: /(exam|midterm)\s*(#\s*)?(2|two|ii)\b/i },
        { id: 'final', name: 'Final exam', share: 3, priority: true, match: /\bfinal\b/i },
      ],
    },
    // G10, G11: from "Important Dates" in the syllabus. "Exam dates will not change";
    // weekly topics are "a rough outline … subject to change".
    schedule: {
      textbook: 'Introduction to Modern Statistics (free, open-source)',
      classes: [
        { id: 'lec', name: 'Lecture', days: ['Wed', 'Fri'], start: '15:30', end: '16:50', where: 'SCI 260', from: '2026-09-30', until: '2026-12-11' },
        {
          id: 'qs',
          name: 'Quiz section',
          days: ['Tue', 'Thu'],
          from: '2026-09-30',
          until: '2026-12-10',
          note: 'Bring a laptop: you write and submit R code in quiz section. Homework is handwritten and collected here.',
          sections: {
            AA: { start: '15:30', end: '16:20', where: 'SOC 234', staff: 'Lu & Ramos' },
            AB: { start: '16:30', end: '17:20', where: 'SOC 211', staff: 'Allison & Ng' },
            AC: { start: '15:30', end: '16:20', where: 'SOC 235', staff: 'Zhou & Lim' },
            AD: { start: '16:30', end: '17:20', where: 'SOC 235', staff: 'Zhou & Lim' },
            AE: { start: '15:30', end: '16:20', where: 'SOC 211', staff: 'Allison & Ng' },
            AF: { start: '16:30', end: '17:20', where: 'SOC 234', staff: 'Lu & Ramos' },
          },
        },
      ],
      weeks: [
        { start: '2026-09-28', label: 'Week 1', topics: [['Intro to Data', 'Ch. 1']] },
        { start: '2026-10-05', label: 'Week 2', topics: [['Sourcing Data', 'Ch. 2'], ['Basics of Probability', 'not in the textbook']] },
        { start: '2026-10-12', label: 'Week 3', topics: [['Summarizing Data', 'Ch. 3–4'], ['Foundations of Inference', 'Ch. 11–12']] },
        { start: '2026-10-19', label: 'Week 4', topics: [['Inference for Proportions', 'Ch. 16–17']] },
        { start: '2026-10-26', label: 'Week 5', topics: [['Inference for Two-way Tables', 'Ch. 18']] },
        { start: '2026-11-02', label: 'Week 6', topics: [['Inference for a Single Mean', 'Ch. 19']] },
        { start: '2026-11-09', label: 'Week 7', topics: [['Comparing Two Independent Means', 'Ch. 20']] },
        { start: '2026-11-16', label: 'Week 8', topics: [['Comparing Many Means', 'Ch. 22']] },
        { start: '2026-11-23', label: 'Week 9', topics: [['Linear Regression with a Single Predictor', 'Ch. 7']] },
        { start: '2026-11-30', label: 'Week 10', topics: [['Inference for Linear Regression', 'Ch. 24'], ['Regression with Multiple Predictors', 'Ch. 8']] },
        { start: '2026-12-07', label: 'Week 11', topics: [['Logistic Regression', 'Ch. 9']] },
      ],
      noClass: [
        { day: '2026-10-09', only: ['lec'], title: 'Lecture videos (no in-person lecture)', keep: true, note: 'No in-person lecture on 10/9. Videos are provided instead.' },
        { day: '2026-11-11', title: 'No class · Veterans Day' },
        { day: '2026-11-26', title: 'No class · Thanksgiving' },
        { day: '2026-11-27', title: 'No class · Native American Heritage Day' },
      ],
      exams: [
        { id: 'e1', title: 'Exam 1', day: '2026-10-30', start: '15:30', end: '16:50', where: 'SCI 260', replaces: 'lec', match: /\b(exam|midterm)\s*(#\s*)?(1|one|i)\b/i, note: 'In class. Makeups only in extreme circumstances.' },
        { id: 'e2', title: 'Exam 2', day: '2026-11-20', start: '15:30', end: '16:50', where: 'SCI 260', replaces: 'lec', match: /\b(exam|midterm)\s*(#\s*)?(2|two|ii)\b/i, note: 'In class. Makeups only in extreme circumstances.' },
        { id: 'final', title: 'Final exam', day: '2026-12-17', start: '14:30', end: '16:20', where: 'SCI 260', match: /\bfinal\b(?!\s*(project|paper|report|essay|draft|presentation|portfolio|reflection))/i, note: 'Cumulative.' },
      ],
    },
  },
  {
    code: 'R E 150',
    term: 'Autumn 2026',
    source: 'RE 150 syllabus (Prof. Waters)',
    credits: 5,
    officeHours: [
      { id: 're-walter', person: 'Rachel Waters', role: 'Instructor', days: ['Wed'], start: '08:00', end: '09:00', where: 'Zoom (meeting ID 900 0000 0001; link in Canvas)', from: '2026-09-30', until: '2026-12-09' },
      { id: 're-wang', person: 'Vera Wong', role: 'TA', days: ['Tue'], start: '08:30', end: '10:00', where: 'Zoom (meeting ID 900 0000 0002; link in Canvas)', from: '2026-09-29', until: '2026-12-08' },
    ],
    canvasReliable: false, // Canvas divides by points offered so far, not by 600
    scale: { rows: [...steps(94, 4.0, 0.7)], mode: 'step', round: 'none', notes: ['Percent = points earned ÷ 600. 700 points are offered, so extra points still count.'] },
    model: { kind: 'outOf', outOf: 600 },
    // G10: "Assignment Due Dates" in the syllabus. Everything is due 11:59 PM; no late work.
    schedule: {
      deadlineTime: '23:59',
      deadlineSuffix: ' · quizzes and writing',
      deadlineWhat: '5 quizzes (25 points) and the writing assignment (50 points)',
      deadlineNote: 'Read the chapter in the textbook (Modules in Canvas), take its 5 quizzes (best attempt counts, no time limit) and answer one of the 5 writing options. No late work.',
      deadlines: [
        { id: 'ch1', day: '2026-10-16', title: 'Chapter 1: Overview of Homeownership' },
        { id: 'ch2', day: '2026-10-23', title: 'Chapter 2: Homeowner Responsibilities' },
        { id: 'ch3', day: '2026-10-30', title: 'Chapter 3: Navigating Homeownership' },
        { id: 'ch4', day: '2026-11-06', title: 'Chapter 4: Real Estate Brokerage' },
        { id: 'ch5', day: '2026-11-13', title: 'Chapter 5: Mortgage Loans' },
        { id: 'ch6', day: '2026-11-20', title: 'Chapter 6: The Housing Finance System' },
        { id: 'ch7', day: '2026-11-30', title: 'Chapter 7: Property Rights and Restrictions', note: 'Moved to Monday for Thanksgiving and Native American Heritage Day.' },
        { id: 'ch8', day: '2026-12-04', title: 'Chapter 8: Title Insurance' },
        { id: 'ch9', day: '2026-12-11', title: 'Chapter 9: Real Estate Settlement' },
      ],
    },
  },
];

export default PROFILES;
