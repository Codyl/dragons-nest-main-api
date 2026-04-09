import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/entities/user.schema';
import { AccountType } from 'src/users/enums/account-type.enum';
import { getGradeSlidingWindowOrdinals } from 'src/users/utils/grade-sliding-window.util';
import { ordinalGradesToHomeschoolGrades } from 'src/users/utils/ordinal-grade-to-homeschool-grade.util';

export type DiscoveryTeacherRow = {
  id: string;
  givenName: string | null;
  teachableCourses: {
    className: string;
    subjectId: string;
    /** @deprecated Legacy single grade */
    grade?: string;
    grades: string[];
    matchesAllGrades: boolean;
    curriculum: string;
  }[];
};

@Injectable()
export class DiscoveryService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  collectOrdinalsFromSlidingWindows(gradeOrdinals: number[]): number[] {
    const set = new Set<number>();
    for (const g of gradeOrdinals) {
      for (const o of getGradeSlidingWindowOrdinals(g)) {
        set.add(o);
      }
    }

    return [...set].sort((a, b) => a - b);
  }

  async findTeachersByGradeOrdinals(
    ordinals: number[],
  ): Promise<DiscoveryTeacherRow[]> {
    const gradeStrings = ordinalGradesToHomeschoolGrades(ordinals);
    const docs = await this.userModel
      .find({
        accountType: AccountType.Adult,
        deleted: { $ne: true },
        teachableCourses: {
          $elemMatch: {
            $or: [
              { grade: { $in: gradeStrings } },
              { grades: { $in: gradeStrings } },
              { matchesAllGrades: true },
            ],
          },
        },
      })
      .select('_id givenName teachableCourses')
      .lean();

    return docs.map((d) => ({
      id: String(d._id),
      givenName: d.givenName ?? null,
      teachableCourses: (d.teachableCourses ?? []).map((c) => ({
        className:
          typeof c.className === 'string' && c.className.length > 0
            ? c.className
            : '',
        subjectId: String(c.subjectId),
        grade: c.grade != null ? String(c.grade) : undefined,
        grades: Array.isArray(c.grades) ? c.grades.map(String) : [],
        matchesAllGrades: Boolean(c.matchesAllGrades),
        curriculum: String(c.curriculum),
      })),
    }));
  }
}
