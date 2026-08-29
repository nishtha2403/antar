# The Constitution of Antar

**Ratified 30 August 2026 by Nishtha Sharma.**

The ten rules below are copied verbatim from the orchestration brief. They were
written by a person. This file is a transcription so that the code can reference
them by number — no part of it was drafted by an assistant.

---

## The ten rules

1. Cannot accept political party funding.
2. Cannot endorse candidates.
3. Cannot suppress inconvenient data.
4. Cannot change methodology retroactively.
5. Cannot overwrite a historical target.
6. Cannot publish an unverified figure.
7. Cannot let a funder influence a metric.
8. Cannot claim causality without evidence.
9. Cannot name an individual without documented provenance.
10. Cannot delete a correction.

---

## Which rules the kernel enforces, and how

A rule the code can enforce should not rely on anyone remembering it. A rule the
code cannot enforce should be named as such, so nobody mistakes the silence for
safety.

Accurate as of 30 August 2026. This table is part of what is ratified: if it
overstates what the code does, the constitution is wrong.

| Rule | Enforcement | Where |
|---|---|---|
| 1 · No party funding | **None.** Governance. | — |
| 2 · No endorsing candidates | **None.** Governance. | — |
| 3 · No suppressing inconvenient data | **Partial.** Records are append-only and superseded rather than edited, so a figure cannot be quietly removed through the store. Nothing stops a person deleting files directly; the defence there is git history and review, not code. | `store/store.ts` |
| 4 · No retroactive methodology change | **None yet.** Methodology versioning lands at G5. Calculations are currently unversioned. | not built |
| 5 · No overwriting a historical record | **Structural.** No API edits or removes a revision; records are deep-frozen; the store refuses to overwrite a file. Applies to target revisions, observations and roadmap milestones alike. | `kernel/target.ts`, `store/store.ts` |
| 6 · No unverified figure published | **Structural.** The render path accepts `Verified<T>` only — a compile error otherwise — and checks again at runtime for values arriving from disk, a scraper or an agent. Verification is typed to a registered human; an agent identity cannot satisfy it. | `kernel/verification.ts`, `render/publish.ts`, `kernel/people.ts` |
| 7 · No funder influence on a metric | **None.** Governance. | — |
| 8 · No causal claim without evidence | **Partial.** Not enforceable in code, but the citizen page states in every locale that it makes no claim about why a gap exists, and the gap calculation is arithmetic that attributes nothing. | `render/page.ts`, `kernel/gap.ts` |
| 9 · No individual named without provenance | **Partial.** Provenance is mandatory on every figure and cannot be constructed without a resolvable source. The page names no individual except the verifier of record, asserted by test. Rules governing named officials arrive at G6. | `kernel/provenance.ts`, `test/page.test.ts` |
| 10 · No correction deleted | **Structural.** Corrections are append-only files written through the same no-overwrite guarantee as revisions. | `store/store.ts` |

Rules 1, 2, 4 and 7 are not enforced by anything in this repository. Nothing here
prevents them being broken. They are held by people, which is why
[SUCCESSION.md](SUCCESSION.md) matters more than any test in here — and why that
document's honesty about not yet binding anyone is a live problem rather than a
formality.

---

## Ratification

- **Ratified by:** Nishtha Sharma
- **Date:** 30 August 2026

Ratification covers the ten rules and the enforcement table above. It does not
assert that the rules are fully enforced — the table records exactly where they
are not.

## Amendment

Amendments are appended, never edited in place, so that the history of this
document is readable for the same reason target revisions are.

| Date | Change | By |
|---|---|---|
| 2026-08-30 | Ratified. Enforcement table restated against the code as it stands: rule 5 now covers observations and milestones as well as targets; rules 3, 8 and 9 recorded as partially enforced; rule 4 recorded as not built. | Nishtha Sharma |
