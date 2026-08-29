import { KernelError } from '../kernel/identity.ts';

/**
 * Discovery for the CEA monthly report archive.
 *
 * Historical reports cannot be addressed by constructing a URL. The filenames
 * are not systematic — across ten months sampled they included `IC_July2026.xlsx`,
 * `Website_June.pdf`, `Website-1.pdf`, `website.pdf`, `Website_Report-1.pdf`,
 * `IC_June_2025_allocation_wise.pdf` and `IC_31_Dec_2023.pdf` — so every URL
 * pattern guessed from one month 404s on the next.
 *
 * The index page's month selector calls a WordPress admin-ajax action, and that
 * action returns the markup for a month, links included. It is undocumented and
 * could change without notice, which is exactly why the caller checks what comes
 * back rather than trusting it.
 */

const ENDPOINT = 'https://cea.nic.in/wp-admin/admin-ajax.php';
const REFERER = 'https://cea.nic.in/installed-capacity-report/?lang=en';

export type ArchiveEntry = {
  readonly year: number;
  readonly month: number;
  readonly url: string;
  readonly format: 'xlsx' | 'pdf';
};

/** Injected so the discovery logic is testable without the network. */
export type HttpPost = (url: string, body: URLSearchParams, headers: Record<string, string>) => Promise<string>;

export const defaultPost: HttpPost = async (url, body, headers) => {
  const response = await fetch(url, { method: 'POST', body, headers });
  if (!response.ok) {
    throw new KernelError(`CEA archive: HTTP ${response.status} from ${url}.`);
  }
  return response.text();
};

const FILE_LINK = /href="(https:\/\/cea\.nic\.in\/wp-content\/uploads\/installed\/[^"]+\.(xlsx|pdf))"/gi;

/**
 * Report URLs published for one month.
 *
 * An empty result raises. A month with no report is indistinguishable from a
 * changed endpoint from here, and treating either as "no data" would quietly
 * put a hole in a time series — rule 2.
 */
export async function discoverMonth(
  year: number,
  month: number,
  post: HttpPost = defaultPost,
): Promise<ArchiveEntry[]> {
  if (month < 1 || month > 12) throw new KernelError(`Month must be 1-12, got ${month}.`);

  const body = new URLSearchParams({
    action: 'monthly_archive_report',
    selMonthYear: `${year}-${String(month).padStart(2, '0')}`,
    reportType: 'installed',
  });

  const html = await post(ENDPOINT, body, {
    'content-type': 'application/x-www-form-urlencoded',
    referer: REFERER,
  });

  if (/Connection failed|Fatal error|<b>Warning<\/b>/i.test(html)) {
    // The CEA API has been observed returning HTTP 200 with an error in the
    // body; a status code is not evidence that a request worked.
    throw new KernelError(
      `CEA archive: ${year}-${month} returned a success status with an error body: ` +
        `${JSON.stringify(html.slice(0, 120))}`,
    );
  }

  const seen = new Set<string>();
  const entries: ArchiveEntry[] = [];
  for (const match of html.matchAll(FILE_LINK)) {
    const url = match[1] as string;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({ year, month, url, format: (match[2] as string).toLowerCase() as 'xlsx' | 'pdf' });
  }

  if (entries.length === 0) {
    throw new KernelError(
      `CEA archive: no report link found for ${year}-${String(month).padStart(2, '0')}. ` +
        'Either the month has no published report or the endpoint changed — both need a person to look.',
    );
  }
  return entries;
}
