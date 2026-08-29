import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { humanIdentity, KernelError } from '../kernel/identity.ts';
import { translationEntry, translations, type Translations } from '../kernel/translation.ts';
import { currentRevision, type Target } from '../kernel/target.ts';
import { roadmap, type Roadmap } from '../kernel/roadmap.ts';
import { series, type Series } from '../kernel/series.ts';
import {
  decodeMilestone,
  encodeMilestone,
  type MilestoneJson,
  decodeObservation,
  decodeTarget,
  encodeObservation,
  encodeRevision,
  encodeTargetHeader,
  type MeasureJson,
  type ObservationJson,
  type RevisionJson,
  type TargetHeaderJson,
} from './codec.ts';

/**
 * The store is a directory of JSON files under version control.
 *
 * Three properties come from that choice rather than from code we maintain.
 * Git's history is the append-only log, and rewriting it leaves evidence.
 * The files committed here are the same files published as raw data at G2, so
 * auditability is not a later export step. And a reviewer with no toolchain can
 * read the record.
 *
 * SQLite is built from these files as a query cache. It is derived, disposable,
 * and never a source of truth.
 *
 *   data/targets/<TARGET-ID>/target.json     header: identity, measure, human judgements
 *   data/targets/<TARGET-ID>/rev-0001.json   one immutable file per revision
 */
export class Store {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private targetDir(id: string): string {
    return join(this.root, 'targets', id);
  }

  /**
   * Writes a file only if it does not already exist.
   *
   * This is the append-only guarantee at the filesystem layer. The kernel makes
   * overwriting a revision unrepresentable in the type system; this makes it
   * fail even when the caller bypasses the kernel entirely, including a stray
   * script or a re-run of an ingest job.
   */
  private async writeNew(path: string, contents: string): Promise<void> {
    if (existsSync(path)) {
      throw new KernelError(
        `Refusing to overwrite ${path}. Records here are append-only: ` +
          'correct a mistaken revision by appending another one that says so.',
      );
    }
    await mkdir(dirname(path), { recursive: true });
    // wx: fails if the path appeared between the check above and this write.
    await writeFile(path, contents, { flag: 'wx' });
  }

