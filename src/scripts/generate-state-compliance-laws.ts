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
import { existsSync } from 'fs';
import mongoose, { type Model, Types } from 'mongoose';
import { resolve } from 'path';

import type { HomeschoolPathway } from 'src/compliance/entities/state-compliance-laws.entity';
import {
  StateComplianceLaws,
  StateComplianceLawsSchema,
} from 'src/compliance/entities/state-compliance-laws.entity';
import { Subject, SubjectSchema } from 'src/subjects/subject.entity';
import { State } from 'src/users/enums/state.enum';

const cwd = process.cwd();
for (const name of ['.env.development.local', '.env']) {
  const p = resolve(cwd, name);
  if (existsSync(p)) {
    loadEnv({ path: p });
  }
}

/** Synonym groups: one topic id per group (first DB match wins). */
const COMMON_REQUIRED_TOPIC_NAME_GROUPS = [
  ['Reading'],
  ['Language Arts', 'English Language Arts', 'English'],
  ['Mathematics', 'Math'],
  ['Science'],
  ['Social Studies', 'History'],
];

async function resolveTopicIdsByNameGroups(
  topicModel: Model<Subject>,
  groups: string[][],
): Promise<{ ids: Types.ObjectId[]; unresolved: string[][] }> {
  const ids: Types.ObjectId[] = [];
  const unresolved: string[][] = [];

  for (const group of groups) {
    let found: Types.ObjectId | null = null;
    for (const name of group) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const doc = await topicModel
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

  const TopicModel = (mongoose.models[Subject.name] ??
    mongoose.model(Subject.name, SubjectSchema)) as Model<Subject>;

  const ComplianceModel =
    mongoose.models[StateComplianceLaws.name] ??
    mongoose.model(StateComplianceLaws.name, StateComplianceLawsSchema);

  try {
    const { ids: subjectsRequiredTopicIds, unresolved } =
      await resolveTopicIdsByNameGroups(
        TopicModel,
        COMMON_REQUIRED_TOPIC_NAME_GROUPS,
      );

    if (unresolved.length > 0) {
      console.warn(
        'Warning: No topic documents matched these synonym groups — add/update `topics` or adjust synonyms in script:',
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

    await ComplianceModel.bulkWrite(
      entriesToUpsert.map((entry) => ({
        updateOne: {
          filter: { state: entry.state },
          update: {
            $set: {
              ...entry,
              pathways: [DEFAULT_PATHWAY_MAIN],
              subjectsRequiredTopicIds,
              immunizationRequired,
            },
          },
          upsert: true,
        },
      })),
    );

    console.log(
      `Upserted ${entriesToUpsert.length} ${StateComplianceLaws.name} record(s) with ${subjectsRequiredTopicIds.length} resolved topic id(s).`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
