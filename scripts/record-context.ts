#!/usr/bin/env node
/**
 * Records what the government says about NEM-2047-100GW.
 *
 * Everything here is attributed and quoted closely from the source. Nothing is
 * Antar's assessment of whether any of it is right, achievable or worthwhile —
 * that judgement is the reader's, and the citation is what lets them make it.
 *
 *   node scripts/record-context.ts [--dry-run] [--verified]
 */
import { contextNote } from '../src/kernel/context.ts';
import { byHuman } from '../src/kernel/identity.ts';
import { FOUNDER } from '../src/kernel/people.ts';
import { provenance } from '../src/kernel/provenance.ts';
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
  locator: 'PRID 2287710',
});

const METHOD = 'Read against PRID 2287710 and reported as stated there.';
const say = (text: string) => {
  const a = attest(text, source);
  return markVerified ? verify(a, FOUNDER, ON, METHOD) : a;
};

const notes = [
  contextNote({
    kind: 'stated-purpose',
    attributedTo: 'Department of Atomic Energy',
    statement: say(
      'The Nuclear Energy Mission was announced with the objective of achieving 100 GWe of ' +
        'nuclear power generation capacity by 2047, to support the vision of Viksit Bharat and ' +
        'the goal of net zero carbon emissions by 2070.',
    ),
    saidOn: '2026-07-22',
    recordedBy: FOUNDER,
    recordedOn: ON,
  }),
  contextNote({
    kind: 'recorded-event',
    attributedTo: 'Parliament of India',
    statement: say(
      'The SHANTI Act, 2025 was enacted to achieve a target of 100 GW by 2047. The Act opens ' +
        'the nuclear energy sector to private participation.',
    ),
    saidOn: '2026-07-22',
    recordedBy: FOUNDER,
    recordedOn: ON,
  }),
  contextNote({
    kind: 'stated-plan',
    attributedTo: 'Department of Atomic Energy',
    statement: say(
      'The mission also aims to develop and operationalise at least five indigenous Small ' +
        'Modular Reactors by 2033.',
    ),
    saidOn: '2026-07-22',
    recordedBy: FOUNDER,
    recordedOn: ON,
  }),
];

console.log(`\nContext for NEM-2047-100GW — ${notes.length} notes\n`);
for (const n of notes) {
  console.log(`  [${n.kind}] ${n.attributedTo}`);
  console.log(`    ${n.statement.value.slice(0, 96)}...`);
  console.log(`    ${n.statement.verification.state}\n`);
}

if (dryRun) console.log('Dry run. Nothing written.\n');
else {
  await new Store('data').saveContext('NEM-2047-100GW', notes);
  console.log('Written to data/targets/NEM-2047-100GW/context/\n');
}
