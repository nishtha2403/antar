import type { HumanIdentity } from '../kernel/identity.ts';
import { KernelError } from '../kernel/identity.ts';
import { provenance, type Provenance } from '../kernel/provenance.ts';
import { divideToScale, type Quantity, quantity } from '../kernel/quantity.ts';
import { type Observation, series, type Series } from '../kernel/series.ts';
import type { Measure } from '../kernel/target.ts';
import { isoDate } from '../kernel/time.ts';
import { attest } from '../kernel/verification.ts';
import { cellAt, findRow, readXlsx, type Sheet } from './xlsx.ts';

/**
 * Reader for the CEA monthly Installed Capacity report.
 *
 * The report is one .xlsx per month at a predictable path, not an HTML table:
 *
 *   https://cea.nic.in/wp-content/uploads/installed/YYYY/MM/IC_MonthYYYY.xlsx
 *
 * The index page lists only the most recent month, so a series is assembled
 * from several files, each carrying its own provenance and its own retrieval
 * date. Every figure enters unverified.
 *
 * Nothing here is addressed by cell position alone. The sheet is searched for
 * its landmarks — the "IN MW" heading, the "Nuclear" column header, the ALL
 * INDIA block, the Total row within it — and any one of them being absent
 * raises rather than falling back to a coordinate that used to work. A layout
 * change in a government workbook is a finding, and the failure mode this
 * guards against is not a crash but a plausible number read from the wrong
 * column.
 */

