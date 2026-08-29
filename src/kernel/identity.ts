import { type Brand, brandAs } from './brand.ts';

/**
 * A named human being who is accountable for a judgement the kernel refuses to
 * make on its own.
 *
 * Rule 1 of the allocation model is "agents propose, humans dispose". That rule
 * is only real if disposal leaves a name attached. Every field in this kernel
 * that records a human decision is typed `HumanIdentity`, and the constructor
 * is the only way to make one.
 */
export type HumanIdentity = Brand<string, 'HumanIdentity'>;

const asHuman = brandAs<'HumanIdentity'>();

/** Identifiers are stable handles, not display names. Keep them boring. */
const HUMAN_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export function humanIdentity(id: string): HumanIdentity {
  if (!HUMAN_ID.test(id)) {
    throw new KernelError(
      `Invalid human identity ${JSON.stringify(id)}. ` +
        'Expected a stable lowercase handle such as "n.sharma", not a display name.',
    );
  }
  return asHuman(id);
}

/**
 * A non-human actor: a scraper, an extraction agent, a build step.
 *
 * Agents get identities too, because provenance has to record who proposed a
 * value as well as who accepted it. What an agent identity can never do is
 * appear in a field typed `HumanIdentity` — that is the whole point of keeping
 * the two types distinct.
 */
export type AgentIdentity = Brand<string, 'AgentIdentity'>;

const asAgent = brandAs<'AgentIdentity'>();

export function agentIdentity(id: string): AgentIdentity {
  if (!HUMAN_ID.test(id)) {
    throw new KernelError(`Invalid agent identity ${JSON.stringify(id)}.`);
  }
  return asAgent(id);
}

/**
 * Who did something, tagged with which kind of actor they are.
 *
 * `HumanIdentity` and `AgentIdentity` are distinct at compile time and identical
 * at runtime — both are strings once the brand is erased — so a record that
 * stores only the id cannot say afterwards whether a person or a scraper
 * retrieved a document. That distinction is the difference between provenance
 * and decoration, so it is carried explicitly rather than inferred.
 */
export type Actor =
  | { readonly kind: 'human'; readonly id: HumanIdentity }
  | { readonly kind: 'agent'; readonly id: AgentIdentity };

export const byHuman = (id: HumanIdentity): Actor => ({ kind: 'human', id });
export const byAgent = (id: AgentIdentity): Actor => ({ kind: 'agent', id });

export class KernelError extends Error {
  override readonly name = 'KernelError';
}
