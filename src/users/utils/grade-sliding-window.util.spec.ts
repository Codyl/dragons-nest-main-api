import { getGradeSlidingWindowOrdinals } from './grade-sliding-window.util';

describe('getGradeSlidingWindowOrdinals', () => {
  it('returns three ordinals in the middle', () => {
    expect(getGradeSlidingWindowOrdinals(5)).toEqual([4, 5, 6]);
  });

  it('clamps low end at pre-k', () => {
    expect(getGradeSlidingWindowOrdinals(0)).toEqual([0, 1]);
  });

  it('clamps high end at grade 12', () => {
    expect(getGradeSlidingWindowOrdinals(13)).toEqual([12, 13]);
  });
});
