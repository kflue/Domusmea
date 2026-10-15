import { milliToAmountText, parseAmount } from './amount-input';

describe('parseAmount', () => {
  it('parses amounts with up to 3 decimals into thousandths', () => {
    expect(parseAmount('812')).toBe(812_000);
    expect(parseAmount("1'234.5")).toBe(1_234_500);
    expect(parseAmount('21,125')).toBe(21_125);
    expect(parseAmount('0')).toBe(0);
  });

  it('returns null for empty and undefined for invalid input', () => {
    expect(parseAmount(' ')).toBeNull();
    expect(parseAmount('1.2345')).toBeUndefined();
    expect(parseAmount('-1')).toBeUndefined();
    expect(parseAmount('abc')).toBeUndefined();
  });
});

describe('milliToAmountText', () => {
  it('drops trailing zeros', () => {
    expect(milliToAmountText(1_234_500)).toBe('1234.5');
    expect(milliToAmountText(21_000)).toBe('21');
    expect(milliToAmountText(125)).toBe('0.125');
  });
});
