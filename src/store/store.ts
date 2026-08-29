import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { KernelError } from '../kernel/identity.ts';
import { currentRevision, type Target } from '../kernel/target.ts';
import { series, type Series } from '../kernel/series.ts';
import {
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
    const headerPath = join(dir, 'target.json');
    if (!existsSync(headerPath)) {
      await this.writeNew(headerPath, Store.json(encodeTargetHeader(target)));
    }
    for (const revision of target.revisions) {
      const path = join(dir, `rev-${String(revision.seq).padStart(4, '0')}.json`);
      if (existsSync(path)) continue;
      await this.writeNew(path, Store.json(encodeRevision(revision)));
    }
  }

  async loadTarget(id: string): Promise<Target> {
    const dir = this.targetDir(id);
    const header = JSON.parse(await readFile(join(dir, 'target.json'), 'utf8')) as TargetHeaderJson;
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
   * Persists a series: its measure once, then one immutable file per observation.
   *
   * Same append-only rule as revisions. A re-run adds new dates and leaves
   * existing files byte-for-byte alone, so a figure that has been verified
   * cannot be quietly replaced by a later scrape of the same month.
   */
  async saveSeries(slug: string, s: Series): Promise<void> {
    const dir = join(this.root, 'series', slug);
    const measurePath = join(dir, 'measure.json');
    if (!existsSync(measurePath)) {
      await this.writeNew(measurePath, Store.json({ slug, measure: s.measure }));
    }
    for (const observation of s.observations) {
      const path = join(dir, `obs-${observation.asOf}.json`);
      if (existsSync(path)) continue;
      await this.writeNew(path, Store.json(encodeObservation(observation)));
    }
  }

  async loadSeries(slug: string): Promise<Series> {
    const dir = join(this.root, 'series', slug);
    if (!existsSync(dir)) throw new KernelError(`No series named ${slug} in the store.`);
    const header = JSON.parse(await readFile(join(dir, 'measure.json'), 'utf8')) as MeasureJson;
    const files = (await readdir(dir)).filter((f) => /^obs-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    if (files.length === 0) {
      throw new KernelError(`Series ${slug} has a measure but no observations.`);
    }
    const observations = await Promise.all(
      files.map(async (f) =>
        decodeObservation(JSON.parse(await readFile(join(dir, f), 'utf8')) as ObservationJson),
      ),
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
