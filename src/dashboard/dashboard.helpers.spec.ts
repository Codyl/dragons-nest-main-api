import {
  computeActivityFrequency,
  computeAverageHoursPerDay,
  computeConceptMastery,
  computeStrugglingConcepts,
  computeMissingAttendanceDays,
  computeOverdueSubjects,
  computePortfolioUpdatesNeeded,
  computePerformanceStatus,
  computeLetterGrade,
  sortTestScores,
  validateDateRange,
  validateTestScoreInput,
  ConceptActivities,
} from './dashboard.helpers';

describe('dashboard.helpers', () => {
  describe('computeActivityFrequency', () => {
    it('returns one entry per day with correct hours', () => {
      const result = computeActivityFrequency(
        [
          { date: '2024-01-01', timeSpentMinutes: 90 },
          { date: '2024-01-01', timeSpentMinutes: 30 },
          { date: '2024-01-03', timeSpentMinutes: 60 },
        ],
        '2024-01-01',
        '2024-01-03',
      );
      expect(result).toEqual([
        { date: '2024-01-01', hours: 2 },
        { date: '2024-01-02', hours: 0 },
        { date: '2024-01-03', hours: 1 },
      ]);
    });

    it('returns empty array for invalid range', () => {
      const result = computeActivityFrequency([], '2024-01-05', '2024-01-01');
      expect(result).toEqual([]);
    });
  });

  describe('computeAverageHoursPerDay', () => {
    it('returns sum/N rounded to 1 decimal', () => {
      expect(
        computeAverageHoursPerDay([
          { date: '2024-01-01', hours: 2.5 },
          { date: '2024-01-02', hours: 1.3 },
          { date: '2024-01-03', hours: 0 },
        ]),
      ).toBe(1.3);
    });

    it('returns 0 for empty array', () => {
      expect(computeAverageHoursPerDay([])).toBe(0);
    });
  });

  describe('computeConceptMastery', () => {
    it('counts concepts with ≥3 activities and ≥1 Hard', () => {
      const map = new Map<string, ConceptActivities>([
        [
          'c1',
          {
            conceptName: 'Algebra',
            activities: [
              { difficulty: 'Easy' },
              { difficulty: 'Medium' },
              { difficulty: 'Hard' },
            ],
          },
        ],
        [
          'c2',
          {
            conceptName: 'Geometry',
            activities: [
              { difficulty: 'Easy' },
              { difficulty: 'Easy' },
              { difficulty: 'Easy' },
            ],
          },
        ],
      ]);
      expect(computeConceptMastery(map)).toBe(1);
    });
  });

  describe('computeStrugglingConcepts', () => {
    it('returns non-mastered concepts sorted by fewest activities then alphabetical', () => {
      const map = new Map<string, ConceptActivities>([
        [
          'c1',
          {
            conceptName: 'Zebra',
            activities: [{ difficulty: 'Easy' }],
          },
        ],
        [
          'c2',
          {
            conceptName: 'Alpha',
            activities: [{ difficulty: 'Easy' }],
          },
        ],
        [
          'c3',
          {
            conceptName: 'Beta',
            activities: [{ difficulty: 'Easy' }, { difficulty: 'Medium' }],
          },
        ],
      ]);
      const result = computeStrugglingConcepts(map);
      expect(result[0].conceptName).toBe('Alpha');
      expect(result[1].conceptName).toBe('Zebra');
      expect(result[2].conceptName).toBe('Beta');
      expect(result).toHaveLength(3);
    });

    it('caps at 5 entries', () => {
      const map = new Map<string, ConceptActivities>();
      for (let i = 0; i < 8; i++) {
        map.set(`c${i}`, {
          conceptName: `Concept${i}`,
          activities: [{ difficulty: 'Easy' }],
        });
      }
      expect(computeStrugglingConcepts(map)).toHaveLength(5);
    });
  });

  describe('computeMissingAttendanceDays', () => {
    it('returns weekdays with zero activities, most recent first', () => {
      // 2024-01-08 is Monday, 2024-01-12 is Friday
      const activityDates = new Set(['2024-01-09', '2024-01-11']);
      const result = computeMissingAttendanceDays(activityDates, {
        start: '2024-01-08',
        end: '2024-01-12',
      });
      expect(result).toEqual(['2024-01-12', '2024-01-10', '2024-01-08']);
    });

    it('skips weekends', () => {
      // 2024-01-06 is Saturday, 2024-01-07 is Sunday
      const result = computeMissingAttendanceDays(new Set(), {
        start: '2024-01-06',
        end: '2024-01-07',
      });
      expect(result).toEqual([]);
    });
  });

  describe('computeOverdueSubjects', () => {
    it('returns subjects with no activity in last 7 days', () => {
      const subjects = [
        { id: 's1', name: 'Math' },
        { id: 's2', name: 'Science' },
      ];
      const activities = [{ subjectId: 's1', date: '2024-01-10' }];
      const result = computeOverdueSubjects(subjects, activities, '2024-01-15');
      expect(result).toEqual(['Science']);
    });
  });

  describe('computePortfolioUpdatesNeeded', () => {
    it('excludes overdue subjects and returns no-activity-in-30-days', () => {
      const subjects = [
        { id: 's1', name: 'Math' },
        { id: 's2', name: 'Science' },
        { id: 's3', name: 'Art' },
      ];
      const activities = [{ subjectId: 's1', date: '2024-01-01' }];
      const overdueSet = new Set(['Science']);
      const result = computePortfolioUpdatesNeeded(
        subjects,
        activities,
        overdueSet,
        '2024-02-15',
      );
      expect(result).toEqual(['Math', 'Art']);
    });
  });

  describe('computePerformanceStatus', () => {
    it('returns "Progressing Well" for avgHours ≥ 3 and mastered ≥ 2', () => {
      expect(computePerformanceStatus(3, 2)).toBe('Progressing Well');
    });

    it('returns "Needs Attention" for avgHours between 1 and 3', () => {
      expect(computePerformanceStatus(2, 5)).toBe('Needs Attention');
    });

    it('returns "Needs Attention" for mastered = 1', () => {
      expect(computePerformanceStatus(5, 1)).toBe('Needs Attention');
    });

    it('returns "At Risk" for avgHours < 1 and mastered = 0', () => {
      expect(computePerformanceStatus(0.5, 0)).toBe('At Risk');
    });

    it('returns "At Risk" for 0/0', () => {
      expect(computePerformanceStatus(0, 0)).toBe('At Risk');
    });
  });

  describe('computeLetterGrade', () => {
    it('maps scores correctly', () => {
      expect(computeLetterGrade(95)).toBe('A');
      expect(computeLetterGrade(90)).toBe('A');
      expect(computeLetterGrade(85)).toBe('B');
      expect(computeLetterGrade(80)).toBe('B');
      expect(computeLetterGrade(75)).toBe('C');
      expect(computeLetterGrade(70)).toBe('C');
      expect(computeLetterGrade(65)).toBe('D');
      expect(computeLetterGrade(60)).toBe('D');
      expect(computeLetterGrade(55)).toBe('F');
      expect(computeLetterGrade(0)).toBe('F');
    });
  });

  describe('sortTestScores', () => {
    it('sorts by date descending and caps at 5', () => {
      const scores = [
        { date: '2024-01-01', subjectName: 'A', score: 80 },
        { date: '2024-01-03', subjectName: 'B', score: 90 },
        { date: '2024-01-02', subjectName: 'C', score: 70 },
      ];
      const result = sortTestScores(scores);
      expect(result[0].date).toBe('2024-01-03');
      expect(result[1].date).toBe('2024-01-02');
      expect(result[2].date).toBe('2024-01-01');
    });
  });

  describe('validateDateRange', () => {
    it('accepts valid range', () => {
      expect(validateDateRange('2024-01-01', '2024-01-30')).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('rejects invalid format', () => {
      const result = validateDateRange('01-01-2024', '2024-01-30');
      expect(result.valid).toBe(false);
    });

    it('rejects start after end', () => {
      const result = validateDateRange('2024-02-01', '2024-01-01');
      expect(result.valid).toBe(false);
    });

    it('rejects range exceeding 90 days', () => {
      const result = validateDateRange('2024-01-01', '2024-05-01');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateTestScoreInput', () => {
    it('accepts valid input', () => {
      expect(
        validateTestScoreInput({
          subjectName: 'Math',
          score: 85,
          date: '2024-01-15',
        }),
      ).toEqual({ valid: true, errors: [] });
    });

    it('rejects empty subjectName', () => {
      const result = validateTestScoreInput({
        subjectName: '',
        score: 85,
        date: '2024-01-15',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects non-integer score', () => {
      const result = validateTestScoreInput({
        subjectName: 'Math',
        score: 85.5,
        date: '2024-01-15',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid date', () => {
      const result = validateTestScoreInput({
        subjectName: 'Math',
        score: 85,
        date: 'not-a-date',
      });
      expect(result.valid).toBe(false);
    });
  });
});
