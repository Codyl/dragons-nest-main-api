/**
 * CLI seed/upsert script for `state_compliance_laws`.
 *
 * Upserts all 50 states by default. You can target a single state with:
 *   pnpm tsx src/scripts/generate-state-compliance-laws.ts --state=tx
 *   pnpm tsx src/scripts/generate-state-compliance-laws.ts --state=all
 *
 * Requires MONGODB_URI (loads `.env.development.local` then `.env`).
 */
import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import mongoose, { type Model, Types } from 'mongoose';
import { resolve } from 'path';

import type { HomeschoolPathway } from 'src/compliance/entities/state-compliance-laws.entity';
import {
  StateComplianceLaws,
  StateComplianceLawsSchema,
} from 'src/compliance/entities/state-compliance-laws.entity';
import { Subject, SubjectSchema } from 'src/subjects/subject.entity';
import { State } from 'src/users/enums/state.enum';

// --- Exported pure parsing functions (used by property tests in task 1.3) ---

/** Parse daily_hours_required CSV value → number in [0.5, 24] or null. */
export function parseDailyHours(value: string | undefined | null): number | null {
  if (value == null || value.trim() === '') return null;
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  if (n < 0.5 || n > 24) return null;
  return n;
}

/** Parse yearly_attendance JSON column → integer in [1, 8760] or null. */
export function parseYearlyAttendance(value: string | undefined | null): number | null {
  if (value == null || value.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.required !== true || obj.hours == null) return null;
  const hours = Number(obj.hours);
  if (!Number.isInteger(hours)) return null;
  if (hours < 1 || hours > 8760) return null;
  return hours;
}

/** Parse required_subjects JSON array column → comma-space joined string or null. */
export function parseRequiredSubjects(value: string | undefined | null): string | null {
  if (value == null || value.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  if (parsed.length === 0) return null;
  return parsed.join(', ');
}

/** ponytail: single-pass RFC 4180 CSV parser — handles quoted fields with commas/newlines/escaped quotes. */
function parseCSV(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++; // escaped quote
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else if (ch === '\r') {
        // skip, \n follows
      } else {
        field += ch;
      }
    }
  }
  // Flush last field/row
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] ?? '';
    }
    return record;
  });
}

/** Read CSV and build a map of state → plan 1 parsed fields. */
export function buildPlan1FieldsMap(csvPath: string): Map<string, {
  dailyHoursRequired: number | null;
  yearlyHoursRequired: number | null;
  requiredSubjects: string | null;
}> {
  const map = new Map<string, {
    dailyHoursRequired: number | null;
    yearlyHoursRequired: number | null;
    requiredSubjects: string | null;
  }>();

  if (!existsSync(csvPath)) return map;

  const content = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  for (const row of rows) {
    if (row.plan_number !== '1') continue;
    const state = row.state?.trim().toLowerCase();
    if (!state) continue;

    map.set(state, {
      dailyHoursRequired: parseDailyHours(row.daily_hours_required),
      yearlyHoursRequired: parseYearlyAttendance(row.yearly_attendance),
      requiredSubjects: parseRequiredSubjects(row.required_subjects),
    });
  }

  return map;
}

// --- End parsing functions ---

const cwd = process.cwd();
for (const name of ['.env.development.local', '.env']) {
  const p = resolve(cwd, name);
  if (existsSync(p)) {
    loadEnv({ path: p });
  }
}

/** Synonym groups: one subject id per group (first DB match wins). */
const COMMON_REQUIRED_SUBJECT_NAME_GROUPS = [
  ['Reading'],
  ['Language Arts', 'English Language Arts', 'English'],
  ['Mathematics', 'Math'],
  ['Science'],
  ['Social Studies', 'History'],
];

async function resolveSubjectIdsByNameGroups(
  subjectModel: Model<Subject>,
  groups: string[][],
): Promise<{ ids: Types.ObjectId[]; unresolved: string[][] }> {
  const ids: Types.ObjectId[] = [];
  const unresolved: string[][] = [];

  for (const group of groups) {
    let found: Types.ObjectId | null = null;
    for (const name of group) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const doc = await subjectModel
        .findOne({ name: new RegExp(`^${escaped}$`, 'i') })
        .select({ _id: 1 })
        .lean<{ _id: Types.ObjectId } | null>();
      if (doc?._id) {
        found = doc._id;
        break;
      }
    }
    if (found) {
      ids.push(found);
    } else {
      unresolved.push(group);
    }
  }

  return { ids, unresolved };
}

