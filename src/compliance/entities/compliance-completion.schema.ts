import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'compliance_completions' })
export class ComplianceCompletionRecord extends Document {
  @Prop({ type: String, required: true })
  managerId!: string;

  @Prop({ type: String, required: true })
  managedUserId!: string;

  @Prop({ type: String, required: true })
  state!: string;

  @Prop({ type: Map, of: Boolean, default: {} })
  items!: Map<string, boolean>;
}

export const ComplianceCompletionRecordSchema = SchemaFactory.createForClass(
  ComplianceCompletionRecord,
);

ComplianceCompletionRecordSchema.index(
  { managerId: 1, managedUserId: 1, state: 1 },
  { unique: true },
);
