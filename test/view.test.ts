import { describe, expect, it } from 'vitest';
import { contextNote } from '../src/kernel/context.ts';
import { quantity } from '../src/kernel/quantity.ts';
import { milestoneStatus, roadmap } from '../src/kernel/roadmap.ts';
import { series } from '../src/kernel/series.ts';
import { reviseTarget, targetId } from '../src/kernel/target.ts';
import { isoDate, targetYear } from '../src/kernel/time.ts';
import { translationEntry, translations } from '../src/kernel/translation.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { buildIndicatorPage, statesOf, summarise, text } from '../src/lib/view.ts';
import { ceaSource, FOUNDER, nuclearMeasure, nuclearTarget, pibSource } from './fixtures.ts';

const TODAY = '2026-08-30';

const observed = (asOf: string, value: string, verified = true) => ({
  asOf: isoDate(asOf),
  value: verified
    ? verify(attest(quantity(value, 'GW'), ceaSource), FOUNDER, asOf, 'Checked against the report.')
    : attest(quantity(value, 'GW'), ceaSource),
});
const capacity = (...os: ReturnType<typeof observed>[]) => series(nuclearMeasure, os);

const page = (over: Partial<Parameters<typeof buildIndicatorPage>[0]> = {}) => {
  const target = over.target ?? nuclearTarget();
  return buildIndicatorPage({
    target,
    series: capacity(observed('2025-12-31', '8.18')),
    context: [],
    locale: 'en',
    today: TODAY,
    ...over,
  });
};

describe('no unverified figure reaches a template', () => {
  it('refuses to build a page whose observation is unverified', () => {
    expect(() =>
      page({ series: capacity(observed('2025-12-31', '8.18', false)) }),
    ).toThrow(/no verified observation/);
  });

  it('produces a figure and its citation together, with no bare value', () => {
    // A template cannot render the number without also holding where it came
    // from and who signed it.
    expect(Object.keys(page().observed).sort()).toEqual([
      'citation', 'display', 'sourceUrl', 'verifiedBy', 'verifiedOn',
    ]);
  });

  it('names the verifier by name, not by handle', () => {
    expect(page().observed.verifiedBy).toBe('Nishtha Sharma');
  });

  it('excludes unverified observations from the chart', () => {
    const p = page({
      series: capacity(observed('2025-12-31', '8.18'), observed('2026-06-30', '9.40', false)),
    });
    expect(p.points).toHaveLength(1);
    expect(p.coverage).toEqual({ verified: 1, total: 2 });
  });

  it('excludes unverified milestones and context', () => {
    const plan = roadmap(targetId('NEM-2047-100GW'), [{
      label: 'Balance from other parties',
      value: attest(quantity('46', 'GW'), pibSource),
      basis: 'increment' as const,
      actors: ['Private sector'],
      status: milestoneStatus('planned', FOUNDER, TODAY, 'A projection, not an undertaking.'),
      provenance: pibSource,
      recordedBy: FOUNDER,
      recordedOn: isoDate(TODAY),
    }]);
    const note = contextNote({
      kind: 'stated-purpose',
      attributedTo: 'Department of Atomic Energy',
      statement: attest('Something unverified.', pibSource),
      recordedBy: FOUNDER,
      recordedOn: TODAY,
    });
    const p = page({ roadmap: plan, context: [note] });
    expect(p.milestones).toHaveLength(0);
    expect(p.context).toHaveLength(0);
  });
});

describe('measurement states are facts, not verdicts', () => {
  it('reports measured when a verified series exists', () => {
    expect(statesOf(nuclearTarget(), capacity(observed('2025-12-31', '8.18')), TODAY)).toContain('measured');
  });

  it('reports no data when nothing is verified', () => {
    expect(statesOf(nuclearTarget(), capacity(observed('2025-12-31', '8.18', false)), TODAY))
      .toContain('no-data');
  });

  it('reports a passed deadline as a fact', () => {
    const target = nuclearTarget();
    expect(statesOf(target, undefined, '2050-01-01')).toContain('deadline-passed');
    expect(statesOf(target, undefined, TODAY)).not.toContain('deadline-passed');
  });

  it('reports a revised target, and can report several states at once', () => {
    const revised = reviseTarget(nuclearTarget(), {
      value: verify(attest(quantity('100', 'GW'), pibSource), FOUNDER, '2027-03-01', 'checked'),
      dueBy: targetYear(2030),
      announcedBy: 'Ministry of Finance',
      announcedOn: '2027-02-01',
      provenance: pibSource,
      recordedBy: FOUNDER,
      recordedOn: '2027-03-01',
      note: 'Deadline moved.',
    });
    const states = statesOf(revised, undefined, '2040-01-01');
    expect(states).toContain('revised');
    expect(states).toContain('deadline-passed');
  });

  it('has no state that expresses a judgement', () => {
    const states = statesOf(nuclearTarget(), capacity(observed('2025-12-31', '8.18')), TODAY);
    for (const s of states) expect(['measured', 'no-data', 'deadline-passed', 'revised']).toContain(s);
  });
});

describe('recorded text is translated only where a translation is recorded', () => {
  const table = translations('hi', [
    translationEntry('100 GW of nuclear power capacity by 2047', '2047 तक 100 गीगावाट', FOUNDER, TODAY),
  ]);

  it('uses the recorded translation and marks it translated', () => {
    const t = text('100 GW of nuclear power capacity by 2047', 'hi', table);
    expect(t).toEqual({ text: '2047 तक 100 गीगावाट', translated: true });
  });

  it('falls back to English and flags it, rather than showing it silently', () => {
    const t = text('Installed nuclear capacity', 'hi', table);
    expect(t.translated).toBe(false);
    expect(t.text).toBe('Installed nuclear capacity');
  });

  it('never flags anything on the English page', () => {
    expect(text('anything at all', 'en').translated).toBe(true);
  });

  it('drift is self-detecting: an edited source string falls back', () => {
    // Entries are keyed by the exact English string, so editing the English
    // means no entry matches and the page shows English rather than a stale
    // translation of a sentence that no longer exists.
    expect(text('100 GW of nuclear power capacity by 2047.', 'hi', table).translated).toBe(false);
  });
});

describe('summaries carry what a listing needs and nothing more', () => {
  it('reports the achieved share and the reading count', () => {
    const s = summarise(nuclearTarget(), capacity(observed('2025-12-31', '8.18')), 'en', undefined, TODAY);
    expect(s.achievedLabel).toBe('8.18 %');
    expect(s.readings).toBe(1);
    expect(s.category).toBe('energy');
  });

  it('survives a target with no series rather than failing the build', () => {
    const s = summarise(nuclearTarget(), undefined, 'en', undefined, TODAY);
    expect(s.achievedPercent).toBeNull();
    expect(s.states).toContain('no-data');
  });
});