const DEFAULT_PATHWAY_MAIN: HomeschoolPathway = {
  name: 'Homeschool / private-school instruction',
  parentRequirements: {
    degreeRequired: false,
    minimumEducationLevel: 'none',
    backgroundCheck: false,
  },
  notification: {
    required: true,
    frequency: 'once',
    to: 'state',
  },
  requiredSubjects: {
    required: true,
    subjects: [
      {
        name: 'Reading',
        notes:
          'Representative core subject requirement. Verify against current state law.',
      },
      {
        name: 'Language arts',
      },
      { name: 'Mathematics' },
      { name: 'Science' },
      {
        name: 'Social studies',
        notes:
          'Including history/civics where applicable. Verify state-specific wording annually.',
      },
    ],
  },
  assessment: {
    required: false,
    type: 'none',
    frequency: 'none',
    submittedToState: false,
  },
  recordKeeping: {
    required: true,
    details: [
      'Maintain attendance and coursework records appropriate to your state requirements.',
      'Retain any documentation required for district/state filings and audits.',
    ],
  },
  instructionRequirements: {
    equivalencyStandard:
      'Instruction should satisfy current state compulsory education requirements.',
  },
  teacherQualification: {
    required: false,
    description:
      'Teacher qualifications vary by pathway/state; verify annual requirements.',
  },
  diplomaAuthority: {
    parentIssued: true,
    stateRecognized: true,
  },
};

type SeedEntry = {
  state: State;
  abbreviation: string;
  regulationProfile: {
    level: 'none' | 'low' | 'moderate' | 'high';
    description: string;
  };
  compulsoryAttendance: { startAge: number; endAge: number; notes?: string };
  sources: { name: 'HSLDA'; url: string; lastVerified: string }[];
};

