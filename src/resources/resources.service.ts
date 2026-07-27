import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Resource } from './resource.entity';
import { Favorite } from 'src/favorites/favorite.entity';
import { CreateResourceDto } from './dto/create-resource.dto';

export interface PaginatedResources {
  data: Array<{
    _id: string;
    title: string;
    description: string;
    subjectName: string;
    favoriteCount: number;
    isFavoritedByCurrentUser: boolean;
  }>;
  pagination: { total: number; page: number; limit: number };
}

@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(Resource.name)
    private readonly resourceModel: Model<Resource>,
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<Favorite>,
  ) {}

  async findPaginated(
    subjectId: Types.ObjectId,
    page = 1,
    limit = 10,
    search?: string,
    userId?: string,
  ): Promise<PaginatedResources> {
    // ponytail: clamp inline, no helper needed
    page = Math.max(1, page);
    limit = Math.min(50, Math.max(1, limit));

    const filter: Record<string, unknown> = { subjectId };
    if (search) {
      filter.$text = { $search: search };
    }

    const total = await this.resourceModel.countDocuments(filter);
    const skip = (page - 1) * limit;

    const resources = await this.resourceModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Annotate isFavoritedByCurrentUser
    let favoritedIds = new Set<string>();
    if (userId && resources.length > 0) {
      const resourceIds = resources.map((r) => r._id);
      const favorites = await this.favoriteModel
        .find({
          userId: new Types.ObjectId(userId),
          resourceId: { $in: resourceIds },
        })
        .lean();
      favoritedIds = new Set(favorites.map((f) => f.resourceId.toString()));
    }

    const data = resources.map((r) => ({
      _id: r._id.toString(),
      title: r.title,
      description: r.description,
      subjectName: r.subjectName,
      favoriteCount: r.favoriteCount,
      isFavoritedByCurrentUser: favoritedIds.has(r._id.toString()),
    }));

    return { data, pagination: { total, page, limit } };
  }

  create(dto: CreateResourceDto, userId: Types.ObjectId) {
    return this.resourceModel.create({
      title: dto.title,
      description: dto.description,
      subjectId: new Types.ObjectId(dto.subjectId),
      subjectName: dto.subjectName,
      createdBy: userId,
    });
  }

  get({
    createdBy,
    subjectId,
  }: {
    createdBy: Types.ObjectId;
    subjectId: Types.ObjectId;
  }) {
    return this.resourceModel.find({
      createdBy,
      subjectId,
    });
  }
}
