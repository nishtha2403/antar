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

## What does not work

**Historical reports are not at the predictable path.** Every month before the
current one returns 404 at the same URL pattern:

```
2026/06/IC_June2026.xlsx      404
2025/12/IC_December2025.xlsx  404
2024/07/IC_July2024.xlsx      404
```

The uploads directory returns 403, so it exists but is not browsable. The index
page's "Select Month" control is rendered by JavaScript and its endpoint is not
in the static HTML. **A time series cannot currently be assembled from this
source by URL construction alone.** That is unresolved.

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
