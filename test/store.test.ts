import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatQuantity, quantity } from '../src/kernel/quantity.ts';
import { series } from '../src/kernel/series.ts';
import { milestoneStatus, roadmap } from '../src/kernel/roadmap.ts';
import { reviseTarget, targetId } from '../src/kernel/target.ts';
import { isoDate, targetYear } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { Store } from '../src/store/store.ts';
import { ceaSource, FOUNDER, nuclearMeasure, nuclearTarget, pibSource } from './fixtures.ts';

let store: Store;
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'antar-store-'));
  store = new Store(root);
});

const revisionOf = (dueBy: number, note: string) => ({
  value: verify(attest(quantity('100', 'GW'), pibSource), FOUNDER, '2027-03-01', 'Read against source'),
  dueBy: targetYear(dueBy),
  announcedBy: 'Ministry of Finance',
  announcedOn: '2027-02-01',
  provenance: pibSource,
  recordedBy: FOUNDER,
  recordedOn: '2027-03-01',
  note,
});

describe('the store is append-only on disk, not just in memory', () => {
  it('round-trips a target through JSON and back', async () => {
    const target = nuclearTarget();
    await store.saveTarget(target);
    const loaded = await store.loadTarget('NEM-2047-100GW');
    expect(loaded.revisions).toHaveLength(1);
    expect(loaded.revisions[0]?.value.value).toEqual(quantity('100', 'GW'));
    expect(loaded.classification.value).toBe('PROMISE');
    expect(loaded.classification.decidedBy).toBe('nishtha.sharma');
  });

  it('writes a new file per revision and leaves earlier ones untouched', async () => {
    const target = nuclearTarget();
    await store.saveTarget(target);
    const originalBytes = await readFile(
      join(root, 'targets', 'NEM-2047-100GW', 'rev-0001.json'),
      'utf8',
    );

    await store.saveTarget(reviseTarget(target, revisionOf(2052, 'Deadline moved to 2052.')));

    expect(
      await readFile(join(root, 'targets', 'NEM-2047-100GW', 'rev-0001.json'), 'utf8'),
    ).toBe(originalBytes);
    const loaded = await store.loadTarget('NEM-2047-100GW');
    expect(loaded.revisions).toHaveLength(2);
    expect(loaded.revisions[0]?.dueBy).toBe(2047);
  });

  it('is safe to re-run without duplicating or rewriting anything', async () => {
    const target = nuclearTarget();
    await store.saveTarget(target);
    await store.saveTarget(target);
    await store.saveTarget(target);
    expect((await store.loadTarget('NEM-2047-100GW')).revisions).toHaveLength(1);
  });

  it('refuses to load a history with a removed revision', async () => {
    const target = nuclearTarget();
    const revised = reviseTarget(target, revisionOf(2052, 'Deadline moved to 2052.'));
    await store.saveTarget(revised);
    // Simulate someone deleting the inconvenient original by hand.
    await writeFile(join(root, 'targets', 'NEM-2047-100GW', 'rev-0001.json'), '');
    await expect(store.loadTarget('NEM-2047-100GW')).rejects.toThrow();
  });

  it('refuses to overwrite an existing revision file', async () => {
    await store.saveTarget(nuclearTarget());
    // Bypassing the kernel entirely, as a stray script would.
    await expect(
      // @ts-expect-error — writeNew is private; this is deliberately reaching past it.
      store.writeNew(join(root, 'targets', 'NEM-2047-100GW', 'rev-0001.json'), '{}'),
    ).rejects.toThrow(/Refusing to overwrite/);
  });

  it('appends corrections and never deletes one', async () => {
    await store.appendCorrection({
      what: 'R&D indicator was ambiguous between GERD and government R&D expenditure',
      why: 'The measure did not name its source series, so two readers read it two ways.',
      affects: ['RND-2030-2PCT'],
      correctedOn: '2026-08-29',
      writtenBy: 'nishtha.sharma',
    });
    const corrections = await store.listCorrections();
    expect(corrections).toHaveLength(1);
    expect(corrections[0]?.what).toContain('GERD');
    await expect(
      store.appendCorrection({
        what: 'R&D indicator was ambiguous between GERD and government R&D expenditure',
        why: 'Trying to rewrite the same correction.',
        affects: [],
        correctedOn: '2026-08-29',
        writtenBy: 'nishtha.sharma',
      }),
    ).rejects.toThrow(/Refusing to overwrite/);
  });

  it('reports an empty store as empty rather than inventing a zero', async () => {
    expect(await store.listTargetIds()).toEqual([]);
  });
});

