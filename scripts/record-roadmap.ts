#!/usr/bin/env node
/**
 * Drafts the NEM-2047-100GW roadmap from the PIB release, for verification.
 *
 * Every figure below is quoted from PRID 2287710, not derived. Where the source
 * gives a running total it is recorded as cumulative; where it gives an addition
 * it is recorded as an increment. Flattening the two would produce a roadmap
 * that double-counts while looking tidy.
 *
 * The status of each line — planned, committed, built — is a human judgement,
 * and `planned` is the default because a government projecting that private
 * operators will supply capacity is not those operators undertaking to.
 *
 *   node scripts/record-roadmap.ts [--dry-run] [--verified]
 *
 * Without --verified every milestone is recorded unverified and nothing renders.
 */
import { byHuman } from '../src/kernel/identity.ts';
import { FOUNDER } from '../src/kernel/people.ts';
import { provenance } from '../src/kernel/provenance.ts';
import { formatQuantity, quantity } from '../src/kernel/quantity.ts';
import { type Milestone, milestoneStatus, reconcile, roadmap } from '../src/kernel/roadmap.ts';
import { currentRevision, targetId } from '../src/kernel/target.ts';
import { isoDate, targetYear } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { Store } from '../src/store/store.ts';

const dryRun = process.argv.includes('--dry-run');
const markVerified = process.argv.includes('--verified');
const ON = '2026-08-30';

const source = provenance({
  sourceUrl: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287710&reg=3&lang=1',
  sourceTitle: 'PARLIAMENT QUESTION: NUCLEAR ENERGY MISSION FOR VIKSIT BHARAT',
  publisher: 'Press Information Bureau, Department of Atomic Energy',
  publishedOn: '2026-07-22',
  retrievedOn: ON,
  retrievedBy: byHuman(FOUNDER),
  locator: 'PRID 2287710, roadmap paragraph',
});

const METHOD =
  'Read against PRID 2287710, which states: present capacity 8.78 GW; expected to reach about ' +
  '22 GW by 2031-32 on progressive completion of projects under implementation; another 32 GW ' +
  'beyond 2032 by NPCIL taking capacity to about 54 GW; balance of 46 GW expected from other ' +
  'public sector enterprises, state governments, private sector and joint ventures.';

const figure = (amount: string) => {
  const attested = attest(quantity(amount, 'GW'), source);
  return markVerified ? verify(attested, FOUNDER, ON, METHOD) : attested;
};

const milestones: Milestone[] = [
  {
    label: 'In service today',
    value: figure('8.78'),
    basis: 'cumulative',
    actors: ['NPCIL (existing fleet)'],
    status: milestoneStatus(
      'built',
      FOUNDER,
      ON,
      'Capacity already generating, independently observable in the CEA monthly series and ' +
        'corroborated by this release, which gives the same 8.78 GW figure.',
    ),
    provenance: source,
    recordedBy: FOUNDER,
    recordedOn: isoDate(ON),
  },
  {
    label: 'Expected by 2031-32, from projects under construction',
    value: figure('22'),
    basis: 'cumulative',
    by: targetYear(2032),
    actors: ['NPCIL'],
    status: milestoneStatus(
      'planned',
      FOUNDER,
      ON,
      'The release says capacity "is expected to reach" this level on progressive completion of ' +
        'projects at various stages of implementation. Construction being under way is evidence of ' +
        'intent, not an undertaking to a date, so this is planned rather than committed.',
    ),
    provenance: source,
    recordedBy: FOUNDER,
    recordedOn: isoDate(ON),
  },
  {
    label: 'Envisaged beyond 2032, indigenous PHWR and LWR',
    value: figure('32'),
    basis: 'increment',
    by: targetYear(2047),
    actors: ['NPCIL'],
    status: milestoneStatus(
      'planned',
      FOUNDER,
      ON,
      'Described as "envisaged to be set up beyond 2032". No sanction, site or schedule is cited ' +
        'in this release, so it is a projection.',
    ),
    provenance: source,
    recordedBy: FOUNDER,
    recordedOn: isoDate(ON),
  },
  {
    label: 'Balance expected from other parties',
    value: figure('46'),
    basis: 'increment',
    by: targetYear(2047),
    actors: [
      'Other Public Sector Enterprises (Central and State)',
      'State Governments',
      'Private sector',
      'Joint Ventures',
    ],
    status: milestoneStatus(
      'planned',
      FOUNDER,
      ON,
      'The government expects these parties to supply this capacity. None of them is recorded as ' +
        'having undertaken to. This is the single largest line in the roadmap and the one with the ' +
        'least behind it, which is precisely why it belongs on the page.',
    ),
    provenance: source,
    recordedBy: FOUNDER,
    recordedOn: isoDate(ON),
  },
];

const store = new Store('data');
const target = await store.loadTarget('NEM-2047-100GW');
const plan = roadmap(targetId('NEM-2047-100GW'), milestones);
const sums = reconcile(currentRevision(target).value.value, plan);

console.log(`\nRoadmap for ${plan.targetId} — ${milestones.length} milestones\n`);
for (const m of plan.milestones) {
  console.log(
    `  ${formatQuantity(m.value.value).padStart(9)}  ${m.basis.padEnd(10)} ${m.status.value.padEnd(9)} ` +
      `${m.label}\n${' '.repeat(33)}${m.actors.join('; ')}`,
  );
}
console.log(`\n  accounts for: ${formatQuantity(sums.total)}`);
console.log(`  target:       ${formatQuantity(sums.target)}`);
console.log(`  reconciles:   ${sums.reconciles ? 'yes' : `NO — ${formatQuantity(sums.difference)} unexplained`}`);
console.log(`  verified:     ${markVerified ? `yes, by ${FOUNDER} on ${ON}` : 'no — will not render'}`);

if (dryRun) console.log('\nDry run. Nothing written.\n');
else {
  await store.saveRoadmap(plan);
  console.log(`\nWritten to data/targets/${plan.targetId}/roadmap/.\n`);
}
