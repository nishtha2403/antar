import type { Gap } from '../kernel/gap.ts';
import { formatQuantity } from '../kernel/quantity.ts';
import { citation } from '../kernel/provenance.ts';
import { currentRevision, type Target } from '../kernel/target.ts';
import { publishTarget } from './publish.ts';

/**
 * The citizen page for one target.
 *
 * Built from `publishTarget` and `computeGap`, both of which refuse unverified
 * input, so there is no path from a raw record to this HTML that skips the
 * check. Every figure on the page arrives with a citation attached because the
 * type it arrives in has no field that omits one.
 *
 * Constraints from the brief that show up as choices here:
 *
 * Hindi is the default and English is the parallel text, not the other way
 * round. No web fonts, no scripts, no external requests — the page has to open
 * on bad 3G, so the whole thing is one file with inline CSS and degrades to
 * readable text if the CSS never arrives.
 *
 * Every string of prose is a fixed template. Nothing on this page is generated
 * per-target beyond slot-filled figures and names of institutions taken
 * verbatim from the record. No individual is named at G1.
 */

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const CLASS_LABEL: Record<string, { hi: string; en: string; note: string }> = {
  PROMISE: { hi: 'वादा', en: 'Promise', note: 'The government stated this as a commitment.' },
  BENCHMARK: { hi: 'मानक', en: 'Benchmark', note: 'A reference point, not a commitment.' },
  FLOOR: { hi: 'न्यूनतम', en: 'Statutory minimum', note: 'A legal or scheme minimum, not an ambition.' },
};

