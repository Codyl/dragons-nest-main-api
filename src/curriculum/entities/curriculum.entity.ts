import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ collection: 'curriculum_items', timestamps: false })
export class CurriculumItem extends Document {
  @Prop({ required: true, maxlength: 255 })
  fileName: string;

  @Prop({ required: true, maxlength: 127 })
  mimeType: string;

  @Prop({ required: true, default: () => new Date() })
  uploadedAt: Date;

  @Prop({ required: true, maxlength: 2048 })
  url: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  })
  subjectId: Types.ObjectId;

  @Prop({ type: String, default: null, maxlength: 128 })
  managedUserId: Types.ObjectId | null;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  householdId: Types.ObjectId;
}

export const CurriculumItemSchema =
  SchemaFactory.createForClass(CurriculumItem);

CurriculumItemSchema.index(
  { subjectId: 1, householdId: 1, managedUserId: 1 },
  { name: 'curriculum_scope_idx' },
);

CurriculumItemSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.__v;

    if (obj._id) {
      obj._id = (obj._id as Types.ObjectId).toString();
    }

    if (obj.subjectId) {
      obj.subjectId = (obj.subjectId as Types.ObjectId).toString();
    }

    if (obj.householdId) {
      obj.householdId = (obj.householdId as Types.ObjectId).toString();
    }

    if (obj.uploadedAt instanceof Date) {
      obj.uploadedAt = obj.uploadedAt.toISOString();
    }

    return obj;
  },
});