function humanizeState(enumKey: string): string {
  return enumKey.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function parseStateArg(): State | 'all' {
  const stateArg = process.argv.find((arg) => arg.startsWith('--state='));
  if (!stateArg) return 'all';

  const raw = stateArg.split('=')[1]?.trim().toLowerCase();
  if (!raw || raw === 'all') return 'all';

  const candidate = raw as State;

  if (!Object.values(State).includes(candidate)) {
    throw new Error(
      `Invalid --state value "${raw}". Use a 2-letter state code (e.g. tx) or "all".`,
    );
  }

  return candidate;
}

function buildBaseEntries(lastVerified: string): SeedEntry[] {
  return Object.entries(State).map(([key, value]) => ({
    state: value,
    abbreviation: value.toUpperCase(),
    regulationProfile: {
      level: 'moderate',
      description: `${humanizeState(key)} homeschool regulation profile. Update with state-specific policy details.`,
    },
    compulsoryAttendance: {
      startAge: 6,
      endAge: 18,
      notes:
        'Baseline placeholder values. Replace with current state compulsory attendance ages.',
    },
    sources: [
      {
        name: 'HSLDA',
        url: `https://hslda.org/post/${key
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .toLowerCase()}`,
        lastVerified,
      },
    ],
  }));
}

function applyCuratedOverrides(
  entries: SeedEntry[],
  lastVerified: string,
): SeedEntry[] {
  const overrides = new Map<State, Partial<SeedEntry>>([
    [
      State.Idaho,
      {
        regulationProfile: {
          level: 'low',
          description:
            'Idaho is one of the least restrictive states; parents are not required to notify the state or seek approval.',
        },
        compulsoryAttendance: {
          startAge: 7,
          endAge: 16,
          notes:
            'Must provide instruction in subjects "commonly taught" in public schools.',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/idaho',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.Pennsylvania,
      {
        regulationProfile: {
          level: 'high',
          description:
            'Requires affidavit, detailed objectives, immunization records, and annual evaluator reports.',
        },
        compulsoryAttendance: {
          startAge: 6,
          endAge: 18,
          notes: 'Ages recently updated in 2020.',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/pennsylvania',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.NewYork,
      {
        regulationProfile: {
          level: 'high',
          description:
            'Requires Notice of Intent, IHIP (Individualized Home Instruction Plan), and quarterly reports.',
        },
        compulsoryAttendance: {
          startAge: 6,
          endAge: 16,
          notes: 'Varies by district (some cities are 17).',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/new-york',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.Texas,
      {
        regulationProfile: {
          level: 'low',
          description:
            'Homeschools are considered private schools. No notification to the state is required.',
        },
        compulsoryAttendance: {
          startAge: 6,
          endAge: 19,
          notes: 'Must use a written curriculum (online counts).',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/texas',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.Florida,
      {
        regulationProfile: {
          level: 'moderate',
          description:
            'Requires Notice of Intent and annual evaluation (test or portfolio review).',
        },
        compulsoryAttendance: {
          startAge: 6,
          endAge: 16,
          notes: 'Parents must maintain a portfolio for 2 years.',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/florida',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.Illinois,
      {
        regulationProfile: {
          level: 'low',
          description:
            'Considered a private school. No registration or testing required.',
        },
        compulsoryAttendance: {
          startAge: 6,
          endAge: 17,
          notes: 'Mandates instruction in English.',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/illinois',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.Ohio,
      {
        regulationProfile: {
          level: 'moderate',
          description:
            'Requires annual notification and assessment (test or portfolio).',
        },
        compulsoryAttendance: {
          startAge: 6,
          endAge: 18,
          notes: 'Notification due by start of school year.',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/ohio',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.California,
      {
        regulationProfile: {
          level: 'moderate',
          description:
            'Most homeschoolers file a Private School Affidavit (PSA).',
        },
        compulsoryAttendance: {
          startAge: 6,
          endAge: 18,
          notes: 'Must keep attendance records.',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/california',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.Virginia,
      {
        regulationProfile: {
          level: 'moderate',
          description:
            'Requires annual Notice of Intent and evidence of progress.',
        },
        compulsoryAttendance: {
          startAge: 5,
          endAge: 18,
          notes: 'Parents can opt-out of starting at 5 if child is not ready.',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/virginia',
            lastVerified,
          },
        ],
      },
    ],
    [
      State.Oklahoma,
      {
        regulationProfile: {
          level: 'low',
          description:
            'Constitutionally protected homeschooling; no notice requirement.',
        },
        compulsoryAttendance: {
          startAge: 5,
          endAge: 18,
          notes: 'Must provide 180 days of instruction.',
        },
        sources: [
          {
            name: 'HSLDA',
            url: 'https://hslda.org/post/oklahoma',
            lastVerified,
          },
        ],
      },
    ],
  ]);

  return entries.map((entry) => ({
    ...entry,
    ...overrides.get(entry.state),
  }));
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri?.trim()) {
    throw new Error(
      'MONGODB_URI is not set. Add it to .env.development.local or .env in nest-app root.',
    );
  }

  await mongoose.connect(uri);

  const SubjectModel = (mongoose.models[Subject.name] ??
    mongoose.model(Subject.name, SubjectSchema)) as Model<Subject>;

  const ComplianceModel =
    mongoose.models[StateComplianceLaws.name] ??
    mongoose.model(StateComplianceLaws.name, StateComplianceLawsSchema);

  try {
    const { ids: requiredSubjectIds, unresolved } =
      await resolveSubjectIdsByNameGroups(
        SubjectModel,
        COMMON_REQUIRED_SUBJECT_NAME_GROUPS,
      );

    if (unresolved.length > 0) {
      console.warn(
        'Warning: No subject documents matched these synonym groups — add/update subjects or adjust synonyms in script:',
      );
      unresolved.forEach((g) => console.warn('  - ', g.join(' | ')));
    }

    const selectedState = parseStateArg();
    const lastVerified = new Date().toISOString().slice(0, 10);

    /** Pure homeschooling: typically no homeschool-registration immunization gate. */
    const immunizationRequired = false;

    const allEntries = applyCuratedOverrides(
      buildBaseEntries(lastVerified),
      lastVerified,
    );
    const entriesToUpsert =
      selectedState === 'all'
        ? allEntries
        : allEntries.filter((entry) => entry.state === selectedState);

    // Parse CSV plan 1 data for new fields
    const csvPath = resolve(cwd, 'src/scripts/state-compliance-laws.csv');
    const plan1Fields = buildPlan1FieldsMap(csvPath);

    // ponytail: remove legacy documents that used full state names (e.g. "alabama") instead of abbreviations ("al")
    const validAbbreviations = Object.values(State);
    const deleteResult = await ComplianceModel.deleteMany({ state: { $nin: validAbbreviations } });
    if (deleteResult.deletedCount > 0) {
      console.log(`Removed ${deleteResult.deletedCount} legacy document(s) with non-abbreviation state values.`);
    }

    await ComplianceModel.bulkWrite(
      entriesToUpsert.map((entry) => {
        const csvData = plan1Fields.get(entry.state) ?? {
          dailyHoursRequired: null,
          yearlyHoursRequired: null,
          requiredSubjects: null,
        };

        return {
          updateOne: {
            filter: { state: entry.state },
            update: {
              $set: {
                ...entry,
                pathways: [DEFAULT_PATHWAY_MAIN],
                requiredSubjectIds,
                immunizationRequired,
                ...csvData,
              },
            },
            upsert: true,
          },
        };
      }),
    );

    console.log(
      `Upserted ${entriesToUpsert.length} ${StateComplianceLaws.name} record(s) with ${requiredSubjectIds.length} resolved subject id(s).`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
