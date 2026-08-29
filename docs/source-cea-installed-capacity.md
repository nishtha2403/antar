# Source note — CEA Installed Capacity

Investigated 2026-08-29 while building the G1 nuclear slice. Recording what the
source actually does, including what does not work, because the next person to
touch this will otherwise spend the same afternoon.

## What works

The monthly report is an .xlsx at a predictable path:

```
https://cea.nic.in/wp-content/uploads/installed/YYYY/MM/IC_<Month><YYYY>.xlsx
```

`IC_July2026.xlsx` is 47 KB and parses cleanly. The figure we want is the
all-India nuclear total: the **ALL INDIA** block, its **Total** row, the
**Nuclear** column. In the July 2026 sheet that is row 36, column I — **8780 MW**.
The sheet states its own vintage in B3, `(As on 31.07.2026)`, and its unit in the
B2 heading, `(IN MW)`.

`src/ingest/cea.ts` reads it by searching for those landmarks rather than by
cell coordinates. A parser pinned to column I would have kept working and
returned the grand total the day the layout shifted.

## The archive — resolved

Historical reports exist, but **cannot be addressed by constructing a URL**. Every
guessed pattern 404s, and the uploads directory returns 403. The filenames are
not systematic. Ten months sampled:

| Month | Published file |
|---|---|
| 2026-07 | `IC_July2026.xlsx` (current month only, on the index page) |
| 2026-06 | `Website_June.pdf` |
| 2026-03 | `Website-1.pdf` |
| 2025-12 | `website.pdf` |
| 2025-09 | `Website_Report-1.pdf` |
| 2025-06 | `IC_June_2025_allocation_wise.pdf` |
| 2024-12 | `IC_Dec_2024_allocation_wise-2.pdf` |
| 2023-12 | `IC_31_Dec_2023.pdf` |

Discovery is therefore mandatory. The index page's month selector posts to a
WordPress admin-ajax action, which returns the markup for a month with its links:

```
POST https://cea.nic.in/wp-admin/admin-ajax.php
action=monthly_archive_report&selMonthYear=YYYY-MM&reportType=installed
```

`src/ingest/cea-archive.ts` wraps this. It is undocumented and could change
without notice, which is why it verifies what comes back and raises on an empty
result rather than reporting a month as having no data.

**Only the current month is .xlsx. Everything older is PDF.**

## What reads, and what does not

`src/ingest/cea-pdf.ts` finds the all-India row by checking the table's own
arithmetic — coal+lignite+gas+diesel = thermal, hydro+RES = renewable, and those
plus nuclear = grand total — rather than counting columns. Ten numbers satisfying
all three at once are the row; a neighbouring column fails all three instead of
returning a plausible wrong figure.

| Report | Reads | Nuclear |
|---|---|---|
| 2026-07 (.xlsx) | yes | 8780 MW |
| 2025-12 (.pdf) | yes | 8780.00 MW |
| 2025-09 (.pdf) | yes | 8780.00 MW |
| 2025-06 and older (.pdf) | **no** | — |

**The limit.** Reports up to mid-2025 use an "allocation wise" layout and set
their table digits in a CID font whose ToUnicode map this reader does not
resolve. Prose in those documents decodes correctly — the outage note reads
fine — but every numeric cell comes back empty, so the arithmetic check finds no
row and the parser refuses rather than guessing. Fixing it means resolving font
resources per page, which needs xref and object parsing. Pinned by a test in
`test/cea-pdf.test.ts` so a future fix announces itself by failing there.

**Practical consequence: the series available today runs from September 2025.**
That is roughly a year of monthly points against a 2047 deadline.

**The CEA API is down, and says so with a 200.**

```
GET https://cea.nic.in/api/installed_capacity_allindia.php
→ HTTP 200, text/html, 39 bytes
→ "Connection failed: Connection timed out"
```

Worth dwelling on. The endpoint returns a success status, a plausible content
type, and a non-empty body, and a scraper that checks any of those three would
record a failure as data. This is the concrete case rule 2 exists for, and the
reason `ingest()` verifies expected fields are present in the payload rather
than trusting the transport.

## Open questions for the depth pass

1. How are historical monthly reports actually addressed? Options not yet tried:
   the JS endpoint behind the month selector, `data.gov.in`'s Power Generation
   catalogue, or the older `monthlyinstalledcapacity.html` archive.
2. Is the API intermittently up? If it is, it may be the better series source,
   with the workbook as the cross-check — which is the G4 verification pattern.
3. **The headline figure is capacity in service, not capacity that exists.** The
   July 2026 report notes that 1995 MW coal, 4225.84 MW gas and **100 MW nuclear**
   were removed with effect from 31.05.2025 because they are under long-term
   outage, to be added back on restoration. So "installed capacity" here excludes
   plant that is built but not running. Whether that is the right denominator for
   a 100 GW promise is a judgement, and it belongs on the page either way. The
   parser collects these notes; it does not decide.
4. Float artefacts. The workbook stores figures like `892.21400000000006` and
   `551994.7575500001`. The parser keeps them verbatim rather than rounding.
   Nuclear happens to be a clean integer, so this does not bite at G1, but it
   will for any indicator whose column is not.
