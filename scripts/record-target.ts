#!/usr/bin/env node
/**
 * Records the G1 target: the Nuclear Energy Mission 100 GW by 2047.
 *
 * Every human judgement in here — the classification, the indicator typing, the
 * unit decision, the choice of anchoring announcement — was made by a person and
 * is recorded with their name, the date, and a written reason. The script does
 * not decide anything; it writes down decisions already taken.
 *
 *   node scripts/record-target.ts [--dry-run]
 */
import { byHuman } from '../src/kernel/identity.ts';
import { displayName, FOUNDER } from '../src/kernel/people.ts';
import { provenance } from '../src/kernel/provenance.ts';
import { formatQuantity, quantity } from '../src/kernel/quantity.ts';
import { classify, createTarget, seriesSlug, targetId, typeIndicator } from '../src/kernel/target.ts';
import { targetYear } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { CEA_NUCLEAR_MEASURE } from '../src/ingest/cea.ts';
import { Store } from '../src/store/store.ts';

const dryRun = process.argv.includes('--dry-run');
const ON = '2026-08-30';

/** The document actually read. Note this is not the document that announced it. */
const source = provenance({
  sourceUrl: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287710&reg=3&lang=1',
  sourceTitle: 'PARLIAMENT QUESTION: NUCLEAR ENERGY MISSION FOR VIKSIT BHARAT',
  publisher: 'Press Information Bureau, Department of Atomic Energy',
  publishedOn: '2026-07-22',
  retrievedOn: ON,
  // Retrieved and read by a person, not fetched by a scraper.
  retrievedBy: byHuman(FOUNDER),
  locator: 'PRID 2287710',
});

const target = createTarget({
  id: targetId('NEM-2047-100GW'),
  title: '100 GW of nuclear power capacity by 2047',
  series: seriesSlug('cea-nuclear-installed-capacity'),
  // The same measure the observation series uses. A target and its series must
  // describe the same quantity or the gap between them means nothing.
  measure: CEA_NUCLEAR_MEASURE,

  classification: classify(
    'PROMISE',
    FOUNDER,
    ON,
    'Announced by the Union government in the Budget 2025-26 as a national mission with a stated ' +
      'year, and since legislated: Parliament enacted the SHANTI Act 2025 to achieve 100 GW by 2047. ' +
      'Classified PROMISE rather than FLOOR because the Act sets an objective the state has undertaken ' +
      'to reach, not a minimum standard imposed on regulated conduct — its effect is to strengthen the ' +
      'commitment, not to convert it into a compliance threshold. Not a BENCHMARK: no external ' +
      'comparator is invoked.',
  ),

  indicatorType: typeIndicator(
    'output',
    FOUNDER,
    ON,
    'Installed capacity is the direct product of construction activity. Not an outcome: electricity ' +
      'delivered, emissions avoided and price effects are all downstream of capacity existing. Not an ' +
      'input: the inputs are the capital and R&D allocations, including the SMR research budget.',
  ),

  original: {
    value: verify(
      attest(quantity('100', 'GW'), source),
      FOUNDER,
      ON,
      'Read against the PIB release of 22 July 2026 (PRID 2287710), which states the Nuclear Energy ' +
        'Mission objective of 100 GWe nuclear power generation capacity by 2047, announced in the ' +
        'Union Budget 2025-26. The release writes "100 GWe" in one sentence and "100 GW" in another; ' +
        'recorded as GW, treating GWe as the same quantity CEA reports as megawatts of installed ' +
        'capacity. That equivalence is a human judgement, not a conversion the kernel performed.',
    ),
    dueBy: targetYear(2047),
    // Who announced it, and when — distinct from the document read above.
    announcedBy: 'Ministry of Finance, Union Budget 2025-26',
    announcedOn: '2025-02-01',
    provenance: source,
    recordedBy: FOUNDER,
    recordedOn: ON,
  },
});

const revision = target.revisions[0];
console.log(`\n${target.id} — ${target.title}\n`);
console.log(`  value:      ${formatQuantity(revision.value.value)} by ${revision.dueBy}`);
console.log(`  class:      ${target.classification.value}`);
console.log(`  type:       ${target.indicatorType.value}`);
console.log(`  announced:  ${revision.announcedOn} by ${revision.announcedBy}`);
console.log(`  source:     ${source.sourceUrl}`);
console.log(`  recorded:   ${displayName(FOUNDER)} on ${ON}`);
console.log(`\n  classification rationale:\n    ${target.classification.rationale}`);
console.log(`\n  indicator rationale:\n    ${target.indicatorType.rationale}`);

if (dryRun) {
  console.log('\nDry run. Nothing written.\n');
} else {
  await new Store('data').saveTarget(target);
  console.log(`\nWritten to data/targets/${target.id}/.\n`);
}
