/**
 * Page copy, per locale.
 *
 * English is the root. `en` below is the reference: `Strings` is derived from
 * it, so every other locale must supply exactly the same keys with exactly the
 * same signatures, and a translation that falls behind is a compile error
 * rather than a page with an English sentence in the middle of it.
 *
 * What lives here is template copy only. Nothing from the record is translated —
 * institution names, target titles, revision notes and correction text render
 * verbatim in whatever language the source used. Translating those would make
 * the page assert something about what the source said, which is a claim, not a
 * rendering decision. If a Hindi rendering of a recorded field is wanted, it has
 * to be recorded by a named human like any other judgement.
 */

export type Locale = 'en' | 'hi';

export const LOCALES: readonly Locale[] = ['en', 'hi'];

/** English is the root locale. Every other locale is typed against it. */
const en = {
  htmlLang: 'en',
  dir: 'ltr',

  rowTarget: 'Target',
  rowAchieved: 'Achieved so far',
  rowRemaining: 'Remaining',

  classPromise: 'Promise',
  classBenchmark: 'Benchmark',
  classFloor: 'Statutory minimum',
  classPromiseNote: 'The government stated this as a commitment.',
  classBenchmarkNote: 'A reference point, not a commitment.',
  classFloorNote: 'A legal or scheme minimum, not an ambition.',

  asOf: (date: string) => `as of ${date}`,

  promisedLabel: 'Promised',
  dueLabel: 'Due',
  promiseDetail: (who: string, when: string, years: number) =>
    `Announced ${when} by ${who} · a ${years}-year window`,
  originallyPromised: (when: string) =>
    `Originally promised ${when}. The deadline has since been revised.`,

  barAchieved: 'Achieved',
  barElapsed: 'Time elapsed',
  elapsedDetail: (elapsed: string, total: number) => `${elapsed} of ${total} years`,
  noVerdict:
    'These two are shown side by side, not divided into each other. Capacity arrives in steps ' +
    'when a reactor commissions, so a year with none is not by itself a year behind.',

  requiredRate: (rate: string, years: number) =>
    `<strong>${rate} per year</strong> over ${years} years would reach the target. ` +
    'This is division, not a forecast: it assumes nothing about whether that rate is achievable.',
  targetMet: 'Target met.',
  deadlinePassed: 'The deadline has passed.',

  sourcesHeading: 'Where these figures come from',
  sourceLinkLabel: 'source',
  labelTarget: 'Target',
  labelAchieved: 'Achieved',
  labelMeasure: 'Measure',
  announcedBy: (who: string, when: string) => `Announced by ${who} on ${when}.`,
  verifiedBy: (who: string, when: string) => `Verified by ${who} on ${when}.`,
  labelExcludes: 'What this figure leaves out',
  vintageCurrent: 'current measurement',
  vintageLastAvailable: 'last available measurement',

  roadmapHeading: 'How the target is meant to be reached',
  roadmapCaveat:
    'This is the roadmap the government has published. Lines marked planned are its projections: ' +
    'no party named below has undertaken to deliver them, and this page does not say that any of ' +
    'them is responsible for the shortfall.',
  roadmapReconciles: (total: string) => `The roadmap accounts for ${total}, which matches the target.`,
  roadmapGap: (total: string, missing: string) =>
    `The roadmap accounts for ${total}, leaving ${missing} the published plan does not explain.`,
  statusBuilt: 'built',
  statusCommitted: 'committed',
  statusPlanned: 'planned',
  basisCumulative: 'running total',
  basisIncrement: 'addition',

  revisedHeading: 'This target has been revised',
  revisedNote: 'The original target is preserved in the record and was not overwritten.',

  notSayingHeading: 'What this page does not say',
  notSayingIndividual: 'It does not assign responsibility to any individual.',
  notSayingCause: 'It makes no claim about why the gap exists.',

  footer: 'Every figure carries its source. No unverified figure is published.',

  /** Label for the link to the other language. Written in the target language. */
  switchToHi: 'हिन्दी में पढ़ें',
  switchToEn: 'Read in English',
};

export type Strings = typeof en;