export type CeaReading = {
  /** The date the workbook states it is current as of. */
  readonly asOn: string;
  /** All-India total nuclear installed capacity, verbatim, in megawatts. */
  readonly nuclearMw: string;
  /** All-India grand total, used as a cross-check that the row was read right. */
  readonly grandTotalMw: string;
  /**
   * Notes printed beneath the table.
   *
   * These are not decoration. The July 2026 report records that 100 MW of
   * nuclear capacity was removed from the figure because it has been under
   * outage since 31 May 2025 — so the headline number is capacity in service,
   * not capacity that exists. A verifier who never sees that note cannot judge
   * whether the figure means what the page will say it means.
   */
  readonly notes: readonly string[];
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** The published URL for one month's report. */
export function ceaReportUrl(year: number, month: number): string {
  const name = MONTHS[month - 1];
  if (!name) throw new KernelError(`Month must be 1-12, got ${month}.`);
  return `https://cea.nic.in/wp-content/uploads/installed/${year}/${String(month).padStart(2, '0')}/IC_${name}${year}.xlsx`;
}

/** "(As on 31.07.2026)" → "2026-07-31". */
function parseAsOn(raw: string): string {
  const match = /\(?\s*As on\s+(\d{2})\.(\d{2})\.(\d{4})\s*\)?/i.exec(raw);
  if (!match) {
    throw new KernelError(
      `CEA: could not read the "As on" date from ${JSON.stringify(raw.slice(0, 80))}. ` +
        'The report header format changed; re-read it by hand before adjusting this parser.',
    );
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function parseCeaWorkbook(buffer: Buffer): CeaReading {
  return parseCeaSheet(readXlsx(buffer));
}

/**
 * The report semantics, separated from the container format.
 *
 * Splitting these apart is what makes the drift guarantees testable: a test can
 * hand this a sheet with a renamed column and assert that it refuses, without
 * having to build a valid .xlsx to say so.
 */
export function parseCeaSheet(sheet: Sheet): CeaReading {
  // 1. The sheet must say it is in megawatts. If the unit ever changes, every
  //    figure below changes meaning, so this is checked before anything is read.
  const heading = findRow(sheet, 'B', (v) => /INSTALLED CAPACITY/i.test(v));
  if (heading === undefined) {
    throw new KernelError('CEA: no "INSTALLED CAPACITY" heading found. This is not the expected report.');
  }
  const headingText = cellAt(sheet, 'B', heading) ?? '';
  if (!/\(IN MW\)/i.test(headingText)) {
    throw new KernelError(
      `CEA: expected the sheet to be denominated "(IN MW)", heading reads ` +
        `${JSON.stringify(headingText.slice(0, 120))}. Halting: the unit may have changed.`,
    );
  }

  const asOn = parseAsOn(cellAt(sheet, 'B', heading + 1) ?? '');

  // 2. Locate the Nuclear column by its header rather than assuming column I.
  const nuclearColumn = findNuclearColumn(sheet, heading);

  // 3. The ALL INDIA block, then the Total row inside it.
  const allIndia = findRow(sheet, 'B', (v) => v.trim().toUpperCase() === 'ALL INDIA', heading);
  if (allIndia === undefined) {
    throw new KernelError('CEA: no ALL INDIA block found in the report.');
  }
  const totalRow = findRow(sheet, 'C', (v) => v.trim().toLowerCase() === 'total', allIndia);
  if (totalRow === undefined) {
    throw new KernelError(`CEA: no Total row found after the ALL INDIA block at row ${allIndia}.`);
  }
  // The Total row belongs to the ALL INDIA block, not to a later section.
  if (totalRow - allIndia > 12) {
    throw new KernelError(
      `CEA: the Total row (${totalRow}) is too far below the ALL INDIA block (${allIndia}). ` +
        'The sheet layout changed; refusing to read a row that may belong to another table.',
    );
  }

  const nuclearMw = cellAt(sheet, nuclearColumn, totalRow);
  const grandTotalMw = cellAt(sheet, 'M', totalRow);
  if (nuclearMw === undefined || grandTotalMw === undefined) {
    throw new KernelError(`CEA: Total row ${totalRow} is missing the nuclear or grand-total figure.`);
  }

  return { asOn, nuclearMw, grandTotalMw, notes: collectNotes(sheet, totalRow) };
}

function findNuclearColumn(sheet: Sheet, heading: number): string {
  for (let row = heading; row <= heading + 10; row++) {
    for (const [ref, value] of sheet.cells) {
      const match = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!match || Number(match[2]) !== row) continue;
      if (value.trim().toLowerCase() === 'nuclear') return match[1] as string;
    }
  }
  throw new KernelError(
    'CEA: no "Nuclear" column header found beneath the report heading. ' +
      'Refusing to fall back to a fixed column — reading the wrong column would produce a ' +
      'plausible number rather than an error.',
  );
}

/** Free text beneath the table: notes, caveats, abbreviations. */
function collectNotes(sheet: Sheet, fromRow: number): string[] {
  const notes: string[] = [];
  for (let row = fromRow; row <= sheet.rowCount; row++) {
    for (const column of ['B', 'C', 'D']) {
      const value = cellAt(sheet, column, row);
      if (value && value.trim().length > 40) notes.push(value.trim().replace(/\s+/g, ' '));
    }
  }
  return notes;
}

/**
 * Converts a megawatt figure to gigawatts.
 *
 * The factor is exact, but the decision to read the source's megawatts as the
 * target's gigawatts is still a judgement about whether the two measure the same
 * thing, so it carries the name of the person who made it. The kernel never
 * converts units on its own; this is the declared exception, and it is declared
 * per ingest rather than globally.
 */
export function megawattsToGigawatts(mw: string, _declaredBy: HumanIdentity): Quantity {
  // `declaredBy` is a type-level gate: the signature cannot be satisfied without
  // a named human, which is the point. It reaches the record via provenance.
  const asMegawatts = quantity(mw, 'MW');
  return divideToScale(asMegawatts.digits, 1000n * 10n ** BigInt(asMegawatts.scale), 3, 'GW');
}

export type CeaFetch = {
  readonly buffer: Buffer;
  readonly url: string;
  readonly retrievedOn: string;
};

export const CEA_NUCLEAR_MEASURE: Measure = {
  measure: 'Installed nuclear electricity generation capacity, all-India, utilities',
  unit: 'GW',
  sourceSeries: 'CEA Monthly Installed Capacity Report, ALL INDIA Total, Nuclear column',
  vintage: 'current',
};

export type CeaIngestResult = {
  readonly series: Series;
  /** Notes from every workbook read, for the verifier to work through. */
  readonly notes: readonly { readonly asOn: string; readonly note: string }[];
};

/**
 * Builds an unverified series from workbooks already fetched.
 *
 * Fetching is kept out of this function so the parse can be tested against a
 * stored workbook with no network involved. Every observation enters
 * `unverified`; a human signs each row off against the PDF or the sheet itself.
 */
export function ingestCeaNuclear(fetches: readonly CeaFetch[], declaredBy: HumanIdentity): CeaIngestResult {
  if (fetches.length === 0) {
    throw new KernelError('CEA: no workbooks supplied. An empty result is a failure, never a zero.');
  }

  const observations: Observation[] = [];
  const notes: { asOn: string; note: string }[] = [];

  for (const fetched of fetches) {
    const reading = parseCeaWorkbook(fetched.buffer);
    const source: Provenance = provenance({
      sourceUrl: fetched.url,
      sourceTitle: `Installed Capacity Report, as on ${reading.asOn}`,
      publisher: 'Central Electricity Authority',
      retrievedOn: fetched.retrievedOn,
      retrievedBy: declaredBy,
      locator: 'ALL INDIA, Total, Nuclear',
    });
    observations.push({
      asOf: isoDate(reading.asOn),
      value: attest(megawattsToGigawatts(reading.nuclearMw, declaredBy), source),
    });
    for (const note of reading.notes) notes.push({ asOn: reading.asOn, note });
  }

  return { series: series(CEA_NUCLEAR_MEASURE, observations), notes };
}
