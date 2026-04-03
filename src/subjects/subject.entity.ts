import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Catalog of teachable subject lines; stored in Mongo as `topics` for backward compatibility. */
@Schema({ collection: 'topics' })
export class Subject extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  icon: string;

  @Prop({ required: true })
  color: string;

  @Prop({ required: true })
  slug: string;

  @Prop({ required: true })
  isEnrichment: boolean;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);
