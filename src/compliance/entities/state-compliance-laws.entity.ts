import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';
import { State } from 'src/users/enums/state.enum';

/**
 * Per-state homeschool / education compliance metadata for UI (subjects, teacher
 * requirements, barriers). Seeded or maintained separately; not user-editable in-app initially.
 */
@Schema({ collection: 'state_compliance_laws' })
export class StateComplianceLaws extends Document {
  @ApiProperty({
    enum: State,
    description: 'US state this row applies to (unique).',
  })
  @Prop({
    type: String,
    enum: Object.values(State),
    required: true,
    unique: true,
  })
  state!: State;

  @ApiProperty({
    type: [String],
    description:
      'Teacher/parent qualification rules to surface (e.g. credentials, affidavits).',
  })
  @Prop({ type: [String], default: [] })
  teacherQualificationsRequired!: string[];

  @ApiProperty({
    type: [String],
    description: 'Subject areas that must be covered or reported.',
  })
  @Prop({ type: [String], default: [] })
  subjectsRequired!: string[];

  @ApiProperty({
    type: [String],
    description: 'Recordkeeping / portfolio requirements.',
  })
  @Prop({ type: [String], default: [] })
  recordsRequired!: string[];

  @ApiProperty({
    type: [String],
    description: 'Testing or evaluation requirements.',
  })
  @Prop({ type: [String], default: [] })
  evaluationsRequired!: string[];

  @ApiProperty({
    description:
      'Whether the state expects notification of intent to homeschool (or similar).',
  })
  @Prop({ type: Boolean, default: false })
  isNotificationRequired!: boolean;

  @ApiProperty({
    type: [String],
    description:
      'Age-related rules (e.g. compulsory attendance ages); free-form strings for UI gating.',
  })
  @Prop({ type: [String], default: [] })
  agesRequired!: string[];

  @ApiProperty({
    type: [String],
    description: 'Immunization or health documentation requirements.',
  })
  @Prop({ type: [String], default: [] })
  immunizationsRequired!: string[];
}

export const StateComplianceLawsSchema =
  SchemaFactory.createForClass(StateComplianceLaws);
