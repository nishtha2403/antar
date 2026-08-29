import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeGap } from '../src/kernel/gap.ts';
import { formatQuantity } from '../src/kernel/quantity.ts';
import { verificationCoverage } from '../src/kernel/series.ts';
import {
  ceaReportUrl,
  ingestCeaNuclear,
  megawattsToGigawatts,
  parseCeaSheet,
  parseCeaWorkbook,
} from '../src/ingest/cea.ts';
import { readXlsx } from '../src/ingest/xlsx.ts';
import { FOUNDER, nuclearTarget } from './fixtures.ts';

/**
 * Tested against the real workbook, committed at test/fixtures/IC_July2026.xlsx
 * and retrieved from cea.nic.in on 2026-08-29. Keeping the source document in
 * the repository is the point: a reviewer can open it and check these numbers
 * without trusting the parser or the network.
 */
const WORKBOOK = readFileSync(new URL('./fixtures/IC_July2026.xlsx', import.meta.url));

describe('reading the CEA workbook', () => {
  it('reads the sheet without a spreadsheet library', () => {
    const sheet = readXlsx(WORKBOOK);
    expect(sheet.rowCount).toBe(333);
    expect(sheet.cells.get('B3')).toBe('(As on 31.07.2026)');
  });

  it('extracts the all-India nuclear total and the date it is current as of', () => {
    const reading = parseCeaWorkbook(WORKBOOK);
    expect(reading.asOn).toBe('2026-07-31');
    expect(reading.nuclearMw).toBe('8780');
    expect(reading.grandTotalMw).toBe('551994.7575500001');
  });

  it('surfaces the outage note rather than dropping it', () => {
    // The headline figure is capacity in service, not capacity that exists:
    // 100 MW of nuclear is excluded for a long-running outage. A verifier who
    // never sees this cannot judge what the published number means.
    const reading = parseCeaWorkbook(WORKBOOK);
    const outage = reading.notes.find((n) => /under outage for very long time/i.test(n));
    expect(outage).toBeDefined();
    expect(outage).toContain('Nuclear Capacity of 100 MW');
    expect(outage).toContain('31.05.2025');
  });

  it('keeps source values verbatim, float artefacts included', () => {
    // The workbook itself stores this with float noise. Re-parsing it into a
    // double and back would add a second error on top of the source's own.
    const reading = parseCeaWorkbook(WORKBOOK);
    expect(reading.grandTotalMw).toContain('.7575500001');
  });

  it('builds the published report URL', () => {
    expect(ceaReportUrl(2026, 7)).toBe(
      'https://cea.nic.in/wp-content/uploads/installed/2026/07/IC_July2026.xlsx',
    );
    expect(() => ceaReportUrl(2026, 13)).toThrow(/Month must be 1-12/);
  });
});

