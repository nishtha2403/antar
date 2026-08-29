import { describe, expect, it } from 'vitest';
import { formatQuantity, quantity } from '../src/kernel/quantity.ts';
import { type Milestone, milestoneStatus, reconcile, roadmap } from '../src/kernel/roadmap.ts';
import { targetId } from '../src/kernel/target.ts';
import { isoDate } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { FOUNDER, pibSource } from './fixtures.ts';

const ID = targetId('NEM-2047-100GW');

const milestone = (
  label: string,
  amount: string,
  basis: 'cumulative' | 'increment',
  status: 'built' | 'planned' | 'committed' = 'planned',
  verified = true,
): Milestone => ({
  label,
  value: verified
    ? verify(attest(quantity(amount, 'GW'), pibSource), FOUNDER, '2026-08-30', 'Read against the release.')
    : attest(quantity(amount, 'GW'), pibSource),
  basis,
  actors: ['NPCIL'],
  status: milestoneStatus(status, FOUNDER, '2026-08-30', 'Stated as a projection in the release.'),
  provenance: pibSource,
  recordedBy: FOUNDER,
  recordedOn: isoDate('2026-08-30'),
});

describe('roadmap reconciliation', () => {
  it('adds increments on top of the highest running total', () => {
    // The source mixes the two: "expected to reach about 22 GW" is cumulative,
    // "another 32 GW is envisaged" is an addition on top of it.
    const plan = roadmap(ID, [
      milestone('in service', '8.78', 'cumulative', 'built'),
      milestone('by 2031-32', '22', 'cumulative'),
      milestone('beyond 2032', '32', 'increment'),
      milestone('balance', '46', 'increment'),
    ]);
    const sums = reconcile(quantity('100', 'GW'), plan);
    expect(formatQuantity(sums.total)).toBe('100 GW');
    expect(sums.reconciles).toBe(true);
  });

  it('does not double-count a cumulative figure as an addition', () => {
    // 8.78 is inside 22. Summing all four naively would give 108.78.
    const plan = roadmap(ID, [
      milestone('in service', '8.78', 'cumulative', 'built'),
      milestone('by 2031-32', '22', 'cumulative'),
      milestone('beyond 2032', '32', 'increment'),
      milestone('balance', '46', 'increment'),
    ]);
    expect(formatQuantity(reconcile(quantity('100', 'GW'), plan).total)).not.toBe('108.78 GW');
  });

  it('reports a roadmap that does not add up to its own target', () => {
    const plan = roadmap(ID, [
      milestone('by 2031-32', '22', 'cumulative'),
      milestone('beyond 2032', '32', 'increment'),
    ]);
    const sums = reconcile(quantity('100', 'GW'), plan);
    expect(sums.reconciles).toBe(false);
    expect(formatQuantity(sums.difference)).toBe('46 GW');
  });

  it('refuses a roadmap that mixes units', () => {
    const mw: Milestone = { ...milestone('x', '22', 'cumulative'), value: verify(
      attest(quantity('22000', 'MW'), pibSource), FOUNDER, '2026-08-30', 'checked') };
    expect(() => roadmap(ID, [milestone('a', '22', 'cumulative'), mw])).toThrow(/mixes units/);
  });

  it('refuses an empty roadmap', () => {
    expect(() => roadmap(ID, [])).toThrow(/no milestones/);
  });
});

describe('planned is not committed', () => {
  it('requires a written reason for the status', () => {
    expect(() => milestoneStatus('committed', FOUNDER, '2026-08-30', '  ')).toThrow(
      /needs a written reason/,
    );
  });

  it('keeps the three states distinct', () => {
    const plan = roadmap(ID, [
      milestone('in service', '8.78', 'cumulative', 'built'),
      milestone('balance', '46', 'increment', 'planned'),
    ]);
    expect(plan.milestones.map((m) => m.status.value)).toEqual(['built', 'planned']);
  });
});
