import { type HumanIdentity, KernelError } from './identity.ts';
import { type IsoDate, isoDate } from './time.ts';

/**
 * Human-recorded translations of text held in the record.
 *
 * Template copy lives in `render/strings.ts` and is translated there. This is for
 * the other half: titles, measure definitions, institution names, milestone
 * labels — text that is part of the record rather than part of the page. A
 * renderer must not translate those on the fly, because a translation of a
 * recorded value is an assertion about what the source says, and assertions in
 * this project carry a name.
 *
 * Entries are keyed by the exact English string they translate. That makes
 * translation drift self-detecting: if the English is edited, no entry matches
 * it any more and the page falls back to English with a visible marker, rather
 * than displaying a confident translation of a sentence that no longer exists.
 * A key scheme would have quietly kept the stale text.
 *
 * What is deliberately not translated: source URLs, document titles and
 * locators. A citation is a pointer to a document, and a reader following it
 * needs the name the document actually has.
 */
export type TranslationEntry = {
  readonly text: string;
  readonly translatedBy: HumanIdentity;
  readonly translatedOn: IsoDate;
  /** Optional: why a particular rendering was chosen, where it was a judgement. */
  readonly note?: string;
};

export type Translations = {
  readonly locale: string;
  /** Keyed by the exact English source string. */
  readonly entries: ReadonlyMap<string, TranslationEntry>;
};

export function translationEntry(
  source: string,
  text: string,
  by: HumanIdentity,
  on: string,
  note?: string,
): readonly [string, TranslationEntry] {
  if (!source.trim()) throw new KernelError('A translation needs a source string to translate.');
  if (!text.trim()) throw new KernelError(`Translation of ${JSON.stringify(source.slice(0, 40))} is empty.`);
  if (text.trim() === source.trim()) {
    throw new KernelError(
      `Translation of ${JSON.stringify(source.slice(0, 40))} is identical to the source. ` +
        'An untranslated entry is worse than a missing one: it renders as translated.',
    );
  }
  return [
    source,
    { text: text.trim(), translatedBy: by, translatedOn: isoDate(on), ...(note ? { note } : {}) },
  ];
}

export function translations(
  locale: string,
  entries: readonly (readonly [string, TranslationEntry])[],
): Translations {
  return { locale, entries: new Map(entries) };
}

export type Rendered = {
  readonly text: string;
  /** False when the fallback is in use, so the page can mark it. */
  readonly translated: boolean;
};

/**
 * The translated text, or the English with `translated: false`.
 *
 * Falling back is the correct behaviour for a missing translation, and the page
 * marks it so a reader can see which parts have not been translated rather than
 * assuming the whole page has.
 */
export function inLocale(source: string, table?: Translations): Rendered {
  const entry = table?.entries.get(source);
  return entry ? { text: entry.text, translated: true } : { text: source, translated: false };
}

/** How much of a page's recorded text has been translated. */
export function translationCoverage(
  sources: readonly string[],
  table?: Translations,
): { translated: number; total: number } {
  const unique = [...new Set(sources.filter((s) => s.trim()))];
  return {
    translated: unique.filter((s) => table?.entries.has(s)).length,
    total: unique.length,
  };
}
