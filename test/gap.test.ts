import { describe, expect, it } from 'vitest';
import { computeGap } from '../src/kernel/gap.ts';
import { KernelError } from '../src/kernel/identity.ts';
import { formatQuantity, quantity, ratioAsPercent } from '../src/kernel/quantity.ts';
import { latestVerified, series, verificationCoverage } from '../src/kernel/series.ts';
import { isoDate } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { FOUNDER, ceaSource, nuclearMeasure, nuclearTarget } from './fixtures.ts';

/** All figures here are synthetic test fixtures, not sourced claims. */
const observed = (asOf: string, value: string, verified = true) => ({
  asOf: isoDate(asOf),
  value: verified
    ? verify(attest(quantity(value, 'GW'), ceaSource), FOUNDER, asOf, 'Row checked against the CEA report.')
    : attest(quantity(value, 'GW'), ceaSource),
});

const capacity = (...os: ReturnType<typeof observed>[]) => series(nuclearMeasure, os);

describe('gap arithmetic', () => {
  it('computes remaining, achieved share and required annual addition', () => {
    const gap = computeGap(nuclearTarget(), capacity(observed('2025-12-31', '8.18')));

    expect(formatQuantity(gap.remaining)).toBe('91.82 GW');
    expect(formatQuantity(gap.achieved)).toBe('8.18 %');
    expect(gap.yearsRemaining).toBe(22);
    expect(formatQuantity(gap.requiredAnnualAddition!)).toBe('4.17 GW');
    expect(gap.met).toBe(false);
  });

  it('reports a target that has been exceeded rather than a negative shortfall', () => {
    const gap = computeGap(nuclearTarget(), capacity(observed('2045-12-31', '104.5')));
    expect(gap.met).toBe(true);
    expect(formatQuantity(gap.achieved)).toBe('104.50 %');
    expect(gap.requiredAnnualAddition).toBeUndefined();
  });

  it('omits a required rate once the deadline has passed', () => {
    const gap = computeGap(nuclearTarget(), capacity(observed('2048-12-31', '60')));
    expect(gap.yearsRemaining).toBe(-1);
    expect(gap.requiredAnnualAddition).toBeUndefined();
  });

  it('uses the latest verified observation, not the latest scraped one', () => {
    const gap = computeGap(
      nuclearTarget(),
      capacity(observed('2025-12-31', '8.18'), observed('2026-06-30', '9.40', false)),
    );
    // The unverified 2026 row is on file but does not move the published figure.
    expect(gap.observedAsOf).toBe('2025-12-31');
    expect(formatQuantity(gap.observed.value)).toBe('8.18 GW');
  });
});

describe('gap refuses to compute rather than guessing', () => {
  it('refuses when no observation has been verified', () => {
    expect(() => computeGap(nuclearTarget(), capacity(observed('2025-12-31', '8.18', false)))).toThrow(
      /no verified observation/,
    );
  });

  it('refuses an empty series instead of treating it as zero', () => {
    expect(() => series(nuclearMeasure, [])).toThrow(/never a zero/);
  });

  it('refuses a series whose unit differs from the target', () => {
    const mw = series(
      { ...nuclearMeasure, unit: 'MW' },
      [{ asOf: isoDate('2025-12-31'), value: verify(attest(quantity('8180', 'MW'), ceaSource), FOUNDER, '2025-12-31', 'checked') }],
    );
    expect(() => computeGap(nuclearTarget(), mw)).toThrow(/is in "MW"/);
  });

  it('refuses two observations on the same date', () => {
    expect(() => capacity(observed('2025-12-31', '8.18'), observed('2025-12-31', '8.20'))).toThrow(
      /two observations on the same date/,
    );
  });

  it('handles a zero observation as zero progress, not as missing data', () => {
    const gap = computeGap(nuclearTarget(), capacity(observed('2025-12-31', '0')));
    expect(formatQuantity(gap.achieved)).toBe('0.00 %');
    expect(formatQuantity(gap.remaining)).toBe('100 GW');
    expect(gap.met).toBe(false);
  });

  it('refuses to divide by a zero target rather than reporting infinity', () => {
    expect(() => ratioAsPercent(quantity('8.18', 'GW'), quantity('0', 'GW'))).toThrow(
      /Division by zero/,
    );
  });
});

describe('series bookkeeping', () => {
  it('sorts observations regardless of input order', () => {
    const s = capacity(observed('2026-06-30', '9.40'), observed('2025-12-31', '8.18'));
    expect(s.observations[0]?.asOf).toBe('2025-12-31');
    expect(latestVerified(s)?.asOf).toBe('2026-06-30');
  });

  it('reports verification coverage as a number', () => {
    const s = capacity(
      observed('2024-12-31', '8.18'),
      observed('2025-12-31', '8.18'),
      observed('2026-06-30', '9.40', false),
    );
    expect(verificationCoverage(s)).toEqual({ verified: 2, total: 3, percent: 66.7 });
  });
});

describe('rounding is declared, not incidental', () => {
  it('rounds a derived ratio half away from zero at the stated precision', () => {
    // 1/3 has no exact decimal form. The result says which precision it used.
    const gap = computeGap(nuclearTarget(), capacity(observed('2025-12-31', '33.333')));
    expect(formatQuantity(gap.achieved)).toBe('33.33 %');
  });

  it('still refuses to round a source figure', () => {
    expect(() => quantity('1.005', 'GW')).not.toThrow();
    // Exactness applies to money at the paise boundary; quantities keep their
    // source precision verbatim and only derived values are rounded.
    expect(formatQuantity(quantity('1.005', 'GW'))).toBe('1.005 GW');
  });
});
