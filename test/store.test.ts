import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { quantity } from '../src/kernel/quantity.ts';
import { reviseTarget } from '../src/kernel/target.ts';
import { targetYear } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { Store } from '../src/store/store.ts';
import { FOUNDER, nuclearTarget, pibSource } from './fixtures.ts';

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
    expect(loaded.classification.decidedBy).toBe('n.sharma');
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
      writtenBy: 'n.sharma',
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
        writtenBy: 'n.sharma',
      }),
    ).rejects.toThrow(/Refusing to overwrite/);
  });

  it('reports an empty store as empty rather than inventing a zero', async () => {
    expect(await store.listTargetIds()).toEqual([]);
  });
});
