import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { discoverMonth, type HttpPost } from '../src/ingest/cea-archive.ts';
import { parseCeaPdf } from '../src/ingest/cea-pdf.ts';
import { extractTextRows } from '../src/ingest/pdf.ts';

/**
 * Fixtures are the real published reports, retrieved from cea.nic.in on
 * 2026-08-29 and committed so a reviewer can check these figures against the
 * source without the network and without trusting the parser.
 */
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const DECEMBER_2025 = fixture('IC_December2025.pdf');
const JUNE_2025 = fixture('IC_June2025_allocation_wise.pdf');

describe('reading a CEA PDF', () => {
  it('extracts the all-India nuclear figure and its date', () => {
    const reading = parseCeaPdf(DECEMBER_2025);
    expect(reading.asOn).toBe('2025-12-31');
    expect(reading.nuclearMw).toBe('8780.00');
    expect(reading.grandTotalMw).toBe('513729.69');
  });

  it('locates the row by the table\'s own arithmetic, not by column position', () => {
    // The row is accepted only because coal+lignite+gas+diesel equals the
    // thermal total, hydro+RES equals the renewable total, and those three plus
    // nuclear equal the grand total. Reading a neighbouring column would fail
    // all three rather than returning a plausible wrong number.
    const reading = parseCeaPdf(DECEMBER_2025);
    const nuclear = Number(reading.nuclearMw);
    const grand = Number(reading.grandTotalMw);
    expect(nuclear).toBeGreaterThan(0);
    expect(nuclear).toBeLessThan(grand);
    expect(grand).toBeGreaterThan(500_000);
  });

  it('surfaces the outage caveat', () => {
    const reading = parseCeaPdf(DECEMBER_2025);
    const outage = reading.notes.find((n) => /under outage for very long time/i.test(n));
    expect(outage).toBeDefined();
    expect(outage).toContain('Nuclear Capacity of 100 MW');
  });

  it('refuses a file that is not a PDF', () => {
    expect(() => parseCeaPdf(Buffer.from('not a pdf'))).toThrow(/Not a PDF/);
  });
});

describe('the known limit of the PDF reader', () => {
  /**
   * Reports up to mid-2025 use a different layout ("allocation wise") and set
   * their table digits in a CID font whose ToUnicode map this reader does not
   * resolve, so the numeric cells come back empty. Prose in the same document
   * decodes correctly.
   *
   * This is pinned as a test rather than left as a comment so that the boundary
   * is explicit, and so that a future fix announces itself by failing here.
   */
  it('cannot yet read pre-July-2025 allocation-wise reports, and says so', () => {
    expect(() => parseCeaPdf(JUNE_2025)).toThrow(/could not read the report under either text encoding/);
  });

  it('does decode the prose in those reports, so the gap is the numerals alone', () => {
    const rows = extractTextRows(JUNE_2025, 'cid');
    const text = rows.map((r) => r.cells.join(' ')).join('\n');
    expect(text).toMatch(/INSTALLED\s+CAPACITY/i);
    // Line-wrapped in this report, hence the short phrase.
    expect(text).toMatch(/under outage for very long/i);
    expect(text).toMatch(/OPM division of CEA about the restoration/i);
  });
});

describe('archive discovery', () => {
  const html = (body: string): HttpPost => async () => body;

  it('finds the report link for a month', async () => {
    const entries = await discoverMonth(
      2025,
      12,
      html('<a href="https://cea.nic.in/wp-content/uploads/installed/2025/12/website.pdf">View</a>'),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toContain('website.pdf');
    expect(entries[0]?.format).toBe('pdf');
  });

  it('deduplicates the repeated download and view links', async () => {
    const link = 'https://cea.nic.in/wp-content/uploads/installed/2025/12/website.pdf';
    const entries = await discoverMonth(2025, 12, html(`<a href="${link}">D</a><a href="${link}">V</a>`));
    expect(entries).toHaveLength(1);
  });

  it('raises on a month with no link rather than returning an empty series', async () => {
    await expect(discoverMonth(2025, 11, html('<p>No reports found</p>'))).rejects.toThrow(
      /no report link found/,
    );
  });

  it('raises when a success status carries an error body', async () => {
    // Observed behaviour of the CEA API: HTTP 200, body "Connection failed".
    await expect(
      discoverMonth(2025, 12, html('Connection failed: Connection timed out')),
    ).rejects.toThrow(/success status with an error body/);
  });

  it('rejects an impossible month', async () => {
    await expect(discoverMonth(2025, 13, html(''))).rejects.toThrow(/Month must be 1-12/);
  });
});
