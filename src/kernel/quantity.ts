import { KernelError } from './identity.ts';

/**
 * An exact decimal with an explicit unit.
 *
 * Targets are not always money: 100 GW, 2% of GDP, 70 per 1,000 live births.
 * The value is held as digits plus a scale rather than a float, for the same
 * reason money is held in paise — a stored 0.1 that is really 0.1000000000000000055
 * will eventually be compared against a threshold and produce a wrong answer in
 * public.
 *
 * The unit is mandatory and free-text by design. "GW" and "MW" must not be
 * silently interchangeable, and the kernel refuses to guess a conversion; a unit
 * mismatch is an error a person resolves, because the resolution is usually a
 * finding about the source rather than a multiplication.
 */
export type Quantity = {
  /** value = digits / 10^scale */
  readonly digits: bigint;
  readonly scale: number;
  /** Verbatim from the source: "GW", "% of GDP", "per 1000 live births". */
  readonly unit: string;
};

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

export function quantity(amount: string | number | bigint, unit: string): Quantity {
  if (!unit.trim()) {
    throw new KernelError(
      'A quantity needs a unit. An indicator without one is the ambiguity the brief warns about: ' +
        '"R&D spending" is not an indicator, "GERD as % of GDP" is.',
    );
  }
  if (typeof amount === 'bigint') return { digits: amount, scale: 0, unit: unit.trim() };
  if (typeof amount === 'number') {
    if (!Number.isInteger(amount)) {
      throw new KernelError(
        `Refusing the non-integer number ${amount}. Pass decimals as strings so they are not pre-rounded.`,
      );
    }
    return { digits: BigInt(amount), scale: 0, unit: unit.trim() };
  }
  const match = DECIMAL.exec(amount.trim());
  if (!match) throw new KernelError(`Cannot parse ${JSON.stringify(amount)} as an exact decimal.`);
  const [, sign, whole = '', fraction = ''] = match;
  const digits = BigInt(`${whole}${fraction}`);
  return { digits: sign === '-' ? -digits : digits, scale: fraction.length, unit: unit.trim() };
}

function alignedDigits(a: Quantity, b: Quantity): [bigint, bigint] {
  const scale = Math.max(a.scale, b.scale);
  return [
    a.digits * 10n ** BigInt(scale - a.scale),
    b.digits * 10n ** BigInt(scale - b.scale),
  ];
}

export function assertSameUnit(a: Quantity, b: Quantity, context: string): void {
  if (a.unit !== b.unit) {
    throw new KernelError(
      `Unit mismatch in ${context}: "${a.unit}" vs "${b.unit}". ` +
        'The kernel does not convert units. Resolve this against the sources — ' +
        'a mismatch is usually a finding, not a conversion factor.',
    );
  }
}

/** Negative if a < b, zero if equal, positive if a > b. Throws on unit mismatch. */
export function compareQuantity(a: Quantity, b: Quantity): number {
  assertSameUnit(a, b, 'comparison');
  const [x, y] = alignedDigits(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function subtractQuantity(a: Quantity, b: Quantity): Quantity {
  assertSameUnit(a, b, 'subtraction');
  const scale = Math.max(a.scale, b.scale);
  const [x, y] = alignedDigits(a, b);
  return { digits: x - y, scale, unit: a.unit };
}

export function formatQuantity(q: Quantity): string {
  const negative = q.digits < 0n;
  const abs = (negative ? -q.digits : q.digits).toString().padStart(q.scale + 1, '0');
  const whole = abs.slice(0, abs.length - q.scale) || '0';
  const fraction = q.scale > 0 ? `.${abs.slice(abs.length - q.scale)}` : '';
  return `${negative ? '-' : ''}${whole}${fraction} ${q.unit}`;
}

export const quantityToJSON = (q: Quantity) => ({
  digits: q.digits.toString(),
  scale: q.scale,
  unit: q.unit,
});

export const quantityFromJSON = (j: { digits: string; scale: number; unit: string }): Quantity => ({
  digits: BigInt(j.digits),
  scale: j.scale,
  unit: j.unit,
});
