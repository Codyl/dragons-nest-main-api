import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ collection: 'resources', timestamps: true })
export class Resource extends Document {
  @Prop({ required: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, maxlength: 2000 })
  description: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  })
  subjectId: Types.ObjectId;

  @Prop({ required: true, maxlength: 50 })
  subjectName: string;

  @Prop({ default: 0, min: 0 })
  favoriteCount: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);

ResourceSchema.index({ subjectId: 1, createdAt: -1 });
ResourceSchema.index({ title: 'text', description: 'text' });
