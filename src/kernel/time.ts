import { type Brand, brandAs } from './brand.ts';
import { KernelError } from './identity.ts';

/**
 * A calendar day, `YYYY-MM-DD`, UTC.
 *
 * Days rather than timestamps: retrieval dates, announcement dates and
 * verification dates are all things a person can check against a document, and
 * a spurious time-of-day invites a precision the source does not have. Work
 * events in Hisaab (recommended, sanctioned, released, spent) do carry real
 * timestamps and get their own type at G3, where lag is measured in days.
 */
export type IsoDate = Brand<string, 'IsoDate'>;

const asIsoDate = brandAs<'IsoDate'>();

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isoDate(value: string): IsoDate {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new KernelError(`Invalid date ${JSON.stringify(value)}. Expected YYYY-MM-DD.`);
  }
  // Round-trip through Date to reject 2025-02-30 and similar.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new KernelError(`${value} is not a real calendar date.`);
  }
  return asIsoDate(value);
}

/** A year a target is due. Kept separate from IsoDate: "by 2047" is not a day. */
export type TargetYear = Brand<number, 'TargetYear'>;

const asTargetYear = brandAs<'TargetYear'>();

export function targetYear(year: number): TargetYear {
  if (!Number.isInteger(year) || year < 1947 || year > 2200) {
    throw new KernelError(`Implausible target year ${year}.`);
  }
  return asTargetYear(year);
}

export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
