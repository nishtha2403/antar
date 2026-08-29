import { KernelError } from './identity.ts';
import {
  assertSameUnit,
  divideQuantity,
  isNegative,
  type Quantity,
  ratioAsPercent,
  subtractQuantity,
} from './quantity.ts';
import { latestVerified, type Series } from './series.ts';
import { currentRevision, type Target } from './target.ts';
import type { IsoDate } from './time.ts';
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
    ...(yearsRemaining > 0 && !met
      ? { requiredAnnualAddition: divideQuantity(remaining, BigInt(yearsRemaining), 2) }
      : {}),
  };
  return gap;
}
