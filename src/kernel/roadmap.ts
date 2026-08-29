import { type HumanIdentity, KernelError } from './identity.ts';
import type { Provenance } from './provenance.ts';
import { assertSameUnit, compareQuantity, type Quantity, subtractQuantity } from './quantity.ts';
import type { HumanJudgement, TargetId } from './target.ts';
import { type IsoDate, isoDate, type TargetYear } from './time.ts';
import type { Attested } from './verification.ts';

/**
 * How a target is meant to be reached, according to the source that set it.
 *
 * A single "91.22 GW remaining" reads as one quantity owed by one actor. The
 * government's own roadmap for this target says otherwise: about half is planned
 * through NPCIL and the balance is expected from state governments, other public
 * enterprises, the private sector and joint ventures. A page that shows only the
 * total attributes the whole gap, by implication, to the body that made the
 * promise — which is over-attribution, and misleading in the same way as omitting
 * what a capacity figure excludes.
 *
 * Two things this deliberately does not do.
 *
 * It does not turn a projection into a commitment. A government saying that
 * private operators will supply 46 GW is not those operators undertaking to. The
 * distinction is a `status` a human decides, and `planned` is the honest default.
 *
 * It does not assign responsibility. Actors are recorded as the source names
 * them, quoted rather than attributed. Deciding who is answerable for a shortfall
 * is a human judgement in the responsibility graph, not something a record type
 * infers from a list of names.
 */
export type MilestoneStatus =
  /** Already in service, and observable in a published series. */
  | 'built'
  /** A named actor has undertaken to deliver it. Requires evidence of the undertaking. */
  | 'committed'
  /** The source projects it. Nobody named has promised it. */
  | 'planned';

/**
 * Whether a figure is a running total or an addition.
 *
 * The source mixes them — "expected to reach about 22 GW by 2031-32" is
 * cumulative, "another 32 GW is envisaged" is an increment — and a record that
 * flattens the two produces a roadmap that double-counts or falls short while
 * looking perfectly tidy.
 */
export type MilestoneBasis = 'cumulative' | 'increment';

export type Milestone = {
  /** As a reader would say it: "Expected by 2031-32 from projects under construction". */
  readonly label: string;
  readonly value: Attested<Quantity>;
  readonly basis: MilestoneBasis;
  /** When the source says it lands. Absent where the source gives no date. */
  readonly by?: TargetYear;
  /** Institutions exactly as the source names them. Never expanded or inferred. */
  readonly actors: readonly string[];
  readonly status: HumanJudgement<MilestoneStatus>;
  readonly provenance: Provenance;
  readonly recordedBy: HumanIdentity;
  readonly recordedOn: IsoDate;
};

export type Roadmap = {
  readonly targetId: TargetId;
  readonly milestones: readonly Milestone[];
};

export function milestoneStatus(
  value: MilestoneStatus,
  by: HumanIdentity,
  on: string,
  rationale: string,
): HumanJudgement<MilestoneStatus> {
  if (!rationale.trim()) {
    throw new KernelError(
      'A milestone status needs a written reason. Whether something is committed or merely ' +
        'planned is the difference between reporting a promise and inventing one.',
    );
  }
  return { value, decidedBy: by, decidedOn: isoDate(on), rationale: rationale.trim() };
}

export function roadmap(targetId: TargetId, milestones: readonly Milestone[]): Roadmap {
  if (milestones.length === 0) {
    throw new KernelError(`Roadmap for ${targetId} has no milestones.`);
  }
  const units = new Set(milestones.map((m) => m.value.value.unit));
  if (units.size > 1) {
    throw new KernelError(
      `Roadmap for ${targetId} mixes units: ${[...units].join(', ')}. The kernel does not convert.`,
    );
  }
  return { targetId, milestones };
}

export type Reconciliation = {
  /** Largest cumulative figure, plus every increment stated on top of it. */
  readonly total: Quantity;
  readonly target: Quantity;
  readonly difference: Quantity;
  readonly reconciles: boolean;
};

/**
 * Checks the roadmap against the target it claims to reach.
 *
 * The source's own arithmetic should close: the highest running total plus the
 * increments stated beyond it ought to equal the target. When it does, the
 * decomposition is safe to publish. When it does not, that is a finding about
 * the source worth surfacing rather than a rounding to absorb — a roadmap that
 * does not add up to its own target is exactly the sort of thing this project
 * exists to notice.
 */
export function reconcile(target: Quantity, plan: Roadmap): Reconciliation {
  const cumulative = plan.milestones.filter((m) => m.basis === 'cumulative');
  const increments = plan.milestones.filter((m) => m.basis === 'increment');

  let total: Quantity = { digits: 0n, scale: 0, unit: target.unit };
  for (const m of cumulative) {
    assertSameUnit(m.value.value, target, 'roadmap reconciliation');
    if (compareQuantity(m.value.value, total) > 0) total = m.value.value;
  }
  for (const m of increments) {
    assertSameUnit(m.value.value, target, 'roadmap reconciliation');
    const scale = Math.max(total.scale, m.value.value.scale);
    const lift = (q: Quantity) => q.digits * 10n ** BigInt(scale - q.scale);
    total = { digits: lift(total) + lift(m.value.value), scale, unit: target.unit };
  }

  const difference = subtractQuantity(target, total);
  return { total, target, difference, reconciles: difference.digits === 0n };
}
