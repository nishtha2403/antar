import type { ContextNote } from '../kernel/context.ts';
import { computeGap, type Gap } from '../kernel/gap.ts';
import { displayName } from '../kernel/people.ts';
import { citation } from '../kernel/provenance.ts';
import { formatQuantity, type Quantity } from '../kernel/quantity.ts';
import { reconcile, type Roadmap } from '../kernel/roadmap.ts';
import type { Series } from '../kernel/series.ts';
import { isVerified } from '../kernel/verification.ts';
import { currentRevision, type Target } from '../kernel/target.ts';
import { inLocale, type Translations } from '../kernel/translation.ts';
import type { Locale } from './locales.ts';

/**
 * View models: the layer between verified records and the templates.
 *
 * Everything the templates need is computed here, in plain TypeScript, so the
 * guarantees stay unit-testable. A template is a dumb renderer of these shapes —
 * it cannot reach past them to a raw record, which is what stops a redesign from
 * quietly dropping a citation or rendering an unverified figure.
 *
 * Two rules hold throughout. A figure and its provenance are produced together
 * or not at all. Recorded text is translated only where a translation has been
 * recorded, and a fallback is marked rather than silently shown in English.
 */

export type Text = {
  readonly text: string;
  /** False when the English fallback is in use, so the template can mark it. */
  readonly translated: boolean;
};

export type Figure = {
  readonly display: string;
  readonly citation: string;
  readonly sourceUrl: string;
  readonly verifiedBy: string;
  readonly verifiedOn: string;
};

/**
 * What we know about measuring a target. Every value is a fact, not a verdict.
 *
 * "Deadline passed" is checkable. "Behind schedule" would be a judgement, and
 * this project does not make it — capacity arrives in steps, and a year without
 * one is not by itself a year behind.
 */
export type MeasurementState = 'measured' | 'no-data' | 'deadline-passed' | 'revised';

export type IndicatorSummary = {
  readonly id: string;
  readonly slug: string;
  readonly category: string;
  readonly title: Text;
  readonly measure: Text;
  readonly classification: 'PROMISE' | 'BENCHMARK' | 'FLOOR';
  readonly states: readonly MeasurementState[];
  readonly promisedYear: number;
  readonly dueBy: number;
  readonly achievedPercent: number | null;
  readonly achievedLabel: string;
  readonly observedAsOf: string | null;
  readonly readings: number;
  readonly lastCheckedOn: string | null;
};

export type SeriesPoint = { readonly asOf: string; readonly value: number; readonly label: string };

export type IndicatorPage = IndicatorSummary & {
  readonly target: Figure;
  readonly observed: Figure;
  readonly remaining: string;
  readonly elapsedPercent: number | null;
  readonly yearsElapsed: string;
  readonly windowYears: number;
  readonly yearsRemaining: number;
  readonly requiredAnnual: string | null;
  readonly met: boolean;
  readonly announcedBy: Text;
  readonly announcedOn: string;
  readonly excludes: Text | null;
  readonly sourceSeries: Text;
  readonly points: readonly SeriesPoint[];
  readonly milestones: readonly MilestoneView[];
  readonly roadmapTotal: string | null;
  readonly roadmapReconciles: boolean;
  readonly context: readonly ContextView[];
  readonly revisions: readonly { seq: number; note: Text; recordedOn: string }[];
  readonly coverage: { verified: number; total: number };
};

export type MilestoneView = {
  readonly label: Text;
  readonly value: string;
  readonly actors: readonly Text[];
  readonly status: 'built' | 'committed' | 'planned';
  readonly basis: 'cumulative' | 'increment';
  readonly by: number | null;
};

export type ContextView = {
  readonly kind: ContextNote['kind'];
  readonly attributedTo: Text;
  readonly statement: Text;
  readonly saidOn: string | null;
  readonly sourceUrl: string;
};

/** Translation lookup, with the fallback flagged rather than hidden. */
export function text(source: string, locale: Locale, table?: Translations): Text {
  if (locale === 'en') return { text: source, translated: true };
  const rendered = inLocale(source, table);
  return { text: rendered.text, translated: rendered.translated };
}

const percent = (q: Quantity): number => Number(q.digits) / 10 ** q.scale;

export const slugFor = (target: Target): string => target.id.toLowerCase();

/**
 * The states of a target, computed from the record.
 *
 * A target can be in several at once: a revised target whose deadline has passed
 * is both. Reporting only the first would hide the more interesting one.
 */
export function statesOf(target: Target, series: Series | undefined, today: string): MeasurementState[] {
  const states: MeasurementState[] = [];
  const revision = currentRevision(target);
  const verified = series?.observations.filter((o) => isVerified(o.value)) ?? [];
  states.push(verified.length > 0 ? 'measured' : 'no-data');
  if (revision.dueBy < Number(today.slice(0, 4))) states.push('deadline-passed');
  if (target.revisions.length > 1) states.push('revised');
  return states;
}

