import { describe, expect, it } from 'vitest';
import { formatRupees, fromCrore, fromLakh, fromRupees, money, paiseFromJSON, paiseToJSON } from '../src/kernel/money.ts';
import { compareQuantity, formatQuantity, quantity, subtractQuantity } from '../src/kernel/quantity.ts';

describe('the units trap', () => {
  it('normalises lakh and crore to the same paise value', () => {
    // The same amount as e-SAKSHI reports it in two different views.
    expect(fromLakh('100')).toBe(fromCrore('1'));
    expect(fromCrore('1')).toBe(fromRupees('10000000'));
  });

  it('keeps precision at Union-budget scale, where floats run out of headroom', () => {
    // ₹50 lakh crore is 5e15 paise. A double holds exact integers to 2^53
    // (~9.007e15), so a single year's budget still fits — with under one order
    // of magnitude to spare. Two years, or any cumulative total across years,
    // does not, and the failure is silent when it comes.
    const budget = fromCrore('5000000');
    expect(budget).toBe(5_000_000_000_000_000n);
    expect(budget).toBeLessThan(BigInt(Number.MAX_SAFE_INTEGER));
    expect(budget * 2n).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));

    // bigint stays exact past that line; float quietly stops counting.
    const twoYears = budget * 2n;
    expect(twoYears + 1n).not.toBe(twoYears);
    expect(Number(twoYears) + 1).toBe(Number(twoYears));
  });

  it('refuses a pre-rounded float rather than accepting its error', () => {
    expect(() => money(12.34, 'lakh')).toThrow(/non-integer number/);
    expect(fromLakh('12.34')).toBe(1_234_000_00n);
  });

  it('refuses sub-paise amounts instead of rounding them away', () => {
    expect(() => fromRupees('1.234')).toThrow(/not an exact number of paise/);
  });

  it('round-trips through JSON without loss', () => {
    const value = fromCrore('2715');
    expect(paiseFromJSON(paiseToJSON(value))).toBe(value);
  });

  it('formats in Indian grouping', () => {
    // The MPLADS pool in the brief: ~₹2,715 crore a year across 543 MPs.
    expect(formatRupees(fromCrore('2715'))).toBe('₹27,15,00,00,000.00');
    expect(formatRupees(fromRupees('999'))).toBe('₹999.00');
  });
});

describe('quantities carry units that cannot be silently crossed', () => {
  it('refuses to compare GW against MW', () => {
    expect(() => compareQuantity(quantity('100', 'GW'), quantity('100', 'MW'))).toThrow(
      /Unit mismatch/,
    );
  });

  it('subtracts exactly at differing scales', () => {
    const gap = subtractQuantity(quantity('100', 'GW'), quantity('8.18', 'GW'));
    expect(formatQuantity(gap)).toBe('91.82 GW');
  });

  it('refuses an indicator with no unit', () => {
    expect(() => quantity('100', '  ')).toThrow(/needs a unit/);
  });
});