describe('the parser refuses rather than reading the wrong cell', () => {
  /**
   * Built as a cell grid rather than a workbook: the container format is tested
   * separately, and what matters here is what the parser does when a government
   * spreadsheet quietly changes shape.
   */
  const sheetOf = (cells: Record<string, string>) => ({
    cells: new Map(Object.entries(cells)),
    rowCount: 60,
  });

  const wellFormed = {
    B2: 'ALL INDIA INSTALLED CAPACITY (IN MW) OF POWER STATIONS',
    B3: '(As on 31.07.2026)',
    I7: 'Nuclear',
    B33: 'ALL INDIA',
    C36: 'Total',
    I36: '8780',
    M36: '551994.75',
  };

  it('reads a well-formed sheet, so the refusals below mean something', () => {
    const reading = parseCeaSheet(sheetOf(wellFormed));
    expect(reading.nuclearMw).toBe('8780');
    expect(reading.asOn).toBe('2026-07-31');
  });

  it('halts if the sheet is no longer denominated in MW', () => {
    // A unit change silently alters the meaning of every figure below it.
    const drifted = { ...wellFormed, B2: 'ALL INDIA INSTALLED CAPACITY (IN GW)' };
    expect(() => parseCeaSheet(sheetOf(drifted))).toThrow(/denominated/);
  });

  it('halts if the Nuclear column header is gone', () => {
    const { I7: _dropped, ...rest } = wellFormed;
    expect(() => parseCeaSheet(sheetOf(rest))).toThrow(/no "Nuclear" column/);
  });

  it('reads the Nuclear column by header, not by position', () => {
    // Same data, column moved from I to K. A parser hard-coded to I would
    // return the grand total here and look perfectly plausible doing it.
    const { I7: _old, I36: _oldValue, ...rest } = wellFormed;
    const moved = { ...rest, K7: 'Nuclear', K36: '8780' };
    expect(parseCeaSheet(sheetOf(moved)).nuclearMw).toBe('8780');
  });

  it('halts if the ALL INDIA block is missing', () => {
    const { B33: _dropped, ...rest } = wellFormed;
    expect(() => parseCeaSheet(sheetOf(rest))).toThrow(/no ALL INDIA block/);
  });

  it('halts if the Total row is missing', () => {
    const { C36: _dropped, ...rest } = wellFormed;
    expect(() => parseCeaSheet(sheetOf(rest))).toThrow(/no Total row/);
  });

  it('refuses a Total row too far below the ALL INDIA block to belong to it', () => {
    const drifted = { ...wellFormed, C36: '', C50: 'Total', I50: '999' };
    delete (drifted as Record<string, string>).C36;
    expect(() => parseCeaSheet(sheetOf(drifted))).toThrow(/too far below/);
  });

  it('halts on an unreadable "As on" date', () => {
    const drifted = { ...wellFormed, B3: 'Updated recently' };
    expect(() => parseCeaSheet(sheetOf(drifted))).toThrow(/could not read the "As on" date/);
  });

  it('halts if it is not the expected report at all', () => {
    expect(() => parseCeaWorkbook(Buffer.from('not a zip'))).toThrow(/Not a ZIP archive/);
  });
});

describe('megawatt to gigawatt conversion is declared, not silent', () => {
  it('converts exactly', () => {
    expect(formatQuantity(megawattsToGigawatts('8780', FOUNDER))).toBe('8.780 GW');
    expect(formatQuantity(megawattsToGigawatts('100', FOUNDER))).toBe('0.100 GW');
  });

  it('requires a named human in the signature', () => {
    // @ts-expect-error — the conversion cannot be performed anonymously.
    megawattsToGigawatts('8780');
  });
});

describe('ingesting a CEA series', () => {
  const fetched = [
    { buffer: WORKBOOK, url: ceaReportUrl(2026, 7), retrievedOn: '2026-08-29' },
  ];

  it('produces observations that are all unverified', () => {
    const result = ingestCeaNuclear(fetched, FOUNDER);
    expect(result.series.observations).toHaveLength(1);
    expect(verificationCoverage(result.series)).toEqual({ verified: 0, total: 1, percent: 0 });
    expect(formatQuantity(result.series.observations[0]!.value.value)).toBe('8.780 GW');
  });

  it('carries provenance pointing at the workbook it was read from', () => {
    const { provenance: p } = ingestCeaNuclear(fetched, FOUNDER).series.observations[0]!.value;
    expect(p.sourceUrl).toContain('IC_July2026.xlsx');
    expect(p.publisher).toBe('Central Electricity Authority');
    expect(p.locator).toBe('ALL INDIA, Total, Nuclear');
    expect(p.retrievedOn).toBe('2026-08-29');
  });

  it('cannot yet move a published figure', () => {
    const result = ingestCeaNuclear(fetched, FOUNDER);
    expect(() => computeGap(nuclearTarget(), result.series)).toThrow(/no verified observation/);
  });

  it('refuses an empty set of workbooks', () => {
    expect(() => ingestCeaNuclear([], FOUNDER)).toThrow(/never a zero/);
  });

  it('collects the notes for the verifier', () => {
    const result = ingestCeaNuclear(fetched, FOUNDER);
    expect(result.notes.some((n) => /under outage/i.test(n.note))).toBe(true);
    expect(result.notes[0]?.asOn).toBe('2026-07-31');
  });
});
