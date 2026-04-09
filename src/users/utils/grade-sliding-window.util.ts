import {
  MAX_GRADE_ORDINAL,
  MIN_GRADE_ORDINAL,
} from './homeschool-grade-order';

/** Sliding window [current-1, current, current+1] clamped to grade ordinals. */
export function getGradeSlidingWindowOrdinals(
  currentGradeOrdinal: number,
): number[] {
  const c = Math.round(currentGradeOrdinal);
  const lo = Math.max(MIN_GRADE_ORDINAL, c - 1);
  const hi = Math.min(MAX_GRADE_ORDINAL, c + 1);
  const set = new Set<number>();
  for (let i = lo; i <= hi; i += 1) {
    set.add(i);
  }

  return [...set].sort((a, b) => a - b);
}
