#!/usr/bin/env node
/**
 * Builds the static site from the store.
 *
 * Rendered from the records on every deploy rather than from committed HTML, so
 * a published page cannot drift from the data it claims to represent. If a
 * figure is unverified the render throws and the build fails, which is the
 * intended behaviour: nothing publishes on failure.
 *
 *   node scripts/build-site.ts [outDir]
 *
 * Layout: English at the root, Hindi under /hi/, matching the hreflang links.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { computeGap } from '../src/kernel/gap.ts';
import { renderIndex } from '../src/render/index.ts';
import { renderTargetPage, slugFor } from '../src/render/page.ts';
import { type Locale, LOCALES } from '../src/render/strings.ts';
import { Store } from '../src/store/store.ts';

const out = process.argv[2] ?? 'build/site';
const store = new Store('data');

const write = (path: string, contents: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  console.log(`  ${path}`);
};

const dir = (locale: Locale): string => (locale === 'en' ? out : join(out, locale));

const targetIds = await store.listTargetIds();
if (targetIds.length === 0) {
  // An empty site is a failure, never an empty page — rule 2 at the render layer.
  console.error('No targets in the store. Refusing to publish an empty site.');
  process.exit(1);
}

console.log('Building site:');
const targets = [];

for (const id of targetIds) {
  const target = await store.loadTarget(id);
  const observations = await store.loadSeries('cea-nuclear-installed-capacity');
  const plan = (await store.hasRoadmap(id)) ? await store.loadRoadmap(id) : undefined;
  const gap = computeGap(target, observations);

  for (const locale of LOCALES) {
    write(join(dir(locale), `${slugFor(target)}.html`), renderTargetPage(target, gap, locale, plan));
  }
  targets.push(target);
}

for (const locale of LOCALES) {
  write(join(dir(locale), 'index.html'), renderIndex(targets, locale));
}

// Jekyll would otherwise ignore files it does not recognise.
write(join(out, '.nojekyll'), '');

console.log(`\n${targets.length} target(s), ${LOCALES.length} locales. Every figure verified or the build would have failed.\n`);