export function summarise(
  target: Target,
  series: Series | undefined,
  locale: Locale,
  table: Translations | undefined,
  today: string,
): IndicatorSummary {
  const revision = currentRevision(target);
  const verified = series?.observations.filter((o) => isVerified(o.value)) ?? [];
  const gap = series && verified.length > 0 ? safeGap(target, series) : undefined;
  const lastChecked = verified
    .map((o) => (o.value.verification.state === 'verified' ? o.value.verification.verifiedOn : ''))
    .sort()
    .at(-1);

  return {
    id: target.id,
    slug: slugFor(target),
    category: target.category,
    title: text(target.title, locale, table),
    measure: text(target.measure.measure, locale, table),
    classification: target.classification.value,
    states: statesOf(target, series, today),
    promisedYear: Number(revision.announcedOn.slice(0, 4)),
    dueBy: revision.dueBy,
    achievedPercent: gap ? percent(gap.achieved) : null,
    achievedLabel: gap ? formatQuantity(gap.achieved) : '—',
    observedAsOf: gap?.observedAsOf ?? null,
    readings: verified.length,
    lastCheckedOn: lastChecked && lastChecked.length > 0 ? lastChecked : null,
  };
}

/** Gap computation that reports its own failure rather than breaking a build silently. */
function safeGap(target: Target, series: Series): Gap | undefined {
  try {
    return computeGap(target, series);
  } catch {
    return undefined;
  }
}

export function buildIndicatorPage(input: {
  target: Target;
  series: Series;
  roadmap?: Roadmap | undefined;
  context: readonly ContextNote[];
  locale: Locale;
  table?: Translations | undefined;
  today: string;
}): IndicatorPage {
  const { target, series, roadmap, context, locale, table, today } = input;
  const gap = computeGap(target, series);
  const revision = currentRevision(target);
  const summary = summarise(target, series, locale, table, today);

  const verifiedPoints = series.observations
    .filter((o) => isVerified(o.value))
    .map((o) => ({
      asOf: o.asOf,
      value: Number(o.value.value.digits) / 10 ** o.value.value.scale,
      label: formatQuantity(o.value.value),
    }));

  const milestones: MilestoneView[] = (roadmap?.milestones ?? [])
    .filter((m) => m.value.verification.state === 'verified')
    .map((m) => ({
      label: text(m.label, locale, table),
      value: formatQuantity(m.value.value),
      actors: m.actors.map((a) => text(a, locale, table)),
      status: m.status.value,
      basis: m.basis,
      by: m.by ?? null,
    }));

  const sums = roadmap ? reconcile(gap.target.value, roadmap) : undefined;

  return {
    ...summary,
    target: figureOf(gap.target, `target ${target.id}`),
    observed: figureOf(gap.observed, `observation ${gap.observedAsOf}`),
    remaining: formatQuantity(gap.remaining),
    elapsedPercent: gap.elapsed ? percent(gap.elapsed) : null,
    yearsElapsed: formatQuantity(gap.yearsElapsed).replace(' years', ''),
    windowYears: gap.windowYears,
    yearsRemaining: gap.yearsRemaining,
    requiredAnnual: gap.requiredAnnualAddition ? formatQuantity(gap.requiredAnnualAddition) : null,
    met: gap.met,
    announcedBy: text(gap.promisedBy, locale, table),
    announcedOn: gap.promisedOn,
    excludes: target.measure.excludes ? text(target.measure.excludes, locale, table) : null,
    sourceSeries: text(target.measure.sourceSeries, locale, table),
    points: verifiedPoints,
    milestones,
    roadmapTotal: sums ? formatQuantity(sums.total) : null,
    roadmapReconciles: sums?.reconciles ?? false,
    context: context
      .filter((n) => n.statement.verification.state === 'verified')
      .map((n) => ({
        kind: n.kind,
        attributedTo: text(n.attributedTo, locale, table),
        statement: text(n.statement.value, locale, table),
        saidOn: n.saidOn ?? null,
        sourceUrl: n.statement.provenance.sourceUrl,
      })),
    revisions: target.revisions
      .filter((r) => r.seq > 1)
      .map((r) => ({ seq: r.seq, note: text(r.note, locale, table), recordedOn: r.recordedOn })),
    coverage: {
      verified: verifiedPoints.length,
      total: series.observations.length,
    },
  };
}

/**
 * A figure and its citation, produced together.
 *
 * There is no bare-value field. A template cannot render the number without
 * also holding where it came from and who signed it, which is what stops a
 * refactor three layers up from dropping the provenance.
 */
function figureOf(
  attested: { value: Quantity; provenance: import('../kernel/provenance.ts').Provenance; verification: import('../kernel/verification.ts').Verification },
  context: string,
): Figure {
  if (attested.verification.state !== 'verified') {
    throw new Error(`Refusing to render an unverified figure in ${context}.`);
  }
  return {
    display: formatQuantity(attested.value),
    citation: citation(attested.provenance),
    sourceUrl: attested.provenance.sourceUrl,
    verifiedBy: displayName(attested.verification.verifiedBy),
    verifiedOn: attested.verification.verifiedOn,
  };
}
