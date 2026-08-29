import { KernelError } from './identity.ts';
import {
  assertSameUnit,
  divideQuantity,
  divideToScale,
  isNegative,
  type Quantity,
  ratioAsPercent,
  subtractQuantity,
} from './quantity.ts';
import { latestVerified, type Series } from './series.ts';
import { currentRevision, type Target } from './target.ts';
import { daysBetween, type IsoDate, isoDate } from './time.ts';
import type { Verified } from './verification.ts';

/**
 * The gap: what was promised, what exists, and the arithmetic between them.
 *
 * Everything here is deterministic and stated in units the sources use. What it
 * deliberately does not do is as important as what it does.
 *
 * It does not forecast. `requiredAnnualAddition` is division — the remaining
 * quantity over the remaining years — not a prediction that the rate will hold.
 * It is labelled that way wherever it is rendered.
 *
 * It does not attribute. Nothing in this module names a responsible institution.
 * Responsibility is an edge in a graph a human tags, and joining a gap to a name
 * is the step that turns an observation into an accusation.
 *
 * It does not accept unverified inputs. Both sides are `Verified<Quantity>`, so
 * a gap cannot be computed from a figure nobody has checked, let alone rendered.
 */
export type Gap = {
  readonly targetId: string;
  readonly target: Verified<Quantity>;
  readonly observed: Verified<Quantity>;
  readonly observedAsOf: IsoDate;
  readonly dueBy: number;
  /** target − observed. Negative means the target has been exceeded. */
  readonly remaining: Quantity;
  /** observed ÷ target, as a percentage to two places. */
  readonly achieved: Quantity;
  readonly met: boolean;
  /** Whole years from the observation to the deadline. Negative once it passes. */
  readonly yearsRemaining: number;

  /**
   * When the operative version of this promise was announced, and by whom.
   *
   * Without it a deadline means nothing: 100 GW by 2047 is a 22-year runway if
   * it was promised in 2025 and a 12-year one if it was promised in 2035.
   */
  readonly promisedOn: IsoDate;
  readonly promisedBy: string;
  /**
   * When the first version was announced. Differs from `promisedOn` only when
   * the target has been revised, and when it differs, both belong on the page.
   */
  readonly originallyPromisedOn: IsoDate;
  readonly wasRevised: boolean;
  /**
   * Whole years from the announcement year to the deadline year.
   *
   * This is the phrase a person would use for the promise — "a 22-year window" —
   * and it is not a computed claim, just the two years subtracted.
   */
  readonly windowYears: number;
  /**
   * Years elapsed, to one decimal place, measured in days.
   *
   * Whole-year subtraction reported eleven months as zero, which understated
   * elapsed time by most of a year in the first year of every promise. The
   * deadline is taken as 31 December of the due year: "by 2047" is met by the
   * end of 2047.
   */
  readonly yearsElapsed: Quantity;
  /**
   * Share of the promise window that has passed, to two places.
   *
   * Reported beside the achieved share, never divided into it. Comparing the
   * two would assume the quantity accrues linearly, and nuclear capacity
   * arrives in steps when a reactor commissions — a page that called a year
   * "behind schedule" because no reactor happened to finish would be exactly
   * the misleading claim G1 exists to catch. Both numbers, no verdict.
   */
  readonly elapsed?: Quantity;
  /**
   * remaining ÷ yearsRemaining. Arithmetic, not a forecast.
   * Absent when the deadline has passed or the target is already met.
   */
  readonly requiredAnnualAddition?: Quantity;
};

export function computeGap(target: Target, observations: Series): Gap {
  const revision = currentRevision(target);

  if (revision.value.verification.state !== 'verified') {
    throw new KernelError(
      `Cannot compute a gap for ${target.id}: the operative target revision is ` +
        `"${revision.value.verification.state}". Verify it first.`,
    );
  }
  const targetValue = revision.value as Verified<Quantity>;

  const latest = latestVerified(observations);
  if (!latest) {
    throw new KernelError(
      `Cannot compute a gap for ${target.id}: the series has no verified observation. ` +
        'An unverified row does not move the published figure.',
    );
  }

  if (observations.measure.unit !== target.measure.unit) {
    throw new KernelError(
      `Series for ${target.id} is in "${observations.measure.unit}", target is in "${target.measure.unit}".`,
    );
  }
  assertSameUnit(targetValue.value, latest.value.value, `gap for ${target.id}`);

  const remaining = subtractQuantity(targetValue.value, latest.value.value);
  const achieved = ratioAsPercent(latest.value.value, targetValue.value, 2);
  const met = isNegative(remaining) || remaining.digits === 0n;

  const observedYear = Number(latest.asOf.slice(0, 4));
  const yearsRemaining = revision.dueBy - observedYear;

  const original = target.revisions[0];
  const promisedYear = Number(revision.announcedOn.slice(0, 4));
  const windowYears = revision.dueBy - promisedYear;

  // "By 2047" is met by the end of 2047, so the deadline is 31 December.
  const deadline = isoDate(`${revision.dueBy}-12-31`);
  const windowDays = daysBetween(revision.announcedOn, deadline);
  const elapsedDays = Math.max(0, daysBetween(revision.announcedOn, latest.asOf));
  const yearsElapsed = divideToScale(BigInt(elapsedDays), 365n, 1, 'years');

  const gap: Gap = {
    targetId: target.id,
    target: targetValue,
    observed: latest.value,
    observedAsOf: latest.asOf,
    dueBy: revision.dueBy,
    remaining,
    achieved,
    met,
    yearsRemaining,
    promisedOn: revision.announcedOn,
    promisedBy: revision.announcedBy,
    originallyPromisedOn: original.announcedOn,
    wasRevised: target.revisions.length > 1,
    windowYears,
    yearsElapsed,
    ...(windowDays > 0
      ? { elapsed: divideToScale(BigInt(elapsedDays) * 100n, BigInt(windowDays), 2, '%') }
      : {}),
    ...(yearsRemaining > 0 && !met
      ? { requiredAnnualAddition: divideQuantity(remaining, BigInt(yearsRemaining), 2) }
      : {}),
  };
  return gap;
}
