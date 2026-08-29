# Antar — Plan v2: from one slice to a publishing operation

Draft for discussion, 30 August 2026. Board v1 lives in
`ANTAR-orchestration-brief.md` with its amendments; this proposes what replaces
the parts of it that no longer fit.

---

## 1. The fork that has to be settled first

Board v1 is a **measurement** project: promise → account → versioned gap →
named responsible institution. The kernel enforces that reading. The page says
what it does not claim.

Plan v2 adds two things that are not measurement:

- *"How beneficial it is"* — a value judgement about whether a target is worth
  pursuing.
- *"What steps the government is taking"* — a claim about intent and effort,
  usually sourced from the government's own account of itself.

Both are legitimate journalism. Neither is verifiable against a spreadsheet, and
the moment a page asserts either, every number on that page inherits the reader's
opinion of the assertion. A reader who distrusts the framing stops trusting the
8.78 GW.

**Recommendation: stay a measurement project; make the articles richer without
making them assertive.**

| Reader question | How it is answered without asserting |
|---|---|
| What was promised? | The target record: figure, date, announcing body, source document. |
| Where does it stand? | The verified series and the gap. |
| Who says it will happen? | The roadmap: the government's own plan, quoted, marked planned or committed. |
| Why does this matter? | **Cited, never asserted.** The government's own stated rationale, or a named external body's. "The mission's stated purpose is X" is reportable. "This is important" is not. |
| Is the government acting? | Reportable only as recorded events with dates and sources — a sanction, a commissioning, a budget line. Not as a characterisation of effort. |

This keeps the science-backed, non-partisan positioning honest. Being
non-partisan is not a claim you make in an About page; it is a property of never
publishing a sentence you cannot source.

**Decision needed.** If you want the explainer voice instead, say so — it is a
different product and the kernel needs different guarantees, not more of them.

---

## 2. Repositories: one, not three

The instinct to separate site / articles / scraper is sound engineering. It is
premature here, and the cost is concrete.

**Why three repos hurts now**

- The article layer needs the kernel's types (`Verified<T>`, `Target`, `Series`).
  Splitting means publishing the kernel as a versioned package and upgrading it
  across repos on every change.
- The scraper writes the records the article layer reads. Split, that becomes a
  data contract to version and break.
- One person shipping weekly turns every cross-cutting change into two or three
  coordinated pushes. The bottleneck is your review time, and this spends it.

**What already separates cleanly, inside one repo**

```
src/kernel/   the model and the guarantees
src/ingest/   scrapers: sources in, unverified records out
src/render/   pages and the site
data/         the records: targets, series, roadmaps, translations
```

**Split later, on a real trigger.** When a second person joins, or when someone
outside wants the data without the code, `data/` becomes its own published
artifact — which is the G5 public-API item, not a repo reshuffle.

---

## 3. The article as a unit

Today the model is *target → page*. An article is a bigger thing: a topic, a
category, one or more targets, human-written narrative, in two languages.

```
Article
  slug, category
  question         the reader's question, in their words
  targets[]        one or more, each with its series and roadmap
  sections[]       human-written prose, each carrying its citations
  status           draft → figures verified → text reviewed → published
  publishedOn, translations
```

**The narrative rule.** Sections are written by a person, never generated. The
*figures inside them* are slot-filled from verified records, so a number in a
sentence is the same object as the number in the table and cannot drift from it.
This preserves the guarantee — nothing unverified renders — while allowing prose
a reader will actually finish.

This is the existing never-automate line held exactly where board v1 put it:
templates and slot-filling for anything about institutions; no free generation.

---

## 4. The pipeline

```
  topic queue  →  scope  →  ingest  →  verify  →  draft  →  review  →  publish
                    H         S          H          H         H          S
```
H = human, S = scripted.

1. **Topic queue.** Candidates with their selection scores (§5). You pick.
2. **Scope.** Identify the target(s), the source document, the series. Decide the
   four judgement calls: classification, indicator type, unit, anchor date.
3. **Ingest.** Scraper pulls the series. Everything lands unverified.
4. **Verify.** Row by row against the source documents, signed with your name.
   This is the bottleneck and it does not compress.
5. **Draft.** Write the sections. Figures are slot references, not typed numbers.
6. **Review.** Read the rendered page in both languages. Record translations.
7. **Publish.** `git push` builds and deploys. Nothing publishes if anything is
   unverified.

