# Antar — G0 kernel, G1 machinery

[![gate](https://github.com/nishtha2403/antar/actions/workflows/gate.yml/badge.svg?branch=main)](https://github.com/nishtha2403/antar/actions/workflows/gate.yml)
[![pages](https://github.com/nishtha2403/antar/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/nishtha2403/antar/actions/workflows/pages.yml)

**Live: https://nishtha2403.github.io/antar/**

The distance between the country India was promised and the country it lives in.

The badges above are the gate — typecheck, the unsafe-cast linter, and the tests
that assert the three guarantees — and the deploy, which depends on the gate
passing.

The site is rendered from `data/` on every deploy, never from committed HTML, so
a published page cannot drift from the records it claims to represent. The
renderer throws on an unverified figure, so a deploy either carries fully
verified figures or does not happen.

**G0 is complete**: the schema, the verification state machine, the append-only
revision store, and the test harness that asserts the guarantees.

**G1 is built but unfed**: gap calculation, citizen page, and the fail-loud ingest
harness all exist and are tested. What they lack is data, and that is deliberate —
the brief assigns source retrieval and the target record to a human. `data/` stays
empty until someone reads the PIB release.

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
src/kernel/      the model. brands, money, quantities, provenance, verification,
                 targets, observation series, gap arithmetic
src/ingest/      the fail-loud scraper contract. every row enters unverified
src/render/      the publication boundary. the only way a figure reaches a reader
src/store/       git-tracked JSON. append-only on disk, not just in memory
data/            the records themselves. empty until a human reads a source
scripts/         cast linter, derived SQLite build, layout preview
test/            the guarantees, as executable claims
```

Look at the page design without any data:

```bash
node scripts/preview.ts build/preview
```

That renders both locales from placeholder values whose provenance is titled
PLACEHOLDER, so the marking shows up in the rendered citations. It is for
reviewing layout and is not an ingest path.

## Languages

English is the root locale. `src/render/strings.ts` defines `en` first and
derives the `Strings` type from it, so every other locale must supply the same
keys with the same signatures — a translation that falls behind is a `tsc`
error, not a page with an English sentence in the middle of it.

One language per page. English sits at the root, Hindi under `/hi/`, and the two
are linked with `hreflang`. A bilingual page halves its own information density
and no reader needs both.

**Template copy is translated; the record is not.** Target titles, institution
names, revision notes and correction text render verbatim in every locale,
because translating a recorded value would make the page assert something the
source did not say. The consequence is visible in the preview: the Hindi page
currently shows an English title, because that is the language the record is in.
Fixing that means recording translations as human judgements, which is a schema
decision, not a rendering one.

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

**A handle is not a name.** `src/kernel/people.ts` holds both: a stable
lowercase handle that appears in every record and never changes, and the display
name a reader sees. Collapsing them would either put a person's written name into
record keys, where a stray capital silently forks one person into two, or ask
readers to accept `n.sharma` as accountability. Publishing under a handle nobody
has put a name to raises.

**Git is the append-only log.** The JSON files here are simultaneously the record,
the audit trail, and the raw-data publication G2 requires. SQLite is a derived
cache, gitignored and rebuilt on every run; if it disagrees with the JSON, the
JSON is right.

**No build step.** Everything runs under Node's type stripping, enforced by
`erasableSyntaxOnly`. No enums, no parameter properties.

**A successful scrape changes nothing.** Every ingested row enters `unverified`,
and `latestVerified` — not "latest" — is what feeds a gap. The published figure
moves when a person signs off, not when a fetch succeeds. The harness halts on an
empty payload, a missing expected field, a collapsed row count, or a row it
cannot parse; none of those degrade to a shorter table.

**The gap calculation does not forecast and does not attribute.**
`requiredAnnualAddition` is the remaining quantity divided by the remaining years,
labelled as division wherever it renders. No institution or individual is named
by the arithmetic — responsibility is a human-tagged edge, and joining a gap to a
name is the step that turns an observation into an accusation.

**Rounding is declared where it happens.** A source figure that cannot be
represented exactly is refused, because the inexactness is a fact about the
source. A derived ratio has no exact decimal form, so it is rounded half away
from zero at a stated precision that travels with the result.

## Honest limits

- **TypeScript's types are erased.** A determined `as any` defeats the
  compile-time half of every guarantee. That is why the runtime half exists, and
  why `npm run lint:casts` fails the build on unjustified casts. It is a
  guardrail, not a proof.
- **Deep-freeze protects a process, not a disk.** Anyone who can write to `data/`
  can rewrite a file. The defence there is git history and review, not code.
- **Rules 1, 2, 4 and 7 are not enforced by anything here.** They are governance.
  Rules 3, 8 and 9 are only partly enforced. `CONSTITUTION.md` has the table.
- **`data/` is empty on purpose.** Seeding a plausible-looking sourced figure to
  make a demo work would be the exact failure this project exists to avoid.

## Where this stands

1. **G0 complete.** Kernel, store and guarantees built and tested.
   `CONSTITUTION.md` ratified; `SUCCESSION.md` adopted and honest about binding
   nobody.
2. **G1 built and recorded.** `NEM-2047-100GW` with its source, eleven verified
   CEA observations, and a four-milestone roadmap. Both citizen pages render from
   the store.
3. **G1 ships without its exit criterion.** The gate was *a hostile reviewer
   cannot find what makes it misleading*; there will be no hostile reviewer, and
   the co-founder search is closed without a hire. Both removals are recorded in
   the amendments section of the orchestration brief, along with what they change.
4. **One person is author, verifier and reviewer.** `src/kernel/people.ts`
   registers one name. Publication halts permanently if they stop.
