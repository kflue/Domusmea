import { quarterRange } from './utility-year-comparison';

describe('quarterRange', () => {
  it('names consecutive quarters as a range and lists gaps', () => {
    expect(quarterRange([1, 2, 3])).toBe('Q1–Q3');
    expect(quarterRange([2])).toBe('Q2');
    expect(quarterRange([1, 2, 4])).toBe('Q1, Q2, Q4');
  });
});
