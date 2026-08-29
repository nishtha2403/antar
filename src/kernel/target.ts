import { type Brand, brandAs } from './brand.ts';
import { type HumanIdentity, KernelError } from './identity.ts';
import type { Provenance } from './provenance.ts';
import type { Quantity } from './quantity.ts';
import { type IsoDate, isoDate, type TargetYear } from './time.ts';
import type { Attested } from './verification.ts';

export type TargetId = Brand<string, 'TargetId'>;

const asTargetId = brandAs<'TargetId'>();
const TARGET_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;

/** Stable, readable, and printable in a citation: `NEM-2047-100GW`. */
export function targetId(id: string): TargetId {
  if (!TARGET_ID.test(id)) {
    throw new KernelError(
      `Invalid target id ${JSON.stringify(id)}. Expected uppercase segments, e.g. "NEM-2047-100GW".`,
    );
  }
  return asTargetId(id);
}

/**
 * What kind of thing the number is.
 *
 * The brief singles this out: the founding document already got this wrong once,
 * and a BENCHMARK reported as a PROMISE is the difference between an accusation
 * and an observation. So it is a human judgement with a name and a rationale
 * attached, and there is no constructor that omits them.
 */
export type TargetClass =
  /** The state said it would do this. Attributable. */
  | 'PROMISE'
  /** A reference point or international comparison. Not a commitment. */
  | 'BENCHMARK'
  /** A statutory or scheme minimum. Compliance, not ambition. */
  | 'FLOOR';

/**
 * What the number measures, which decides what it may be compared against.
 *
 * Comparing an input to an outcome is how a project like this produces a
 * confident, well-sourced, wrong claim.
 */
export type IndicatorType =
  /** Money or resource committed. */
  | 'input'
  /** Activity performed with it. */
  | 'execution'
  /** Direct product of the activity. */
  | 'output'
  /** Change in the world. Rarely attributable to one actor. */
  | 'outcome';

export type HumanJudgement<T> = {
  readonly value: T;
  readonly decidedBy: HumanIdentity;
  readonly decidedOn: IsoDate;
  /** Why. Required, because an unexplained classification cannot be reviewed. */
  readonly rationale: string;
};

function judgement<T>(
  value: T,
  by: HumanIdentity,
  on: string,
  rationale: string,
  what: string,
): HumanJudgement<T> {
  if (!rationale.trim()) {
    throw new KernelError(`${what} needs a written rationale. An unexplained call cannot be reviewed.`);
  }
  return { value, decidedBy: by, decidedOn: isoDate(on), rationale: rationale.trim() };
}

export const classify = (
  value: TargetClass,
  by: HumanIdentity,
  on: string,
  rationale: string,
): HumanJudgement<TargetClass> => judgement(value, by, on, rationale, 'Classification');

export const typeIndicator = (
  value: IndicatorType,
  by: HumanIdentity,
  on: string,
  rationale: string,
): HumanJudgement<IndicatorType> => judgement(value, by, on, rationale, 'Indicator typing');

/**
 * The exact thing being measured.
 *
 * `measure` is the sentence that makes the indicator unambiguous, `sourceSeries`
 * names the series it is read from, and `vintage` records whether this is a
 * current measurement or the last available one — the brief requires those to be
 * labelled differently.
 */
export type Measure = {
  /** "Installed nuclear electricity generation capacity", not "nuclear power". */
  readonly measure: string;
  readonly unit: string;
  /** "CEA Installed Capacity Report, All-India, Nuclear". */
  readonly sourceSeries: string;
  readonly vintage: 'current' | 'last-available';
};

/**
 * One version of a target. Never edited, only superseded.
 *
 * A revision is created when the state changes a target — a deadline slips, a
 * figure is restated — and the original stays in the record with its own
 * provenance. This is the machinery that makes the G5 target-revision watcher
 * meaningful: it can only surface a change if the previous value still exists.
 */
