import { agentIdentity, byAgent, byHuman, humanIdentity, KernelError } from '../kernel/identity.ts';
import { provenance, type Provenance } from '../kernel/provenance.ts';
import { quantityFromJSON, quantityToJSON, type Quantity } from '../kernel/quantity.ts';
import {
  classify,
  createTarget,
  type IndicatorType,
  reviseTarget,
  type Target,
  targetId,
  seriesSlug,
  type TargetClass,
  type TargetRevision,
  typeIndicator,
} from '../kernel/target.ts';
import { isoDate, targetYear } from '../kernel/time.ts';
import { type ContextKind, type ContextNote, contextNote } from '../kernel/context.ts';
import type { Observation } from '../kernel/series.ts';
import { type Milestone, type MilestoneBasis, milestoneStatus, type MilestoneStatus } from '../kernel/roadmap.ts';
import { type Attested, attest, reject, verify } from '../kernel/verification.ts';

/**
 * JSON is the wire format, not the model.
 *
 * Decoding routes every field back through the kernel constructors, so a
 * hand-edited or corrupted file fails on read with the same errors it would have
 * failed with on write. Nothing enters the model by being shaped correctly; it
 * enters by being validated.
 */

type JsonProvenance = Omit<Provenance, 'retrievedBy'> & {
  retrievedBy: { kind: 'human' | 'agent'; id: string };
};

/**
 * The actor's kind travels in the record rather than being supplied by the
 * caller writing it. An earlier version took it as a parameter, and a scraped
 * document was duly filed as having been retrieved by a human.
 */
export const encodeProvenance = (p: Provenance): JsonProvenance => ({
  ...p,
  retrievedBy: { kind: p.retrievedBy.kind, id: p.retrievedBy.id },
});

export const decodeProvenance = (j: JsonProvenance): Provenance =>
  provenance({
    ...j,
    retrievedBy:
      j.retrievedBy.kind === 'human'
        ? byHuman(humanIdentity(j.retrievedBy.id))
        : byAgent(agentIdentity(j.retrievedBy.id)),
  });

/** The attested-value envelope, independent of what is inside it. */
function encodeVerification(a: Attested<unknown>) {
  return { provenance: encodeProvenance(a.provenance), verification: a.verification };
}

export function encodeAttestedString(a: Attested<string>) {
  return { value: a.value, ...encodeVerification(a) };
}

type JsonAttestedString = ReturnType<typeof encodeAttestedString>;

export function decodeAttestedString(j: JsonAttestedString): Attested<string> {
  const base = attest(j.value, decodeProvenance(j.provenance));
  switch (j.verification.state) {
    case 'unverified':
      return base;
    case 'verified':
      return verify(base, humanIdentity(j.verification.verifiedBy), j.verification.verifiedOn, j.verification.method);
    case 'rejected':
      return reject(base, humanIdentity(j.verification.rejectedBy), j.verification.rejectedOn, j.verification.reason);
    default: {
      const state: never = j.verification;
      throw new KernelError(`Unknown verification state: ${JSON.stringify(state)}`);
    }
  }
}

export type ContextNoteJson = {
  kind: ContextKind;
  attributedTo: string;
  statement: JsonAttestedString;
  saidOn?: string;
  recordedBy: string;
  recordedOn: string;
};

export const encodeContextNote = (n: ContextNote): ContextNoteJson => ({
  kind: n.kind,
  attributedTo: n.attributedTo,
  statement: encodeAttestedString(n.statement),
  ...(n.saidOn === undefined ? {} : { saidOn: n.saidOn }),
  recordedBy: n.recordedBy,
  recordedOn: n.recordedOn,
});

const CONTEXT_KINDS = new Set(['stated-purpose', 'stated-plan', 'recorded-event']);

