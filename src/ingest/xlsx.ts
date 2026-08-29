import { KernelError } from '../kernel/identity.ts';
import { readZip } from './zip.ts';

/**
 * A minimal .xlsx reader: first worksheet, cells as strings.
 *
 * Values are returned exactly as they appear in the XML, never parsed into
 * JavaScript numbers. The workbook already contains float artefacts — the July
 * 2026 CEA sheet stores one figure as 892.21400000000006 — and turning those
 * into doubles and back would add a second layer of error on top of the one the
 * source shipped with. Whether such a value is usable is a question for the
 * person verifying the row, and they can only answer it if they see what the
 * file actually says.
 */
export type Sheet = {
  /** Keyed "A1", "I36". Only non-empty cells are present. */
  readonly cells: ReadonlyMap<string, string>;
  readonly rowCount: number;
};

const decodeXml = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const SHARED_ITEM = /<si>([\s\S]*?)<\/si>/g;
const TEXT_RUN = /<t[^>]*>([\s\S]*?)<\/t>/g;
const ROW = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
/** Handles both `<c .../>` and `<c ...>…</c>`; conflating them corrupts the grid. */
const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

export function readXlsx(buffer: Buffer): Sheet {
  const files = readZip(buffer);

  const sharedXml = files.get('xl/sharedStrings.xml');
  const shared: string[] = [];
  if (sharedXml) {
    const text = sharedXml.toString('utf8');
    for (const item of text.matchAll(SHARED_ITEM)) {
      const runs = [...(item[1] ?? '').matchAll(TEXT_RUN)].map((m) => m[1] ?? '');
      shared.push(decodeXml(runs.join('')));
    }
  }

  const sheetFile =
    files.get('xl/worksheets/sheet1.xml') ??
    [...files.entries()].find(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))?.[1];
  if (!sheetFile) throw new KernelError('Workbook contains no worksheet.');

  const cells = new Map<string, string>();
  let rowCount = 0;
  const sheetXml = sheetFile.toString('utf8');

  for (const row of sheetXml.matchAll(ROW)) {
    const rowNumber = Number(/r="(\d+)"/.exec(row[1] ?? '')?.[1] ?? 0);
    if (rowNumber > rowCount) rowCount = rowNumber;
    for (const cell of (row[2] ?? '').matchAll(CELL)) {
      const attrs = cell[1] ?? '';
      const inner = cell[2] ?? '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      if (raw === undefined || raw === '') continue;
      const value = /t="s"/.test(attrs) ? (shared[Number(raw)] ?? '') : decodeXml(raw);
      if (value !== '') cells.set(ref, value);
    }
  }
  return { cells, rowCount };
}

export const cellAt = (sheet: Sheet, column: string, row: number): string | undefined =>
  sheet.cells.get(`${column}${row}`);

/** Every non-empty value in a row, in column order. */
export function rowValues(sheet: Sheet, row: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const [ref, value] of sheet.cells) {
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (match && Number(match[2]) === row) out.set(match[1] as string, value);
  }
  return new Map([...out].sort(([a], [b]) => (a.length - b.length) || a.localeCompare(b)));
}

/** First row whose cell in `column` matches, searching from `from`. */
export function findRow(
  sheet: Sheet,
  column: string,
  predicate: (value: string) => boolean,
  from = 1,
): number | undefined {
  for (let row = from; row <= sheet.rowCount; row++) {
    const value = cellAt(sheet, column, row);
    if (value !== undefined && predicate(value)) return row;
  }
  return undefined;
}
