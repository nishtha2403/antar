import { currentRevision, type Target } from '../kernel/target.ts';
import { escapeHtml, slugFor } from './page.ts';
import { inLocale, type Translations } from '../kernel/translation.ts';
import { type Locale, LOCALES, type Strings, STRINGS } from './strings.ts';

/**
 * The home page.
 *
 * The first thing a reader sees, so it says what the project is before it says
 * what it has measured. The three panel names are the frame — promise, account,
 * distance — and the index lists only what actually exists, which today is one
 * indicator out of the eight to twelve G2 requires.
 *
 * It says so. A site that lists one indicator without mentioning that is
 * implying a completeness it does not have.
 */
/**
 * Relative href from one locale's index to another's.
 *
 * English is at the root and every other locale sits one directory below it, so
 * the answer depends on direction. Emitting the same href from both — as the
 * first version did — sent the root index to the site's parent and the Hindi
 * index to a directory that does not exist.
 */
function indexHref(from: Locale, to: Locale): string {
  if (from === to) return './';
  return from === 'en' ? `${to}/` : '../';
}

export function renderIndex(
  targets: readonly Target[],
  locale: Locale,
  table?: Translations,
): string {
  const t = STRINGS[locale];

  // The index links to the articles, so it must use the same recorded
  // translations they do. Listing an English title above a Hindi page makes the
  // translation look absent when it is not.
  const untranslated: string[] = [];
  const tr = (source: string): string => {
    if (locale === 'en') return escapeHtml(source);
    const rendered = inLocale(source, table);
    if (rendered.translated) return escapeHtml(rendered.text);
    untranslated.push(source);
    return `<span class="untranslated" lang="en">${escapeHtml(source)}</span>`;
  };
  const other = LOCALES.filter((l) => l !== locale);
  const switchLinks = other
    .map((l) => {
      const href = locale === 'en' ? `${l}/` : '../';
      return `<a href="${href}" hreflang="${l}">${escapeHtml(l === 'hi' ? t.switchToHi : t.switchToEn)}</a>`;
    })
    .join(' · ');

  const rows = targets.map((target) => {
    const revision = currentRevision(target);
    // Each locale keeps its pages in one directory, so this is a bare filename.
    const href = `${slugFor(target)}.html`;
    return `    <li>
      <a href="${escapeHtml(href)}">${tr(target.title)}</a>
      <span class="meta">${escapeHtml(t.indexPromisedDue(String(revision.announcedOn.slice(0, 4)), String(revision.dueBy)))}</span>
    </li>`;
  });

  return `<!doctype html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(t.siteName)} — ${escapeHtml(t.siteTagline)}</title>
${LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${indexHref(locale, l)}">`).join('\n')}
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
  nav { font-size:.85rem; margin-bottom:2rem; }
  nav a { color:var(--dim); }
  h1 { font-size:2rem; margin:0 0 .25rem; font-weight:680; letter-spacing:-.01em; }
  .tagline { color:var(--dim); margin:0 0 2rem; font-size:1.05rem; line-height:1.5; }
  .panels { display:grid; gap:1rem; margin:2rem 0; }
  .panel { border-left:2px solid var(--line); padding-left:.9rem; }
  .panel b { display:block; font-size:1.05rem; font-weight:600; }
  .panel span { color:var(--dim); font-size:.9rem; }
  h2 { font-size:.8rem; text-transform:uppercase; letter-spacing:.06em; color:var(--dim);
       margin:2.5rem 0 .5rem; font-weight:600; }
  ul { padding-left:0; list-style:none; margin:.5rem 0; }
  li { padding:.7rem 0; border-bottom:1px solid var(--line); }
  li a { color:var(--ink); font-weight:550; text-decoration-color:var(--line); }
  .meta { display:block; color:var(--dim); font-size:.82rem; font-variant-numeric:tabular-nums; }
  .note { font-size:.875rem; color:var(--dim); border-left:2px solid var(--line);
          padding-left:.85rem; margin:1.75rem 0; }
  footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line);
           font-size:.8rem; color:var(--dim); }
  a { color:inherit; }
  .untranslated { opacity:.82; border-bottom:1px dotted var(--line); }
</style>

<nav>${switchLinks}</nav>

<h1>${escapeHtml(t.siteName)}</h1>
<p class="tagline">${escapeHtml(t.siteTagline)}</p>

<div class="panels">
  <div class="panel"><b>${escapeHtml(t.panelLakshya)}</b><span>${escapeHtml(t.panelLakshyaDesc)}</span></div>
  <div class="panel"><b>${escapeHtml(t.panelHisaab)}</b><span>${escapeHtml(t.panelHisaabDesc)}</span></div>
  <div class="panel"><b>${escapeHtml(t.panelAntar)}</b><span>${escapeHtml(t.panelAntarDesc)}</span></div>
</div>

<h2>${escapeHtml(t.indexHeading)}</h2>
<ul>
${rows.join('\n')}
</ul>

<p class="note">${escapeHtml(t.indexScope(targets.length))}</p>

<h2>${escapeHtml(t.indexMethodHeading)}</h2>
<p class="note">${escapeHtml(t.indexMethod)}</p>

${locale !== 'en' && untranslated.length > 0 ? `<p class="note">${escapeHtml(t.untranslatedNote(untranslated.length))}</p>` : ''}

<footer>${escapeHtml(t.footer)}<br>
<a href="https://github.com/nishtha2403/antar">${escapeHtml(t.indexSource)}</a></footer>
</html>
`;
}