const hi: Strings = {
  htmlLang: 'hi',
  dir: 'ltr',

  rowTarget: 'लक्ष्य',
  rowAchieved: 'अब तक',
  rowRemaining: 'शेष',

  classPromise: 'वादा',
  classBenchmark: 'मानक',
  classFloor: 'वैधानिक न्यूनतम',
  classPromiseNote: 'सरकार ने इसे एक प्रतिबद्धता के रूप में कहा।',
  classBenchmarkNote: 'यह एक संदर्भ बिंदु है, प्रतिबद्धता नहीं।',
  classFloorNote: 'यह कानूनी या योजनागत न्यूनतम है, लक्ष्य नहीं।',

  asOf: (date: string) => `${date} तक`,

  promisedLabel: 'वादा किया',
  dueLabel: 'समय सीमा',
  promiseDetail: (who: string, when: string, years: number) =>
    `${when} को ${who} द्वारा घोषित · ${years} वर्ष की अवधि`,
  originallyPromised: (when: string) =>
    `मूल रूप से ${when} को वादा किया गया। समय सीमा बाद में बदली गई।`,

  barAchieved: 'हासिल',
  barElapsed: 'बीता समय',
  elapsedDetail: (elapsed: string, total: number) => `${total} में से ${elapsed} वर्ष`,
  noVerdict:
    'ये दोनों आँकड़े साथ-साथ दिखाए गए हैं, एक को दूसरे से भाग नहीं दिया गया। क्षमता तब जुड़ती है ' +
    'जब कोई रिएक्टर चालू होता है, इसलिए जिस वर्ष कोई रिएक्टर चालू न हो वह अपने आप पिछड़ा वर्ष नहीं है।',

  requiredRate: (rate: string, years: number) =>
    `लक्ष्य तक पहुँचने के लिए <strong>${rate} प्रति वर्ष</strong>, ${years} वर्षों तक जोड़ना होगा। ` +
    'यह केवल भाग है, पूर्वानुमान नहीं: इससे यह नहीं कहा जा रहा कि यह दर संभव है।',
  targetMet: 'लक्ष्य पूरा हुआ।',
  deadlinePassed: 'समय सीमा बीत चुकी है।',

  sourcesHeading: 'ये आँकड़े कहाँ से आए',
  sourceLinkLabel: 'स्रोत',
  labelTarget: 'लक्ष्य',
  labelAchieved: 'अब तक',
  labelMeasure: 'मापदंड',
  announcedBy: (who: string, when: string) => `${who} द्वारा ${when} को घोषित।`,
  verifiedBy: (who: string, when: string) => `${who} द्वारा ${when} को सत्यापित।`,
  labelExcludes: 'यह आँकड़ा क्या छोड़ता है',
  vintageCurrent: 'वर्तमान माप',
  vintageLastAvailable: 'अंतिम उपलब्ध माप',

  roadmapHeading: 'लक्ष्य तक पहुँचने की योजना',
  roadmapCaveat:
    'यह सरकार द्वारा प्रकाशित योजना है। जिन पंक्तियों पर "नियोजित" लिखा है वे सरकार के अनुमान हैं: ' +
    'नीचे नामित किसी भी पक्ष ने इन्हें पूरा करने का वचन नहीं दिया है, और यह पृष्ठ यह नहीं कहता कि ' +
    'उनमें से कोई कमी के लिए ज़िम्मेदार है।',
  roadmapReconciles: (total: string) => `योजना ${total} तक का हिसाब देती है, जो लक्ष्य के बराबर है।`,
  roadmapGap: (total: string, missing: string) =>
    `योजना ${total} तक का हिसाब देती है; ${missing} के लिए प्रकाशित योजना में कोई स्पष्टीकरण नहीं है।`,
  statusBuilt: 'बन चुका',
  statusCommitted: 'वचनबद्ध',
  statusPlanned: 'नियोजित',
  basisCumulative: 'कुल योग',
  basisIncrement: 'अतिरिक्त',

  revisedHeading: 'इस लक्ष्य में बदलाव हुआ है',
  revisedNote: 'मूल लक्ष्य अभिलेख में सुरक्षित है; उसे मिटाया नहीं गया।',

  notSayingHeading: 'यह पृष्ठ क्या नहीं कहता',
  notSayingIndividual: 'यह किसी व्यक्ति को ज़िम्मेदार नहीं ठहराता।',
  notSayingCause: 'यह अंतर के कारण के बारे में कोई दावा नहीं करता।',

  footer: 'हर आँकड़े के साथ उसका स्रोत है। कोई भी असत्यापित आँकड़ा प्रकाशित नहीं होता।',

  switchToHi: 'हिन्दी में पढ़ें',
  switchToEn: 'Read in English',
};

export const STRINGS: Readonly<Record<Locale, Strings>> = { en, hi };

/**
 * Where each locale's page lives.
 *
 * English is the root, so it sits at the top level and Hindi under `/hi/`.
 */
export const pagePath = (slug: string, locale: Locale): string =>
  locale === 'en' ? `${slug}.html` : `${locale}/${slug}.html`;

/** Relative href from one locale's page to another's, for the switch link. */
export const relativeHref = (slug: string, from: Locale, to: Locale): string =>
  from === 'en' ? `${to}/${slug}.html` : `../${slug}.html`;
