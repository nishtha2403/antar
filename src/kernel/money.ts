import { type Brand, brandAs } from './brand.ts';
import { KernelError } from './identity.ts';

/**
 * Money, always in paise, always exact.
 *
 * Two decisions are load-bearing here.
 *
 * `bigint`, not `number`. The Union budget is on the order of ₹50 lakh crore,
 * which is 5e16 paise. IEEE-754 doubles lose integer precision above 2^53
 * (~9.0e15). A float rupee column is not merely untidy at this scale, it is
 * wrong, and it goes wrong silently.
 *
 * One unit, converted once. e-SAKSHI reports lakh in some views and crore in
 * others, and the same figure appears under both. The brief's instruction is to
 * normalise at the boundary and nowhere else, so the conversion functions below
 * are the boundary. Past this module, a quantity of money has exactly one
 * representation and no unit to get wrong.
 */
export type Paise = Brand<bigint, 'Paise'>;

const asPaise = brandAs<'Paise'>();

const PAISE_PER_RUPEE = 100n;
const RUPEES_PER_LAKH = 100_000n;
const RUPEES_PER_CRORE = 10_000_000n;

/** The Indian-numbering units that actually appear in government sources. */
export type MoneyUnit = 'paise' | 'rupee' | 'lakh' | 'crore';

const UNIT_IN_PAISE: Readonly<Record<MoneyUnit, bigint>> = {
  paise: 1n,
  rupee: PAISE_PER_RUPEE,
  lakh: PAISE_PER_RUPEE * RUPEES_PER_LAKH,
  crore: PAISE_PER_RUPEE * RUPEES_PER_CRORE,
};

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

/**
 * Parses a decimal *string* exactly, as digits and a scale, with no float step.
 *
 * Decimal input must arrive as a string. A source that hands us 12.34 as a
 * JavaScript number has already rounded it before we were called, and we cannot
 * tell from here whether that mattered.
 */
function parseExactDecimal(input: string): { digits: bigint; scale: number } {
  const match = DECIMAL.exec(input.trim());
  if (!match) {
    throw new KernelError(
      `Cannot parse ${JSON.stringify(input)} as an exact decimal. ` +
        'Expected digits only, e.g. "1234" or "12.34". ' +
        'Scraped values must be passed as strings, never as parsed floats.',
    );
  }
  const [, sign, whole = '', fraction = ''] = match;
  const digits = BigInt(`${whole}${fraction}`);
  return { digits: sign === '-' ? -digits : digits, scale: fraction.length };
}

/**
 * The single conversion into the kernel's money representation.
 *
 * Sub-paise precision is an error rather than a rounding. If a source reports a
 * figure we cannot represent exactly, that is a fact about the source worth
 * halting on, not a decimal place worth discarding.
 */
export function money(amount: string | bigint | number, unit: MoneyUnit): Paise {
  const factor = UNIT_IN_PAISE[unit];

  if (typeof amount === 'bigint') return asPaise(amount * factor);

  if (typeof amount === 'number') {
    if (!Number.isInteger(amount)) {
      throw new KernelError(
        `Refusing to convert the non-integer number ${amount}. ` +
          'Pass decimals as strings so the value is not rounded before it reaches the kernel.',
      );
    }
    return asPaise(BigInt(amount) * factor);
  }

  const { digits, scale } = parseExactDecimal(amount);
  const divisor = 10n ** BigInt(scale);
  const scaled = digits * factor;
  if (scaled % divisor !== 0n) {
    throw new KernelError(
      `${amount} ${unit} is not an exact number of paise. ` +
        'Refusing to round: an inexact source figure is a data-quality finding, not a display concern.',
    );
  }
  return asPaise(scaled / divisor);
}

export const fromPaise = (n: string | bigint | number): Paise => money(n, 'paise');
export const fromRupees = (n: string | bigint | number): Paise => money(n, 'rupee');
export const fromLakh = (n: string | bigint | number): Paise => money(n, 'lakh');
export const fromCrore = (n: string | bigint | number): Paise => money(n, 'crore');

export const addPaise = (a: Paise, b: Paise): Paise => asPaise(a + b);
export const subPaise = (a: Paise, b: Paise): Paise => asPaise(a - b);
export const zeroPaise: Paise = asPaise(0n);

/** Serialised as a decimal string of paise. JSON has no bigint and no exact decimal. */
export const paiseToJSON = (p: Paise): string => p.toString();
export const paiseFromJSON = (s: string): Paise => asPaise(BigInt(s));

/** Exact rupee rendering. Presentation only — never feed this back into arithmetic. */
export function formatRupees(p: Paise): string {
  const negative = p < 0n;
  const abs = negative ? -p : p;
  const rupees = abs / PAISE_PER_RUPEE;
  const paise = abs % PAISE_PER_RUPEE;
  const body = `${groupIndian(rupees)}.${paise.toString().padStart(2, '0')}`;
  return `${negative ? '-' : ''}₹${body}`;
}

/** 12,34,56,789 — the grouping Indian readers expect, not 123,456,789. */
function groupIndian(n: bigint): string {
  const s = n.toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}
