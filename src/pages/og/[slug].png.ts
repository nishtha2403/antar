import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { loadRecords } from '../../lib/records.ts';
import { buildIndicatorPage, slugFor } from '../../lib/view.ts';
import { TODAY } from '../../lib/today.ts';

/**
 * The share card, rendered from the same view model as the page.
 *
 * That is the point: a card built from its own copy of the numbers can drift
 * from the page it links to, and a wrong figure travels further than a right
 * one. This one cannot drift, because it fails to build for the same reasons
 * the page does.
 *
 * What a card may carry: the target, what has been achieved, the distance
 * between them, and where the figure came from. What it may not: the magnified
 * chart panel without its full-scale parent, which is the exact misreading that
 * figure exists to prevent — so no chart appears here at all.
 *
 * Type differs from the site: the rasteriser uses system faces rather than the
 * webfonts, which is acceptable at thumbnail size and avoids making the build
 * depend on downloading a font.
 */
export async function getStaticPaths() {
  const { targets } = await loadRecords();
  return targets.map((t) => ({ params: { slug: slugFor(t) }, props: { id: t.id } }));
}

const escape = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Trims at a word boundary. Cutting mid-word looks like a rendering fault. */
const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max))}…`;

/** Naive wrap; the card is fixed-width, so a character budget is enough. */
function wrap(text: string, perLine: number, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((`${line} ${word}`).trim().length > perLine) {
      out.push(line.trim());
      line = word;
    } else {
      line += ` ${word}`;
    }
    if (out.length === max) break;
  }
  if (line.trim() && out.length < max) out.push(line.trim());
  return out;
}

export const GET: APIRoute = async ({ props }) => {
  const records = await loadRecords();
  const target = records.targets.find((t) => t.id === (props as { id: string }).id) as NonNullable<
    (typeof records.targets)[number]
  >;
  const page = buildIndicatorPage({
    target,
    series: records.series.get(target.series) as NonNullable<ReturnType<typeof records.series.get>>,
    roadmap: records.roadmaps.get(target.id),
    context: records.context.get(target.id) ?? [],
    locale: 'en',
    today: TODAY,
  });

  const title = wrap(page.title.text, 34, 3);
  const titleLines = title
    .map((l, i) => `<text x="72" y="${186 + i * 54}" font-family="Georgia, serif" font-size="46" fill="#22242B">${escape(l)}</text>`)
    .join('\n  ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#EFEFF1"/>
  <rect x="0" y="0" width="1200" height="6" fill="#8E2F6B"/>

  <text x="72" y="92" font-family="serif" font-size="34" fill="#22242B">अंतर</text>
  <line x1="152" y1="80" x2="188" y2="80" stroke="#22242B" stroke-width="1.5"/>
  <text x="200" y="88" font-family="monospace" font-size="17" letter-spacing="5" fill="#22242B">ANTAR</text>

  ${titleLines}

  <text x="72" y="${196 + title.length * 54}" font-family="sans-serif" font-size="21" fill="#575B65">${escape(clip(page.measure.text, 74))}</text>

  <g transform="translate(72, 432)">
    <text x="0" y="0" font-family="monospace" font-size="15" letter-spacing="2" fill="#666A73">TARGET</text>
    <text x="0" y="52" font-family="monospace" font-size="44" fill="#22242B">${escape(page.target.display)}</text>
    <text x="0" y="78" font-family="monospace" font-size="14" fill="#666A73">BY ${page.dueBy}</text>

    <text x="340" y="0" font-family="monospace" font-size="15" letter-spacing="2" fill="#666A73">ACHIEVED</text>
    <text x="340" y="52" font-family="monospace" font-size="44" fill="#22242B">${escape(page.observed.display)}</text>
    <text x="340" y="78" font-family="monospace" font-size="14" fill="#666A73">${escape(page.observedAsOf ?? '')}</text>

    <text x="680" y="0" font-family="monospace" font-size="15" letter-spacing="2" fill="#8E2F6B">REMAINING</text>
    <text x="680" y="52" font-family="monospace" font-size="44" fill="#8E2F6B">${escape(page.remaining)}</text>
    <text x="680" y="78" font-family="monospace" font-size="14" fill="#666A73">${page.yearsRemaining} YEARS TO RUN</text>
  </g>

  <line x1="72" y1="558" x2="1128" y2="558" stroke="#D6D7DC" stroke-width="1"/>
  <text x="72" y="588" font-family="sans-serif" font-size="16" fill="#575B65">${escape(clip(page.observed.citation, 96))}</text>
  <text x="72" y="611" font-family="sans-serif" font-size="14" fill="#666A73">Verified by ${escape(page.observed.verifiedBy)} on ${escape(page.observed.verifiedOn)}</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } });
};
