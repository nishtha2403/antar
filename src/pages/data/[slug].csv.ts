import type { APIRoute } from 'astro';
import { loadRecords } from '../../lib/records.ts';
import { slugFor } from '../../lib/view.ts';
import { formatQuantity } from '../../kernel/quantity.ts';

/** The observation series as a spreadsheet, with provenance on every row. */
export async function getStaticPaths() {
  const { targets } = await loadRecords();
  return targets.map((t) => ({ params: { slug: slugFor(t) }, props: { id: t.id } }));
}

const escape = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const GET: APIRoute = async ({ props }) => {
  const records = await loadRecords();
  const target = records.targets.find((t) => t.id === (props as { id: string }).id)!;
  const series = records.series.get(target.series)!;

  const rows = [
    ['as_of', 'value', 'unit', 'state', 'verified_by', 'verified_on', 'source_url', 'retrieved_on'],
    ...series.observations.map((o) => {
      const v = o.value.verification;
      return [
        o.asOf,
        formatQuantity(o.value.value).replace(` ${o.value.value.unit}`, ''),
        o.value.value.unit,
        v.state,
        v.state === 'verified' ? v.verifiedBy : '',
        v.state === 'verified' ? v.verifiedOn : '',
        o.value.provenance.sourceUrl,
        o.value.provenance.retrievedOn,
      ];
    }),
  ];

  return new Response(rows.map((r) => r.map((c) => escape(String(c))).join(',')).join('\n') + '\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8' },
  });
};
