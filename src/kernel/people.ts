import { type HumanIdentity, humanIdentity, KernelError } from './identity.ts';

/**
 * The people who can sign off a figure, and how their names are written.
 *
 * Two different things, deliberately kept apart. The handle is the stable key
 * that appears in every record and never changes — lowercase, no spaces, safe to
 * join on and safe in a filename. The display name is what a reader sees, and it
 * is the person's name as they write it.
 *
 * Collapsing the two would mean either putting "Nishtha Sharma" into every
 * record key, where a stray capital or double space silently forks one person
 * into two, or showing readers a handle and asking them to accept `n.sharma` as
 * accountability. Neither is acceptable, so both exist.
 *
 * This list is code rather than data because who may verify a figure is a
 * governance question, not a configuration one. Adding a person is a change
 * someone reviews. When the succession clause is written, this is one of the
 * things it governs.
 */
const REGISTRY: Readonly<Record<string, string>> = {
  'nishtha.sharma': 'Nishtha Sharma',
};

export const FOUNDER: HumanIdentity = humanIdentity('nishtha.sharma');

/** The name to show a reader. Raises for an unregistered handle. */
export function displayName(id: HumanIdentity): string {
  const name = REGISTRY[id];
  if (name === undefined) {
    throw new KernelError(
      `No display name registered for ${JSON.stringify(id)}. ` +
        'A figure cannot be published under a handle nobody has put a name to — ' +
        'add the person to src/kernel/people.ts.',
    );
  }
  return name;
}

export const isRegistered = (id: string): boolean => id in REGISTRY;