export function decodeContextNote(j: ContextNoteJson): ContextNote {
  if (!CONTEXT_KINDS.has(j.kind)) throw new KernelError(`Unknown context kind ${j.kind}.`);
  return contextNote({
    kind: j.kind,
    attributedTo: j.attributedTo,
    statement: decodeAttestedString(j.statement),
    ...(j.saidOn === undefined ? {} : { saidOn: j.saidOn }),
    recordedBy: humanIdentity(j.recordedBy),
    recordedOn: j.recordedOn,
  });
}

export function encodeAttestedQuantity(a: Attested<Quantity>) {
  return {
    value: quantityToJSON(a.value),
    provenance: encodeProvenance(a.provenance),
    verification: a.verification,
  };
}

type JsonAttestedQuantity = ReturnType<typeof encodeAttestedQuantity>;

export function decodeAttestedQuantity(j: JsonAttestedQuantity): Attested<Quantity> {
  const base = attest(quantityFromJSON(j.value), decodeProvenance(j.provenance));
  switch (j.verification.state) {
    case 'unverified':
      return base;
    case 'verified':
      return verify(
        base,
        humanIdentity(j.verification.verifiedBy),
        j.verification.verifiedOn,
        j.verification.method,
      );
    case 'rejected':
      return reject(
        base,
        humanIdentity(j.verification.rejectedBy),
        j.verification.rejectedOn,
        j.verification.reason,
      );
    default: {
      const state: never = j.verification;
      throw new KernelError(`Unknown verification state: ${JSON.stringify(state)}`);
    }
  }
}

export type TargetHeaderJson = {
  id: string;
  title: string;
  series: string;
  measure: Target['measure'];
  classification: { value: string; decidedBy: string; decidedOn: string; rationale: string };
  indicatorType: { value: string; decidedBy: string; decidedOn: string; rationale: string };
};

export type RevisionJson = {
  seq: number;
  supersedes?: number;
  value: JsonAttestedQuantity;
  dueBy: number;
  announcedBy: string;
  announcedOn: string;
  provenance: JsonProvenance;
  recordedBy: string;
  recordedOn: string;
  note: string;
};

export const encodeTargetHeader = (t: Target): TargetHeaderJson => ({
  id: t.id,
  title: t.title,
  series: t.series,
  measure: t.measure,
  classification: { ...t.classification, value: t.classification.value },
  indicatorType: { ...t.indicatorType, value: t.indicatorType.value },
});

export const encodeRevision = (r: TargetRevision): RevisionJson => ({
  seq: r.seq,
  ...(r.supersedes === undefined ? {} : { supersedes: r.supersedes }),
  value: encodeAttestedQuantity(r.value),
  dueBy: r.dueBy,
  announcedBy: r.announcedBy,
  announcedOn: r.announcedOn,
  provenance: encodeProvenance(r.provenance),
  recordedBy: r.recordedBy,
  recordedOn: r.recordedOn,
  note: r.note,
});

const TARGET_CLASSES = new Set(['PROMISE', 'BENCHMARK', 'FLOOR']);
const INDICATOR_TYPES = new Set(['input', 'execution', 'output', 'outcome']);

/**
 * Rebuilds a target from its header and its revision files.
 *
 * Revisions are replayed in order through `reviseTarget`, so the append-only
 * rules are re-checked on every load. A file that was edited by hand to rewrite
 * history fails here rather than being trusted because it is on disk.
 */
