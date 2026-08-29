import type { APIRoute } from 'astro';
import { loadRecords } from '../../lib/records.ts';
import { slugFor } from '../../lib/view.ts';
import { encodeTargetHeader, encodeRevision, encodeObservation } from '../../store/codec.ts';
import { quantityToJSON } from '../../kernel/quantity.ts';

/**
 * The record behind a page, as published.
 *
 * "Others build on the data without asking" is the project's stated success
 * metric, so every indicator ships its own machine-readable record rather than
 * requiring a reader to clone a repository.
 */
export async function getStaticPaths() {
  const { targets } = await loadRecords();
  return targets.map((t) => ({ params: { slug: slugFor(t) }, props: { id: t.id } }));
}

export const GET: APIRoute = async ({ props }) => {
  const records = await loadRecords();
  const target = records.targets.find((t) => t.id === (props as { id: string }).id)!;
  const series = records.series.get(target.series)!;

  const body = {
    target: {
      ...encodeTargetHeader(target),
      revisions: target.revisions.map(encodeRevision),
    },
    series: {
      measure: series.measure,
      observations: series.observations.map(encodeObservation),
    },
    roadmap: records.roadmaps.get(target.id)?.milestones.map((m) => ({
      label: m.label,
      value: quantityToJSON(m.value.value),
      basis: m.basis,
      actors: m.actors,
      status: m.status.value,
      verification: m.value.verification,
      provenance: m.provenance,
    })) ?? [],
    licence: 'CC BY 4.0',
    source: 'https://github.com/nishtha2403/antar-data',
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