  private static json(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  /**
   * Persists any revisions of a target not already on disk.
   *
   * Safe to re-run. Existing revision files are left untouched and never
   * compared away; only genuinely new sequence numbers are written.
   */
  async saveTarget(target: Target): Promise<void> {
    const dir = this.targetDir(target.id);

    // The header carries the target's definition — title, measure, the series
    // that measures it, the human judgements. Definitions get corrected, so the
    // header is revised like everything else rather than written once and frozen:
    // target-r0002.json supersedes target.json, and the original stays readable.
    const headers = await this.headerFiles(target.id);
    const encoded = Store.json(encodeTargetHeader(target));
    const currentHeader =
      headers.length > 0 ? await readFile(join(dir, headers[headers.length - 1] as string), 'utf8') : undefined;
    if (currentHeader !== encoded) {
      const next = String(headers.length + 1).padStart(4, '0');
      await this.writeNew(join(dir, `target-r${next}.json`), encoded);
    }

    for (const revision of target.revisions) {
      const path = join(dir, `rev-${String(revision.seq).padStart(4, '0')}.json`);
      if (existsSync(path)) continue;
      await this.writeNew(path, Store.json(encodeRevision(revision)));
    }
  }

  /** Header filenames for a target, oldest revision first. */
  private async headerFiles(id: string): Promise<string[]> {
    const dir = this.targetDir(id);
    if (!existsSync(dir)) return [];
    const pattern = /^target(?:-r(\d{4}))?\.json$/;
    const parsed: { file: string; revision: number }[] = [];
    for (const file of await readdir(dir)) {
      const match = pattern.exec(file);
      if (!match) continue;
      parsed.push({ file, revision: match[1] ? Number(match[1]) : 1 });
    }
    // Numeric, not lexical: "target-r0002.json" precedes "target.json" as a
    // string, which would return the superseded definition as operative.
    return parsed.sort((a, b) => a.revision - b.revision).map((p) => p.file);
  }

  async loadTarget(id: string): Promise<Target> {
    const dir = this.targetDir(id);
    const headers = await this.headerFiles(id);
    if (headers.length === 0) throw new KernelError(`Target ${id} has no header on disk.`);
    const header = JSON.parse(
      await readFile(join(dir, headers[headers.length - 1] as string), 'utf8'),
    ) as TargetHeaderJson;
    const files = (await readdir(dir)).filter((f) => /^rev-\d{4}\.json$/.test(f)).sort();
    if (files.length === 0) throw new KernelError(`Target ${id} has a header but no revisions.`);
    const revisions = await Promise.all(
      files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')) as RevisionJson),
    );
    return decodeTarget(header, revisions);
  }

  /**
   * Lists every target id in the store.
   *
   * An empty store is reported as empty by returning an empty list; callers that
   * expect targets must treat that as a failure themselves. Rule 2 — scrapers
   * fail loud — is enforced at the ingest boundary, not by a directory listing
   * pretending a missing directory is a populated one.
   */
  async listTargetIds(): Promise<string[]> {
    const dir = join(this.root, 'targets');
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  }

  async loadAllTargets(): Promise<Target[]> {
    const ids = await this.listTargetIds();
    return Promise.all(ids.map((id) => this.loadTarget(id)));
  }

  /**
   * Persists a series: its measure once, then immutable observation files.
   *
   * An observation can be superseded but never rewritten. Files are named
   * `obs-<date>-r0001.json`, and saving a date that already exists writes the
   * next revision rather than replacing the current one, so the earlier record —
   * including what it claimed about who verified it and how — stays readable.
   *
   * This is not hypothetical tidiness. A figure recorded as verified can later
   * turn out not to have been, and the honest repair is a new revision saying so
   * on top of a preserved original, not a quiet edit that leaves no trace of the
   * claim ever having been made.
   */
  async saveSeries(slug: string, s: Series): Promise<void> {
    const dir = join(this.root, 'series', slug);
    const measurePath = join(dir, 'measure.json');
    if (!existsSync(measurePath)) {
      await this.writeNew(measurePath, Store.json({ slug, measure: s.measure }));
    }
    const existing = await this.observationFiles(slug);
    for (const observation of s.observations) {
      const revisions = existing.get(observation.asOf) ?? [];
      const encoded = Store.json(encodeObservation(observation));
      // Identical content is not a new revision; re-running a scrape is not an event.
      if (revisions.length > 0) {
        const current = await readFile(join(dir, revisions[revisions.length - 1] as string), 'utf8');
        if (current === encoded) continue;
      }
      const next = String(revisions.length + 1).padStart(4, '0');
      await this.writeNew(join(dir, `obs-${observation.asOf}-r${next}.json`), encoded);
    }
  }

  /** Observation filenames per date, oldest revision first. */
  private async observationFiles(slug: string): Promise<Map<string, string[]>> {
    const dir = join(this.root, 'series', slug);
    if (!existsSync(dir)) return new Map();
    const pattern = /^obs-(\d{4}-\d{2}-\d{2})(?:-r(\d{4}))?\.json$/;
    const parsed: { file: string; date: string; revision: number }[] = [];
    for (const file of await readdir(dir)) {
      const match = pattern.exec(file);
      if (!match) continue;
      // A file with no -rNNNN suffix is revision 1, from before revisions existed.
      parsed.push({ file, date: match[1] as string, revision: match[2] ? Number(match[2]) : 1 });
    }

    const byDate = new Map<string, string[]>();
    // Sorted by revision number, not by filename: "-r0002.json" sorts before
    // ".json" lexically, because '-' precedes '.', so a string sort silently
    // returns the superseded record as the operative one.
    for (const { file, date } of parsed.sort((a, b) => a.date.localeCompare(b.date) || a.revision - b.revision)) {
      const list = byDate.get(date);
      if (list) list.push(file);
      else byDate.set(date, [file]);
    }
    return byDate;
  }

  /** The operative version of each observation: the highest revision on file. */
  async loadSeries(slug: string): Promise<Series> {
    const dir = join(this.root, 'series', slug);
    if (!existsSync(dir)) throw new KernelError(`No series named ${slug} in the store.`);
    const header = JSON.parse(await readFile(join(dir, 'measure.json'), 'utf8')) as MeasureJson;
    const byDate = await this.observationFiles(slug);
    if (byDate.size === 0) {
      throw new KernelError(`Series ${slug} has a measure but no observations.`);
    }
    const observations = await Promise.all(
      [...byDate.values()].map(async (revisions) => {
        const operative = revisions[revisions.length - 1] as string;
        return decodeObservation(JSON.parse(await readFile(join(dir, operative), 'utf8')) as ObservationJson);
      }),
    );
    return series(header.measure, observations);
  }

  async listSeriesSlugs(): Promise<string[]> {
    const dir = join(this.root, 'series');
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  }

  /**
   * Persists a roadmap: immutable milestone files, superseded rather than edited.
   *
   * `m-0001-r0002.json` supersedes `m-0001-r0001.json`. Milestones need this for
   * the same reason observations do — a status can move from planned to
   * committed when an actor actually undertakes something, and a figure recorded
   * before verification has to be re-recorded after it. Both are events worth
   * keeping, not states worth overwriting.
   *
   * Identity is position in the roadmap, since a milestone has no natural key
   * the way an observation has its date.
   */
  async saveRoadmap(plan: Roadmap): Promise<void> {
    const dir = join(this.root, 'targets', plan.targetId, 'roadmap');
    const existing = await this.milestoneFiles(plan.targetId);
    for (const [index, milestone] of plan.milestones.entries()) {
      const key = String(index + 1).padStart(4, '0');
      const revisions = existing.get(key) ?? [];
      const encoded = Store.json(encodeMilestone(milestone));
      if (revisions.length > 0) {
        const current = await readFile(join(dir, revisions[revisions.length - 1] as string), 'utf8');
        if (current === encoded) continue;
      }
      const next = String(revisions.length + 1).padStart(4, '0');
      await this.writeNew(join(dir, `m-${key}-r${next}.json`), encoded);
    }
  }

  /** Milestone filenames per position, oldest revision first. */
  private async milestoneFiles(targetId: string): Promise<Map<string, string[]>> {
    const dir = join(this.root, 'targets', targetId, 'roadmap');
    if (!existsSync(dir)) return new Map();
    const pattern = /^m-(\d{4})(?:-r(\d{4}))?\.json$/;
    const parsed: { file: string; key: string; revision: number }[] = [];
    for (const file of await readdir(dir)) {
      const match = pattern.exec(file);
      if (!match) continue;
      parsed.push({ file, key: match[1] as string, revision: match[2] ? Number(match[2]) : 1 });
    }
    const byKey = new Map<string, string[]>();
    // Numeric sort, not lexical: "-r0002.json" precedes ".json" as a string,
    // which would hand back the superseded record as the operative one.
    for (const { file, key } of parsed.sort((a, b) => a.key.localeCompare(b.key) || a.revision - b.revision)) {
      const list = byKey.get(key);
      if (list) list.push(file);
      else byKey.set(key, [file]);
    }
    return byKey;
  }

  async loadRoadmap(targetId: string): Promise<Roadmap> {
    const dir = join(this.root, 'targets', targetId, 'roadmap');
    if (!existsSync(dir)) throw new KernelError(`No roadmap recorded for ${targetId}.`);
    const byKey = await this.milestoneFiles(targetId);
    if (byKey.size === 0) throw new KernelError(`No roadmap milestones recorded for ${targetId}.`);
    const milestones = await Promise.all(
      [...byKey.values()].map(async (revisions) => {
        const operative = revisions[revisions.length - 1] as string;
        return decodeMilestone(JSON.parse(await readFile(join(dir, operative), 'utf8')) as MilestoneJson);
      }),
    );
    return roadmap(targetId as Target['id'], milestones);
  }

  async hasRoadmap(targetId: string): Promise<boolean> {
    return existsSync(join(this.root, 'targets', targetId, 'roadmap'));
  }

  /**
   * Persists a locale's translations of recorded text.
   *
   * One file per locale per target-independent scope: translations are keyed by
   * the English string, so the same entry serves every page that uses that
   * string. Rewritten wholesale rather than appended, because a translation
   * table is a working document rather than a claim about the world — the claims
   * are the figures, and those are append-only.
   */
  async saveTranslations(table: Translations): Promise<void> {
    const path = join(this.root, 'translations', `${table.locale}.json`);
    await mkdir(dirname(path), { recursive: true });
    const entries = [...table.entries.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([source, entry]) => ({ source, ...entry }));
    await writeFile(path, Store.json({ locale: table.locale, entries }));
  }

  async loadTranslations(locale: string): Promise<Translations | undefined> {
    const path = join(this.root, 'translations', `${locale}.json`);
    if (!existsSync(path)) return undefined;
    const json = JSON.parse(await readFile(path, 'utf8')) as {
      locale: string;
      entries: { source: string; text: string; translatedBy: string; translatedOn: string; note?: string }[];
    };
    return translations(
      json.locale,
      json.entries.map((e) =>
        translationEntry(e.source, e.text, humanIdentity(e.translatedBy), e.translatedOn, e.note),
      ),
    );
  }

  /**
   * Appends to the public corrections log.
   *
   * Rule 10 is that a correction cannot be deleted. Each correction is its own
   * file, written with the same no-overwrite guarantee as a revision.
   */
  async appendCorrection(correction: Correction): Promise<void> {
    if (!correction.what.trim() || !correction.why.trim()) {
      throw new KernelError('A correction records both what was wrong and why it was wrong.');
    }
    const slug = correction.what
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    const path = join(this.root, 'corrections', `${correction.correctedOn}-${slug}.json`);
    await this.writeNew(path, Store.json(correction));
  }

  async listCorrections(): Promise<Correction[]> {
    const dir = join(this.root, 'corrections');
    if (!existsSync(dir)) return [];
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
    return Promise.all(
      files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')) as Correction),
    );
  }
}

export type Correction = {
  /** What was wrong, in the words a reader would use. */
  readonly what: string;
  /** Why it was wrong — the underlying cause, not the symptom. */
  readonly why: string;
  /** Ids of affected records, where the error had a location. */
  readonly affects: readonly string[];
  readonly correctedOn: string;
  /** Rule 6: the wording of a correction is never generated. */
  readonly writtenBy: string;
};

export function targetSummary(target: Target): string {
  const revision = currentRevision(target);
  return `${target.id} · ${target.title} · rev ${revision.seq} · ${revision.value.verification.state}`;
}
