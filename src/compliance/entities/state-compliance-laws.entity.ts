import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';
import { Subject } from 'src/subjects/subject.entity';
import { State } from 'src/users/enums/state.enum';

/** Boolean or `"varies"` — stored as Mixed for statute flexibility. */
export type BooleanOrVaries = boolean | 'varies';

const mixedRequired = {
  type: MongooseSchema.Types.Mixed,
  required: true,
} as const;

@Schema({ _id: false })
export class CompliancePathwaySubjectItem {
  @ApiProperty()
  @Prop({ type: String, required: true })
  name!: string;

  @ApiPropertyOptional()
  @Prop({ type: String })
  mandatoryGrades?: string;

  @ApiPropertyOptional()
  @Prop({ type: String })
  notes?: string;
}

export const CompliancePathwaySubjectItemSchema = SchemaFactory.createForClass(
  CompliancePathwaySubjectItem,
);

@Schema({ _id: false })
export class ComplianceParentRequirements {
  @ApiProperty()
  @Prop(mixedRequired)
  degreeRequired!: BooleanOrVaries;

  @ApiProperty({
    enum: ['none', 'high_school', 'college', 'teacher_cert', 'varies'],
  })
  @Prop({
    type: String,
    required: true,
    enum: ['none', 'high_school', 'college', 'teacher_cert', 'varies'],
  })
  minimumEducationLevel!:
    | 'none'
    | 'high_school'
    | 'college'
    | 'teacher_cert'
    | 'varies';

  @ApiProperty()
  @Prop(mixedRequired)
  backgroundCheck!: BooleanOrVaries;
}

export const ComplianceParentRequirementsSchema = SchemaFactory.createForClass(
  ComplianceParentRequirements,
);

@Schema({ _id: false })
export class ComplianceNotification {
  @ApiProperty()
  @Prop({ type: Boolean, required: true })
  required!: boolean;

  @ApiProperty({ enum: ['none', 'once', 'annual'] })
  @Prop({
    type: String,
    required: true,
    enum: ['none', 'once', 'annual'],
  })
  frequency!: 'none' | 'once' | 'annual';

  @ApiProperty({ enum: ['state', 'district', 'school', 'none'] })
  @Prop({
    type: String,
    required: true,
    enum: ['state', 'district', 'school', 'none'],
  })
  to!: 'state' | 'district' | 'school' | 'none';
}

export const ComplianceNotificationSchema = SchemaFactory.createForClass(
  ComplianceNotification,
);

@Schema({ _id: false })
export class ComplianceRequiredSubjects {
  @ApiProperty()
  @Prop({ type: Boolean, required: true })
  required!: boolean;

  @ApiProperty({ type: [CompliancePathwaySubjectItem] })
  @Prop({
    type: [CompliancePathwaySubjectItemSchema],
    default: [],
  })
  subjects!: CompliancePathwaySubjectItem[];
}

export const ComplianceRequiredSubjectsSchema = SchemaFactory.createForClass(
  ComplianceRequiredSubjects,
);

@Schema({ _id: false })
export class ComplianceAssessment {
  @ApiProperty()
  @Prop({ type: Boolean, required: true })
  required!: boolean;

  @ApiProperty({ enum: ['none', 'test', 'portfolio', 'evaluation', 'hybrid'] })
  @Prop({
    type: String,
    required: true,
    enum: ['none', 'test', 'portfolio', 'evaluation', 'hybrid'],
  })
  type!: 'none' | 'test' | 'portfolio' | 'evaluation' | 'hybrid';

  @ApiProperty({ enum: ['none', 'annual', 'periodic'] })
  @Prop({
    type: String,
    required: true,
    enum: ['none', 'annual', 'periodic'],
  })
  frequency!: 'none' | 'annual' | 'periodic';

  @ApiProperty()
  @Prop({ type: Boolean, required: true })
  submittedToState!: boolean;
}

export const ComplianceAssessmentSchema =
  SchemaFactory.createForClass(ComplianceAssessment);

@Schema({ _id: false })
export class ComplianceRecordKeeping {
  @ApiProperty()
  @Prop({ type: Boolean, required: true })
  required!: boolean;

  @ApiProperty({ type: [String] })
  @Prop({ type: [String], default: [] })
  details!: string[];
}

export const ComplianceRecordKeepingSchema = SchemaFactory.createForClass(
  ComplianceRecordKeeping,
);

@Schema({ _id: false })
export class ComplianceInstructionRequirements {
  @ApiPropertyOptional()
  @Prop({ type: Number })
  hoursPerYear?: number;

  @ApiPropertyOptional()
  @Prop({ type: Number })
  daysPerYear?: number;

  @ApiPropertyOptional()
  @Prop({ type: String })
  equivalencyStandard?: string;
}

export const ComplianceInstructionRequirementsSchema =
  SchemaFactory.createForClass(ComplianceInstructionRequirements);

@Schema({ _id: false })
export class ComplianceTeacherQualification {
  @ApiProperty()
  @Prop({ type: Boolean, required: true })
  required!: boolean;

  @ApiPropertyOptional()
  @Prop({ type: String })
  description?: string;
}

export const ComplianceTeacherQualificationSchema =
  SchemaFactory.createForClass(ComplianceTeacherQualification);

@Schema({ _id: false })
export class ComplianceDiplomaAuthority {
  @ApiProperty()
  @Prop({ type: Boolean, required: true })
  parentIssued!: boolean;

  @ApiProperty()
  @Prop({ type: Boolean, required: true })
  stateRecognized!: boolean;
}

export const ComplianceDiplomaAuthoritySchema = SchemaFactory.createForClass(
  ComplianceDiplomaAuthority,
);

