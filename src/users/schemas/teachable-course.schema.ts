import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import mongoose, { Types } from 'mongoose';
import { HomeschoolGrade } from '../enums/homeschool-grade.enum';
import { HomeschoolCurriculum } from '../enums/homeschool-curriculum.enum';

/**
 * Embedded course descriptor: catalog subject from {@link Subject};
 * grade and curriculum are fixed enums. Not a standalone collection.
 */
@Schema({ _id: false })
export class TeachableCourse {
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

  @ApiProperty({ enum: HomeschoolGrade })
  @Prop({
    type: String,
    enum: Object.values(HomeschoolGrade),
    required: true,
  })
  grade!: HomeschoolGrade;

  @ApiProperty({ enum: HomeschoolCurriculum })
  @Prop({
    type: String,
    enum: Object.values(HomeschoolCurriculum),
    required: true,
  })
  curriculum!: HomeschoolCurriculum;
}

export const TeachableCourseSchema =
  SchemaFactory.createForClass(TeachableCourse);
