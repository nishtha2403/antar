import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadRecords } from '../lib/records.ts';
import { summarise, slugFor } from '../lib/view.ts';
import { TODAY } from '../lib/today.ts';

/** One item per indicator, so a reader can follow the record rather than a newsletter. */
export async function GET(context: APIContext) {
  const records = await loadRecords();
  const items = records.targets.map((t) => {
    const s = summarise(t, records.series.get(t.series), 'en', undefined, TODAY);
    return {
      title: t.title,
      link: `/antar/${t.category}/${slugFor(t)}`,
      pubDate: new Date(`${s.lastCheckedOn ?? s.observedAsOf ?? `${s.promisedYear}-01-01`}T00:00:00Z`),
      description:
        `${s.achievedLabel} achieved against a target due ${s.dueBy}. ` +
        `${s.readings} verified reading${s.readings === 1 ? '' : 's'}.`,
    };
  });
  return rss({
    title: 'Antar',
    description:
      'The distance between the India that was promised and the India people live in — in numbers, ' +
      'each traceable to the document it came from.',
    site: context.site ?? 'https://nishtha2403.github.io',
    items,
  });
}
