import { describe, expect, it } from 'vitest';
import { computeGap } from '../src/kernel/gap.ts';
import { ingest, type ScraperSpec } from '../src/ingest/harness.ts';
import { verificationCoverage } from '../src/kernel/series.ts';
import { byAgent } from '../src/kernel/identity.ts';
import { HARVESTER, nuclearMeasure, nuclearTarget } from './fixtures.ts';

/** A stand-in source shaped like a CEA capacity table. Not real data. */
const PAYLOAD = [
  'date,segment,capacity_gw',
  '2023-12-31,Nuclear,7.48',
  '2024-12-31,Nuclear,8.18',
  '2025-12-31,Nuclear,8.18',
].join('\n');

const spec = (over: Partial<ScraperSpec> = {}): ScraperSpec => ({
  name: 'test-capacity',
  measure: nuclearMeasure,
  fetch: async () => PAYLOAD,
  parse: (payload) =>
    payload
      .split('\n')
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const [asOf = '', , value = ''] = line.split(',');
        return { asOf, value };
      }),
  expectedShape: ['date', 'capacity_gw'],
  source: {
    sourceUrl: 'https://example.invalid/capacity.csv',
    sourceTitle: 'Test capacity table',
    publisher: 'Test publisher',
    retrievedBy: byAgent(HARVESTER),
  },
  minimumRows: 3,
  ...over,
});

describe('scrapers fail loud', () => {
  it('ingests rows and leaves every one of them unverified', async () => {
    const result = await ingest(spec(), '2026-08-29');
    expect(result.fetchedRows).toBe(3);
    expect(result.unverifiedRows).toBe(3);
    expect(verificationCoverage(result.series)).toEqual({ verified: 0, total: 3, percent: 0 });
  });

  it('produces a series that cannot yet be published', async () => {
    const result = await ingest(spec(), '2026-08-29');
    // A successful scrape changes nothing on the site until a person signs off.
    expect(() => computeGap(nuclearTarget(), result.series)).toThrow(/no verified observation/);
  });

  it('halts on an empty payload instead of publishing a zero', async () => {
    await expect(ingest(spec({ fetch: async () => '' }), '2026-08-29')).rejects.toThrow(
      /never a zero/,
    );
  });

  it('halts when the fetch itself fails', async () => {
    await expect(
      ingest(spec({ fetch: async () => { throw new Error('502 Bad Gateway'); } }), '2026-08-29'),
    ).rejects.toThrow(/fetch failed.*502/s);
  });

  it('halts on schema drift rather than parsing what is left', async () => {
    const renamed = PAYLOAD.replace('capacity_gw', 'capacity_mw');
    await expect(ingest(spec({ fetch: async () => renamed }), '2026-08-29')).rejects.toThrow(
      /schema drift.*capacity_gw/s,
    );
  });

  it('halts when the row count collapses', async () => {
    const truncated = PAYLOAD.split('\n').slice(0, 2).join('\n');
    await expect(ingest(spec({ fetch: async () => truncated }), '2026-08-29')).rejects.toThrow(
      /parsed 1 rows, expected at least 3/,
    );
  });

  it('halts on an unparseable row rather than skipping it', async () => {
    const corrupt = PAYLOAD.replace('8.18', 'n/a');
    await expect(ingest(spec({ fetch: async () => corrupt }), '2026-08-29')).rejects.toThrow(
      /could not be parsed/,
    );
  });

  it('stamps the retrieval date it was given, not the wall clock', async () => {
    const result = await ingest(spec(), '2026-08-29');
    expect(result.series.observations[0]?.value.provenance.retrievedOn).toBe('2026-08-29');
  });
});
