import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

@Schema({ collection: 'favorites', timestamps: true })
export class Favorite extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Resource',
    required: true,
  })
  resourceId: Types.ObjectId;
}

export type FavoriteDocument = HydratedDocument<Favorite>;

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Unique compound index: a user can favorite a resource only once
FavoriteSchema.index({ userId: 1, resourceId: 1 }, { unique: true });