describe('series persistence', () => {
  const observation = (asOf: string, gw: string) => ({
    asOf: isoDate(asOf),
    value: verify(
      attest(quantity(gw, 'GW'), ceaSource),
      FOUNDER,
      asOf,
      'Read against the CEA report.',
    ),
  });

  it('round-trips a series and its measure', async () => {
    const s = series(nuclearMeasure, [observation('2025-12-31', '8.780')]);
    await store.saveSeries('cea-nuclear', s);
    const loaded = await store.loadSeries('cea-nuclear');
    expect(loaded.observations).toHaveLength(1);
    expect(formatQuantity(loaded.observations[0]!.value.value)).toBe('8.780 GW');
    expect(loaded.measure.unit).toBe('GW');
  });

  it('adds new dates on a re-run and leaves existing files alone', async () => {
    await store.saveSeries('cea-nuclear', series(nuclearMeasure, [observation('2025-12-31', '8.780')]));
    const before = await readFile(
      join(root, 'series', 'cea-nuclear', 'obs-2025-12-31-r0001.json'),
      'utf8',
    );
    await store.saveSeries(
      'cea-nuclear',
      series(nuclearMeasure, [observation('2025-12-31', '9.999'), observation('2026-01-31', '8.780')]),
    );
    // A later scrape cannot silently replace a figure a person already signed off.
    expect(
      await readFile(join(root, 'series', 'cea-nuclear', 'obs-2025-12-31-r0001.json'), 'utf8'),
    ).toBe(before);
    expect((await store.loadSeries('cea-nuclear')).observations).toHaveLength(2);
  });

  it('raises for a series that is not in the store', async () => {
    await expect(store.loadSeries('nope')).rejects.toThrow(/No series named nope/);
  });

  it('records who retrieved a document as an agent, not as a human', async () => {
    // The brands are erased at runtime, so the kind travels in the record.
    // An earlier version took it as a parameter and filed a scraped document
    // as having been retrieved by a person.
    await store.saveSeries('cea-nuclear', series(nuclearMeasure, [observation('2025-12-31', '8.780')]));
    const raw = JSON.parse(
      await readFile(join(root, 'series', 'cea-nuclear', 'obs-2025-12-31-r0001.json'), 'utf8'),
    );
    expect(raw.value.provenance.retrievedBy).toEqual({ kind: 'agent', id: 'pib-harvester' });
    expect(raw.value.verification.verifiedBy).toBe('nishtha.sharma');
  });
});

describe('observations can be superseded but never rewritten', () => {
  const at = (asOf: string, verified: boolean, method = 'checked') => ({
    asOf: isoDate(asOf),
    value: verified
      ? verify(attest(quantity('8.780', 'GW'), ceaSource), FOUNDER, asOf, method)
      : attest(quantity('8.780', 'GW'), ceaSource),
  });

  it('keeps the original when a verification claim is withdrawn', async () => {
    await store.saveSeries('cea', series(nuclearMeasure, [at('2025-12-31', true)]));
    await store.saveSeries('cea', series(nuclearMeasure, [at('2025-12-31', false)]));

    const files = (await readdir(join(root, 'series', 'cea'))).filter((f) => f.startsWith('obs-'));
    expect(files).toHaveLength(2);

    // The operative record says unverified; the original claim is still readable.
    const loaded = await store.loadSeries('cea');
    expect(loaded.observations[0]?.value.verification.state).toBe('unverified');
    const [first] = files.sort();
    const original = JSON.parse(await readFile(join(root, 'series', 'cea', first as string), 'utf8'));
    expect(original.value.verification.state).toBe('verified');
  });

  it('orders revisions numerically, not by filename', async () => {
    // "obs-<date>-r0002.json" sorts before "obs-<date>.json" lexically, because
    // '-' precedes '.'. A string sort therefore returns the superseded record as
    // the operative one, which is how a withdrawn verification comes back to life.
    await store.saveSeries('cea', series(nuclearMeasure, [at('2025-12-31', true)]));
    await store.saveSeries('cea', series(nuclearMeasure, [at('2025-12-31', false)]));
    await store.saveSeries('cea', series(nuclearMeasure, [at('2025-12-31', true, 'rechecked')]));

    const loaded = await store.loadSeries('cea');
    const verification = loaded.observations[0]?.value.verification;
    expect(verification?.state).toBe('verified');
    expect(verification?.state === 'verified' && verification.method).toBe('rechecked');
  });

  it('does not create a revision when nothing changed', async () => {
    const s = series(nuclearMeasure, [at('2025-12-31', true)]);
    await store.saveSeries('cea', s);
    await store.saveSeries('cea', s);
    await store.saveSeries('cea', s);
    const files = (await readdir(join(root, 'series', 'cea'))).filter((f) => f.startsWith('obs-'));
    expect(files).toHaveLength(1);
  });
});

