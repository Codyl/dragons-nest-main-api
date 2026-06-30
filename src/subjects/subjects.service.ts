import { Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Subject } from './subject.entity';
import { Activity } from 'src/activities/activity.entity';
import { CurriculumItem } from 'src/curriculum/entities/curriculum.entity';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name) private readonly subjectModel: Model<Subject>,
    @InjectModel(Activity.name) private readonly activityModel: Model<Activity>,
    @InjectModel(CurriculumItem.name)
    private readonly curriculumItemModel: Model<CurriculumItem>,
  ) {}

  async getSubjects() {
    return this.subjectModel.find();
  }

  async getSummary(subjectId: Types.ObjectId, studentId: Types.ObjectId) {
    // Week boundaries: Monday 00:00 UTC to Sunday 23:59:59 UTC
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun,1=Mon...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + diffToMonday,
      ),
    );
    const sunday = new Date(
      Date.UTC(
        monday.getUTCFullYear(),
        monday.getUTCMonth(),
        monday.getUTCDate() + 6,
        23,
        59,
        59,
        999,
      ),
    );

    // ponytail: single aggregation instead of pulling all activities into memory.
    // Computes most practiced concept (with name via $lookup), weekly time, and avg difficulty in one pass.
    const [result] = await this.activityModel.aggregate<{
      mostPracticedConcept: string | null;
      weekMinutes: number;
      avgDifficulty: number | null;
    }>([
      { $match: { subjectId, studentId } },
      {
        $facet: {
          // Most practiced concept by session count
          topConcept: [
            { $group: { _id: '$conceptId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: 'concepts',
                localField: '_id',
                foreignField: '_id',
                as: 'concept',
              },
            },
            {
              $project: {
                name: {
                  $ifNull: [
                    { $arrayElemAt: ['$concept.name', 0] },
                    { $toString: '$_id' },
                  ],
                },
              },
            },
          ],
          // Total time this week
          weekTime: [
            { $match: { date: { $gte: monday, $lte: sunday } } },
            { $group: { _id: null, total: { $sum: '$timeSpentMinutes' } } },
          ],
          // Average difficulty (Easy=1, Medium=2, Hard=3)
          difficulty: [
            {
              $group: {
                _id: null,
                avg: {
                  $avg: {
                    $switch: {
                      branches: [
                        { case: { $eq: ['$difficulty', 'Easy'] }, then: 1 },
                        { case: { $eq: ['$difficulty', 'Medium'] }, then: 2 },
                        { case: { $eq: ['$difficulty', 'Hard'] }, then: 3 },
                      ],
                      default: 0,
                    },
                  },
                },
              },
            },
          ],
        },
      },
      {
        $project: {
          mostPracticedConcept: {
            $ifNull: [{ $arrayElemAt: ['$topConcept.name', 0] }, null],
          },
          weekMinutes: {
            $ifNull: [{ $arrayElemAt: ['$weekTime.total', 0] }, 0],
          },
          avgDifficulty: {
            $ifNull: [{ $arrayElemAt: ['$difficulty.avg', 0] }, null],
          },
        },
      },
    ]);

    if (!result || result.avgDifficulty === null) {
      return {
        mostPracticedConcept: null,
        totalTimeThisWeek: { hours: 0, minutes: 0 },
        averageDifficulty: null,
      };
    }

    const totalTimeThisWeek = {
      hours: Math.floor(result.weekMinutes / 60),
      minutes: result.weekMinutes % 60,
    };

    const averageDifficulty: 'Low' | 'Medium' | 'High' =
      result.avgDifficulty < 1.5
        ? 'Low'
        : result.avgDifficulty > 2.5
          ? 'High'
          : 'Medium';

    return {
      mostPracticedConcept: result.mostPracticedConcept,
      totalTimeThisWeek,
      averageDifficulty,
    };
  }

  async getConcepts(
    subjectId: Types.ObjectId,
    studentId: Types.ObjectId,
    limit: number,
  ) {
    const cap = Math.min(Math.max(limit, 1), 50);

    const concepts = await this.activityModel.aggregate<{
      _id: string;
      name: string;
      difficulty: 'Easy' | 'Medium' | 'Hard';
      totalMinutes: number;
      progressPercent: number;
      sessionCount: number;
      lastSessionDate: string | null;
    }>([
      { $match: { subjectId, studentId } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$conceptId',
          totalMinutes: { $sum: '$timeSpentMinutes' },
          sessionCount: { $sum: 1 },
          lastSessionDate: { $max: '$date' },
          difficulty: { $first: '$difficulty' }, // ponytail: last recorded difficulty (sorted desc by date, so $first = most recent)
        },
      },
      {
        $lookup: {
          localField: '_id',
          foreignField: '_id',
          as: 'concept',
          from: 'concepts',
        },
      },
      { $sort: { totalMinutes: -1 } },
      { $limit: cap },
      {
        $project: {
          _id: { $toString: '$_id' },
          concept: { $arrayElemAt: ['$concept', 0] },
          difficulty: 1,
          totalMinutes: 1,
          progressPercent: { $literal: 0 }, // ponytail: no enrollment targets yet. Upgrade path: add concept enrollment with session targets.
          sessionCount: 1,
          lastSessionDate: {
            $dateToString: {
              format: '%Y-%m-%dT%H:%M:%S.%LZ',
              date: '$lastSessionDate',
            },
          },
        },
      },
    ]);

    return concepts;
  }

  async getStats(
    subjectId: Types.ObjectId,
    studentId: string,
    householdId: string,
  ) {
    const [timeResult, documentsCount] = await Promise.all([
      this.activityModel.aggregate<{ totalMinutes: number }>([
        { $match: { subjectId, studentId } },
        { $group: { _id: null, totalMinutes: { $sum: '$timeSpentMinutes' } } },
      ]),
      this.curriculumItemModel.countDocuments({
        subjectId,
        householdId: new Types.ObjectId(householdId),
        studentId,
      }),
    ]);

    const totalMinutes = timeResult[0]?.totalMinutes ?? 0;
    const hoursCompleted = +(totalMinutes / 60).toFixed(1);
    // ponytail: hoursTarget=0, standardsMet/standardsTotal=0 — no schema supports these yet.
    // Upgrade path: add a SubjectEnrollment entity with target hours + standards tracking.
    const hoursTarget = 0;
    const standardsMet = 0;
    const standardsTotal = 0;
    const progressPercent =
      hoursTarget > 0
        ? Math.min(100, Math.round((hoursCompleted / hoursTarget) * 100))
        : 0;

    return {
      progressPercent,
      hoursCompleted,
      hoursTarget,
      standardsMet,
      standardsTotal,
      documentsCount,
    };
  }
}
