import { formatRupees, type Paise } from '../kernel/money.ts';
import { displayName } from '../kernel/people.ts';
import { citation } from '../kernel/provenance.ts';
import { formatQuantity, type Quantity } from '../kernel/quantity.ts';
import { currentRevision, type Target } from '../kernel/target.ts';
import { assertVerified, type Attested, type Verified } from '../kernel/verification.ts';

/**
 * The publication boundary.
 *
 * Every figure that reaches a reader leaves through this module, and these
 * functions accept `Verified<T>` only. Handing one an unverified figure is a
 * `tsc` error, and the `assertVerified` call behind it catches the same mistake
 * at runtime for values that entered from JSON, a scraper or an agent, where the
 * compiler had nothing to check.
 *
 * The return type has no bare-value field. A caller cannot render the number
 * without also holding the citation, which is what stops provenance being
 * dropped by an ordinary-looking refactor three layers up.
 */
export type PublishedFigure = {
  /** Formatted for display. Never parse this back into arithmetic. */
  readonly display: string;
  readonly citation: string;
  readonly sourceUrl: string;
  /** The verifier's name, as they write it. This is what a reader sees. */
  readonly verifiedBy: string;
  /** The stable handle. Kept for joins and for matching against the record. */
  readonly verifiedById: string;
  readonly verifiedOn: string;
};

function publish<T>(figure: Verified<T>, display: string, context: string): PublishedFigure {
  assertVerified(figure, context);
  const { verification, provenance } = figure;
  return {
    display,
    citation: citation(provenance),
    sourceUrl: provenance.sourceUrl,
    verifiedBy: displayName(verification.verifiedBy),
    verifiedById: verification.verifiedBy,
    verifiedOn: verification.verifiedOn,
  };
}

export const publishQuantity = (f: Verified<Quantity>, context = 'quantity'): PublishedFigure =>
  publish(f, formatQuantity(f.value), context);

export const publishMoney = (f: Verified<Paise>, context = 'money'): PublishedFigure =>
  publish(f, formatRupees(f.value), context);

/**
 * Guards data arriving from outside the compiler's reach.
 *
 * Use this at every boundary — file reads, scraper output, agent proposals —
 * to turn an unproven `Attested<T>` into a `Verified<T>` the render layer will
 * accept. It throws rather than returning a fallback: rule 2 is that an empty
 * or unverified result is a failure and never a zero.
 */
export function requireVerified<T>(figure: Attested<T>, context: string): Verified<T> {
  assertVerified(figure, context);
  return figure;
}

export type PublishedTarget = {
  readonly id: string;
  readonly title: string;
  readonly measure: string;
  readonly classification: string;
  readonly indicatorType: string;
  readonly dueBy: number;
  readonly announcedBy: string;
  readonly figure: PublishedFigure;
  /** Present whenever the target has been revised. Surfaced, never hidden. */
  readonly revisionHistory: readonly { seq: number; note: string; recordedOn: string }[];
};

/**
 * Renders a target, refusing if its operative value is unverified.
 *
 * Revision history ships with the target rather than behind a link. A target
 * quietly revised from 2032 to 2047 is the single most interesting fact Lakshya
 * can report, and it is only interesting if the reader sees it by default.
 */
export function publishTarget(target: Target): PublishedTarget {
  const revision = currentRevision(target);
  const figure = publishQuantity(
    requireVerified(revision.value, `target ${target.id} rev ${revision.seq}`),
    `target ${target.id}`,
  );
  return {
    id: target.id,
    title: target.title,
    measure: target.measure.measure,
    classification: target.classification.value,
    indicatorType: target.indicatorType.value,
    dueBy: revision.dueBy,
    announcedBy: revision.announcedBy,
    figure,
    revisionHistory: target.revisions
      .filter((r) => r.seq > 1)
      .map((r) => ({ seq: r.seq, note: r.note, recordedOn: r.recordedOn })),
  };
}
