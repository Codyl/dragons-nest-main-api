import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Concept } from './entities/concept.entity';

@Injectable()
export class ConceptsService {
  constructor(
    @InjectModel(Concept.name) private readonly conceptModel: Model<Concept>,
  ) {}

  async findBySubject(subjectId: string, grade?: string) {
    const filter: Record<string, unknown> = {
      subject: new Types.ObjectId(subjectId),
    };
    if (grade) filter.grade = grade;

    return this.conceptModel.find(filter).sort({ name: 1 }).lean();
  }
}
