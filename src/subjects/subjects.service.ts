import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { Subject } from './subject.entity';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name) private readonly subjectModel: Model<Subject>,
  ) {}

  async getSubjects() {
    return this.subjectModel.find();
  }
}