export function renderTargetPage(target: Target, gap: Gap): string {
  const published = publishTarget(target);
  const revision = currentRevision(target);
  const label = CLASS_LABEL[published.classification] ?? {
    hi: '', en: published.classification, note: '',
  };

  const rows = [
    { hi: 'लक्ष्य', en: 'Target', value: formatQuantity(gap.target.value), by: `${published.dueBy}` },
    { hi: 'अब तक', en: 'Achieved so far', value: formatQuantity(gap.observed.value), by: gap.observedAsOf },
    { hi: 'अंतर', en: 'Remaining', value: formatQuantity(gap.remaining), by: '' },
  ];

  const pct = Number(formatQuantity(gap.achieved).replace(' %', ''));
  const barWidth = Math.max(0, Math.min(100, pct));

  return `<!doctype html>
<html lang="hi">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(target.title)} — अंतर</title>
<style>
  :root { color-scheme: light dark; --ink:#1a1a1a; --dim:#5a5a5a; --line:#d8d4cc; --bg:#faf8f4; --accent:#7a2e1e; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#ece8e1; --dim:#9a948a; --line:#3a3630; --bg:#16140f; --accent:#e0a08a; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:1.5rem 1.25rem 4rem; background:var(--bg); color:var(--ink);
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         line-height:1.6; max-width:44rem; margin-inline:auto; }
  h1 { font-size:1.5rem; line-height:1.35; margin:0 0 .25rem; font-weight:650; }
  .en { color:var(--dim); font-size:.95rem; margin:0 0 1.25rem; }
  .tag { display:inline-block; font-size:.75rem; letter-spacing:.04em; text-transform:uppercase;
         border:1px solid var(--line); border-radius:2px; padding:.15rem .45rem; color:var(--dim); }
  table { width:100%; border-collapse:collapse; margin:1.5rem 0 .5rem; }
  th, td { text-align:left; padding:.6rem 0; border-bottom:1px solid var(--line); vertical-align:baseline; }
  th { font-weight:500; color:var(--dim); font-size:.9rem; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; font-size:1.15rem; font-weight:600; white-space:nowrap; }
  td.when { text-align:right; color:var(--dim); font-size:.8rem; white-space:nowrap; padding-left:.75rem; }
  .bar { height:.5rem; background:var(--line); border-radius:2px; overflow:hidden; margin:.75rem 0 .25rem; }
  .bar > span { display:block; height:100%; background:var(--accent); }
  .pct { font-size:.85rem; color:var(--dim); }
  .note { font-size:.85rem; color:var(--dim); border-left:2px solid var(--line); padding-left:.75rem; margin:1.5rem 0; }
  h2 { font-size:.8rem; text-transform:uppercase; letter-spacing:.06em; color:var(--dim);
       margin:2.5rem 0 .5rem; font-weight:600; }
  ol, ul { padding-left:1.1rem; margin:.5rem 0; }
  li { font-size:.85rem; color:var(--dim); margin:.4rem 0; }
  a { color:inherit; }
  footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); font-size:.8rem; color:var(--dim); }
</style>

<h1>${escapeHtml(target.title)}</h1>
<p class="en">${escapeHtml(target.measure.measure)}</p>
<p><span class="tag">${escapeHtml(label.hi)} · ${escapeHtml(label.en)}</span></p>

<table>
  <tbody>
${rows
  .map(
    (r) => `    <tr>
      <th>${escapeHtml(r.hi)}<br><span style="font-weight:400">${escapeHtml(r.en)}</span></th>
      <td class="num">${escapeHtml(r.value)}</td>
      <td class="when">${escapeHtml(r.by)}</td>
    </tr>`,
  )
  .join('\n')}
  </tbody>
</table>

<div class="bar"><span style="width:${barWidth}%"></span></div>
<p class="pct">${escapeHtml(formatQuantity(gap.achieved))} — ${escapeHtml(gap.observedAsOf)} तक / as of ${escapeHtml(gap.observedAsOf)}</p>

${
  gap.requiredAnnualAddition
    ? `<p class="note">लक्ष्य तक पहुँचने के लिए ${escapeHtml(formatQuantity(gap.requiredAnnualAddition))} प्रति वर्ष जोड़ना होगा, ${gap.yearsRemaining} वर्षों में।<br>
       <strong>${escapeHtml(formatQuantity(gap.requiredAnnualAddition))} per year</strong> over ${gap.yearsRemaining} years would reach the target.
       This is division, not a forecast: it assumes nothing about whether that rate is achievable.</p>`
    : gap.met
      ? `<p class="note">लक्ष्य पूरा हुआ। / Target met.</p>`
      : `<p class="note">समय सीमा बीत चुकी है। / The deadline has passed.</p>`
}

<h2>यह आँकड़ा कहाँ से आया / Where these figures come from</h2>
<ul>
  <li><strong>लक्ष्य / Target:</strong> ${escapeHtml(published.figure.citation)} —
      <a href="${escapeHtml(published.figure.sourceUrl)}">source</a>.
      Announced by ${escapeHtml(published.announcedBy)} on ${escapeHtml(revision.announcedOn)}.
      Verified by ${escapeHtml(published.figure.verifiedBy)} on ${escapeHtml(published.figure.verifiedOn)}.</li>
  <li><strong>अब तक / Achieved:</strong> ${escapeHtml(citation(gap.observed.provenance))} —
      <a href="${escapeHtml(gap.observed.provenance.sourceUrl)}">source</a>.
      Verified by ${escapeHtml(gap.observed.verification.verifiedBy)} on ${escapeHtml(gap.observed.verification.verifiedOn)}.</li>
  <li><strong>मापदंड / Measure:</strong> ${escapeHtml(target.measure.sourceSeries)},
      ${escapeHtml(target.measure.vintage === 'current' ? 'current measurement' : 'last available measurement')}.</li>
</ul>

${
  published.revisionHistory.length > 0
    ? `<h2>लक्ष्य में बदलाव / This target has been revised</h2>
<ol>
${published.revisionHistory
  .map((r) => `  <li>${escapeHtml(r.recordedOn)} — ${escapeHtml(r.note)}</li>`)
  .join('\n')}
</ol>
<p class="note">The original target is preserved in the record and was not overwritten.</p>`
    : ''
}

<h2>यह पृष्ठ क्या नहीं कहता / What this page does not say</h2>
<ul>
  <li>यह किसी व्यक्ति को ज़िम्मेदार नहीं ठहराता। / It does not assign responsibility to any individual.</li>
  <li>यह कारण नहीं बताता। / It makes no claim about why the gap exists.</li>
  <li>${escapeHtml(label.note)}</li>
</ul>

<footer>
  अंतर · Antar — ${escapeHtml(target.id)}.
  हर आँकड़ा स्रोत सहित। कोई भी असत्यापित आँकड़ा प्रकाशित नहीं होता।<br>
  Every figure carries its source. No unverified figure is published.
</footer>
</html>
`;
}
