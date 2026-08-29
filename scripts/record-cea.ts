#!/usr/bin/env node
/**
 * Records verified CEA observations into the append-only store.
 *
 * Reads the manifest written by `fetch-cea.ts` rather than re-fetching, so the
 * figure signed off is the one read from the document actually on disk. A
 * second download could quietly return something else — government pages are
 * edited in place — and then the record would attest to bytes nobody saw.
 *
 *   node scripts/record-cea.ts "<what you checked>" [--dry-run]
 *
 * The method string is required and goes into every record. "How did you check
 * this?" has to be answerable, or the check did not happen.
 */
import { readFileSync } from 'node:fs';
import { byAgent } from '../src/kernel/identity.ts';
import { FOUNDER, displayName } from '../src/kernel/people.ts';
import { provenance } from '../src/kernel/provenance.ts';
import { formatQuantity } from '../src/kernel/quantity.ts';
import { series } from '../src/kernel/series.ts';
import { isoDate } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { CEA_HARVESTER, CEA_NUCLEAR_MEASURE, megawattsToGigawatts } from '../src/ingest/cea.ts';
import { Store } from '../src/store/store.ts';

const SLUG = 'cea-nuclear-installed-capacity';
const [method, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');

if (!method?.trim()) {
  console.error('A verification method is required: node scripts/record-cea.ts "<what you checked>"');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync('build/sources/manifest.json', 'utf8')) as {
  retrievedOn: string;
  readings: { month: string; asOn: string; mw: string; url: string; file: string }[];
};

const HARVESTER = CEA_HARVESTER;

const observations = manifest.readings.map((r) => ({
  asOf: isoDate(r.asOn),
  value: verify(
    attest(
      megawattsToGigawatts(r.mw, FOUNDER),
      provenance({
        sourceUrl: r.url,
        sourceTitle: `Installed Capacity Report, as on ${r.asOn}`,
        publisher: 'Central Electricity Authority',
        retrievedOn: manifest.retrievedOn,
        retrievedBy: byAgent(HARVESTER),
        locator: 'ALL INDIA, Total, Nuclear',
      }),
    ),
    FOUNDER,
    manifest.retrievedOn,
    method.trim(),
  ),
}));

const built = series(CEA_NUCLEAR_MEASURE, observations);

console.log(`\n${SLUG} — ${built.observations.length} observation(s)`);
for (const o of built.observations) {
  console.log(`  ${o.asOf}  ${formatQuantity(o.value.value).padStart(10)}  verified by ${displayName(FOUNDER)}`);
}
console.log(`\n  measure:  ${built.measure.measure}`);
console.log(`  excludes: ${built.measure.excludes ?? '(nothing recorded)'}`);
console.log(`  method:   ${method.trim()}`);

if (dryRun) {
  console.log('\nDry run. Nothing written.\n');
} else {
  await new Store('data').saveSeries(SLUG, built);
  console.log(`\nWritten to data/series/${SLUG}/. Records are append-only; re-running adds only new dates.\n`);
}
