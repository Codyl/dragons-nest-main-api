import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity } from './activity.entity';
import { Concept } from 'src/concepts/entities/concept.entity';

const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

export interface CreateActivityDto {
  subjectId: string;
  managedUserId: string;
  date: string;
  conceptId: string;
  difficulty: string;
  timeSpentMinutes: number;
  notes?: string | undefined;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
    @InjectModel(Concept.name) private conceptModel: Model<Concept>,
  ) {}

  async findBySubjectAndManagedUser(subjectId: string, managedUserId: string) {
    return this.activityModel
      .find({ subjectId, managedUserId })
      .sort({ date: -1 })
      .exec();
  }

  // ponytail: returns all activities for a managed user (used by compliance hours computation)
  async findByManagedUser(managedUserId: string) {
    return this.activityModel.find({ managedUserId }).sort({ date: -1 }).exec();
  }

  async create(dto: CreateActivityDto, householdId: string) {
    // Validate difficulty
    if (
      !VALID_DIFFICULTIES.includes(
        dto.difficulty as (typeof VALID_DIFFICULTIES)[number],
      )
    ) {
      throw new BadRequestException(
        'difficulty must be one of: Easy, Medium, Hard',
      );
    }

    // Validate timeSpentMinutes
    if (
      !Number.isInteger(dto.timeSpentMinutes) ||
      dto.timeSpentMinutes < 1 ||
      dto.timeSpentMinutes > 1440
    ) {
      throw new BadRequestException(
        'timeSpentMinutes must be a positive integer no greater than 1440',
      );
    }

    // Validate date not in the future
    const activityDate = new Date(dto.date);
    if (isNaN(activityDate.getTime())) {
      throw new BadRequestException('date must be a valid ISO 8601 date');
    }

    // ponytail: compare date-only (start of next day) so same-day UTC entries pass
    const startOfTomorrow = new Date();
    startOfTomorrow.setHours(23, 59, 59, 999);
    if (activityDate > startOfTomorrow) {
      throw new BadRequestException('date must not be in the future');
    }

    const concept = await this.conceptModel.findById(dto.conceptId);
    if (!concept) {
      throw new BadRequestException('Unable to find concept');
    }

    return this.activityModel.create({
      subjectId: new Types.ObjectId(dto.subjectId),
      managedUserId: dto.managedUserId,
      householdId: new Types.ObjectId(householdId),
      date: activityDate,
      conceptId: new Types.ObjectId(dto.conceptId),
      conceptName: concept.name,
      difficulty: dto.difficulty,
      timeSpentMinutes: dto.timeSpentMinutes,
      notes: dto.notes,
    });
  }

  async delete(activityId: string, householdId: string) {
    const activity = await this.activityModel.findById(activityId).exec();
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    if (!activity.householdId.equals(new Types.ObjectId(householdId))) {
      throw new ForbiddenException('Forbidden');
    }

    await activity.deleteOne();
  }
}
