import {
  Commodity,
  COMMODITIES,
  COMMODITY_INFO,
  UtilityBillInput,
  UtilityBillLine,
  UtilityEntry,
  UtilityEntryInput,
} from '../../../shared/utility';
import { milliToAmountText, parseAmount } from '../../shared/amount-input';
import { parseSignedChf, rappenToChfText } from '../../shared/chf-input';

/** One commodity's line as typed; all empty means the bill does not cover it. */
export interface BillLineFormModel {
  /** Consumption in the unit, e.g. `812.5`; unused for garbage. */
  amount: string;
  /** Usage cost in CHF, negative for a credit; unused for garbage. */
  cost: string;
  /** Fixed fee in CHF; garbage's flat fee. */
  fixedFee: string;
}

/** Form state: strings only, as Signal Forms binds inputs to non-null values. */
export interface UtilityBillFormModel {
  periodFrom: string;
  periodTo: string;
  /** Shared by all entries of the bill (R11). */
  invoiceNumber: string;
  notes: string;
  lines: Record<Commodity, BillLineFormModel>;
  /** The user confirmed saving despite an overlapping period. */
  confirmOverlap: boolean;
}

const emptyLine = (): BillLineFormModel => ({ amount: '', cost: '', fixedFee: '' });

function emptyLines(): Record<Commodity, BillLineFormModel> {
  return Object.fromEntries(COMMODITIES.map((c) => [c, emptyLine()])) as Record<
    Commodity,
    BillLineFormModel
  >;
}

/** A new bill for the given period. */
export function newBillForm(period: { from: string; to: string }): UtilityBillFormModel {
  return {
    periodFrom: period.from,
    periodTo: period.to,
    invoiceNumber: '',
    notes: '',
    lines: emptyLines(),
    confirmOverlap: false,
  };
}

/** An existing entry: its period and its commodity's line. */
export function toFormModel(entry: UtilityEntry): UtilityBillFormModel {
  const info = COMMODITY_INFO[entry.commodity];
  return {
    periodFrom: entry.periodFrom,
    periodTo: entry.periodTo,
    invoiceNumber: entry.invoiceNumber ?? '',
    notes: entry.notes ?? '',
    lines: {
      ...emptyLines(),
      [entry.commodity]: {
        amount: entry.amountMilli === null ? '' : milliToAmountText(entry.amountMilli),
        cost: info.unit === null ? '' : rappenToChfText(entry.costRappen),
        fixedFee: info.hasFixedFee ? rappenToChfText(entry.fixedFeeRappen) : '',
      },
    },
    confirmOverlap: false,
  };
}

/** The line has at least one of the fields its commodity uses filled in. */
export function isFilled(commodity: Commodity, line: BillLineFormModel): boolean {
  const info = COMMODITY_INFO[commodity];
  const used = [
    ...(info.unit === null ? [] : [line.amount, line.cost]),
    ...(info.hasFixedFee ? [line.fixedFee] : []),
  ];
  return used.some((value) => value.trim() !== '');
}

/** Converts a valid line; an empty fixed fee is 0. */
export function toBillLine(commodity: Commodity, line: BillLineFormModel): UtilityBillLine {
  const info = COMMODITY_INFO[commodity];
  return {
    commodity,
    amountMilli: info.unit === null ? null : (parseAmount(line.amount) ?? 0),
    costRappen: info.unit === null ? 0 : (parseSignedChf(line.cost) ?? 0),
    fixedFeeRappen: info.hasFixedFee ? (parseSignedChf(line.fixedFee) ?? 0) : 0,
  };
}

/** The API body for a new bill: one line per filled commodity, in the order of the form. */
export function toBillInput(form: UtilityBillFormModel): UtilityBillInput {
  return {
    ...billFields(form),
    lines: COMMODITIES.filter((c) => isFilled(c, form.lines[c])).map((c) =>
      toBillLine(c, form.lines[c]),
    ),
  };
}

/**
 * The API body for the edited `entry`. Invoice number and notes are sent only when changed, so
 * newer values saved from another entry of the bill are kept.
 */
export function toEntryInput(form: UtilityBillFormModel, entry: UtilityEntry): UtilityEntryInput {
  const { invoiceNumber, notes, ...period } = billFields(form);
  return {
    ...toBillLine(entry.commodity, form.lines[entry.commodity]),
    ...period,
    ...(invoiceNumber === entry.invoiceNumber ? {} : { invoiceNumber }),
    ...(notes === entry.notes ? {} : { notes }),
  };
}

/** Period, invoice number and notes; empty text becomes `null`. */
function billFields(form: UtilityBillFormModel) {
  return {
    periodFrom: form.periodFrom,
    periodTo: form.periodTo,
    invoiceNumber: form.invoiceNumber.trim() || null,
    notes: form.notes.trim() || null,
  };
}
