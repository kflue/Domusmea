/** Parsing and editing of CHF amounts in form inputs; amounts are integer Rappen (ADR 0004). */

const CHF_AMOUNT = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Parses a CHF amount into Rappen. Accepts `1299`, `1299.5`, `1'299.50`, `1 299,50`.
 * Returns `null` for an empty value and `undefined` for invalid input.
 */
export function parseChf(text: string): number | null | undefined {
  const compact = text.replaceAll(/['’\s]/g, '');
  if (compact === '') {
    return null;
  }
  const match = CHF_AMOUNT.exec(compact);
  if (!match) {
    return undefined;
  }
  const rappen = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(rappen) ? rappen : undefined;
}

/** Like {@link parseChf}, but also accepts a leading minus for credits, e.g. `-12.50`. */
export function parseSignedChf(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith('-')) {
    return parseChf(trimmed);
  }
  const rappen = parseChf(trimmed.slice(1));
  return typeof rappen === 'number' ? -rappen : undefined;
}

/** Rappen as an editable amount, e.g. `129950` → `1299.50`, `-50` → `-0.50`. */
export function rappenToChfText(rappen: number): string {
  const sign = rappen < 0 ? '-' : '';
  const abs = Math.abs(rappen);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
