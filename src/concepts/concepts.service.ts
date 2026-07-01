import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Concept } from './entities/concept.entity';
import { CreateConceptDto } from './dto/create-concept.dto';

@Injectable()
export class ConceptsService {
  constructor(
    @InjectModel(Concept.name) private readonly conceptModel: Model<Concept>,
  ) {}

  async findBySubject(subjectId: string, grade?: string, userId?: string) {
    const filter: Record<string, unknown> = {
      subject: new Types.ObjectId(subjectId),
    };
    if (grade) filter.grade = grade;

    // ponytail: return global concepts (no createdBy) + user's custom ones in a single query
    if (userId) {
      filter.$or = [
        { createdBy: { $exists: false } },
        { createdBy: null },
        { createdBy: new Types.ObjectId(userId) },
      ];
    } else {
      filter.createdBy = { $exists: false };
    }

    return this.conceptModel.find(filter).sort({ name: 1 }).lean();
  }

  async create(dto: CreateConceptDto, userId: Types.ObjectId) {
    return this.conceptModel.create({
      subject: new Types.ObjectId(dto.subjectId),
      grade: dto.grade,
      name: dto.name,
      createdBy: userId,
    });
  }
}
