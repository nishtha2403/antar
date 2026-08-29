#!/usr/bin/env node
/**
 * Renders the citizen page from PLACEHOLDER data, for looking at the layout.
 *
 * Nothing here has been retrieved from a source. The provenance titles say so,
 * and they say so on the rendered page too, because a preview that looks like a
 * published claim is exactly the artifact this project must not produce.
 *
 * This script exists to review the page design. It is not an ingest path, and
 * it does not write to data/.
 */
import { writeFileSync } from 'node:fs';
import { computeGap } from '../src/kernel/gap.ts';
import { agentIdentity, humanIdentity } from '../src/kernel/identity.ts';
import { provenance } from '../src/kernel/provenance.ts';
import { quantity } from '../src/kernel/quantity.ts';
import { series } from '../src/kernel/series.ts';
import { classify, createTarget, targetId, typeIndicator } from '../src/kernel/target.ts';
import { isoDate, targetYear } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { renderTargetPage } from '../src/render/page.ts';

const out = process.argv[2] ?? 'build/preview.html';
const REVIEWER = humanIdentity('placeholder.reviewer');
const BOT = agentIdentity('placeholder-harvester');

const pib = provenance({
  sourceUrl: 'https://pib.gov.in/',
  sourceTitle: 'PLACEHOLDER — PIB release not yet retrieved',
  publisher: 'Press Information Bureau',
  retrievedOn: '2026-08-29',
  retrievedBy: BOT,
});

const cea = provenance({
  sourceUrl: 'https://cea.nic.in/',
  sourceTitle: 'PLACEHOLDER — CEA series not yet retrieved',
  publisher: 'Central Electricity Authority',
  retrievedOn: '2026-08-29',
  retrievedBy: BOT,
});

const measure = {
  measure: 'Installed nuclear electricity generation capacity, all-India',
  unit: 'GW',
  sourceSeries: 'CEA Installed Capacity Report, All-India, Nuclear (placeholder)',
  vintage: 'current',
} as const;

const target = createTarget({
  id: targetId('NEM-2047-100GW'),
  title: '100 GW of nuclear power capacity by 2047',
  measure,
  classification: classify('PROMISE', REVIEWER, '2026-08-29', 'PLACEHOLDER rationale for layout review only.'),
  indicatorType: typeIndicator('output', REVIEWER, '2026-08-29', 'PLACEHOLDER rationale for layout review only.'),
  original: {
    value: verify(attest(quantity('100', 'GW'), pib), REVIEWER, '2026-08-29', 'PLACEHOLDER verification.'),
    dueBy: targetYear(2047),
    announcedBy: 'Ministry of Finance',
    announcedOn: '2025-02-01',
    provenance: pib,
    recordedBy: REVIEWER,
    recordedOn: '2026-08-29',
  },
});

const observations = series(measure, [
  {
    asOf: isoDate('2025-12-31'),
    value: verify(attest(quantity('8.18', 'GW'), cea), REVIEWER, '2026-08-29', 'PLACEHOLDER verification.'),
  },
]);

writeFileSync(out, renderTargetPage(target, computeGap(target, observations)));
console.log(`Wrote ${out} — PLACEHOLDER DATA, layout review only. Nothing here is sourced.`);
