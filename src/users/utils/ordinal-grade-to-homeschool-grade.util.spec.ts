import { HomeschoolGrade } from '../enums/homeschool-grade.enum';
import {
  homeschoolGradeToOrdinal,
  ordinalGradesToHomeschoolGrades,
  ordinalToHomeschoolGrade,
} from './ordinal-grade-to-homeschool-grade.util';

describe('ordinal grade mapping', () => {
  it('maps 0 to pre_k and 13 to 12', () => {
    expect(ordinalToHomeschoolGrade(0)).toBe(HomeschoolGrade.PreKindergarten);
    expect(ordinalToHomeschoolGrade(13)).toBe(HomeschoolGrade.Grade12);
  });

  it('dedupes homeschool grades', () => {
    expect(ordinalGradesToHomeschoolGrades([1, 1, 2])).toEqual([
      HomeschoolGrade.Kindergarten,
      HomeschoolGrade.Grade1,
    ]);
  });

  it('round-trips homeschoolGradeToOrdinal', () => {
    for (const g of Object.values(HomeschoolGrade)) {
      expect(ordinalToHomeschoolGrade(homeschoolGradeToOrdinal(g))).toBe(g);
    }
  });
});
