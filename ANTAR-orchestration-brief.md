# ANTAR — Orchestration Brief v1

**Purpose.** This is the working document for building Antar. Phase 1 is the locked board. Phase 2 maps every component to an execution model. It is written to be handed to Claude Code gate by gate, not read as prose.

**Status.** Board locked after four independent external reviews. Nothing here is published. No live data collected yet.

---

# PHASE 1 — THE BOARD

## The mission

Every Indian should be able to see, in numbers, the distance between the country they were promised and the country they live in — and know which institutions are responsible for closing it.

## The three panels

**लक्ष्य Lakshya** — what India said it would achieve. National promises, versioned.
**हिसाब Hisaab** — what was actually done with public money, attributed at each step.
**अंतर Antar** — the distance between them, and who can act on it.

Antar is **not** Lakshya minus Hisaab. They operate at incompatible scales — all 543 MPs together control roughly ₹2,715 crore a year, a fraction of a percent of the Union budget, and cannot move national indicators. Antar is a **method** applied to two separate ledgers: promise → account → versioned gap → named responsible institution.

## The gates

| | Gate | Exit criterion | Kill / narrow condition |
|---|---|---|---|
| **G0** | Kernel & Constitution | Ten rules written; schema makes violations structurally impossible | — |
| **G1** | Vertical slice — nuclear, 100 GW by 2047 | A hostile reviewer cannot find what makes it misleading | One indicator can't survive scrutiny → eight can't |
| **G2** | Lakshya ships — 8–12 indicators, raw data and methodology public | Live, fully sourced, no known uncorrected errors | Selection methodology reads as personal preference |
| **G3** | Hisaab depth — 5–10 constituencies, hand-traced, + 15 comprehension interviews | A hostile journalist cannot attack one page, **and** readers correctly identify who is responsible | Recommendation timestamps unreliable → A1 returns. Comprehension fails → **narrow**, don't stop (see below) |
| **G4** | Scale the account — 543, automated ingest, AI-assisted verification | Monthly rebuild runs unattended above the verification threshold | Verification cost scales linearly with constituencies |
| **G5** | Infrastructure hardening — target-revision watcher, methodology versioning, public API | Target revisions detected automatically and surfaced for review | — |
| **G6** | Campaign window — election-timed release | Shipped inside a real campaign window with counsel sign-off | Legal review finds unacceptable exposure |

**G3's comprehension failure mode is narrowing, not stopping.** If readers cannot map a figure to a responsible institution, Hisaab publishes as a works ledger with no comparative framing until comprehension is demonstrated. Scope limits get enforced by real founders. Full stops do not.

## Continuous tracks

**T1 · People and governance.** Co-founder search opens at G0 and **must close before G4**. First person is a public finance researcher — two independent reviewers caught that the R&D indicator was ambiguous between GERD and government R&D expenditure, the exact class of error that ends this project and the exact class neither the founder nor an AI is equipped to catch. Lawyer matters at G6. Journalist matters at G4. Succession clause written at G0.

**T2 · Legal and risk.** Defamation review before the first named individual appears in public output. Model Code of Conduct analysis begins at G4, not G6. Data licensing from G2.

**T3 · Evidence and method.** Methodology versioning, public corrections log, standing external adversarial review. The review round already completed becomes an institution, not an event. Success metric: others build on the data without asking.

## Explicitly not on the board

Political party. 22-language localisation. Composite performance score. National 1–543 ranking. A responsibility graph spanning all public services — that is a successor organisation, not a phase.

---

# PHASE 2 — TECHNICAL ALLOCATION

## Allocation principle

The boundary is not *hard versus easy*. It is **reversible versus irreversible**. Code can be rewritten. A published claim about a named person cannot be unpublished.

Three rules govern everything below.

1. **Agents propose, humans dispose.** No agent output reaches publication without a human in between. Agents produce *candidates for review*, never published artifacts.
2. **Scrapers fail loud.** An empty result set is a failure, never a zero. Schema drift halts the pipeline rather than publishing nulls.
3. **Provenance travels with the value.** Every figure carries its source URL, retrieval date, verifier identity and verification date, from ingestion through to render.

## Never automate

These stay in human hands permanently, regardless of model capability.

