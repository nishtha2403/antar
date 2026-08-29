#!/usr/bin/env node
/**
 * Fetches CEA monthly Installed Capacity reports and prints a verification
 * worksheet.
 *
 * This deliberately does not write to `data/`. Everything it produces is
 * unverified, and an unverified figure has no business in the record — the
 * point of this script is to put the numbers and their sources in front of a
 * person so they can check each row against the document and sign it off.
 *
 *   node scripts/fetch-cea.ts 2025-09 2026-07
 *
 * Source documents are saved under build/sources/ so the verifier can open the
 * exact file a figure was read from, rather than re-downloading and hoping the
 * publisher has not replaced it in place.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { discoverCurrent, discoverMonth } from '../src/ingest/cea-archive.ts';
import { parseCeaWorkbook } from '../src/ingest/cea.ts';
import { parseCeaPdf } from '../src/ingest/cea-pdf.ts';
import { megawattsToGigawatts } from '../src/ingest/cea.ts';
import { FOUNDER } from '../src/kernel/people.ts';
import { formatQuantity } from '../src/kernel/quantity.ts';

const [fromArg = '2025-09', toArg = '2026-07', retrievedOn = todayFromArgv()] = process.argv.slice(2);

function todayFromArgv(): string {
  // Deliberately not read from the clock: a retrieval date belongs in the
  // record, and a backfill should record when the document was actually
  // fetched. Passed as the third argument; this is only the fallback.
  return new Date().toISOString().slice(0, 10);
}

function* months(from: string, to: string): Generator<[number, number]> {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    yield [y, m];
  }
}

const OUT = 'build/sources';
mkdirSync(OUT, { recursive: true });

const reviewer = FOUNDER;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Row = { month: string; asOn: string; gw: string; mw: string; url: string; notes: number };
const rows: Row[] = [];
const failures: string[] = [];
const allNotes = new Map<string, string>();

for (const [year, month] of months(fromArg, toArg)) {
  const label = `${year}-${String(month).padStart(2, '0')}`;
  try {
    // The current month is on the index page, not in the archive.
    const entries = await discoverMonth(year, month).catch(async (archiveError) => {
      const current = await discoverCurrent().catch(() => []);
      const match = current.filter((e) => e.year === year && e.month === month);
      if (match.length > 0) return match;
      throw archiveError;
    });
    // Prefer the spreadsheet where one exists: it needs no layout inference.
    const entry = entries.find((e) => e.format === 'xlsx') ?? entries[0]!;

    const response = await fetch(entry.url, { headers: { 'user-agent': 'antar-research/0.1' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${entry.url}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const file = `${OUT}/${label}-${entry.url.split('/').pop()}`;
    writeFileSync(file, buffer);

    const reading = entry.format === 'xlsx' ? parseCeaWorkbook(buffer) : parseCeaPdf(buffer);
    const gw = megawattsToGigawatts(reading.nuclearMw, reviewer);

    rows.push({
      month: label,
      asOn: reading.asOn,
      gw: formatQuantity(gw),
      mw: reading.nuclearMw,
      url: entry.url,
      notes: reading.notes.length,
    });
    for (const note of reading.notes) {
      if (/outage|removed|added back/i.test(note)) allNotes.set(note.slice(0, 200), label);
    }
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  }
  await delay(1500); // Be a considerate client of a public server.
}

console.log(`\nCEA nuclear installed capacity — UNVERIFIED. Retrieved ${retrievedOn}.\n`);
console.log('  month     as on        nuclear       MW          source');
console.log('  ' + '-'.repeat(88));
for (const r of rows) {
  console.log(
    `  ${r.month}   ${r.asOn}   ${r.gw.padStart(10)}   ${r.mw.padStart(9)}   ${r.url.replace('https://cea.nic.in/wp-content/uploads/installed/', '')}`,
  );
}

if (allNotes.size > 0) {
  console.log('\nCaveats a verifier must read before signing any of these off:\n');
  for (const [note, first] of allNotes) console.log(`  [${first}] ${note}`);
}

if (failures.length > 0) {
  console.log(`\n${failures.length} month(s) could not be read:\n`);
  for (const f of failures) console.log(`  ${f}`);
}

console.log(
  `\n${rows.length} reading(s), all unverified. Source documents saved to ${OUT}/.\n` +
    'Nothing has been written to data/. Each row needs a person to check it against its document.\n',
);
