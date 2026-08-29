import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ContextNote } from '../kernel/context.ts';
import type { Roadmap } from '../kernel/roadmap.ts';
import type { Series } from '../kernel/series.ts';
import type { Target } from '../kernel/target.ts';
import type { Translations } from '../kernel/translation.ts';
import { Store } from '../store/store.ts';
import type { Locale } from './locales.ts';

/**
 * Everything the site knows, loaded once per build from the record repository.
 *
 * `data/` is a submodule pinned to a commit, so a build is reproducible: the
 * pages that deploy are the pages that come from exactly that revision of the
 * record, not from whatever the record happened to be at deploy time.
 */

const ROOT = 'data';
const store = new Store(ROOT);

export type Correction = {
  readonly what: string;
  readonly why: string;
  readonly affects: readonly string[];
  readonly correctedOn: string;
  readonly writtenBy: string;
  /** Drafts are recorded but never rendered. Wording is a human decision. */
  readonly status?: 'draft' | 'published';
};

export type Records = {
  readonly targets: readonly Target[];
  readonly series: ReadonlyMap<string, Series>;
  readonly roadmaps: ReadonlyMap<string, Roadmap>;
  readonly context: ReadonlyMap<string, readonly ContextNote[]>;
  readonly translations: Partial<Record<Locale, Translations | undefined>>;
  readonly corrections: readonly Correction[];
  readonly categories: readonly string[];
};

let cached: Records | undefined;

export async function loadRecords(): Promise<Records> {
  if (cached) return cached;

  const ids = await store.listTargetIds();
  if (ids.length === 0) {
    // An empty site is a failure, never an empty page.
    throw new Error(
      `No targets found in ${ROOT}/. If the submodule is not checked out, run ` +
        '`git submodule update --init`.',
    );
  }

  const targets: Target[] = [];
  const series = new Map<string, Series>();
  const roadmaps = new Map<string, Roadmap>();
  const context = new Map<string, readonly ContextNote[]>();

  for (const id of ids) {
    const target = await store.loadTarget(id);
    targets.push(target);
    if (!series.has(target.series)) series.set(target.series, await store.loadSeries(target.series));
    if (await store.hasRoadmap(id)) roadmaps.set(id, await store.loadRoadmap(id));
    context.set(id, await store.loadContext(id));
  }

  const records: Records = {
    targets: targets.sort((a, b) => a.title.localeCompare(b.title)),
    series,
    roadmaps,
    context,
    translations: { hi: await store.loadTranslations('hi') },
    corrections: await loadCorrections(),
    categories: [...new Set(targets.map((t) => t.category as string))].sort(),
  };
  cached = records;
  return records;
}

/** Published corrections only. A draft is recorded but not rendered. */
async function loadCorrections(): Promise<Correction[]> {
  const dir = join(ROOT, 'corrections');
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse();
  const all = await Promise.all(
    files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')) as Correction),
  );
  return all.filter((c) => c.status !== 'draft');
}

export const CATEGORY_NAMES: Readonly<Record<string, { en: string; hi: string }>> = {
  energy: { en: 'Energy', hi: 'ऊर्जा' },
  health: { en: 'Health', hi: 'स्वास्थ्य' },
  education: { en: 'Education', hi: 'शिक्षा' },
  research: { en: 'Research', hi: 'अनुसंधान' },
  transport: { en: 'Transport', hi: 'परिवहन' },
};

export const categoryName = (slug: string, locale: Locale): string =>
  CATEGORY_NAMES[slug]?.[locale] ?? slug;
