#!/usr/bin/env node
/**
 * Renders the citizen page from the store. Nothing here is a placeholder.
 *
 * Both sides of the gap are recorded, sourced and verified: the target from the
 * PIB release a person read, the series from the CEA reports a person checked.
 * The page will refuse to render if either side is unverified.
 *
 * Writes nothing to data/. Rendering is a read.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { computeGap } from '../src/kernel/gap.ts';
import { renderAllLocales } from '../src/render/page.ts';
import { Store } from '../src/store/store.ts';
import { LOCALES, pagePath } from '../src/render/strings.ts';

const outDir = process.argv[2] ?? 'build/preview';
const store = new Store('data');
const target = await store.loadTarget('NEM-2047-100GW');
const observations = await store.loadSeries('cea-nuclear-installed-capacity');
// Absent until recorded, and unverified milestones do not render even then.
const plan = (await store.hasRoadmap(target.id)) ? await store.loadRoadmap(target.id) : undefined;
const tables = { hi: await store.loadTranslations('hi') };

const pages = renderAllLocales(target, computeGap(target, observations), plan, tables);
for (const locale of LOCALES) {
  const path = `${outDir}/${pagePath('nem-2047-100gw', locale)}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, pages[locale]);
  console.log(`Wrote ${path}`);
}
const latest = observations.observations[observations.observations.length - 1];
console.log(
  `\nTarget:       ${target.id} — ${target.classification.value}, ${target.indicatorType.value}\n` +
    `Observations: ${observations.observations.length} from data/, latest ${latest?.asOf}\n` +
    `Roadmap:      ${plan ? `${plan.milestones.length} milestones, ` +
      `${plan.milestones.filter((m) => m.value.verification.state === 'verified').length} verified` : 'none recorded'}\n`,
);
