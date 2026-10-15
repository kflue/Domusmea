import { stepPeriod } from './chart-support';

describe('stepPeriod', () => {
  it('moves through the periods and stops at the ends', () => {
    expect(stepPeriod('ArrowRight', undefined, 3)).toEqual({ index: 0 });
    expect(stepPeriod('ArrowRight', 2, 3)).toEqual({ index: 2 });
    expect(stepPeriod('ArrowLeft', undefined, 3)).toEqual({ index: 2 });
    expect(stepPeriod('ArrowLeft', 0, 3)).toEqual({ index: 0 });
    expect(stepPeriod('Home', 2, 3)).toEqual({ index: 0 });
    expect(stepPeriod('End', 0, 3)).toEqual({ index: 2 });
    expect(stepPeriod('Escape', 1, 3)).toEqual({ index: undefined });
  });

  it('ignores other keys, and moving without periods', () => {
    expect(stepPeriod('Enter', 1, 3)).toBeNull();
    expect(stepPeriod('ArrowRight', undefined, 0)).toBeNull();
    expect(stepPeriod('Escape', undefined, 0)).toEqual({ index: undefined });
  });
});
