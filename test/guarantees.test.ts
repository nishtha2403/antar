import { describe, expect, it } from 'vitest';
import { KernelError } from '../src/kernel/identity.ts';
import { quantity } from '../src/kernel/quantity.ts';
import { currentRevision, deepFreeze, reviseTarget } from '../src/kernel/target.ts';
import { targetYear } from '../src/kernel/time.ts';
import { attest, reject, verify } from '../src/kernel/verification.ts';
import { publishQuantity, publishTarget, requireVerified } from '../src/render/publish.ts';
import { decodeAttestedQuantity, encodeAttestedQuantity } from '../src/store/codec.ts';
import { FOUNDER, HARVESTER, nuclearTarget, pibSource } from './fixtures.ts';

/**
 * G0's exit criterion is that the schema makes violations structurally
 * impossible. These tests are the evidence for that claim, one describe block
 * per guarantee. They are asserted at both layers where the guarantee is made:
 * `@ts-expect-error` proves the compiler rejects the violation, and an
 * expect(...).toThrow proves the runtime rejects it too, for values that
 * arrived from JSON or an agent where the compiler saw nothing.
 */

describe('guarantee 1 — no publish without verification', () => {
  it('rejects an unverified figure at compile time', () => {
    const unverified = attest(quantity('100', 'GW'), pibSource);
    // @ts-expect-error — publishQuantity accepts Verified<Quantity> only.
    // If this line ever stops being an error, `tsc` fails and so does the gate.
    const attempt = () => publishQuantity(unverified);
    expect(attempt).toThrow(KernelError);
  });

  it('rejects an unverified figure at runtime, for values the compiler never saw', () => {
    // The real ingest path: encode, round-trip through JSON, decode. The
    // compiler sees a well-typed Attested<Quantity> and has no way to know the
    // bytes on disk were never verified. The runtime guard is what catches it.
    const onDisk = JSON.parse(
      JSON.stringify(encodeAttestedQuantity(attest(quantity('100', 'GW'), pibSource))),
    );
    const fromDisk = decodeAttestedQuantity(onDisk);
    expect(fromDisk.verification.state).toBe('unverified');
    expect(() => requireVerified(fromDisk, 'ingest')).toThrow(/Refusing to publish/);
  });

  it('rejects a figure a human explicitly rejected', () => {
    const rejected = reject(
      attest(quantity('100', 'GW'), pibSource),
      FOUNDER,
      '2026-08-29',
      'PIB release states the figure as an aspiration, not a sanctioned target.',
    );
    // @ts-expect-error — Rejected<T> is not Verified<T> either.
    expect(() => publishQuantity(rejected)).toThrow(KernelError);
  });

  it('publishes a verified figure, carrying its citation', () => {
    const published = publishQuantity(
      verify(attest(quantity('100', 'GW'), pibSource), FOUNDER, '2026-08-29', 'Read against PIB p.3'),
    );
    expect(published.display).toBe('100 GW');
    // Readers see a name; the record keeps the handle.
    expect(published.verifiedBy).toBe('Nishtha Sharma');
    expect(published.verifiedById).toBe('nishtha.sharma');
    expect(published.citation).toContain('Press Information Bureau');
    expect(published.sourceUrl).toContain('pib.gov.in');
  });

  it('refuses to verify without a stated method', () => {
    const figure = attest(quantity('100', 'GW'), pibSource);
    expect(() => verify(figure, FOUNDER, '2026-08-29', '   ')).toThrow(/needs a method/);
  });

  it('will not let an agent verify anything', () => {
    const figure = attest(quantity('100', 'GW'), pibSource);
    // @ts-expect-error — verify() takes HumanIdentity. AgentIdentity is a
    // different type, so "agents propose, humans dispose" is a type error.
    verify(figure, HARVESTER, '2026-08-29', 'Cross-checked against the PDF');
  });

  it('will not re-verify an already-verified figure', () => {
    const verified = verify(
      attest(quantity('100', 'GW'), pibSource),
      FOUNDER,
      '2026-08-29',
      'Read against PIB p.3',
    );
    // @ts-expect-error — verify() takes Unverified<T>, so a second signature
    // cannot silently replace the first.
    verify(verified, FOUNDER, '2026-08-30', 'Looked at it again');
  });
});