- Publishing any figure attributed to a named individual
- Classifying a target as PROMISE, BENCHMARK or FLOOR
- Assigning responsibility in the responsibility graph
- Changing methodology
- Revising a historical target (append-only; originals never overwritten)
- Free-text generation about named officials — templates with slot-filling only
- Deciding the wording of a correction
- Accepting legal risk

---

## G0 — Kernel & Constitution

| Component | Model | Notes |
|---|---|---|
| Constitution: ten rules | **Human** | Values document. Cannot be delegated, including to a very persuasive assistant. |
| Core schema: Target, Indicator, Revision, Provenance, Verification | **Claude Code** | Append-only revision table. Schema must make overwriting a historical target impossible, not merely discouraged. |
| Verification state machine | **Claude Code** | `unverified` cannot render. Enforced in the type system, not in a code review. |
| Repo scaffold, CI, test harness | **Claude Code** | Tests assert the guarantees: no publish without verification, no target overwrite. |
| Succession clause | **Human** | Who can remove the founder. Write it while it costs nothing. |

**The ten rules.** Cannot accept political party funding. Cannot endorse candidates. Cannot suppress inconvenient data. Cannot change methodology retroactively. Cannot overwrite a historical target. Cannot publish an unverified figure. Cannot let a funder influence a metric. Cannot claim causality without evidence. Cannot name an individual without documented provenance. Cannot delete a correction.

---

## G1 — Vertical slice: nuclear, 100 GW by 2047

Chosen because it is a clean government PROMISE with a PIB source, one primary responsible institution, an unambiguous unit, and a public time series.

| Component | Model | Notes |
|---|---|---|
| Source document retrieval | **Human** | One PIB release. Read it directly. |
| Target record with full provenance | **Human** | `NEM-2047-100GW`, value, announcing authority, announcement date, source document, deadline. |
| Installed capacity time series | **Scraper** + **Human verify** | CEA / data.gov.in. Small enough to check every row by hand. |
| Responsibility graph | **Agent** drafts → **Human** decides | DAE, NPCIL, AERB, state governments, private entrants. Each edge tagged direct / shared / indirect / none. The tagging is a human call. |
| Gap calculation | **Claude Code** | Deterministic. Tested. |
| Citizen page | **Claude Code** | Renders from the record; cannot render an unverified field. |
| Adversarial review | **Human, external** | Brief: *find what makes this misleading.* |

---

## G2 — Lakshya

| Component | Model | Notes |
|---|---|---|
| Selection methodology | **Human** | Published alongside the indicators. Without it, the list drifts into personal preference. |
| Indicator schema + template | **Claude Code** | Generalised from the G1 slice. |
| Source harvesting: PIB, budget docs, NHP, ISRO, IN-SPACe | **Agent** | Document processing. Retrieves and structures candidates. |
| Target extraction from PDFs | **Agent** proposes → **Human** verifies | Every extracted target read against the original by a person. |
| Provenance classification | **Human** | PROMISE / BENCHMARK / FLOOR. This is where the founding document already got it wrong once. |
| Indicator typing | **Human** | Input / execution / output / outcome. Prevents comparing incomparable things. |
| Time series ingestion | **Scrapers** | data.gov.in API, DST statistics, NHA, CEA. |
| Raw data + methodology publication | **Claude Code** | Ships **with** the indicators, not later. Auditability from day one is cheaper than retrofitting it. |
| Corrections log | **Claude Code** | Append-only. Public. |
| Static site | **Claude Code** | Loads on bad 3G. Hindi default. |

**Indicator definitions must be unambiguous.** "R&D spending" is not an indicator. "GERD as % of GDP" is. Every indicator specifies its exact measure, its source series, and its vintage — current measurement versus last available measurement are labelled differently.

---

## G3 — Hisaab depth

| Component | Model | Notes |
|---|---|---|
| e-SAKSHI scraper | **Specialized scraper — human-written** | The one component that cannot be delegated. Session handling, retries, and the units trap (lakh in some views, crore in others; normalise to paise at the boundary and nowhere else). |
| Work-level data model | **Claude Code** | recommended → sanctioned → released → spent → completed, each timestamped. Replaces the old fund-level record. |
| Two-ratio computation | **Claude Code** | Recommendation Ratio = recommended ÷ entitlement (MP). Conversion Efficiency = sanctioned+spent ÷ recommended (District Authority). Never combined into one score. |
| Conversion lag | **Claude Code** | Days recommendation → sanction → disbursement. Sanction has a 45-day statutory deadline: compliance fact, not opinion. |
| Work category classification | **Agent** proposes → **Human** verifies sample | Healthcare / education / roads / water / community. Labels are data and pass the same gate as numbers. |
| Per-work manual tracing | **Human** | The entire point of the depth pass. Trace every work in 5–10 constituencies by hand. Document every failure and every gap. |
| Constituency page + share card | **Claude Code** | Card leads with works, not rupees: *24 of 38 works complete.* Concrete, attributes nothing. |
| 15 comprehension interviews | **Human** | One question: *if I showed you this before an election, what would you actually do with it?* |
| Hostile journalist review | **Human, external** | |

