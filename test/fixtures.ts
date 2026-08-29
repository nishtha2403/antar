import { agentIdentity, humanIdentity } from '../src/kernel/identity.ts';
import { provenance } from '../src/kernel/provenance.ts';
import { quantity } from '../src/kernel/quantity.ts';
import { classify, createTarget, targetId, typeIndicator } from '../src/kernel/target.ts';
import { targetYear } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';

export const FOUNDER = humanIdentity('n.sharma');
export const HARVESTER = agentIdentity('pib-harvester');

export const pibSource = provenance({
  sourceUrl: 'https://pib.gov.in/PressReleasePage.aspx?PRID=EXAMPLE',
  sourceTitle: 'Nuclear Energy Mission for Viksit Bharat',
  publisher: 'Press Information Bureau',
  publishedOn: '2025-02-01',
  retrievedOn: '2026-08-29',
  retrievedBy: HARVESTER,
  locator: 'para 3',
});

/** The G1 vertical slice, used as the worked example throughout the tests. */
export const nuclearMeasure = {
  measure: 'Installed nuclear electricity generation capacity, all-India',
  unit: 'GW',
  sourceSeries: 'CEA Installed Capacity Report, All-India, Nuclear',
  vintage: 'current',
} as const;

/** Placeholder source for the observation series. Not a real retrieval. */
export const ceaSource = provenance({
  sourceUrl: 'https://cea.nic.in/installed-capacity-report/?lang=en',
  sourceTitle: 'Installed Capacity Report (placeholder — not yet retrieved)',
  publisher: 'Central Electricity Authority',
  retrievedOn: '2026-08-29',
  retrievedBy: HARVESTER,
  locator: 'All-India, Nuclear',
});

export function nuclearTarget() {
  return createTarget({
    id: targetId('NEM-2047-100GW'),
    title: '100 GW of nuclear power capacity by 2047',
    measure: nuclearMeasure,
    classification: classify(
      'PROMISE',
      FOUNDER,
      '2026-08-29',
      'Announced by the Union government as a national mission with a stated year. ' +
        'Not a benchmark: no comparator is invoked. Not a floor: no statutory minimum.',
    ),
    indicatorType: typeIndicator(
      'output',
      FOUNDER,
      '2026-08-29',
      'Installed capacity is the direct product of construction activity. ' +
        'It is not an outcome: electricity delivered and emissions avoided are downstream of it.',
    ),
    original: {
      value: verify(
        attest(quantity('100', 'GW'), pibSource),
        FOUNDER,
        '2026-08-29',
        'Read against the PIB release, paragraph 3.',
      ),
      dueBy: targetYear(2047),
      announcedBy: 'Ministry of Finance',
      announcedOn: '2025-02-01',
      provenance: pibSource,
      recordedBy: FOUNDER,
      recordedOn: '2026-08-29',
    },
  });
}
