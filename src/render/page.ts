import type { Gap } from '../kernel/gap.ts';
import { displayName } from '../kernel/people.ts';
import { citation } from '../kernel/provenance.ts';
import { formatQuantity } from '../kernel/quantity.ts';
import { reconcile, type Roadmap } from '../kernel/roadmap.ts';
import { currentRevision, type Target } from '../kernel/target.ts';
import { publishTarget } from './publish.ts';
import { type Locale, LOCALES, relativeHref, type Strings, STRINGS } from './strings.ts';

/**
 * The citizen page for one target, in one language.
 *
 * One language per page. A bilingual page halves its own information density,
 * and no reader needs both — whichever language they do not read is noise for
 * the entire length of the page. The two are linked to each other and declared
 * with `hreflang`.
 *
 * Built from `publishTarget` and `computeGap`, both of which refuse unverified
 * input, so there is no path from a raw record to this HTML that skips the
 * check. Every figure arrives with a citation because the type it arrives in has
 * no field that omits one.
 *
 * Record fields — the target title, institution names, revision notes — render
 * verbatim in every locale. They are not translated here. Translating a recorded
 * value would make the page assert something the source did not say.
 *
 * No web fonts, no scripts, no external requests. The page has to open on bad
 * 3G, so it is one file with inline CSS that degrades to readable text.
 */

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const slugFor = (target: Target): string => target.id.toLowerCase();

function classLabel(t: Strings, cls: string): { label: string; note: string } {
  switch (cls) {
    case 'PROMISE':
      return { label: t.classPromise, note: t.classPromiseNote };
    case 'BENCHMARK':
      return { label: t.classBenchmark, note: t.classBenchmarkNote };
    case 'FLOOR':
      return { label: t.classFloor, note: t.classFloorNote };
    default:
      return { label: cls, note: '' };
  }
}