export function decodeTarget(header: TargetHeaderJson, revisions: readonly RevisionJson[]): Target {
  if (revisions.length === 0) {
    throw new KernelError(`Target ${header.id} has no revisions on disk.`);
  }
  const ordered = [...revisions].sort((a, b) => a.seq - b.seq);
  ordered.forEach((r, i) => {
    if (r.seq !== i + 1) {
      throw new KernelError(
        `Target ${header.id} has a gap in its revision sequence at ${r.seq}. ` +
          'Revisions are contiguous and append-only; a gap means a file was removed.',
      );
    }
  });

  if (!TARGET_CLASSES.has(header.classification.value)) {
    throw new KernelError(`Unknown target class ${header.classification.value}.`);
  }
  if (!INDICATOR_TYPES.has(header.indicatorType.value)) {
    throw new KernelError(`Unknown indicator type ${header.indicatorType.value}.`);
  }

  const [first, ...rest] = ordered as [RevisionJson, ...RevisionJson[]];
  if (!header.series) {
    throw new KernelError(
      `Target ${header.id} names no observation series. A target with nothing measuring it ` +
        'cannot have a gap computed, so this is an error rather than a default.',
    );
  }

  let target = createTarget({
    id: targetId(header.id),
    title: header.title,
    series: seriesSlug(header.series),
    measure: header.measure,
    classification: classify(
      header.classification.value as TargetClass,
      humanIdentity(header.classification.decidedBy),
      header.classification.decidedOn,
      header.classification.rationale,
    ),
    indicatorType: typeIndicator(
      header.indicatorType.value as IndicatorType,
      humanIdentity(header.indicatorType.decidedBy),
      header.indicatorType.decidedOn,
      header.indicatorType.rationale,
    ),
    original: {
      value: decodeAttestedQuantity(first.value),
      dueBy: targetYear(first.dueBy),
      announcedBy: first.announcedBy,
      announcedOn: first.announcedOn,
      provenance: decodeProvenance(first.provenance),
      recordedBy: humanIdentity(first.recordedBy),
      recordedOn: first.recordedOn,
    },
  });

  for (const r of rest) {
    target = reviseTarget(target, {
      value: decodeAttestedQuantity(r.value),
      dueBy: targetYear(r.dueBy),
      announcedBy: r.announcedBy,
      announcedOn: r.announcedOn,
      provenance: decodeProvenance(r.provenance),
      recordedBy: humanIdentity(r.recordedBy),
      recordedOn: r.recordedOn,
      note: r.note,
    });
  }
  return target;
}

export type ObservationJson = {
  asOf: string;
  value: JsonAttestedQuantity;
};

export type MeasureJson = {
  slug: string;
  measure: Target['measure'];
};

export const encodeObservation = (o: Observation): ObservationJson => ({
  asOf: o.asOf,
  value: encodeAttestedQuantity(o.value),
});

export const decodeObservation = (j: ObservationJson): Observation => ({
  asOf: isoDate(j.asOf),
  value: decodeAttestedQuantity(j.value),
});

export type MilestoneJson = {
  label: string;
  value: JsonAttestedQuantity;
  basis: MilestoneBasis;
  by?: number;
  actors: string[];
  status: { value: string; decidedBy: string; decidedOn: string; rationale: string };
  provenance: JsonProvenance;
  recordedBy: string;
  recordedOn: string;
};

export const encodeMilestone = (m: Milestone): MilestoneJson => ({
  label: m.label,
  value: encodeAttestedQuantity(m.value),
  basis: m.basis,
  ...(m.by === undefined ? {} : { by: m.by }),
  actors: [...m.actors],
  status: { ...m.status, value: m.status.value },
  provenance: encodeProvenance(m.provenance),
  recordedBy: m.recordedBy,
  recordedOn: m.recordedOn,
});

const MILESTONE_STATUSES = new Set(['built', 'committed', 'planned']);

export function decodeMilestone(j: MilestoneJson): Milestone {
  if (!MILESTONE_STATUSES.has(j.status.value)) {
    throw new KernelError(`Unknown milestone status ${j.status.value}.`);
  }
  if (j.basis !== 'cumulative' && j.basis !== 'increment') {
    throw new KernelError(`Unknown milestone basis ${JSON.stringify(j.basis)}.`);
  }
  return {
    label: j.label,
    value: decodeAttestedQuantity(j.value),
    basis: j.basis,
    ...(j.by === undefined ? {} : { by: targetYear(j.by) }),
    actors: j.actors,
    status: milestoneStatus(
      j.status.value as MilestoneStatus,
      humanIdentity(j.status.decidedBy),
      j.status.decidedOn,
      j.status.rationale,
    ),
    provenance: decodeProvenance(j.provenance),
    recordedBy: humanIdentity(j.recordedBy),
    recordedOn: isoDate(j.recordedOn),
  };
}