**Data-quality checks to run during the depth pass, before writing any scaler:** are recommendation timestamps reliably populated? Does the portal expose per-work sanction dates? Do constituency names join cleanly to the LGD spine, or is a crosswalk table required? If recommendation data is absent, the two-ratio fix fails and A1 returns unsolved — surface this immediately.

---

## G4 — Scale to 543

| Component | Model | Notes |
|---|---|---|
| Scraper hardening, schema-drift detection | **Scraper** + **Claude Code** | Drift halts the build. |
| Verification guardrail | **Agent** | Vision model cross-checks scraped tables against published PDF monthly reports. Per-field thresholds tuned empirically — a flat 0.01% will trip on rounding. |
| Anomaly triage queue | **Claude Code** + **Agent** | Agent ranks by suspicion; human works the queue. |
| Stratified sampling protocol | **Human** designs, **Claude Code** implements | 543 rows cannot be hand-verified at five hours a week. Stratify by state and by anomaly score, verify a sample, and **publish the verification coverage percentage as a public number on the site.** Honesty about coverage is the substitute for total coverage. |
| State quintile computation | **Claude Code** | "Top 20% in Haryana." No national rank. |
| Card rendering at volume | **Claude Code** | Template slot-filling only. |
| Monthly unattended rebuild | **Claude Code** | CI. Fails loud, publishes nothing on failure. |

---

## G5 — Infrastructure hardening

| Component | Model | Notes |
|---|---|---|
| Target-revision watcher | **Agent** | Monitors Union Budget, CAG reports, ministry annual reports and PIB for changes to target years or values. Flags for human review; never updates a target itself. **This is the machinery that makes target version control real** — version control only works if revisions are detected, and no government announces a quiet deadline slip. |
| Methodology versioning | **Claude Code** | Every calculation change is a versioned, dated, published event. |
| Public API / raw data | **Claude Code** | Others building on the data is the success metric. |
| Standing external review | **Human** | Annual adversarial round with a fresh reviewer. |

---

## G6 — Campaign window

| Component | Model | Notes |
|---|---|---|
| Defamation review | **Human — qualified counsel** | Before any named individual appears. |
| Model Code of Conduct analysis | **Human — counsel** | Whether and how to operate during the MCC period. |
| Election-timed release pipeline | **Claude Code** | |
| Card copy | **Claude Code — templates only** | No free generation naming officials. The highest-risk output anyone proposed across four reviews. |
| Positive-frame distribution | **Human** | Unsolved: outrage forwards, competence doesn't. Untested hypothesis — frame positives as civic pride (*your district processed faster than the state average*), not as praise for a politician. Test at G3. |

---

# Where AI sits, and where it doesn't

**AI enters at G3 for classification and G4 for verification.** Not at G2 for interface. Two independent reviewers converged on AI-assists-verification as the correct first use, and that convergence is worth trusting over enthusiasm.

**A conversational interface is a G5+ question at the earliest.** It requires a knowledge graph worth querying, which does not exist until Lakshya and Hisaab are both populated and versioned. When it is built, one rule governs it: **never answer from memory.** Every substantive claim originates from the verified graph with citations, and the honest failure response is *Antar does not currently have sufficient evidence to answer this.*

An AI answering confidently about a named politician and public money, from an unverified graph, is the fastest available way to destroy this project.

---

# Immediate next actions

1. Write the ten rules and the succession clause. One page. Today.
2. `claude-code`: scaffold G0 — schema, verification state machine, append-only revisions, test harness asserting all three guarantees.
3. Build the nuclear slice end to end. Hand it to a hostile reader.
4. Open the co-founder search. Public finance researcher. Deadline: before G4.
