import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { State } from 'src/users/enums/state.enum';
import { HOMESCHOOL_GRADE_ORDINALS } from 'src/users/utils/homeschool-grade-order';

@Schema({ collection: 'concepts', timestamps: true })
export class Concept extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  })
  subject: Types.ObjectId;

  @Prop({ enum: HOMESCHOOL_GRADE_ORDINALS, required: true })
  grade: string;

  @Prop({ enum: State })
  state: string;

  @Prop({ required: true })
  name: string;
}

export type ConceptDocument = Concept & Document;

export const ConceptSchema = SchemaFactory.createForClass(Concept);

ConceptSchema.index({ subject: 1, grade: 1 });
