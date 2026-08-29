# Antar — G0 kernel

The distance between the country India was promised and the country it lives in.

This repository is **G0 only**: the schema, the verification state machine, the
append-only revision store, and the test harness that asserts the guarantees.
No data is published from here. No indicator has been collected.

## What G0 had to prove

> **Exit criterion.** Ten rules written; schema makes violations structurally impossible.

Three guarantees, each enforced twice — once by the compiler, once at runtime —
because the two layers cover different failure modes. The compiler covers code
we write. The runtime covers everything that arrives from outside it: JSON off
disk, scraper payloads, agent output.

| Guarantee | Compile time | Runtime |
|---|---|---|
| No publish without verification | `publish*` accepts `Verified<T>` only | `assertVerified` throws at the boundary |
| No target overwrite | No API edits or removes a revision | Records deep-frozen; store refuses to overwrite a file |
| Provenance travels with the value | `PublishedFigure` has no bare-value field | Constructors reject provenance without a resolvable source |

Run them:

```bash
npm run gate
```

That is `typecheck` + `lint:casts` + `test`. The typecheck is not a formality —
the guarantee tests use `@ts-expect-error` on the violations, so if the type
system ever stops rejecting an unverified figure, `tsc` fails.

## Layout

```
src/kernel/      the model. brands, money, quantities, provenance, verification, targets
src/render/      the publication boundary. the only way a figure reaches a reader
src/store/       git-tracked JSON. append-only on disk, not just in memory
data/            the records themselves. empty until a human reads a source
scripts/         cast linter, derived SQLite build
test/            the guarantees, as executable claims
```

## Decisions worth knowing before you change anything

**Money is `bigint` paise, converted once.** e-SAKSHI reports lakh in some views
and crore in others. `kernel/money.ts` is the only place a unit is interpreted;
past it, an amount has one representation. Floats are refused outright — a
source figure we cannot represent exactly is a data-quality finding, not a
rounding decision.

**Verification is typed `HumanIdentity`, and an agent identity is a different
type.** "Agents propose, humans dispose" is a compile error rather than a
convention. `verify()` also accepts only `Unverified<T>`, so a second signature
cannot quietly replace the first.

**Classification requires a written rationale.** PROMISE / BENCHMARK / FLOOR and
input / execution / output / outcome are human judgements with a name, a date
and a reason attached. There is no constructor that omits them. This is the
class of error that two reviewers already caught once.

**Git is the append-only log.** The JSON files here are simultaneously the record,
the audit trail, and the raw-data publication G2 requires. SQLite is a derived
cache, gitignored and rebuilt on every run; if it disagrees with the JSON, the
JSON is right.

**No build step.** Everything runs under Node's type stripping, enforced by
`erasableSyntaxOnly`. No enums, no parameter properties.

## Honest limits

- **TypeScript's types are erased.** A determined `as any` defeats the
  compile-time half of every guarantee. That is why the runtime half exists, and
  why `npm run lint:casts` fails the build on unjustified casts. It is a
  guardrail, not a proof.
- **Deep-freeze protects a process, not a disk.** Anyone who can write to `data/`
  can rewrite a file. The defence there is git history and review, not code.
- **Rules 1, 2, 3 and 7 are not enforced by anything here.** They are governance.
  See `CONSTITUTION.md`.
- **`data/` is empty on purpose.** Seeding a plausible-looking sourced figure to
  make a demo work would be the exact failure this project exists to avoid.

## Next, per the brief

1. Ratify `CONSTITUTION.md`; write `SUCCESSION.md`. Both are human documents.
2. G1 — the nuclear slice. A human reads the PIB release, records
   `NEM-2047-100GW`, and the CEA time series gets hand-checked row by row.
3. Hand it to a hostile reader with one brief: *find what makes this misleading.*
4. Open the co-founder search. Public finance researcher. Closes before G4.
