# The Constitution of Antar

**Status: TRANSCRIBED, NOT RATIFIED.**

The ten rules below are copied verbatim from the orchestration brief. They were
written by a person. This file is a transcription so that the code can reference
them by number — it is not an authored document, and no part of it was drafted
by an assistant.

Ratifying it means a named human reads it, decides it is right, and records that
below. Until then, treat it as a draft of someone else's words.

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

| Rule | Enforcement | Where |
|---|---|---|
| 4 · No retroactive methodology change | Partial — versioning lands at G5 | not yet built |
| 5 · No overwriting a historical target | **Structural** — no API removes or edits a revision; records frozen; store refuses to overwrite a file | `kernel/target.ts`, `store/store.ts` |
| 6 · No unverified figure published | **Structural** — render accepts `Verified<T>` only, at compile time and again at runtime | `kernel/verification.ts`, `render/publish.ts` |
| 8 · No causal claim without evidence | Not enforceable in code | human review |
| 9 · No individual named without provenance | Partial — provenance is mandatory on every figure; naming rules arrive with G6 | `kernel/provenance.ts` |
| 10 · No correction deleted | **Structural** — corrections are append-only files | `store/store.ts` |

Rules 1, 2, 3 and 7 are governance, not code. Nothing in this repository
prevents them being broken. They are held by people, which is why the succession
clause matters more than any test in here.

---

## Ratification

- Ratified by: _(unfilled — a named human)_
- Date: _(unfilled)_

## Amendment

Amendments are appended, never edited in place, so that the history of this
document is readable for the same reason target revisions are.
