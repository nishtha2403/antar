/**
 * Nominal typing for TypeScript.
 *
 * A branded type is structurally a primitive but nominally distinct: a `Paise`
 * is a bigint that no other bigint can be passed in place of. This is what lets
 * the kernel state guarantees in the type system rather than in a code review.
 *
 * The brand symbol is never exported. Outside this module there is no way to
 * write the brand, so there is no way to fabricate a branded value except
 * through a constructor this kernel provides.
 */
const brand: unique symbol = Symbol('antar.brand');

export type Brand<T, B extends string> = T & { readonly [brand]: B };

/**
 * Applies a brand. Deliberately not exported from the package index.
 *
 * Every call site is a place where an unchecked value becomes a checked one, so
 * every call site belongs inside a constructor that has just done the checking.
 */
export function brandAs<B extends string>() {
  return <T>(value: T): Brand<T, B> => value as Brand<T, B>;
}
