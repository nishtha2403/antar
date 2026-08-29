export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** English is the authoring root, so it has no prefix; every other locale does. */
export const localePrefix = (locale: Locale): string => (locale === 'en' ? '' : `/${locale}`);