**The web tool** should be the interface to steps 4 and 6 — the verification
queue and the translation queue — not a "generate an article" button. Generation
is not the slow part. Checking is.

---

## 5. Topic selection

Board v1's stated kill condition for G2: *"Selection methodology reads as personal
preference."* Trend-driven selection fails this badly. If topics come from what is
hot on Twitter, the agenda is set by whoever is loudest that week, and the
non-partisan claim collapses the first time the trending topic favours one side.

**Separate the two things you described.** One is defensible; the other is not.

**Defensible, and publishable as a methodology:**

| Criterion | Why it is objective |
|---|---|
| A dated, sourced, government-stated target exists | Binary. No judgement. |
| A public time series measures it | Binary. Without it there is no gap. |
| Deadline proximity | Computable from the record. |
| **Elapsed share with no movement** | Computable. This is your "promised five years ago, nothing happened" — and it is the strongest signal you have. |
| Gap size relative to the remaining window | Computable from what is already built. |
| Attribution is clean (output, not outcome) | The indicator-type call, already in the kernel. |

**Not defensible as a selection input:** search volume, social trends, news cycle.

**Where public attention legitimately belongs: distribution, not selection.**
Choose what to publish on the criteria above. Choose *when to post it* by what
people are already discussing. That is the honest version of the same instinct —
the agenda stays yours, the timing responds to the world.

---

## 6. Categories

Start with one. **Energy** is the obvious first, because the nuclear slice
already exists and the sources (CEA, MNRE, PIB) are known.

Later: health, education, research and development, transport, digital
infrastructure. Each new category is a new source-discovery problem — the CEA
work in this repo took a full session and produced a documented dead end for
pre-2025 reports. Budget one such session per new source, not per article.

---

## 7. Cadence, honestly

One article a week, one person who is author, verifier and reviewer.

Measured against the first article, which is the only real data point:

- Source discovery for a new source: hours to a day. Amortised across articles
  from that source.
- Ingest and verify a series: the eleven CEA rows were minutes once the parser
  existed, because they were identical. A series that actually moves needs every
  row checked.
- The four judgement calls plus rationales: the slow, irreducible part.
- Drafting, translating, reviewing both languages.

Weekly is achievable **within one category, from sources already built**. It is
not achievable while also opening new sources. Plan alternating weeks, or accept
that the first article in a new category takes three weeks.

**The standing risk, recorded in `SUCCESSION.md`:** you are the only verifier.
Weekly cadence with no second reader means the pressure to sign off quickly grows
every week. The failure will not look like a wrong number; it will look like a
judgement call nobody argued with.

---

## 8. What this changes in the gates

| Board v1 | Status under v2 |
|---|---|
| G1 vertical slice | Done, minus its exit criterion. |
| G2 Lakshya, 8–12 indicators | **Becomes: 8–12 articles in one category**, with the selection methodology published alongside. Same bar, better shape. |
| G3 Hisaab depth | Unchanged and untouched. Still the harder half. |
| G4 scale to 543 | Recedes. Weekly single-category publishing is not the same road. |
| G5 infrastructure | The target-revision watcher matters *more*: it is what surfaces "promised five years ago, deadline quietly moved." |
| G6 campaign window | Unchanged, and now closer, since publishing is live. |

**Newly load-bearing:** the corrections path. With no external reviewer, the only
remaining defence against a published error is finding and fixing it fast and
visibly. It is still not built.

---

## 9. MVP: the next three articles

1. **Second energy article** from a source already built or close to it. Proves
   the pipeline works twice.
2. **A target whose deadline has passed or moved.** Exercises the revision
   machinery on a real case and is the most distinctive thing this project can
   publish.
3. **An article with two targets**, to prove the article-as-unit schema.

Build in this order:

1. Selection methodology, written and published — it gates G2 and it is the
   thing that stops the list looking arbitrary.
2. Corrections path: record, render, link from every article.
3. Article schema and the multi-target page.
4. Verification web tool.
5. Social distribution.

---

## 10. Open decisions

1. **Measurement or explainer?** (§1) Everything else follows.
2. **Is "why this matters" always cited, never asserted?**
3. **One repo or three?** (§2)
4. **Does trend data influence selection, or only timing?** (§5)
5. **What is the first category, and the next three topics?**
6. **Realistic cadence given one verifier?** (§7)
