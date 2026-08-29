import { KernelError } from './identity.ts';
import { assertSameUnit, type Quantity } from './quantity.ts';
import type { Measure } from './target.ts';
import type { IsoDate } from './time.ts';
import { isVerified, type Attested, type Verified } from './verification.ts';

/**
 * A measured value at a point in time.
 *
 * Observations are what Lakshya compares a target against: the CEA installed
 * capacity series for the nuclear slice, DST statistics for R&D, and so on.
 * Each carries its own provenance and its own verification, because a series
 * is not verified as a block — it is verified row by row, and at G1 that is
 * done by hand.
 */
export type Observation = {
  readonly asOf: IsoDate;
  readonly value: Attested<Quantity>;
};

export type Series = {
  readonly measure: Measure;
  /** Ascending by date, contiguous or not, but never unsorted. */
  readonly observations: readonly Observation[];
};

export function series(measure: Measure, observations: readonly Observation[]): Series {
  if (observations.length === 0) {
    throw new KernelError(
      `Series for "${measure.measure}" is empty. ` +
        'An empty result is a failure, never a zero — rule 2. If the source genuinely ' +
        'has no rows, that is a finding to record, not a series to build.',
    );
  }
  for (const o of observations) {
    if (o.value.value.unit !== measure.unit) {
      throw new KernelError(
        `Observation at ${o.asOf} is in "${o.value.value.unit}" but the series is defined in "${measure.unit}".`,
      );
    }
  }
  const sorted = [...observations].sort((a, b) => (a.asOf < b.asOf ? -1 : a.asOf > b.asOf ? 1 : 0));
  const dates = new Set(sorted.map((o) => o.asOf));
  if (dates.size !== sorted.length) {
    throw new KernelError(
      `Series for "${measure.measure}" has two observations on the same date. ` +
        'Duplicate dates usually mean two source vintages were merged; resolve which one applies.',
    );
  }
  return { measure, observations: sorted };
}

/**
 * The most recent observation a human has verified.
 *
 * Deliberately not "the most recent observation". A scraper that has just
 * pulled an unverified row must not change what the site reports; the published
 * figure moves when a person signs off, not when a fetch succeeds.
 */
export function latestVerified(s: Series): { asOf: IsoDate; value: Verified<Quantity> } | undefined {
  for (let i = s.observations.length - 1; i >= 0; i--) {
    const o = s.observations[i];
    if (o && isVerified(o.value)) return { asOf: o.asOf, value: o.value };
  }
  return undefined;
}

/** How much of the series is verified. Published as a number at G4; useful now. */
export function verificationCoverage(s: Series): { verified: number; total: number; percent: number } {
  const verified = s.observations.filter((o) => isVerified(o.value)).length;
  const total = s.observations.length;
  return { verified, total, percent: total === 0 ? 0 : Math.round((verified / total) * 1000) / 10 };
}

export function changeBetween(a: Observation, b: Observation): Quantity {
  assertSameUnit(a.value.value, b.value.value, 'series change');
  const scale = Math.max(a.value.value.scale, b.value.value.scale);
  const lift = (q: Quantity) => q.digits * 10n ** BigInt(scale - q.scale);
  return { digits: lift(b.value.value) - lift(a.value.value), scale, unit: a.value.value.unit };
}
