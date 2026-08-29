# Decisions

Append-only. Each entry records what was decided, when, by whom, and the reason —
so that a choice can be revisited on its merits rather than rediscovered by
accident.

---

## 2026-08-30 · Measurement, not explainer

Antar reports figures and attributes context. It does not assert.
"The mission's stated purpose is X" is publishable; "this matters because X" is
not. A page that asserts lends every figure on it the reader's opinion of the
assertion.

## 2026-08-30 · Four repositories

`antar` (the website, public) · `antar-data` (the records, public) ·
`antar-ingest` (scrapers, public, Python) · `antar-studio` (editorial tooling,
private).

`antar-data` is the hub. Ingest opens pull requests against it, Studio commits
verified records to it, the website builds from it.

The website keeps the plain name so the published URL does not change.

## 2026-08-30 · Python for ingest, TypeScript for everything else

Decided on evidence rather than preference: the hand-written TypeScript PDF
reader decodes CID-encoded CEA reports' prose but not their numerals, so every
report before September 2025 is unreadable. `pdfplumber` handles them. The
boundary between the two languages is a JSON contract, so nothing couples.

## 2026-08-30 · No database

Git-tracked JSON is the store; SQLite is derived at build and discarded. A
database would buy concurrent writers and millions of rows; there is one writer
and thirty-three observation files. It would cost the pull-request review step,
free hosting, and a tamper-evident history.

Revisit at a second concurrent editor, or roughly ten thousand rows in one
series, or a query that cannot be answered at build time.

## 2026-08-30 · Static site

Opens on a bad connection, cannot leak, cannot drift from the record, cannot
fall over when an article is widely shared, costs nothing to run. Search,
charts, filtering and feeds are all available on static output.

## 2026-08-30 · Design: warm document, not instrument

Paper ground and serif headlines. A colder dashboard aesthetic implies
completeness and machine objectivity; this is a record a named person checked
row by row, and the design should say so.

**No saffron-and-green status coding.** The conventional good/bad palette is
politically loaded in India and a non-partisan project cannot colour its
verdicts in party colours. Rust marks the gap, slate what is measured, sand what
is only planned.

## 2026-08-30 · Status vocabulary

Three independent axes, kept separate:

| Axis | Values | Decided by |
|---|---|---|
| Kind of target | Promise · Benchmark · Statutory floor | Human |
| State of measurement | Measured · No data yet · Deadline passed · Revised | Computed |
| Roadmap milestone | Built · Committed · Planned | Human |

No value is a verdict. "Deadline passed" is a fact; "behind schedule" would be a
judgement, and the page does not make it.

## 2026-08-30 · English at the site root

Reaffirming the earlier decision rather than reverting to board v1's Hindi
default. Hindi lives at `/hi/`, the language switch is prominent and persistent,
and `hreflang` tells search engines which to serve.
