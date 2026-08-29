# antar

[![gate](https://github.com/nishtha2403/antar/actions/workflows/gate.yml/badge.svg?branch=main)](https://github.com/nishtha2403/antar/actions/workflows/gate.yml)
[![pages](https://github.com/nishtha2403/antar/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/nishtha2403/antar/actions/workflows/pages.yml)

**Live: https://nishtha2403.github.io/antar/**

The public website, and the verification kernel it depends on. Reads the records
in [`antar-data`](https://github.com/nishtha2403/antar-data), renders them, and
deploys. It holds no state of its own and never writes to the record.

Public because the rendering rules are part of the methodology: that an
unverified figure cannot be published is checkable only if this code is readable.

## What state this is in

| | |
|---|---|
| Pages | 12 — home, category, indicator, method, about, corrections, in two languages |
| Indicators | 1 |
| Tests | 87 unit, plus a check on what is actually served |
| Search | client-side, built at compile time |
| Feeds | `/rss.xml` |
| Data | JSON and CSV per indicator, at `/data/<slug>.json` |

## Run it

```bash
git submodule update --init   # fetches antar-data
npm ci
npm run dev                   # localhost:4321/antar
npm run gate                  # typecheck, casts, tests, build, output check
```

## What to do next

1. **Studio** — the editorial tooling, in `antar-studio`. Verification is the
   bottleneck in this project and it is the step that degrades quietly under time
   pressure; the tool should target it before the article count grows.
2. **A second indicator**, to prove the machinery is a process and not a one-off.
3. **The first correction.** The path is built and the page renders, but nothing
   has been written to it. Exercise it before it is needed under pressure.

## The four repositories

| Repository | What it is responsible for | |
|---|---|---|
| [`antar`](https://github.com/nishtha2403/antar) | The website and the verification kernel | public |
| [`antar-data`](https://github.com/nishtha2403/antar-data) | The record — every verified figure, with its source | public |
| [`antar-ingest`](https://github.com/nishtha2403/antar-ingest) | Scrapers and parsers, in Python | public |
| `antar-studio` | Editorial tooling: verification and translation queues | private |

`antar-data` is the hub. Ingest opens pull requests against it, Studio commits
verified records to it, and this repository builds from it and never writes.

## Architecture

```
src/kernel/   the guarantees: Verified<T>, append-only records, provenance,
              exact money and quantities, the gap calculation
src/store/    reading records from data/
src/lib/      view models — everything a template needs, computed in plain
              TypeScript so the guarantees stay unit-testable
src/components, src/layouts, src/pages   Astro. Templates are dumb renderers of
              view models and cannot reach past them to a raw record
data/         a submodule pinned to a commit of antar-data
```

**Why the view layer exists.** A template that could read a record directly
could drop a citation or render an unverified figure in a redesign, and no test
would catch it. Templates receive shapes that have already had the rules applied:
a figure arrives with its citation or not at all.

**Why the data is a submodule.** It pins a commit, so a build is reproducible —
the pages that deploy come from exactly that revision of the record, not from
whatever the record happened to be at deploy time.

## The rules this code enforces

- **Nothing unverified renders.** `buildIndicatorPage` throws rather than degrade,
  so the build fails and nothing is published.
- **A figure and its citation are produced together.** There is no bare-value
  field anywhere a template can reach.
- **Recorded text is never translated at render time.** Translations are records
  with a translator's name; an untranslated string shows in English and is
  marked, never silently substituted.
- **No individual is named** beyond the verifier of record — checked against the
  built HTML, not just the source.
- **No page states a verdict.** "Deadline passed" is a fact; "behind schedule"
  would be a judgement, and nothing computes one.

## Governance

[`CONSTITUTION.md`](CONSTITUTION.md) — ten rules, and an honest table of which
ones the code enforces and which rest on trust.
[`SUCCESSION.md`](SUCCESSION.md) — who can remove the founder, which is currently
nobody, stated plainly.
[`DECISIONS.md`](DECISIONS.md) — every standing decision with its reason.
