import { HomeschoolGrade } from '../enums/homeschool-grade.enum';

/** Ordinal 0 = Pre-K … 13 = Grade 12; matches {@link HomeschoolGrade} order. */
export const HOMESCHOOL_GRADE_ORDINALS: readonly HomeschoolGrade[] = [
  HomeschoolGrade.PreKindergarten,
  HomeschoolGrade.Kindergarten,
  HomeschoolGrade.Grade1,
  HomeschoolGrade.Grade2,
  HomeschoolGrade.Grade3,
  HomeschoolGrade.Grade4,
  HomeschoolGrade.Grade5,
  HomeschoolGrade.Grade6,
  HomeschoolGrade.Grade7,
  HomeschoolGrade.Grade8,
  HomeschoolGrade.Grade9,
  HomeschoolGrade.Grade10,
  HomeschoolGrade.Grade11,
  HomeschoolGrade.Grade12,
] as const;

export const MIN_GRADE_ORDINAL = 0;
export const MAX_GRADE_ORDINAL = HOMESCHOOL_GRADE_ORDINALS.length - 1;
