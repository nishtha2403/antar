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

/**
 * Which dates a person actually checked.
 *
 * Required, and not defaulted to "all". Verification is a claim about what a
 * named human did, and a script has no business assuming the answer — a row
 * left off this list is recorded unverified, which is the truthful state and
 * simply means it cannot be published yet.
 */
const verifiedArg = flags.find((f) => f.startsWith('--verified='));
const verifiedDates = new Set(
  (verifiedArg?.slice('--verified='.length) ?? '').split(',').map((d) => d.trim()).filter(Boolean),
);

if (!method?.trim()) {
  console.error('Usage: node scripts/record-cea.ts "<what you checked>" --verified=YYYY-MM-DD[,...]');
  process.exit(1);
}
if (verifiedDates.size === 0) {
  console.error('No --verified dates given. Refusing to record a verification nobody performed.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync('build/sources/manifest.json', 'utf8')) as {
  retrievedOn: string;
  readings: { month: string; asOn: string; mw: string; url: string; file: string }[];
};

const HARVESTER = CEA_HARVESTER;

const observations = manifest.readings.map((r) => {
  const figure = attest(
    megawattsToGigawatts(r.mw, FOUNDER),
    provenance({
      sourceUrl: r.url,
      sourceTitle: `Installed Capacity Report, as on ${r.asOn}`,
      publisher: 'Central Electricity Authority',
      retrievedOn: manifest.retrievedOn,
      retrievedBy: byAgent(HARVESTER),
      locator: 'ALL INDIA, Total, Nuclear',
    }),
  );
  return {
    asOf: isoDate(r.asOn),
    value: verifiedDates.has(r.asOn)
      ? verify(figure, FOUNDER, manifest.retrievedOn, method.trim())
      : figure,
  };
});

const built = series(CEA_NUCLEAR_MEASURE, observations);

console.log(`\n${SLUG} — ${built.observations.length} observation(s)`);
for (const o of built.observations) {
  const state =
    o.value.verification.state === 'verified'
      ? `verified by ${displayName(FOUNDER)}`
      : 'unverified — cannot be published';
  console.log(`  ${o.asOf}  ${formatQuantity(o.value.value).padStart(10)}  ${state}`);
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