@Schema({ _id: false })
export class HomeschoolPathway {
  @ApiProperty()
  @Prop({ type: String, required: true })
  name!: string;

  @ApiProperty({ type: ComplianceParentRequirements })
  @Prop({ type: ComplianceParentRequirementsSchema, required: true })
  parentRequirements!: ComplianceParentRequirements;

  @ApiProperty({ type: ComplianceNotification })
  @Prop({ type: ComplianceNotificationSchema, required: true })
  notification!: ComplianceNotification;

  @ApiProperty({ type: ComplianceRequiredSubjects })
  @Prop({ type: ComplianceRequiredSubjectsSchema, required: true })
  requiredSubjects!: ComplianceRequiredSubjects;

  @ApiProperty({ type: ComplianceAssessment })
  @Prop({ type: ComplianceAssessmentSchema, required: true })
  assessment!: ComplianceAssessment;

  @ApiProperty({ type: ComplianceRecordKeeping })
  @Prop({ type: ComplianceRecordKeepingSchema, required: true })
  recordKeeping!: ComplianceRecordKeeping;

  @ApiProperty({ type: ComplianceInstructionRequirements })
  @Prop({
    type: ComplianceInstructionRequirementsSchema,
    required: true,
  })
  instructionRequirements!: ComplianceInstructionRequirements;

  @ApiProperty({ type: ComplianceTeacherQualification })
  @Prop({ type: ComplianceTeacherQualificationSchema, required: true })
  teacherQualification!: ComplianceTeacherQualification;

  @ApiProperty({ type: ComplianceDiplomaAuthority })
  @Prop({ type: ComplianceDiplomaAuthoritySchema, required: true })
  diplomaAuthority!: ComplianceDiplomaAuthority;
}

export const HomeschoolPathwaySchema =
  SchemaFactory.createForClass(HomeschoolPathway);

@Schema({ _id: false })
export class ComplianceRegulationProfile {
  @ApiProperty({ enum: ['none', 'low', 'moderate', 'high'] })
  @Prop({
    type: String,
    required: true,
    enum: ['none', 'low', 'moderate', 'high'],
  })
  level!: 'none' | 'low' | 'moderate' | 'high';

  @ApiProperty()
  @Prop({ type: String, required: true })
  description!: string;
}

export const ComplianceRegulationProfileSchema = SchemaFactory.createForClass(
  ComplianceRegulationProfile,
);

@Schema({ _id: false })
export class CompulsoryAttendanceAges {
  @ApiProperty({
    description: 'Lower bound of compulsory education age (years).',
  })
  @Prop({ type: Number, required: true })
  startAge!: number;

  @ApiProperty({
    description: 'Upper bound of compulsory education age (years).',
  })
  @Prop({ type: Number, required: true })
  endAge!: number;

  @ApiPropertyOptional({
    description: 'Exceptions, caveats, or statute references.',
  })
  @Prop({ type: String })
  notes?: string;
}

export const CompulsoryAttendanceAgesSchema = SchemaFactory.createForClass(
  CompulsoryAttendanceAges,
);

@Schema({ _id: false })
export class ComplianceSource {
  @ApiProperty({ enum: ['HSLDA', 'DOE', 'statute', 'other'] })
  @Prop({
    type: String,
    required: true,
    enum: ['HSLDA', 'DOE', 'statute', 'other'],
  })
  name!: 'HSLDA' | 'DOE' | 'statute' | 'other';

  @ApiProperty()
  @Prop({ type: String, required: true })
  url!: string;

  @ApiProperty({ description: 'ISO date when information was last reviewed.' })
  @Prop({ type: String, required: true })
  lastVerified!: string;
}

export const ComplianceSourceSchema =
  SchemaFactory.createForClass(ComplianceSource);

/**
 * Per-state homeschool compliance: structured pathways plus app-oriented fields
 * (topic IDs for default required subjects, compulsory ages, immunization prompt flag).
 */
@Schema({ collection: 'state_compliance_laws' })
export class StateComplianceLaws extends Document {
  @ApiProperty({ enum: State })
  @Prop({
    type: String,
    enum: Object.keys(State),
    required: true,
    unique: true,
  })
  state!: State;

  @ApiProperty({ example: 'ID' })
  @Prop({ type: String, required: true })
  abbreviation!: string;

  @ApiProperty({ type: ComplianceRegulationProfile })
  @Prop({ type: ComplianceRegulationProfileSchema, required: true })
  regulationProfile!: ComplianceRegulationProfile;

  @ApiProperty({ type: CompulsoryAttendanceAges })
  @Prop({ type: CompulsoryAttendanceAgesSchema, required: true })
  compulsoryAttendance!: CompulsoryAttendanceAges;

  @ApiProperty({
    type: [String],
    description:
      'Topic catalog ids (`topics` collection / Subject); clients add these subjects to students by default when required.',
  })
  @Prop({
    type: [{ type: Types.ObjectId, ref: Subject.name }],
    default: [],
  })
  subjectsRequiredTopicIds!: Types.ObjectId[];

  @ApiProperty({ type: [HomeschoolPathway] })
  @Prop({
    type: [HomeschoolPathwaySchema],
    default: [],
  })
  pathways!: HomeschoolPathway[];

  @ApiProperty({ type: [ComplianceSource] })
  @Prop({
    type: [ComplianceSourceSchema],
    default: [],
  })
  sources!: ComplianceSource[];

  @ApiProperty({
    description:
      'When true, the app prompts guardians to confirm they addressed immunization/health rules.',
  })
  @Prop({ type: Boolean, default: false })
  immunizationRequired!: boolean;
}

export type StateComplianceLawsDocument = HydratedDocument<StateComplianceLaws>;

export const StateComplianceLawsSchema =
  SchemaFactory.createForClass(StateComplianceLaws);
