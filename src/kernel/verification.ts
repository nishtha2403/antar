import { type HumanIdentity, KernelError } from './identity.ts';
import type { Provenance } from './provenance.ts';
import { type IsoDate, isoDate } from './time.ts';

/**
 * The verification state machine.
 *
 *     attest()          verify()
 *   ─────────────▶ unverified ─────────────▶ verified
 *                      │
 *                      │ reject()
 *                      ▼
 *                   rejected
 *
 * Three properties are deliberate.
 *
 * Only `verified` renders, and that is a compile-time fact: the render layer
 * accepts `Verified<T>` and nothing else, so passing an unverified figure to it
 * fails `tsc` rather than a review.
 *
 * `verify` accepts only `Unverified<T>`. A verified figure cannot be verified
 * again, so a second signature can never quietly overwrite the first. Re-checking
 * a figure after its source changes means re-attesting it from that source,
 * which produces a new figure with its own provenance.
 *
 * Verification is typed `HumanIdentity`. An agent identity is a structurally
 * different type and cannot be passed here at all. This is rule 1 — agents
 * propose, humans dispose — expressed as a type error rather than a convention.
 */
export type VerificationState = 'unverified' | 'verified' | 'rejected';

export type Verification =
  | { readonly state: 'unverified' }
  | {
      readonly state: 'verified';
      readonly verifiedBy: HumanIdentity;
      readonly verifiedOn: IsoDate;
      /** How it was checked, in a person's words: "read against PIB PDF p.2". */
      readonly method: string;
    }
  | {
      readonly state: 'rejected';
      readonly rejectedBy: HumanIdentity;
      readonly rejectedOn: IsoDate;
      readonly reason: string;
    };

export type VerificationFor<S extends VerificationState> = Extract<Verification, { state: S }>;

/**
 * A value bound to its provenance and its verification state.
 *
 * There is no accessor that returns the bare value to a caller that has not
 * proved the state, which is what "provenance travels with the value" means in
 * practice rather than in a comment.
 */
export type Attested<T, S extends VerificationState = VerificationState> = {
  readonly value: T;
  readonly provenance: Provenance;
  readonly verification: VerificationFor<S>;
};

export type Unverified<T> = Attested<T, 'unverified'>;
export type Verified<T> = Attested<T, 'verified'>;
export type Rejected<T> = Attested<T, 'rejected'>;

/** Entry point. Everything enters the kernel unverified, without exception. */
export function attest<T>(value: T, source: Provenance): Unverified<T> {
  return { value, provenance: source, verification: { state: 'unverified' } };
}

export function verify<T>(
  figure: Unverified<T>,
  by: HumanIdentity,
  on: string,
  method: string,
): Verified<T> {
  if (!method.trim()) {
    throw new KernelError(
      'Verification needs a method. "How did you check this?" is answerable or the check did not happen.',
    );
  }
  return {
    value: figure.value,
    provenance: figure.provenance,
    verification: {
      state: 'verified',
      verifiedBy: by,
      verifiedOn: isoDate(on),
      method: method.trim(),
    },
  };
}

export function reject<T>(
  figure: Unverified<T>,
  by: HumanIdentity,
  on: string,
  reason: string,
): Rejected<T> {
  if (!reason.trim()) throw new KernelError('Rejection needs a reason.');
  return {
    value: figure.value,
    provenance: figure.provenance,
    verification: {
      state: 'rejected',
      rejectedBy: by,
      rejectedOn: isoDate(on),
      reason: reason.trim(),
    },
  };
}

export const isVerified = <T>(f: Attested<T>): f is Verified<T> =>
  f.verification.state === 'verified';

/**
 * The runtime half of the guarantee.
 *
 * TypeScript's types are erased at compile time, so the compile-time guard
 * covers our own code and nothing else. Data crossing a boundary the compiler
 * cannot see — JSON off disk, a scraper payload, an agent's output — is checked
 * here instead. Both halves are load-bearing; neither is sufficient alone.
 */
export function assertVerified<T>(f: Attested<T>, context: string): asserts f is Verified<T> {
  if (f.verification.state !== 'verified') {
    throw new KernelError(
      `Refusing to publish an unverified figure in ${context}. ` +
        `State is "${f.verification.state}". Source: ${f.provenance.sourceUrl}`,
    );
  }
}
