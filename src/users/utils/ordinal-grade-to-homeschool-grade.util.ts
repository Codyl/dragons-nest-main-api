import { HomeschoolGrade } from '../enums/homeschool-grade.enum';
import {
  HOMESCHOOL_GRADE_ORDINALS,
  MAX_GRADE_ORDINAL,
  MIN_GRADE_ORDINAL,
} from './homeschool-grade-order';

export function ordinalToHomeschoolGrade(ordinal: number): HomeschoolGrade {
  const o = Math.round(ordinal);
  if (o < MIN_GRADE_ORDINAL || o > MAX_GRADE_ORDINAL) {
    throw new RangeError(`Grade ordinal out of range: ${ordinal}`);
  }

  return HOMESCHOOL_GRADE_ORDINALS[o]!;
}

export function ordinalGradesToHomeschoolGrades(
  ordinals: number[],
): HomeschoolGrade[] {
  const seen = new Set<HomeschoolGrade>();
  for (const x of ordinals) {
    seen.add(ordinalToHomeschoolGrade(x));
  }

  return [...seen];
}

export function homeschoolGradeToOrdinal(grade: HomeschoolGrade): number {
  const i = HOMESCHOOL_GRADE_ORDINALS.indexOf(grade);
  if (i < 0) {
    throw new RangeError(`Unknown homeschool grade: ${grade}`);
  }

  return i;
}
