import type { HumanIdentity } from './identity.ts';
import { KernelError } from './identity.ts';
import { type IsoDate, isoDate } from './time.ts';
import type { Attested } from './verification.ts';

/**
 * Context that belongs to a source, not to Antar.
 *
 * A reader who does not already know why 100 GW matters gets nothing from a
 * table, so context is necessary. The rule is that it is attributed rather than
 * asserted: "the mission's stated purpose is to support net zero by 2070" is
 * reportable and checkable; "nuclear is essential to India's climate goals" is
 * an opinion, and publishing it would lend every figure on the page the reader's
 * view of that opinion.
 *
 * The distinction is not tone. It is whether a hostile reader has a document to
 * consult. Partisan outlets rarely lie outright — they mix sourced fact with
 * unsourced interpretation, and a project that does the same with better
 * politics is structurally the same product.
 *
 * `attributedTo` is therefore mandatory and rendered next to every statement,
 * for the same reason a figure cannot be rendered without its citation.
 */
export type ContextKind =
  /** Why the source says the target exists. */
  | 'stated-purpose'
  /** What the source says it will do. Not evidence that it will. */
  | 'stated-plan'
  /** Something that happened, with a date: a sanction, a commissioning, an Act. */
  | 'recorded-event';

export type ContextNote = {
  readonly kind: ContextKind;
  /** The body making the claim, named as the source names it. Never inferred. */
  readonly attributedTo: string;
  /**
   * The claim, paraphrased closely or quoted, carrying its own provenance and
   * verification. Nothing renders until a person has checked it against the
   * document.
   */
  readonly statement: Attested<string>;
  /** When the source said it, where the source gives a date. */
  readonly saidOn?: IsoDate;
  readonly recordedBy: HumanIdentity;
  readonly recordedOn: IsoDate;
};

export function contextNote(input: {
  readonly kind: ContextKind;
  readonly attributedTo: string;
  readonly statement: Attested<string>;
  readonly saidOn?: string;
  readonly recordedBy: HumanIdentity;
  readonly recordedOn: string;
}): ContextNote {
  if (!input.attributedTo.trim()) {
    throw new KernelError(
      'A context note needs an attribution. An unattributed statement is Antar asserting it, ' +
        'which is the one thing this record type exists to prevent.',
    );
  }
  if (!input.statement.value.trim()) throw new KernelError('A context note needs a statement.');
  return {
    kind: input.kind,
    attributedTo: input.attributedTo.trim(),
    statement: input.statement,
    ...(input.saidOn ? { saidOn: isoDate(input.saidOn) } : {}),
    recordedBy: input.recordedBy,
    recordedOn: isoDate(input.recordedOn),
  };
}
