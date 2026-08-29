import { KernelError } from '../kernel/identity.ts';
import type { CeaReading } from './cea.ts';
import { allText, type DecodeMode, extractTextRows, type TextRow } from './pdf.ts';

/**
 * Reads the all-India nuclear figure out of a CEA Installed Capacity PDF.
 *
 * Historical months are published only as PDF — the .xlsx exists for the
 * current month alone — so a time series has to come through here.
 *
 * A PDF has no columns, only glyphs at coordinates, so the usual approach is to
 * count along a row and hope the layout never moves. This does not do that. It
 * finds the row by checking the table's own arithmetic:
 *
 *   coal + lignite + gas + diesel            = thermal total
 *   hydro + RES                              = renewable total
 *   thermal total + nuclear + renewable total = grand total
 *
 * Ten numbers satisfying all three simultaneously are the row we want, and the
 * odds of an unrelated run of figures doing so by accident are negligible. The
 * mapping is therefore verified rather than assumed, which matters because the
 * failure being guarded against is not a crash — it is reading the hydro column,
 * getting a plausible number, and publishing it.
 *
 * The report itself warns that "figures at decimal may not tally due to rounding
 * off", so the identities are checked to a tolerance of 1 MW against totals in
 * the hundreds of thousands.
 */

const TOLERANCE_MW = 1;
const COLUMNS = 10;

type Candidate = {
  readonly row: TextRow;
  readonly values: readonly number[];
  readonly raw: readonly string[];
};

const NUMERIC = /^-?[\d,]*\.?\d+$/;

const toNumber = (s: string): number => Number(s.replace(/,/g, ''));

/** Windows of ten consecutive numeric cells, with their raw text preserved. */
function numericWindows(row: TextRow): Candidate[] {
  const numeric = row.cells
    .map((cell, index) => ({ cell: cell.trim(), index }))
    .filter(({ cell }) => NUMERIC.test(cell) && cell !== '');

  const out: Candidate[] = [];
  for (let start = 0; start + COLUMNS <= numeric.length; start++) {
    const window = numeric.slice(start, start + COLUMNS);
    out.push({
      row,
      values: window.map((w) => toNumber(w.cell)),
      raw: window.map((w) => w.cell),
    });
  }
  return out;
}

const close = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCE_MW;

function satisfiesTableArithmetic(v: readonly number[]): boolean {
  if (v.length !== COLUMNS || v.some((n) => !Number.isFinite(n))) return false;
  const [coal = 0, lignite = 0, gas = 0, diesel = 0, thermal = 0, nuclear = 0, hydro = 0, res = 0, renewable = 0, grand = 0] = v;
  return (
    close(coal + lignite + gas + diesel, thermal) &&
    close(hydro + res, renewable) &&
    close(thermal + nuclear + renewable, grand)
  );
}

function parseAsOn(text: string): string {
  const match = /As on\s+(\d{2})\.(\d{2})\.(\d{4})/i.exec(text);
  if (!match) {
    throw new KernelError(
      'CEA PDF: no "As on DD.MM.YYYY" date found. The report header changed; read it by hand.',
    );
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function parseCeaPdf(pdf: Buffer): CeaReading {
  const failures: string[] = [];
  // Literal first: it is what the current reports use, and it is cheaper.
  for (const mode of ['literal', 'cid'] as DecodeMode[]) {
    try {
      return readWith(pdf, mode);
    } catch (error) {
      failures.push(`${mode}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new KernelError(
    `CEA PDF: could not read the report under either text encoding.\n  ${failures.join('\n  ')}`,
  );
}

function readWith(pdf: Buffer, mode: DecodeMode): CeaReading {
  const rows = extractTextRows(pdf, mode);
  const text = allText(rows);

  if (!/INSTALLED\s+CAPACITY/i.test(text)) {
    throw new KernelError('no "INSTALLED CAPACITY" heading found');
  }
  if (!/\(\s*IN\s+MW\s*\)/i.test(text)) {
    throw new KernelError('report is not denominated "(IN MW)" — the unit may have changed');
  }

  const candidates = rows.flatMap(numericWindows).filter((c) => satisfiesTableArithmetic(c.values));
  if (candidates.length === 0) {
    throw new KernelError(
      "found no row whose columns satisfy the table's own arithmetic; refusing to guess at column positions",
    );
  }

  // The all-India row is the one with the largest grand total: every regional
  // and sectoral subtotal is a part of it.
  const allIndia = candidates.reduce((best, c) =>
    (c.values[9] ?? 0) > (best.values[9] ?? 0) ? c : best,
  );

  const nuclearMw = allIndia.raw[5];
  const grandTotalMw = allIndia.raw[9];
  if (nuclearMw === undefined || grandTotalMw === undefined) {
    throw new KernelError('matched a row but could not read its nuclear or total figure');
  }

  return { asOn: parseAsOn(text), nuclearMw, grandTotalMw, notes: collectNotes(rows) };
}

/** Long free-text lines: caveats, outage notes, definitions. */
function collectNotes(rows: readonly TextRow[]): string[] {
  const notes: string[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      const text = cell.trim().replace(/\s+/g, ' ');
      if (text.length > 60 && /[a-z]{4}/.test(text)) notes.push(text);
    }
  }
  return [...new Set(notes)];
}