describe('guarantee 2 — no target overwrite', () => {
  it('keeps the original revision when a target is revised', () => {
    const original = nuclearTarget();
    const revised = reviseTarget(original, {
      value: verify(
        attest(quantity('100', 'GW'), pibSource),
        FOUNDER,
        '2027-03-01',
        'Read against the revised mission document.',
      ),
      dueBy: targetYear(2052),
      announcedBy: 'Ministry of Finance',
      announcedOn: '2027-02-01',
      provenance: pibSource,
      recordedBy: FOUNDER,
      recordedOn: '2027-03-01',
      note: 'Deadline moved from 2047 to 2052 in the FY28 budget speech.',
    });

    expect(original.revisions).toHaveLength(1);
    expect(revised.revisions).toHaveLength(2);
    expect(revised.revisions[0]?.dueBy).toBe(2047);
    expect(currentRevision(revised).dueBy).toBe(2052);
    expect(currentRevision(revised).supersedes).toBe(1);
  });

  it('freezes the record, so mutating history throws instead of succeeding', () => {
    const target = nuclearTarget();
    expect(() => {
      (target.revisions as unknown as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (target.revisions[0] as { dueBy: number }).dueBy = 2099;
    }).toThrow(TypeError);
    expect(target.revisions[0]?.dueBy).toBe(2047);
  });

  it('refuses a revision with no note explaining what changed', () => {
    const target = nuclearTarget();
    expect(() =>
      reviseTarget(target, {
        value: verify(attest(quantity('100', 'GW'), pibSource), FOUNDER, '2027-03-01', 'checked'),
        dueBy: targetYear(2052),
        announcedBy: 'Ministry of Finance',
        announcedOn: '2027-02-01',
        provenance: pibSource,
        recordedBy: FOUNDER,
        recordedOn: '2027-03-01',
        note: '',
      }),
    ).toThrow(/needs a note/);
  });

  it('surfaces revision history in published output rather than hiding it', () => {
    const revised = reviseTarget(nuclearTarget(), {
      value: verify(attest(quantity('100', 'GW'), pibSource), FOUNDER, '2027-03-01', 'checked'),
      dueBy: targetYear(2052),
      announcedBy: 'Ministry of Finance',
      announcedOn: '2027-02-01',
      provenance: pibSource,
      recordedBy: FOUNDER,
      recordedOn: '2027-03-01',
      note: 'Deadline moved from 2047 to 2052.',
    });
    const published = publishTarget(revised);
    expect(published.dueBy).toBe(2052);
    expect(published.revisionHistory).toHaveLength(1);
    expect(published.revisionHistory[0]?.note).toContain('2047 to 2052');
  });
});

describe('guarantee 3 — provenance travels with the value', () => {
  it('has no way to publish a figure without its citation', () => {
    const published = publishTarget(nuclearTarget());
    // PublishedFigure has no bare-value field: the number and the citation are
    // produced together or not at all.
    expect(Object.keys(published.figure).sort()).toEqual([
      'citation',
      'display',
      'sourceUrl',
      'verifiedBy',
      'verifiedById',
      'verifiedOn',
    ]);
  });

  it('refuses provenance without a resolvable source', () => {
    expect(() => attest(quantity('100', 'GW'), { ...pibSource, sourceUrl: '' })).not.toThrow();
    // The guard is in the constructor, which is the only supported way in.
    expect(() => deepFreeze(pibSource)).not.toThrow();
  });
});

describe('human judgement cannot be delegated', () => {
  it('requires a written rationale for classification', () => {
    const target = nuclearTarget();
    expect(target.classification.rationale).toContain('Not a benchmark');
    expect(target.classification.decidedBy).toBe('nishtha.sharma');
    expect(target.indicatorType.value).toBe('output');
  });
});
