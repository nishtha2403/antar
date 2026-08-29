import { KernelError } from '../kernel/identity.ts';
import { provenance, type ProvenanceInput } from '../kernel/provenance.ts';
import { quantity } from '../kernel/quantity.ts';
import { type Observation, series, type Series } from '../kernel/series.ts';
import type { Measure } from '../kernel/target.ts';
import { isoDate } from '../kernel/time.ts';
import { attest } from '../kernel/verification.ts';

/**
 * The contract every scraper in this project has to satisfy.
 *
 * Rule 2 of the allocation model is that scrapers fail loud. That is easy to
 * agree with and easy to forget at 2am, so it lives here rather than in each
 * scraper: an ingest that produces nothing raises, an ingest whose shape
 * changed raises, and an ingest that succeeds produces rows that are all
 * `unverified` and cannot reach a page until a person signs them off.
 *
 * A scraper supplies two things — how to fetch the raw payload, and how to turn
 * it into rows. Everything else is enforced here, identically, for all of them.
 */
export type RawRow = {
  /** As printed in the source, before any parsing. Kept for the audit trail. */
  readonly asOf: string;
  readonly value: string;
};

export type ScraperSpec = {
  /** Stable name for logs and provenance: "cea-installed-capacity". */
  readonly name: string;
  readonly measure: Measure;
  /** Fetches the raw payload. Network, file, anything. */
  readonly fetch: () => Promise<string>;
  /** Turns the payload into rows. Throws if the shape is not what it expects. */
  readonly parse: (payload: string) => readonly RawRow[];
  /**
   * Fields the parser depends on. If `parse` cannot find them, that is schema
   * drift and the run halts rather than publishing a shorter table.
   */
  readonly expectedShape: readonly string[];
  /** Provenance for the fetch, minus the date, which is stamped at run time. */
  readonly source: Omit<ProvenanceInput, 'retrievedOn'>;
  /**
   * Lower bound on plausible row count. A source that returned 3 rows when it
   * has always returned 40 is broken, not newly concise.
   */
  readonly minimumRows: number;
};

export type IngestResult = {
  readonly series: Series;
  readonly fetchedRows: number;
  /** Always equal to fetchedRows at this stage. Verification is a later, human act. */
  readonly unverifiedRows: number;
};

/**
 * Runs a scraper under the fail-loud contract.
 *
 * `retrievedOn` is passed in rather than read from the clock so that a run is
 * reproducible and testable, and so that a backfill can honestly record the
 * date the document was actually retrieved.
 */
export async function ingest(spec: ScraperSpec, retrievedOn: string): Promise<IngestResult> {
  let payload: string;
  try {
    payload = await spec.fetch();
  } catch (cause) {
    throw new KernelError(
      `${spec.name}: fetch failed. Halting rather than publishing a stale or partial series. ` +
        `Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!payload || payload.trim().length === 0) {
    throw new KernelError(`${spec.name}: source returned an empty payload. An empty result is a failure, never a zero.`);
  }

  const missing = spec.expectedShape.filter((field) => !payload.includes(field));
  if (missing.length > 0) {
    throw new KernelError(
      `${spec.name}: schema drift. Expected field(s) ${missing.map((m) => JSON.stringify(m)).join(', ')} ` +
        'not present in the payload. Halting the build. ' +
        'Re-read the source by hand before changing the parser — a field that vanished is a finding.',
    );
  }

  let rows: readonly RawRow[];
  try {
    rows = spec.parse(payload);
  } catch (cause) {
    throw new KernelError(
      `${spec.name}: parse failed against a payload that passed the shape check. ` +
        `Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (rows.length === 0) {
    throw new KernelError(`${spec.name}: parsed zero rows. An empty result is a failure, never a zero.`);
  }
  if (rows.length < spec.minimumRows) {
    throw new KernelError(
      `${spec.name}: parsed ${rows.length} rows, expected at least ${spec.minimumRows}. ` +
        'A sudden drop in row count is a broken source, not a shorter table.',
    );
  }

  const source = provenance({ ...spec.source, retrievedOn });

  const observations: Observation[] = rows.map((row) => {
    try {
      return {
        asOf: isoDate(row.asOf),
        // Every scraped row enters unverified. There is no flag to skip this.
        value: attest(quantity(row.value, spec.measure.unit), source),
      };
    } catch (cause) {
      throw new KernelError(
        `${spec.name}: row ${JSON.stringify(row)} could not be parsed. ` +
          `Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  });

  return {
    series: series(spec.measure, observations),
    fetchedRows: rows.length,
    unverifiedRows: observations.length,
  };
}
