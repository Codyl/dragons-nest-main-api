import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SubjectsService } from './subjects.service';
import { Subject } from './subject.entity';
import { Activity } from 'src/activities/activity.entity';
import { CurriculumItem } from 'src/curriculum/entities/curriculum.entity';
import { Types } from 'mongoose';

describe('SubjectsService.getStats', () => {
  let service: SubjectsService;
  let activityModel: { aggregate: jest.Mock };
  let curriculumItemModel: { countDocuments: jest.Mock };

  beforeEach(async () => {
    activityModel = { aggregate: jest.fn() };
    curriculumItemModel = { countDocuments: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        { provide: getModelToken(Subject.name), useValue: {} },
        { provide: getModelToken(Activity.name), useValue: activityModel },
        { provide: getModelToken(CurriculumItem.name), useValue: curriculumItemModel },
      ],
    }).compile();

    service = module.get(SubjectsService);
  });

  it('returns zero stats when no activities or documents exist', async () => {
    activityModel.aggregate.mockResolvedValue([]);
    curriculumItemModel.countDocuments.mockResolvedValue(0);

    const subjectId = new Types.ObjectId();
    const result = await service.getStats(subjectId, 'manageduser-1', new Types.ObjectId().toHexString());

    expect(result).toEqual({
      progressPercent: 0,
      hoursCompleted: 0,
      hoursTarget: 0,
      standardsMet: 0,
      standardsTotal: 0,
      documentsCount: 0,
    });
  });

  it('computes hoursCompleted from activity minutes', async () => {
    activityModel.aggregate.mockResolvedValue([{ totalMinutes: 150 }]);
    curriculumItemModel.countDocuments.mockResolvedValue(3);

    const subjectId = new Types.ObjectId();
    const result = await service.getStats(subjectId, 'manageduser-1', new Types.ObjectId().toHexString());

    expect(result.hoursCompleted).toBe(2.5);
    expect(result.documentsCount).toBe(3);
    // ponytail: progressPercent stays 0 since hoursTarget=0
    expect(result.progressPercent).toBe(0);
  });
});

describe('SubjectsService.getSummary', () => {
  let service: SubjectsService;
  let activityModel: { find: jest.Mock };

  beforeEach(async () => {
    activityModel = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        { provide: getModelToken(Subject.name), useValue: {} },
        { provide: getModelToken(Activity.name), useValue: activityModel },
        { provide: getModelToken(CurriculumItem.name), useValue: {} },
      ],
    }).compile();

    service = module.get(SubjectsService);
  });

  it('returns nulls and zeros when no activities exist', async () => {
    activityModel.find.mockReturnValue({ lean: () => Promise.resolve([]) });

    const result = await service.getSummary(new Types.ObjectId(), 'manageduser-1');

    expect(result).toEqual({
      mostPracticedConcept: null,
      totalTimeThisWeek: { hours: 0, minutes: 0 },
      averageDifficulty: null,
    });
  });

  it('identifies the most practiced concept by session count', async () => {
    const conceptA = new Types.ObjectId();
    const conceptB = new Types.ObjectId();
    const activities = [
      { conceptId: conceptA, date: new Date('2020-01-01'), difficulty: 'Easy', timeSpentMinutes: 30 },
      { conceptId: conceptA, date: new Date('2020-01-02'), difficulty: 'Easy', timeSpentMinutes: 30 },
      { conceptId: conceptB, date: new Date('2020-01-03'), difficulty: 'Hard', timeSpentMinutes: 60 },
    ];
    activityModel.find.mockReturnValue({ lean: () => Promise.resolve(activities) });

    const result = await service.getSummary(new Types.ObjectId(), 'manageduser-1');

    expect(result.mostPracticedConcept).toBe(conceptA.toString());
  });

  it('computes average difficulty label from mean', async () => {
    const conceptId = new Types.ObjectId();
    // All Hard (3) → mean=3 → High
    const activities = [
      { conceptId, date: new Date('2020-01-01'), difficulty: 'Hard', timeSpentMinutes: 30 },
      { conceptId, date: new Date('2020-01-02'), difficulty: 'Hard', timeSpentMinutes: 30 },
    ];
    activityModel.find.mockReturnValue({ lean: () => Promise.resolve(activities) });

    const result = await service.getSummary(new Types.ObjectId(), 'manageduser-1');
    expect(result.averageDifficulty).toBe('High');
  });

  it('labels difficulty Low when mean < 1.5', async () => {
    const conceptId = new Types.ObjectId();
    // All Easy (1) → mean=1 → Low
    const activities = [
      { conceptId, date: new Date('2020-01-01'), difficulty: 'Easy', timeSpentMinutes: 10 },
    ];
    activityModel.find.mockReturnValue({ lean: () => Promise.resolve(activities) });

    const result = await service.getSummary(new Types.ObjectId(), 'manageduser-1');
    expect(result.averageDifficulty).toBe('Low');
  });

  it('sums time only for activities within the current week', async () => {
    const conceptId = new Types.ObjectId();
    // Create an activity for today (in current week) and one far in the past
    const today = new Date();
    const activities = [
      { conceptId, date: today, difficulty: 'Medium', timeSpentMinutes: 90 },
      { conceptId, date: new Date('2020-01-01'), difficulty: 'Medium', timeSpentMinutes: 120 },
    ];
    activityModel.find.mockReturnValue({ lean: () => Promise.resolve(activities) });

    const result = await service.getSummary(new Types.ObjectId(), 'manageduser-1');

    // Only today's 90 minutes should count for this week
    expect(result.totalTimeThisWeek).toEqual({ hours: 1, minutes: 30 });
  });
});
