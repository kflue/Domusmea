/**
 * Commodities on the utility bill (ADR 0011). Stored as string keys, not an SQL enum, so a new one
 * needs no schema change.
 */
export const COMMODITIES = ['electricity', 'water', 'wastewater', 'garbage'] as const;
export type Commodity = (typeof COMMODITIES)[number];

export interface CommodityInfo {
  label: string;
  /** Unit of the amount, e.g. `kWh`; `null` for a flat fee without an amount (garbage). */
  unit: string | null;
  /** The bill states a fixed fee apart from the usage cost. */
  hasFixedFee: boolean;
}

export const COMMODITY_INFO: Record<Commodity, CommodityInfo> = {
  electricity: { label: 'Electricity', unit: 'kWh', hasFixedFee: true },
  water: { label: 'Water', unit: 'm³', hasFixedFee: true },
  wastewater: { label: 'Waste water', unit: 'm³', hasFixedFee: false },
  garbage: { label: 'Garbage', unit: null, hasFixedFee: true },
};

/** Highest amount per entry, 1'000'000 units, in thousandths. */
export const MAX_AMOUNT_MILLI = 1_000_000_000;
/** Highest cost or credit per entry and field, CHF 1'000'000. */
export const MAX_UTILITY_RAPPEN = 100_000_000;
/** Maximum length of a bill's invoice number. */
export const INVOICE_NUMBER_MAX_LENGTH = 100;
/** Maximum length of a bill's notes. */
export const BILL_NOTES_MAX_LENGTH = 2000;

/**
 * One commodity of one bill, as returned by `/api/utilities`. Dates are `YYYY-MM-DD`, money integer
 * Rappen (ADR 0004), amounts integer thousandths of the unit so sums stay exact (ADR 0011).
 */
export interface UtilityEntry {
  id: number;
  /** The bill the entry was entered with; its entries share the invoice number and notes. */
  billId: number;
  commodity: Commodity;
  /** First day of the billing period. */
  periodFrom: string;
  /** Last day of the billing period, not before `periodFrom`. */
  periodTo: string;
  /** Consumption in thousandths of the unit; `null` for commodities without a unit. */
  amountMilli: number | null;
  /** Usage cost; negative for a credit. Always `0` for garbage, which is a fixed fee only. */
  costRappen: number;
  /** Fixed fee; `0` for commodities without one. Negative for a credit. */
  fixedFeeRappen: number;
  /** The bill's invoice number, e.g. to find the PDF; `null` if not recorded. */
  invoiceNumber: string | null;
  /** The bill's free-text notes; `null` if none. */
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body of `PUT /api/utilities/:id`. The commodity cannot change. `invoiceNumber` and `notes`
 * belong to the bill, so they change for all of its entries; leave them out to keep the stored
 * values, so an edit form loaded earlier does not overwrite newer ones.
 */
export type UtilityEntryInput = Omit<
  UtilityEntry,
  'id' | 'billId' | 'invoiceNumber' | 'notes' | 'createdAt' | 'updatedAt'
> &
  Partial<Pick<UtilityEntry, 'invoiceNumber' | 'notes'>>;

/** One filled line of a bill: a commodity with its figures. */
export type UtilityBillLine = Omit<
  UtilityEntryInput,
  'periodFrom' | 'periodTo' | 'invoiceNumber' | 'notes'
>;

/**
 * Request body of `POST /api/utilities`: one bill with a line per billed commodity, each stored as
 * its own entry. The response is the created entries.
 */
export interface UtilityBillInput {
  periodFrom: string;
  periodTo: string;
  invoiceNumber: string | null;
  notes: string | null;
  lines: UtilityBillLine[];
}
