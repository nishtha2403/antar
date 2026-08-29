import { type Actor, KernelError } from './identity.ts';
import { type IsoDate, isoDate } from './time.ts';

/**
 * Where a value came from, and who fetched it.
 *
 * Provenance is not metadata hanging off a record. It is part of the value's
 * type, so that a figure and its citation cannot be separated by any amount of
 * downstream refactoring. Nothing in the kernel accepts a bare number where a
 * figure is expected.
 */
export type Provenance = {
  /** Canonical, resolvable, and specific enough to check the figure against. */
  readonly sourceUrl: string;
  /** As the source titles itself. Used verbatim in citations. */
  readonly sourceTitle: string;
  /** The issuing body: "Press Information Bureau", "Central Electricity Authority". */
  readonly publisher: string;
  /** When the source says it was published, where the source says so. */
  readonly publishedOn?: IsoDate;
  /** When we fetched it. Government pages are edited in place without notice. */
  readonly retrievedOn: IsoDate;
  /** Scraper, agent or person. Not a verification — only a record of retrieval. */
  readonly retrievedBy: Actor;
  /** Page, table or section. A 300-page budget PDF is not a citation. */
  readonly locator?: string;
  /** Optional integrity check for archived source documents. */
  readonly documentSha256?: string;
};

export type ProvenanceInput = Omit<Provenance, 'publishedOn' | 'retrievedOn'> & {
  readonly publishedOn?: string;
  readonly retrievedOn: string;
};

export function provenance(input: ProvenanceInput): Provenance {
  const url = input.sourceUrl?.trim() ?? '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new KernelError(`Provenance needs a resolvable source URL, got ${JSON.stringify(url)}.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new KernelError(`Source URL must be http(s), got ${parsed.protocol}`);
  }
  if (!input.sourceTitle?.trim()) throw new KernelError('Provenance needs a source title.');
  if (!input.publisher?.trim()) throw new KernelError('Provenance needs a publisher.');

  return {
    sourceUrl: parsed.toString(),
    sourceTitle: input.sourceTitle.trim(),
    publisher: input.publisher.trim(),
    ...(input.publishedOn ? { publishedOn: isoDate(input.publishedOn) } : {}),
    retrievedOn: isoDate(input.retrievedOn),
    retrievedBy: input.retrievedBy,
    ...(input.locator ? { locator: input.locator.trim() } : {}),
    ...(input.documentSha256 ? { documentSha256: input.documentSha256 } : {}),
  };
}

/** The citation that travels to render. Every published figure carries one. */
export function citation(p: Provenance): string {
  const parts = [p.publisher, p.sourceTitle];
  if (p.locator) parts.push(p.locator);
  if (p.publishedOn) parts.push(`published ${p.publishedOn}`);
  parts.push(`retrieved ${p.retrievedOn}`);
  return parts.join(', ');
}
