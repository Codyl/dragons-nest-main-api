import { IsMongoId } from 'class-validator';

export class FavoriteResourceDto {
  @IsMongoId({ message: 'resourceId must be a valid MongoDB ObjectId' })
  resourceId: string;
}
