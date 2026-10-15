/** Parsing and editing of consumption amounts in form inputs, in thousandths of the unit (ADR 0011). */

const AMOUNT = /^(\d+)(?:[.,](\d{1,3}))?$/;

/**
 * Parses an amount such as `1234`, `1'234.5` or `12,125` into thousandths. Returns `null` for an
 * empty value and `undefined` for invalid input (negative, more than 3 decimals).
 */
export function parseAmount(text: string): number | null | undefined {
  const compact = text.replaceAll(/['’\s]/g, '');
  if (compact === '') {
    return null;
  }
  const match = AMOUNT.exec(compact);
  if (!match) {
    return undefined;
  }
  const milli = Number(match[1]) * 1000 + Number((match[2] ?? '').padEnd(3, '0'));
  return Number.isSafeInteger(milli) ? milli : undefined;
}

/** Thousandths as an editable amount without trailing zeros, e.g. `1234500` → `1234.5`. */
export function milliToAmountText(milli: number): string {
  // The shortest representation of an integer ÷ 1000 has at most 3 decimals and no trailing zeros.
  return String(milli / 1000);
}
