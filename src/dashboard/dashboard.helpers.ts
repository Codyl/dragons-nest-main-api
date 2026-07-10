// Feature: dashboard-progress — Pure helper functions for dashboard computations

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface ActivityRecord {
  date: string; // ISO date string YYYY-MM-DD
  timeSpentMinutes: number;
  conceptId?: string;
  subjectId?: string;
  difficulty?: Difficulty;
}

export interface FrequencyEntry {
  date: string;
  hours: number;
}

export interface ConceptActivities {
  conceptName: string;
  activities: { difficulty: Difficulty }[];
}

export interface StrugglingConcept {
  conceptName: string;
  lastDifficulty: Difficulty;
  activitiesCompleted: number;
  hasHardActivity: boolean;
}

export interface TestScore {
  subjectName: string;
  score: number;
  letterGrade: string;
  date: string;
}

export interface TestScoreInput {
  subjectName: unknown;
  score: unknown;
  date: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * One entry per calendar day in [startDate, endDate], hours = sum(timeSpentMinutes)/60 rounded to 1 decimal.
 * Days with no activities get hours = 0.
 */
export function computeActivityFrequency(
  activities: Pick<ActivityRecord, 'date' | 'timeSpentMinutes'>[],
  startDate: string,
  endDate: string,
): FrequencyEntry[] {
  const minutesByDay = new Map<string, number>();
  for (const a of activities) {
    minutesByDay.set(
      a.date,
      (minutesByDay.get(a.date) ?? 0) + a.timeSpentMinutes,
    );
  }

  const result: FrequencyEntry[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const minutes = minutesByDay.get(dateStr) ?? 0;
    result.push({ date: dateStr, hours: round1(minutes / 60) });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Sum of hours / N, rounded to 1 decimal. Returns 0 when array is empty.
 */
export function computeAverageHoursPerDay(frequency: FrequencyEntry[]): number {
  if (frequency.length === 0) return 0;

  const sum = frequency.reduce((acc, entry) => acc + entry.hours, 0);
  return round1(sum / frequency.length);
}

/**
 * Count concepts with ≥3 activities AND at least one Hard difficulty.
 */
export function computeConceptMastery(
  activitiesByConceptId: Map<string, ConceptActivities>,
): number {
  let count = 0;
  for (const [, concept] of activitiesByConceptId) {
    if (
      concept.activities.length >= 3 &&
      concept.activities.some((a) => a.difficulty === 'Hard')
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Concepts with ≥1 activity but NOT mastered. Sorted by fewest activities asc, then alphabetical.
 * Max 5 entries.
 */
export function computeStrugglingConcepts(
  activitiesByConceptId: Map<string, ConceptActivities>,
): StrugglingConcept[] {
  const struggling: StrugglingConcept[] = [];

  for (const [, concept] of activitiesByConceptId) {
    const acts = concept.activities;
    if (acts.length === 0) continue;

    const isMastered =
      acts.length >= 3 && acts.some((a) => a.difficulty === 'Hard');
    if (isMastered) continue;

    struggling.push({
      conceptName: concept.conceptName,
      lastDifficulty: acts[acts.length - 1].difficulty,
      activitiesCompleted: acts.length,
      hasHardActivity: acts.some((a) => a.difficulty === 'Hard'),
    });
  }

  struggling.sort((a, b) => {
    if (a.activitiesCompleted !== b.activitiesCompleted)
      return a.activitiesCompleted - b.activitiesCompleted;

    return a.conceptName.localeCompare(b.conceptName);
  });

  return struggling.slice(0, 5);
}

/**
 * Weekdays (Mon–Fri) with zero activities within schoolYearRange, max 10, most recent first.
 */
export function computeMissingAttendanceDays(
  activityDates: Set<string>,
  schoolYearRange: { start: string; end: string },
): string[] {
  const missing: string[] = [];
  const current = new Date(schoolYearRange.end + 'T00:00:00');
  const start = new Date(schoolYearRange.start + 'T00:00:00');

  // Walk backwards from end to start to get most recent first
  while (current >= start && missing.length < 10) {
    const day = current.getDay(); // 0=Sun, 6=Sat
    if (day >= 1 && day <= 5) {
      const dateStr = current.toISOString().slice(0, 10);
      if (!activityDates.has(dateStr)) {
        missing.push(dateStr);
      }
    }

    current.setDate(current.getDate() - 1);
  }

  return missing;
}

/**
 * Subjects with no activity in last 7 days, max 10.
 */
export function computeOverdueSubjects(
  subjectIds: { id: string; name: string }[],
  activities: Pick<ActivityRecord, 'subjectId' | 'date'>[],
  referenceDate: string,
): string[] {
  const sevenDaysAgo = addDays(referenceDate, -7);
  const recentSubjects = new Set<string>();

  for (const a of activities) {
    if (a.subjectId && a.date >= sevenDaysAgo) {
      recentSubjects.add(a.subjectId);
    }
  }

  const overdue: string[] = [];
  for (const subject of subjectIds) {
    if (!recentSubjects.has(subject.id)) {
      overdue.push(subject.name);
    }

    if (overdue.length >= 10) break;
  }

  return overdue;
}

/**
 * Subjects with no activity in 30 days, excluding those already in the overdue set, max 10.
 */
export function computePortfolioUpdatesNeeded(
  subjectIds: { id: string; name: string }[],
  activities: Pick<ActivityRecord, 'subjectId' | 'date'>[],
  overdueSet: Set<string>,
  referenceDate: string,
): string[] {
  const thirtyDaysAgo = addDays(referenceDate, -30);
  const recentSubjects = new Set<string>();

  for (const a of activities) {
    if (a.subjectId && a.date >= thirtyDaysAgo) {
      recentSubjects.add(a.subjectId);
    }
  }

  const result: string[] = [];
  for (const subject of subjectIds) {
    if (overdueSet.has(subject.name)) continue;

    if (!recentSubjects.has(subject.id)) {
      result.push(subject.name);
    }

    if (result.length >= 10) break;
  }

  return result;
}

/**
 * Performance status: highest severity wins.
 * "Progressing Well" — avgHours ≥ 3 AND mastered ≥ 2
 * "Needs Attention" — avgHours ≥1 and <3, OR mastered = 1
 * "At Risk" — avgHours < 1 AND mastered = 0
 * 0/0 → "At Risk"
 */
export function computePerformanceStatus(
  avgHours: number,
  masteredCount: number,
): 'Progressing Well' | 'Needs Attention' | 'At Risk' {
  // Check At Risk first (highest severity)
  if (avgHours < 1 && masteredCount === 0) return 'At Risk';

  // Check Needs Attention (medium severity)
  if ((avgHours >= 1 && avgHours < 3) || masteredCount === 1)
    return 'Needs Attention';

  // Check Progressing Well
  if (avgHours >= 3 && masteredCount >= 2) return 'Progressing Well';

  // ponytail: fallback — covers edge cases like avgHours >= 3 but mastered = 0,
  // or avgHours < 1 but mastered >= 2. Severity-first means "Needs Attention" is safest default.
  // The only remaining uncovered case: avgHours >= 3 && mastered = 0 → not "At Risk" (avgHours >= 1),
  // not "Progressing Well" (mastered < 2), so "Needs Attention".
  // Or: avgHours < 1 && mastered >= 2 → not "At Risk" (mastered > 0), not "Progressing Well" (avgHours < 3).
  return 'Needs Attention';
}

/**
 * A (90-100), B (80-89), C (70-79), D (60-69), F (0-59)
 */
export function computeLetterGrade(score: number): string {
  if (score >= 90) return 'A';

  if (score >= 80) return 'B';

  if (score >= 70) return 'C';

  if (score >= 60) return 'D';

  return 'F';
}

/**
 * Sort by date descending, stable, max 5.
 */
export function sortTestScores<T extends { date: string }>(scores: T[]): T[] {
  return [...scores].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}

/**
 * Validates startDate/endDate: YYYY-MM-DD format, startDate ≤ endDate, max 90 days inclusive.
 */
export function validateDateRange(
  startDate: string,
  endDate: string,
): ValidationResult {
  const errors: string[] = [];
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(startDate)) {
    errors.push('startDate must be a valid YYYY-MM-DD date string');
  }

  if (!dateRegex.test(endDate)) {
    errors.push('endDate must be a valid YYYY-MM-DD date string');
  }

  if (errors.length > 0) return { valid: false, errors };

  // Verify the dates are actually valid calendar dates
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  if (isNaN(start.getTime())) {
    errors.push('startDate must be a valid YYYY-MM-DD date string');
  }

  if (isNaN(end.getTime())) {
    errors.push('endDate must be a valid YYYY-MM-DD date string');
  }

  if (errors.length > 0) return { valid: false, errors };

  if (startDate > endDate) {
    errors.push('startDate must not be after endDate');
    return { valid: false, errors };
  }

  // Inclusive day count: end - start + 1
  const dayCount =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (dayCount > 90) {
    errors.push('Date range must not exceed 90 days');
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates test score input: subjectName 1-100 chars, score integer 0-100, date valid ISO 8601.
 */
export function validateTestScoreInput(
  input: TestScoreInput,
): ValidationResult {
  const errors: string[] = [];

  // subjectName validation
  if (
    typeof input.subjectName !== 'string' ||
    input.subjectName.trim().length === 0
  ) {
    errors.push('subjectName must be a non-empty string');
  } else if (input.subjectName.length > 100) {
    errors.push('subjectName must not exceed 100 characters');
  }

  // score validation
  if (
    typeof input.score !== 'number' ||
    !Number.isInteger(input.score) ||
    input.score < 0 ||
    input.score > 100
  ) {
    errors.push('score must be an integer between 0 and 100');
  }

  // date validation
  if (typeof input.date !== 'string' || !isValidISODate(input.date)) {
    errors.push('date must be a valid ISO 8601 date string');
  }

  return { valid: errors.length === 0, errors };
}

// --- Internal helpers ---

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isValidISODate(str: string): boolean {
  // Accept YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;

  const d = new Date(str + 'T00:00:00');
  if (isNaN(d.getTime())) return false;

  // Verify the date didn't roll over (e.g. 2024-02-30 → 2024-03-01)
  return d.toISOString().slice(0, 10) === str;
}
