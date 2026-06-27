import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import mongoose, { Types } from 'mongoose';
import { HomeschoolGrade } from '../enums/homeschool-grade.enum';
import { HomeschoolCurriculum } from '../enums/homeschool-curriculum.enum';

/**
 * Embedded course descriptor: catalog subject from {@link Subject};
 * grade and curriculum are fixed enums. Not a standalone collection.
 *
 * `_id: true` is intentional — each embedded course gets a stable ObjectId
 * so that enrollment records can reference it by ID for active-enrollment
 * count lookups.
 */
@Schema({ _id: true })
export class TeachableCourse {
  @ApiProperty({
    description: 'Display name for this offering (from onboarding).',
    required: false,
  })
  @Prop({ type: String, required: false, default: '', trim: true })
  className?: string;

  @ApiProperty({
    description:
      'Subject catalog id (references a Subject document in the subjects API / topics collection).',
    type: String,
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  })
  subjectId!: Types.ObjectId;

  @ApiProperty({
    enum: HomeschoolGrade,
    isArray: true,
    description: 'Target grades when matchesAllGrades is false.',
  })
  @Prop({
    type: [String],
    default: [],
  })
  grades?: HomeschoolGrade[];

  @ApiProperty({
    description: 'When true, offering applies to all grade levels.',
    default: false,
  })
  @Prop({ type: Boolean, default: false })
  matchesAllGrades?: boolean;

  @ApiProperty({ enum: HomeschoolCurriculum })
  @Prop({
    type: String,
    enum: Object.values(HomeschoolCurriculum),
    required: true,
  })
  curriculum!: HomeschoolCurriculum;

  @ApiProperty({
    description: 'Maximum concurrent students for this offering (onboarding).',
    minimum: 1,
    maximum: 20,
    required: false,
  })
  @Prop({ type: Number, required: false, min: 1, max: 20 })
  maxStudents?: number;

  // ponytail: denormalized counter — maintained at enroll/unenroll write time.
  // Ceiling: can drift if a mutation path is missed; reconcile via admin script.
  @ApiProperty({
    description:
      'Current number of students enrolled in this course (denormalized counter).',
    default: 0,
  })
  @Prop({ type: Number, default: 0 })
  activeEnrollmentCount?: number;
}

export const TeachableCourseSchema =
  SchemaFactory.createForClass(TeachableCourse);
