import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Topic extends Document {
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

export const TopicSchema = SchemaFactory.createForClass(Topic);
