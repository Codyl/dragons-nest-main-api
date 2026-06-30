import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite } from './favorite.entity';
import { Resource } from 'src/resources/resource.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<Favorite>,
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<Resource>,
  ) {}

  async favorite(userId: string, resourceId: string): Promise<void> {
    const resourceOid = new Types.ObjectId(resourceId);

    const resource = await this.resourceModel.exists({ _id: resourceOid });
    if (!resource) throw new NotFoundException('Resource not found');

    try {
      await this.favoriteModel.create({
        userId: new Types.ObjectId(userId),
        resourceId: resourceOid,
      });
    } catch (err: any) {
      // ponytail: duplicate key (E11000) means already favorited — idempotent no-op
      if (err?.code === 11000) return;
      throw err;
    }

    await this.resourceModel.updateOne(
      { _id: resourceOid },
      { $inc: { favoriteCount: 1 } },
    );
  }

  async unfavorite(
    userId: Types.ObjectId,
    resourceId: Types.ObjectId,
  ): Promise<void> {
    const resourceOid = new Types.ObjectId(resourceId);

    const resource = await this.resourceModel.exists({ _id: resourceOid });
    if (!resource) throw new NotFoundException('Resource not found');

    const result = await this.favoriteModel.deleteOne({
      userId,
      resourceId,
    });

    if (result.deletedCount === 0) return; // ponytail: wasn't favorited — no-op

    await this.resourceModel.updateOne(
      { _id: resourceOid, favoriteCount: { $gt: 0 } },
      { $inc: { favoriteCount: -1 } },
    );
  }
}