export type TargetRevision = {
  /** 1-based, contiguous, assigned by the kernel. */
  readonly seq: number;
  /** The seq this replaces as the operative value. Absent on the original. */
  readonly supersedes?: number;
  readonly value: Attested<Quantity>;
  readonly dueBy: TargetYear;
  /** The body that announced it: "Ministry of Finance", "PMO". */
  readonly announcedBy: string;
  readonly announcedOn: IsoDate;
  readonly provenance: Provenance;
  /** Who entered this revision into the record. */
  readonly recordedBy: HumanIdentity;
  readonly recordedOn: IsoDate;
  /** What changed and how it was noticed. Empty on the original revision. */
  readonly note: string;
};

export type Target = {
  readonly id: TargetId;
  readonly title: string;
  readonly measure: Measure;
  readonly classification: HumanJudgement<TargetClass>;
  readonly indicatorType: HumanJudgement<IndicatorType>;
  /** Non-empty by construction: a target with no revisions cannot exist. */
  readonly revisions: readonly [TargetRevision, ...TargetRevision[]];
};

export type RevisionInput = {
  readonly value: Attested<Quantity>;
  readonly dueBy: TargetYear;
  readonly announcedBy: string;
  readonly announcedOn: string;
  readonly provenance: Provenance;
  readonly recordedBy: HumanIdentity;
  readonly recordedOn: string;
};

export function createTarget(input: {
  readonly id: TargetId;
  readonly title: string;
  readonly measure: Measure;
  readonly classification: HumanJudgement<TargetClass>;
  readonly indicatorType: HumanJudgement<IndicatorType>;
  readonly original: RevisionInput;
}): Target {
  if (!input.title.trim()) throw new KernelError('A target needs a title.');
  if (input.original.value.value.unit !== input.measure.unit) {
    throw new KernelError(
      `Target ${input.id}: value is in "${input.original.value.value.unit}" but the measure is defined in ` +
        `"${input.measure.unit}". The kernel does not convert units.`,
    );
  }
  const first: TargetRevision = {
    seq: 1,
    value: input.original.value,
    dueBy: input.original.dueBy,
    announcedBy: input.original.announcedBy,
    announcedOn: isoDate(input.original.announcedOn),
    provenance: input.original.provenance,
    recordedBy: input.original.recordedBy,
    recordedOn: isoDate(input.original.recordedOn),
    note: '',
  };
  return deepFreeze({ ...input, revisions: [first] as [TargetRevision] });
}

/**
 * Appends a revision and returns a new target. The input target is untouched.
 *
 * There is no counterpart to this function. Nothing in the kernel removes,
 * reorders or rewrites a revision, and `Target` is frozen, so an attempt to
 * mutate the history throws in strict mode rather than succeeding quietly.
 * Correcting a mistaken revision means appending another one that says so.
 */
export function reviseTarget(target: Target, input: RevisionInput & { note: string }): Target {
  if (!input.note.trim()) {
    throw new KernelError(
      `Revising ${target.id} needs a note recording what changed and how it was noticed. ` +
        'A silent revision is indistinguishable from the deadline slip it is meant to catch.',
    );
  }
  if (input.value.value.unit !== target.measure.unit) {
    throw new KernelError(
      `Revision of ${target.id} is in "${input.value.value.unit}", measure is "${target.measure.unit}".`,
    );
  }
  const previous = currentRevision(target);
  const next: TargetRevision = {
    seq: previous.seq + 1,
    supersedes: previous.seq,
    value: input.value,
    dueBy: input.dueBy,
    announcedBy: input.announcedBy,
    announcedOn: isoDate(input.announcedOn),
    provenance: input.provenance,
    recordedBy: input.recordedBy,
    recordedOn: isoDate(input.recordedOn),
    note: input.note.trim(),
  };
  return deepFreeze({
    ...target,
    revisions: [...target.revisions, next] as [TargetRevision, ...TargetRevision[]],
  });
}

/** The operative value today. */
export function currentRevision(target: Target): TargetRevision {
  return target.revisions[target.revisions.length - 1] as TargetRevision;
}

/** The operative value as of a date — what the target said at the time. */
export function revisionAsOf(target: Target, on: IsoDate): TargetRevision | undefined {
  let found: TargetRevision | undefined;
  for (const revision of target.revisions) {
    if (revision.recordedOn <= on) found = revision;
  }
  return found;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}
