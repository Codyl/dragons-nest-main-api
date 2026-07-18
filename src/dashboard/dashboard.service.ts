import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity } from 'src/activities/activity.entity';
import { Concept } from 'src/concepts/entities/concept.entity';
import { Subject } from 'src/subjects/subject.entity';
import { User } from 'src/users/entities/user.schema';
import { DashboardResponse } from './dto/dashboard-response.dto';
import {
  computeActivityFrequency,
  computeAverageHoursPerDay,
  computeConceptMastery,
  computeStrugglingConcepts,
  computeMissingAttendanceDays,
  computeOverdueSubjects,
  computePortfolioUpdatesNeeded,
  computePerformanceStatus,
  computeLetterGrade,
  sortTestScores,
  type ConceptActivities,
} from './dashboard.helpers';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
    @InjectModel(Concept.name) private conceptModel: Model<Concept>,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async getDashboard(
    managedUserId: string,
    managerId: string,
    startDate: string,
    endDate: string,
  ): Promise<DashboardResponse> {
    const managedUserOid = new Types.ObjectId(managedUserId);
    const managerOid = new Types.ObjectId(managerId);

    // Run all queries in parallel
    const [rangeActivities, monthActivities, curriculumSubjects, managerDoc] =
      await Promise.all([
        this.getActivitiesInRange(managedUserOid, startDate, endDate),
        this.getActivitiesInCurrentMonth(managedUserOid),
        this.getCurriculumSubjects(managedUserOid),
        this.userModel.findById(managerOid).select('testScores').lean(),
      ]);

    // Activity frequency
    const activityRecords = rangeActivities.map((a) => ({
      date: a.date.toISOString().slice(0, 10),
      timeSpentMinutes: a.timeSpentMinutes,
    }));
    const activityFrequency = computeActivityFrequency(
      activityRecords,
      startDate,
      endDate,
    );
    const averageHoursPerDay = computeAverageHoursPerDay(activityFrequency);

    // Concept mastery & struggling (current month)
    const conceptMap = await this.buildConceptMap(monthActivities);
    const conceptsMasteredCount = computeConceptMastery(conceptMap);
    const strugglingConcepts = computeStrugglingConcepts(conceptMap);

    // Compliance concerns
    const allActivityDates = new Set(activityRecords.map((a) => a.date));
    // ponytail: school year = Aug 1 of current/prev year to Jun 30 of current/next year
    const schoolYear = this.getSchoolYearRange();
    const missingAttendanceDays = computeMissingAttendanceDays(
      allActivityDates,
      schoolYear,
    );

    const allActivitiesForCompliance = rangeActivities.map((a) => ({
      subjectId: a.subjectId?.toString(),
      date: a.date.toISOString().slice(0, 10),
    }));
    const today = new Date().toISOString().slice(0, 10);
    const overdueSubjects = computeOverdueSubjects(
      curriculumSubjects,
      allActivitiesForCompliance,
      today,
    );
    const overdueSet = new Set(overdueSubjects);
    const portfolioUpdatesNeeded = computePortfolioUpdatesNeeded(
      curriculumSubjects,
      allActivitiesForCompliance,
      overdueSet,
      today,
    );

    // Performance status
    const performanceStatus = computePerformanceStatus(
      averageHoursPerDay,
      conceptsMasteredCount,
    );

    // Recent test scores
    const allScores = (managerDoc?.testScores ?? [])
      .filter((s) => s.managedUserId.equals(managedUserOid))
      .map((s) => ({
        subjectName: s.subjectName,
        score: s.score,
        letterGrade: computeLetterGrade(s.score),
        date: s.date.toISOString().slice(0, 10),
      }));
    const recentTestScores = sortTestScores(allScores);

    return {
      performanceStatus,
      activityFrequency,
      averageHoursPerDay,
      conceptsMasteredCount,
      complianceConcerns: {
        missingAttendanceDays,
        overdueSubjects,
        portfolioUpdatesNeeded,
      },
      strugglingConcepts,
      recentTestScores,
    };
  }

  private async getActivitiesInRange(
    managedUserId: Types.ObjectId,
    startDate: string,
    endDate: string,
  ) {
    return this.activityModel
      .find({
        managedUserId,
        date: {
          $gte: new Date(startDate + 'T00:00:00.000Z'),
          $lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      })
      .lean()
      .exec();
  }

  private async getActivitiesInCurrentMonth(managedUserId: Types.ObjectId) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = new Date(
      Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    );

    return this.activityModel
      .find({
        managedUserId,
        date: { $gte: monthStart, $lte: monthEnd },
      })
      .populate('conceptId', 'name')
      .lean()
      .exec();
  }

  private async getCurriculumSubjects(
    managedUserId: Types.ObjectId,
  ): Promise<{ id: string; name: string }[]> {
    // ponytail: The managed user's addedClasses contains the curriculum subjects
    const managedUser = await this.userModel
      .findById(managedUserId)
      .select('addedClasses')
      .populate('addedClasses.subjectId', 'name')
      .lean();

    if (!managedUser?.addedClasses?.length) return [];

    return managedUser.addedClasses
      .filter((c) => c.subjectId != null)
      .map((c) => {
        const subject = c.subjectId as unknown as {
          _id: Types.ObjectId;
          name: string;
        };
        return { id: subject._id.toString(), name: subject.name };
      });
  }

  private buildConceptMap(
    activities: any[],
  ): Map<string, ConceptActivities> {
    const map = new Map<string, ConceptActivities>();

    for (const a of activities) {
      const conceptId = a.conceptId?._id?.toString() ?? a.conceptId?.toString();
      if (!conceptId) continue;

      if (!map.has(conceptId)) {
        const conceptName = a.conceptId?.name ?? 'Unknown Concept';
        map.set(conceptId, { conceptName, activities: [] });
      }

      map.get(conceptId)!.activities.push({ difficulty: a.difficulty });
    }

    return map;
  }

  private getSchoolYearRange(): { start: string; end: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // ponytail: school year runs Aug 1 – Jun 30.
    // If we're in Aug+ of this year, current school year started this Aug.
    // If we're in Jan–Jul, current school year started previous Aug.
    const startYear = month >= 7 ? year : year - 1;
    const endYear = startYear + 1;

    const start = `${startYear}-08-01`;
    const end = `${endYear}-06-30`;

    // Don't go past today
    const today = now.toISOString().slice(0, 10);
    return { start, end: today < end ? today : end };
  }

  async addTestScore(
    managerId: string,
    score: {
      managedUserId: Types.ObjectId;
      subjectName: string;
      score: number;
      date: string;
    },
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(managerId) },
      {
        $push: {
          testScores: {
            managedUserId: score.managedUserId,
            subjectName: score.subjectName,
            score: score.score,
            date: new Date(score.date + 'T00:00:00.000Z'),
          },
        },
      },
    );
  }
}