describe('roadmap milestones are superseded, not overwritten', () => {
  const milestoneAt = (amount: string, verified: boolean) => ({
    label: 'Balance expected from other parties',
    value: verified
      ? verify(attest(quantity(amount, 'GW'), pibSource), FOUNDER, '2026-08-30', 'Read against the release.')
      : attest(quantity(amount, 'GW'), pibSource),
    basis: 'increment' as const,
    actors: ['Private sector'],
    status: milestoneStatus('planned', FOUNDER, '2026-08-30', 'A projection, not an undertaking.'),
    provenance: pibSource,
    recordedBy: FOUNDER,
    recordedOn: isoDate('2026-08-30'),
  });

  it('records a verification as a new revision over the draft', async () => {
    const id = targetId('NEM-2047-100GW');
    await store.saveRoadmap(roadmap(id, [milestoneAt('46', false)]));
    await store.saveRoadmap(roadmap(id, [milestoneAt('46', true)]));

    const files = await readdir(join(root, 'targets', 'NEM-2047-100GW', 'roadmap'));
    expect(files).toHaveLength(2);

    // Operative record is the verification; the draft is still on file.
    const plan = await store.loadRoadmap('NEM-2047-100GW');
    expect(plan.milestones[0]?.value.verification.state).toBe('verified');
    const draft = JSON.parse(
      await readFile(join(root, 'targets', 'NEM-2047-100GW', 'roadmap', files.sort()[0] as string), 'utf8'),
    );
    expect(draft.value.verification.state).toBe('unverified');
  });

  it('orders milestone revisions numerically, not by filename', async () => {
    const id = targetId('NEM-2047-100GW');
    await store.saveRoadmap(roadmap(id, [milestoneAt('46', false)]));
    await store.saveRoadmap(roadmap(id, [milestoneAt('46', true)]));
    await store.saveRoadmap(roadmap(id, [milestoneAt('47', true)]));
    const plan = await store.loadRoadmap('NEM-2047-100GW');
    expect(formatQuantity(plan.milestones[0]!.value.value)).toBe('47 GW');
  });

  it('does not create a revision when nothing changed', async () => {
    const id = targetId('NEM-2047-100GW');
    const plan = roadmap(id, [milestoneAt('46', true)]);
    await store.saveRoadmap(plan);
    await store.saveRoadmap(plan);
    expect(await readdir(join(root, 'targets', 'NEM-2047-100GW', 'roadmap'))).toHaveLength(1);
  });
});

describe('target headers are revised, not frozen', () => {
  it('supersedes the header when the definition changes', async () => {
    const target = nuclearTarget();
    await store.saveTarget(target);
    await store.saveTarget({ ...target, title: 'A corrected title' });

    const files = (await readdir(join(root, 'targets', 'NEM-2047-100GW'))).filter((f) =>
      f.startsWith('target'),
    );
    expect(files).toHaveLength(2);

    // Operative definition is the correction; the original stays readable.
    expect((await store.loadTarget('NEM-2047-100GW')).title).toBe('A corrected title');
    const original = JSON.parse(
      await readFile(join(root, 'targets', 'NEM-2047-100GW', 'target-r0001.json'), 'utf8'),
    );
    expect(original.title).toBe('100 GW of nuclear power capacity by 2047');
  });

  it('orders header revisions numerically, not by filename', async () => {
    // "target-r0002.json" precedes "target.json" as a string.
    const target = nuclearTarget();
    await store.saveTarget(target);
    await store.saveTarget({ ...target, title: 'second' });
    await store.saveTarget({ ...target, title: 'third' });
    expect((await store.loadTarget('NEM-2047-100GW')).title).toBe('third');
  });

  it('does not revise the header when nothing changed', async () => {
    const target = nuclearTarget();
    await store.saveTarget(target);
    await store.saveTarget(target);
    const files = (await readdir(join(root, 'targets', 'NEM-2047-100GW'))).filter((f) =>
      f.startsWith('target'),
    );
    expect(files).toHaveLength(1);
  });

  it('carries the series that measures the target', async () => {
    await store.saveTarget(nuclearTarget());
    expect((await store.loadTarget('NEM-2047-100GW')).series).toBe('cea-nuclear-installed-capacity');
  });

  it('refuses a target that names no series', async () => {
    // A target with nothing measuring it cannot have a gap computed.
    await store.saveTarget(nuclearTarget());
    const path = join(root, 'targets', 'NEM-2047-100GW', 'target-r0001.json');
    const header = JSON.parse(await readFile(path, 'utf8'));
    delete header.series;
    await writeFile(path, JSON.stringify(header));
    await expect(store.loadTarget('NEM-2047-100GW')).rejects.toThrow(/names no observation series/);
  });
});
