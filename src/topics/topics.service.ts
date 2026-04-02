import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { Topic } from './topic.entity';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class TopicsService {
  constructor(
    @InjectModel(Topic.name) private readonly topicModel: Model<Topic>,
  ) {}

  async getTopics() {
    return this.topicModel.find();
  }
}
