import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ collection: 'activities', timestamps: true })
export class Activity extends Document {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  })
  subjectId: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' })
  studentId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  householdId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Concept',
    required: true,
  })
  conceptId: Types.ObjectId;

  @Prop({ required: true, enum: ['Easy', 'Medium', 'Hard'] })
  difficulty: string;

  @Prop({ required: true, min: 1, max: 1440 })
  timeSpentMinutes: number;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

ActivitySchema.index({ subjectId: 1, studentId: 1, date: -1 });