export function renderTargetPage(
  target: Target,
  gap: Gap,
  locale: Locale,
  plan?: Roadmap,
): string {
  const t = STRINGS[locale];
  const published = publishTarget(target);
  const revision = currentRevision(target);
  const cls = classLabel(t, published.classification);
  const slug = slugFor(target);

  const other = LOCALES.filter((l) => l !== locale);
  const switchLinks = other
    .map(
      (l) =>
        `<a href="${escapeHtml(relativeHref(slug, locale, l))}" hreflang="${l}">${escapeHtml(
          l === 'hi' ? t.switchToHi : t.switchToEn,
        )}</a>`,
    )
    .join(' · ');

  const alternates = LOCALES.map(
    (l) =>
      `<link rel="alternate" hreflang="${l}" href="${escapeHtml(
        l === locale ? `${slug}.html` : relativeHref(slug, locale, l),
      )}">`,
  ).join('\n');

  const rows = [
    { label: t.rowTarget, value: formatQuantity(gap.target.value), when: `${published.dueBy}` },
    { label: t.rowAchieved, value: formatQuantity(gap.observed.value), when: gap.observedAsOf },
    { label: t.rowRemaining, value: formatQuantity(gap.remaining), when: '' },
  ];

  const asWidth = (q: { digits: bigint; scale: number } | undefined): number => {
    if (!q) return 0;
    const n = Number(q.digits) / 10 ** q.scale;
    return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
  };
  const barWidth = asWidth(gap.achieved);
  const elapsedWidth = asWidth(gap.elapsed);
  const promisedYear = gap.promisedOn.slice(0, 4);

  const rateNote = gap.requiredAnnualAddition
    ? t.requiredRate(escapeHtml(formatQuantity(gap.requiredAnnualAddition)), gap.yearsRemaining)
    : gap.met
      ? escapeHtml(t.targetMet)
      : escapeHtml(t.deadlinePassed);

  return `<!doctype html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(target.title)} — Antar</title>
${alternates}
<style>
  :root { color-scheme: light dark; --ink:#1a1a1a; --dim:#5a5a5a; --line:#d8d4cc; --bg:#faf8f4;
          --accent:#7a2e1e; --accent-bg:#f3ece6; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#ece8e1; --dim:#9a948a; --line:#3a3630; --bg:#16140f;
            --accent:#e0a08a; --accent-bg:#221c17; }
  }
  * { box-sizing: border-box; }
  body { margin:0 auto; padding:1.5rem 1.25rem 4rem; background:var(--bg); color:var(--ink);
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         line-height:1.6; max-width:40rem; }
  nav { font-size:.85rem; margin-bottom:1.5rem; }
  nav a { color:var(--dim); }
  h1 { font-size:1.55rem; line-height:1.3; margin:0 0 .35rem; font-weight:650; }
  .measure { color:var(--dim); font-size:.95rem; margin:0 0 1.25rem; }
  .tag { display:inline-block; font-size:.75rem; letter-spacing:.04em; text-transform:uppercase;
         border:1px solid var(--line); border-radius:2px; padding:.15rem .45rem; color:var(--dim); }
  table { width:100%; border-collapse:collapse; margin:1.75rem 0 .5rem; }
  th, td { text-align:left; padding:.7rem 0; border-bottom:1px solid var(--line); vertical-align:baseline; }
  th { font-weight:500; color:var(--dim); font-size:.95rem; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; font-size:1.2rem; font-weight:600; white-space:nowrap; }
  td.when { text-align:right; color:var(--dim); font-size:.8rem; white-space:nowrap; padding-left:.75rem; }
  .promise { border:1px solid var(--accent); border-radius:3px; padding:.9rem 1rem;
             margin:1.5rem 0; background:var(--accent-bg); }
  .promise-years { display:flex; align-items:baseline; gap:.6rem; font-variant-numeric:tabular-nums; }
  .promise-years b { font-size:1.75rem; font-weight:680; line-height:1.1; color:var(--accent); }
  .promise-years span { font-size:.7rem; text-transform:uppercase; letter-spacing:.07em; color:var(--dim); }
  .promise-years .arrow { font-size:1.2rem; color:var(--dim); }
  .promise-detail { margin:.5rem 0 0; font-size:.85rem; color:var(--dim); }
  .promise-revised { margin:.4rem 0 0; font-size:.85rem; color:var(--ink); }
  .meters { margin:1.5rem 0 .5rem; }
  .meter + .meter { margin-top:.85rem; }
  .meter-head { display:flex; justify-content:space-between; align-items:baseline;
                font-size:.85rem; color:var(--dim); margin-bottom:.3rem; }
  .meter-head b { color:var(--ink); font-variant-numeric:tabular-nums; font-size:.95rem; }
  .bar { height:.5rem; background:var(--line); border-radius:2px; overflow:hidden; }
  .bar > span { display:block; height:100%; background:var(--accent); }
  .bar.time > span { background:var(--dim); }
  .pct { font-size:.85rem; color:var(--dim); margin:.35rem 0 0; }
  .note { font-size:.9rem; color:var(--dim); border-left:2px solid var(--line); padding-left:.85rem; margin:1.75rem 0; }
  h2 { font-size:.8rem; text-transform:uppercase; letter-spacing:.06em; color:var(--dim);
       margin:2.5rem 0 .5rem; font-weight:600; }
  ol, ul { padding-left:1.1rem; margin:.5rem 0; }
  li { font-size:.875rem; color:var(--dim); margin:.45rem 0; }
  a { color:inherit; }
  .roadmap th { font-weight:500; color:var(--ink); font-size:.9rem; padding-right:.75rem; }
  .actors { color:var(--dim); font-size:.8rem; font-weight:400; }
  .roadmap td.when { font-size:.75rem; line-height:1.35; }
  footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); font-size:.8rem; color:var(--dim); }
</style>

<nav>${switchLinks}</nav>

<h1>${escapeHtml(target.title)}</h1>
<p class="measure">${escapeHtml(target.measure.measure)}</p>
<p><span class="tag">${escapeHtml(cls.label)}</span></p>

<div class="promise">
  <div class="promise-years">
    <span>${escapeHtml(t.promisedLabel)}</span><b>${escapeHtml(promisedYear)}</b>
    <span class="arrow">&rarr;</span>
    <span>${escapeHtml(t.dueLabel)}</span><b>${published.dueBy}</b>
  </div>
  <p class="promise-detail">${escapeHtml(
    t.promiseDetail(gap.promisedBy, gap.promisedOn, gap.windowYears),
  )}</p>
${
  gap.wasRevised
    ? `  <p class="promise-revised">${escapeHtml(t.originallyPromised(gap.originallyPromisedOn))}</p>`
    : ''
}
</div>

<table>
  <tbody>
${rows
  .map(
    (r) => `    <tr>
      <th>${escapeHtml(r.label)}</th>
      <td class="num">${escapeHtml(r.value)}</td>
      <td class="when">${escapeHtml(r.when)}</td>
    </tr>`,
  )
  .join('\n')}
  </tbody>
</table>

<div class="meters">
  <div class="meter">
    <div class="meter-head"><span>${escapeHtml(t.barAchieved)}</span><b>${escapeHtml(
      formatQuantity(gap.achieved),
    )}</b></div>
    <div class="bar"><span style="width:${barWidth}%"></span></div>
    <p class="pct">${escapeHtml(t.asOf(gap.observedAsOf))}</p>
  </div>
${
  gap.elapsed
    ? `  <div class="meter">
    <div class="meter-head"><span>${escapeHtml(t.barElapsed)}</span><b>${escapeHtml(
      formatQuantity(gap.elapsed),
    )}</b></div>
    <div class="bar time"><span style="width:${elapsedWidth}%"></span></div>
    <p class="pct">${escapeHtml(t.elapsedDetail(formatQuantity(gap.yearsElapsed).replace(' years', ''), gap.windowYears))}</p>
  </div>`
    : ''
}
</div>

${gap.elapsed ? `<p class="note">${escapeHtml(t.noVerdict)}</p>` : ''}

<p class="note">${rateNote}</p>

<h2>${escapeHtml(t.sourcesHeading)}</h2>
<ul>
  <li><strong>${escapeHtml(t.labelTarget)}:</strong> ${escapeHtml(published.figure.citation)} —
      <a href="${escapeHtml(published.figure.sourceUrl)}">${escapeHtml(t.sourceLinkLabel)}</a>.
      ${escapeHtml(t.announcedBy(published.announcedBy, revision.announcedOn))}
      ${escapeHtml(t.verifiedBy(published.figure.verifiedBy, published.figure.verifiedOn))}</li>
  <li><strong>${escapeHtml(t.labelAchieved)}:</strong> ${escapeHtml(citation(gap.observed.provenance))} —
      <a href="${escapeHtml(gap.observed.provenance.sourceUrl)}">${escapeHtml(t.sourceLinkLabel)}</a>.
      ${escapeHtml(t.verifiedBy(displayName(gap.observed.verification.verifiedBy), gap.observed.verification.verifiedOn))}</li>
  <li><strong>${escapeHtml(t.labelMeasure)}:</strong> ${escapeHtml(target.measure.sourceSeries)},
      ${escapeHtml(target.measure.vintage === 'current' ? t.vintageCurrent : t.vintageLastAvailable)}.</li>
${
  target.measure.excludes
    ? `  <li><strong>${escapeHtml(t.labelExcludes)}:</strong> ${escapeHtml(target.measure.excludes)}</li>`
    : ''
}
</ul>

${
  published.revisionHistory.length > 0
    ? `<h2>${escapeHtml(t.revisedHeading)}</h2>
<ol>
${published.revisionHistory
  .map((r) => `  <li>${escapeHtml(r.recordedOn)} — ${escapeHtml(r.note)}</li>`)
  .join('\n')}
</ol>
<p class="note">${escapeHtml(t.revisedNote)}</p>`
    : ''
}

${plan ? renderRoadmap(t, target, gap, plan) : ''}

<h2>${escapeHtml(t.notSayingHeading)}</h2>
<ul>
  <li>${escapeHtml(t.notSayingIndividual)}</li>
  <li>${escapeHtml(t.notSayingCause)}</li>
  <li>${escapeHtml(cls.note)}</li>
</ul>

<footer>Antar · ${escapeHtml(target.id)}<br>${escapeHtml(t.footer)}</footer>
</html>
`;
}

