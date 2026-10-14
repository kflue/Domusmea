import { parseChf, rappenToChfText } from './chf-input';

describe('parseChf', () => {
  it('parses amounts with Swiss separators into Rappen', () => {
    expect(parseChf('1299')).toBe(129900);
    expect(parseChf("1'299.5")).toBe(129950);
    expect(parseChf('1’299.05')).toBe(129905);
    expect(parseChf(' 1 299,50 ')).toBe(129950);
    expect(parseChf('0.10')).toBe(10);
  });

  it('returns null for empty and undefined for invalid input', () => {
    expect(parseChf('  ')).toBeNull();
    expect(parseChf('12.345')).toBeUndefined();
    expect(parseChf('-5')).toBeUndefined();
    expect(parseChf('abc')).toBeUndefined();
    expect(parseChf('9'.repeat(20))).toBeUndefined();
  });
});

describe('rappenToChfText', () => {
  it('formats Rappen as an editable amount', () => {
    expect(rappenToChfText(129950)).toBe('1299.50');
    expect(rappenToChfText(5)).toBe('0.05');
  });
});
