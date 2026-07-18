// Feature: compliance-data-restructure, Property 1–3, 6: Seed parsing property tests
import * as fc from 'fast-check';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  parseDailyHours,
  parseYearlyAttendance,
  parseRequiredSubjects,
  buildPlan1FieldsMap,
} from './generate-state-compliance-laws';

// Feature: compliance-data-restructure, Property 1: Daily hours parsing produces number or null
// **Validates: Requirements 1.1**
describe('Property 1: Daily hours parsing produces number or null', () => {
  it('for any string, parseDailyHours returns a number in [0.5, 24] or null', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseDailyHours(input);
        if (result === null) return true;
        return typeof result === 'number' && result >= 0.5 && result <= 24;
      }),
      { numRuns: 200 },
    );
  });

  it('handles undefined and null inputs', () => {
    expect(parseDailyHours(undefined)).toBeNull();
    expect(parseDailyHours(null)).toBeNull();
  });

  it('returns number for valid numeric strings in range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 24, noNaN: true }),
        (n) => {
          const result = parseDailyHours(String(n));
          return result === n;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: compliance-data-restructure, Property 2: Yearly attendance extraction produces integer or null
// **Validates: Requirements 2.1**
describe('Property 2: Yearly attendance extraction produces integer or null', () => {
  it('for any string, parseYearlyAttendance returns an integer in [1, 8760] or null', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseYearlyAttendance(input);
        if (result === null) return true;
        return (
          typeof result === 'number' &&
          Number.isInteger(result) &&
          result >= 1 &&
          result <= 8760
        );
      }),
      { numRuns: 200 },
    );
  });

  it('returns hours when JSON has required=true and valid integer hours', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8760 }),
        (hours) => {
          const json = JSON.stringify({ required: true, hours });
          const result = parseYearlyAttendance(json);
          return result === hours;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null for required=false regardless of hours', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8760 }),
        (hours) => {
          const json = JSON.stringify({ required: false, hours });
          return parseYearlyAttendance(json) === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null for non-integer hours', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 8760, noNaN: true }).filter((n) => !Number.isInteger(n)),
        (hours) => {
          const json = JSON.stringify({ required: true, hours });
          return parseYearlyAttendance(json) === null;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: compliance-data-restructure, Property 3: Required subjects join formatting
// **Validates: Requirements 2.3**
describe('Property 3: Required subjects join formatting', () => {
  it('for any non-empty array of strings, returns arr.join(", ")', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 20 }),
        (arr) => {
          const json = JSON.stringify(arr);
          const result = parseRequiredSubjects(json);
          return result === arr.join(', ');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns null for empty array', () => {
    expect(parseRequiredSubjects(JSON.stringify([]))).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => {
          try { JSON.parse(s); return false; } catch { return true; }
        }),
        (input) => parseRequiredSubjects(input) === null,
      ),
      { numRuns: 100 },
    );
  });

  it('returns null for JSON that is not an array', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer().map((n) => JSON.stringify(n)),
          fc.string().map((s) => JSON.stringify(s)),
          fc.record({ key: fc.string() }).map((o) => JSON.stringify(o)),
        ),
        (json) => parseRequiredSubjects(json) === null,
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: compliance-data-restructure, Property 6: Plan 1 filtering
// **Validates: Requirements 4.1**
describe('Property 6: Plan 1 filtering', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = join(tmpdir(), `pbt-plan1-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('only uses rows where plan_number === "1"', () => {
    // ponytail: generate a small dataset with 1-5 states, each with 1-3 plan rows
    const stateArb = fc.constantFrom('tx', 'ca', 'fl', 'ny', 'oh');
    const planArb = fc.constantFrom('1', '2', '3');
    const hoursArb = fc.oneof(
      fc.constant(''),
      fc.double({ min: 0.5, max: 24, noNaN: true }).map(String),
    );

    const rowArb = fc.tuple(stateArb, planArb, hoursArb).map(
      ([state, plan, hours]) => ({ state, plan_number: plan, daily_hours_required: hours }),
    );

    fc.assert(
      fc.property(
        fc.array(rowArb, { minLength: 1, maxLength: 20 }),
        (rows) => {
          // Build CSV
          const header = 'state,plan_number,daily_hours_required,yearly_attendance,required_subjects';
          const csvLines = rows.map(
            (r) => `${r.state},${r.plan_number},${r.daily_hours_required},,`,
          );
          const csv = [header, ...csvLines].join('\n');

          const csvPath = join(tempDir, `test-${Date.now()}-${Math.random()}.csv`);
          writeFileSync(csvPath, csv, 'utf-8');

          const result = buildPlan1FieldsMap(csvPath);

          // Verify: every state in the result should only have data from plan 1 rows
          for (const [state, fields] of result) {
            const plan1Rows = rows.filter(
              (r) => r.state === state && r.plan_number === '1',
            );
            // State must have had at least one plan 1 row to appear in map
            if (plan1Rows.length === 0) return false;

            // The fields should match what parseDailyHours would produce for
            // the LAST plan 1 row (since the loop overwrites)
            const lastPlan1Row = plan1Rows[plan1Rows.length - 1];
            const expectedDaily = parseDailyHours(lastPlan1Row.daily_hours_required);
            if (fields.dailyHoursRequired !== expectedDaily) return false;
          }

          // States without plan 1 rows should not appear in map
          const statesWithoutPlan1 = [
            ...new Set(rows.map((r) => r.state)),
          ].filter(
            (s) => !rows.some((r) => r.state === s && r.plan_number === '1'),
          );
          for (const s of statesWithoutPlan1) {
            if (result.has(s)) return false;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