/**
 * The roadmap section.
 *
 * Only verified milestones render, like every other figure. The status of each
 * line is printed beside it, so a projection is never mistaken for a commitment,
 * and the actors are the ones the source names rather than any this project
 * assigns.
 */
function renderRoadmap(t: Strings, target: Target, gap: Gap, plan: Roadmap): string {
  const rows = plan.milestones
    .filter((m) => m.value.verification.state === 'verified')
    .map((m) => {
      const status =
        m.status.value === 'built'
          ? t.statusBuilt
          : m.status.value === 'committed'
            ? t.statusCommitted
            : t.statusPlanned;
      const basis = m.basis === 'cumulative' ? t.basisCumulative : t.basisIncrement;
      return `    <tr>
      <th>${escapeHtml(m.label)}<br><span class="actors">${escapeHtml(m.actors.join('; '))}</span></th>
      <td class="num">${escapeHtml(formatQuantity(m.value.value))}</td>
      <td class="when">${escapeHtml(status)}<br>${escapeHtml(basis)}</td>
    </tr>`;
    });

  if (rows.length === 0) return '';

  const sums = reconcile(gap.target.value, plan);
  const summary = sums.reconciles
    ? t.roadmapReconciles(formatQuantity(sums.total))
    : t.roadmapGap(formatQuantity(sums.total), formatQuantity(sums.difference));

  return `<h2>${escapeHtml(t.roadmapHeading)}</h2>
<table class="roadmap">
  <tbody>
${rows.join('\n')}
  </tbody>
</table>
<p class="pct">${escapeHtml(summary)}</p>
<p class="note">${escapeHtml(t.roadmapCaveat)}</p>`;
}

/** Renders every locale for one target. Keyed by locale, ready to write to disk. */
export function renderAllLocales(
  target: Target,
  gap: Gap,
  plan?: Roadmap,
): Record<Locale, string> {
  return Object.fromEntries(
    LOCALES.map((l) => [l, renderTargetPage(target, gap, l, plan)]),
  ) as Record<Locale, string>;
}
