import type { Locale } from './locales.ts';
import type { MeasurementState } from './view.ts';

/**
 * Interface copy, per locale.
 *
 * English is the reference: `Copy` is derived from it, so a locale missing a key
 * is a compile error rather than an English sentence in the middle of a Hindi
 * page. Recorded text is translated separately, in `data/translations/`.
 */
const en = {
  siteName: 'Antar',
  tagline:
    'The distance between the India that was promised and the India people live in — in numbers, ' +
    'each traceable to the document it came from.',
  navIndicators: 'Indicators',
  navMethod: 'Method',
  navCorrections: 'Corrections',
  navAbout: 'About',
  navSearch: 'Search',
  filterLabel: 'Filter indicators',
  filterAll: 'All',
  notFoundTitle: 'No such page',
  notFoundLede:
    'Nothing is published at this address. Links to indicators change when a target is recategorised; ' +
    'the list below is always current.',
  searchLede: 'Across every indicator, method note and correction on this site.',
  searchPlaceholder: 'Search indicators',
  searchNeedsJs: 'Search needs JavaScript. Everything it would find is reachable from the indicator list.',
  searchReady: 'Type to search.',
  searchNoResults: 'Nothing found.',
  otherLocale: 'हिन्दी में पढ़ें',
  themeLabel: 'Colour scheme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',

  dueThisDecade: 'Due this decade',
  allIndicators: 'All indicators',
  categoryHeading: (name: string) => name,
  achieved: 'achieved',
  noData: 'no data',
  promisedDue: (promised: number, due: number) => `Promised ${promised} · due ${due}`,
  readings: (n: number) => `${n} verified reading${n === 1 ? '' : 's'}`,
  lastChecked: (date: string) => `last checked ${date}`,

  stateMeasured: 'measured',
  stateNoData: 'no data yet',
  stateDeadlinePassed: 'deadline passed',
  stateRevised: 'revised',
  classPromise: 'promise',
  classBenchmark: 'benchmark',
  classFloor: 'statutory floor',

  windowPromised: 'Promised',
  windowDue: 'Due',
  windowToday: 'today',
  windowYears: (n: number) => `${n} years`,
  target: 'Target',
  inService: 'Achieved',
  remaining: 'Remaining',
  by: (year: number) => `by ${year}`,
  asOf: (date: string) => `as of ${date}`,
  yearsLeft: (n: number) => `${n} yrs left`,
  achievedMeter: 'Achieved',
  elapsedMeter: 'Promise window elapsed',
  elapsedDetail: (elapsed: string, total: number) => `${elapsed} of ${total} years`,
  noVerdict:
    'Shown side by side, not divided into each other. Capacity arrives in steps when a project ' +
    'commissions, so a year with none is not by itself a year behind.',
  requiredRate: (rate: string, years: number) =>
    `${rate} per year over ${years} years would reach the target. This is division, not a forecast.`,
  targetMet: 'Target met.',
  deadlinePassed: 'The deadline has passed.',

  chartCaption: (n: number, from: string, to: string) =>
    `${n} verified readings, ${from} to ${to}. Each checked against its source report.`,
  chartFullScale: (from: number, to: number, unit: string) =>
    `Full scale · ${from}–${to} ${unit}`,
  chartMagnified: (times: number, band: number, unit: string) =>
    `Magnified ×${times} · 0–${band} ${unit}`,
  chartAria: (n: number, target: number, unit: string) =>
    `${n} verified readings plotted against a target of ${target} ${unit}, drawn to the full scale of the target.`,
  chartMagnifiedAria: (times: number) =>
    `The same readings, with the vertical scale magnified ${times} times so the movement is legible.`,
  chartArithmetic: (rate: number, unit: string, due: number) =>
    `The dashed line is ${rate} ${unit} per year to ${due}, the arithmetic that reaches the target. It is division, not a forecast.`,


  contextHeading: 'What the government says',
  contextCaveat:
    'Every statement here is attributed. These are claims the named body has made, reported with ' +
    'their sources — not this site’s assessment of whether they are right.',
  kindPurpose: 'stated purpose',
  kindPlan: 'stated plan',
  kindEvent: 'recorded event',

  roadmapHeading: 'Who is expected to build it',
  roadmapCaveat:
    'The government’s published roadmap. No party named here has undertaken to deliver it, and ' +
    'this page does not say any of them is responsible for the shortfall.',
  statusBuilt: 'built',
  statusCommitted: 'committed',
  statusPlanned: 'planned',
  basisCumulative: 'running total',
  basisIncrement: 'addition',
  roadmapReconciles: (total: string) => `Accounts for ${total}, matching the target.`,
  roadmapGap: (total: string) => `Accounts for ${total} — less than the target.`,

  revisedHeading: 'This target has been revised',
  revisedNote: 'The original is preserved in the record and was not overwritten.',

  sourcesHeading: 'Where these figures come from',
  sourceLink: 'source',
  labelTarget: 'Target',
  labelAchieved: 'Achieved',
  labelMeasure: 'Measure',
  labelExcludes: 'What this figure leaves out',
  labelCoverage: 'Verification coverage',
  coverage: (verified: number, total: number) =>
    verified === total
      ? `all ${total} readings in this series have been checked against their source documents`
      : `${verified} of ${total} readings have been checked against their source documents. ` +
        'The rest are recorded but not published, and do not appear in any figure above.',
  announcedBy: (who: string, when: string) => `Announced by ${who} on ${when}.`,
  verifiedBy: (who: string, when: string) => `Verified by ${who} on ${when}.`,
  downloadData: 'Download this data',

  notSayingHeading: 'What this page does not say',
  notSayingIndividual: 'It does not assign responsibility to any individual.',
  notSayingCause: 'It makes no claim about why the gap exists.',

  untranslatedNote: (n: number) =>
    n === 0
      ? 'Source documents are cited by their own titles, in the language they were published in.'
      : `${n} passage${n === 1 ? '' : 's'} here ${n === 1 ? 'is' : 'are'} still in English, marked ` +
        'with a dotted underline: no translation has been recorded. Source documents are always ' +
        'cited by their own titles.',

  correctionsEmpty:
    'No corrections have been published yet. That is not evidence of accuracy — it is a claim ' +
    'about this site worth being sceptical of.',
  footer: 'Every figure carries its source. No unverified figure is published.',
  scopeNote: (n: number) =>
    `${n} indicator${n === 1 ? '' : 's'} published. This is an early build: the full panel is 8–12 ` +
    'indicators, and the constituency spending ledger is not built. Nothing here is a survey of ' +
    'government performance.',
};

export type Copy = typeof en;

const hi: Copy = {
  siteName: 'अंतर',
  tagline:
    'जिस भारत का वादा किया गया और जिस भारत में लोग रहते हैं — उन दोनों के बीच की दूरी, आँकड़ों में, ' +
    'और हर आँकड़े के साथ वह दस्तावेज़ जिससे वह आया है।',
  navIndicators: 'संकेतक',
  navMethod: 'पद्धति',
  navCorrections: 'सुधार',
  navAbout: 'परिचय',
  navSearch: 'खोज',
  filterLabel: 'संकेतक छाँटें',
  filterAll: 'सभी',
  notFoundTitle: 'यह पृष्ठ नहीं है',
  notFoundLede:
    'इस पते पर कुछ प्रकाशित नहीं है। संकेतक की कड़ियाँ तब बदलती हैं जब किसी लक्ष्य की श्रेणी बदलती है; ' +
    'नीचे की सूची हमेशा वर्तमान रहती है।',
  searchLede: 'इस साइट के हर संकेतक, पद्धति-टिप्पणी और सुधार में।',
  searchPlaceholder: 'संकेतक खोजें',
  searchNeedsJs: 'खोज के लिए जावास्क्रिप्ट चाहिए। जो कुछ यह खोजेगी वह संकेतक-सूची से भी मिल जाएगा।',
  searchReady: 'खोजने के लिए लिखें।',
  searchNoResults: 'कुछ नहीं मिला।',
  otherLocale: 'Read in English',
  themeLabel: 'रंग योजना',
  themeSystem: 'सिस्टम',
  themeLight: 'उजला',
  themeDark: 'गहरा',

  dueThisDecade: 'इस दशक की समय सीमा',
  allIndicators: 'सभी संकेतक',
  categoryHeading: (name: string) => name,
  achieved: 'हासिल',
  noData: 'आँकड़े नहीं',
  promisedDue: (promised: number, due: number) => `वादा ${promised} · समय सीमा ${due}`,
  readings: (n: number) => `${n} सत्यापित पाठ`,
  lastChecked: (date: string) => `अंतिम जाँच ${date}`,

  stateMeasured: 'मापा गया',
  stateNoData: 'आँकड़े नहीं',
  stateDeadlinePassed: 'समय सीमा बीती',
  stateRevised: 'संशोधित',
  classPromise: 'वादा',
  classBenchmark: 'मानक',
  classFloor: 'वैधानिक न्यूनतम',

  windowPromised: 'वादा',
  windowDue: 'समय सीमा',
  windowToday: 'आज',
  windowYears: (n: number) => `${n} वर्ष`,
  target: 'लक्ष्य',
  inService: 'अब तक',
  remaining: 'शेष',
  by: (year: number) => `${year} तक`,
  asOf: (date: string) => `${date} तक`,
  yearsLeft: (n: number) => `${n} वर्ष शेष`,
  achievedMeter: 'हासिल',
  elapsedMeter: 'बीता समय',
  elapsedDetail: (elapsed: string, total: number) => `${total} में से ${elapsed} वर्ष`,
  noVerdict:
    'ये दोनों आँकड़े साथ-साथ दिखाए गए हैं, एक को दूसरे से भाग नहीं दिया गया। क्षमता तब जुड़ती है जब ' +
    'कोई परियोजना चालू होती है, इसलिए जिस वर्ष कोई चालू न हो वह अपने आप पिछड़ा वर्ष नहीं है।',
  requiredRate: (rate: string, years: number) =>
    `लक्ष्य तक पहुँचने के लिए ${years} वर्षों तक ${rate} प्रति वर्ष जोड़ना होगा। यह केवल भाग है, पूर्वानुमान नहीं।`,
  targetMet: 'लक्ष्य पूरा हुआ।',
  deadlinePassed: 'समय सीमा बीत चुकी है।',

  chartCaption: (n: number, from: string, to: string) =>
    `${from} से ${to} तक ${n} सत्यापित पाठ। हर एक अपनी स्रोत रिपोर्ट से मिलाकर जाँचा गया।`,
  chartFullScale: (from: number, to: number, unit: string) =>
    `पूर्ण पैमाना · ${from}–${to} ${unit}`,
  chartMagnified: (times: number, band: number, unit: string) =>
    `${times} गुना बड़ा · 0–${band} ${unit}`,
  chartAria: (n: number, target: number, unit: string) =>
    `${target} ${unit} के लक्ष्य के सामने ${n} सत्यापित पाठ, लक्ष्य के पूर्ण पैमाने पर।`,
  chartMagnifiedAria: (times: number) =>
    `वही पाठ, ऊर्ध्वाधर पैमाना ${times} गुना बड़ा किया गया ताकि बदलाव दिख सके।`,
  chartArithmetic: (rate: number, unit: string, due: number) =>
    `बिंदुदार रेखा ${due} तक ${rate} ${unit} प्रति वर्ष है — वह भाग जो लक्ष्य तक पहुँचता है। यह भाग है, पूर्वानुमान नहीं।`,


  contextHeading: 'सरकार क्या कहती है',
  contextCaveat:
    'इस भाग की हर बात किसी को उद्धृत करके कही गई है। ये नामित संस्था के अपने कथन हैं, स्रोत सहित — ' +
    'यह साइट यह नहीं कह रही कि वे सही हैं या ग़लत।',
  kindPurpose: 'घोषित उद्देश्य',
  kindPlan: 'घोषित योजना',
  kindEvent: 'दर्ज घटना',

  roadmapHeading: 'इसे कौन बनाएगा',
  roadmapCaveat:
    'यह सरकार द्वारा प्रकाशित योजना है। नीचे नामित किसी भी पक्ष ने इसे पूरा करने का वचन नहीं दिया है, ' +
    'और यह पृष्ठ यह नहीं कहता कि उनमें से कोई कमी के लिए ज़िम्मेदार है।',
  statusBuilt: 'बन चुका',
  statusCommitted: 'वचनबद्ध',
  statusPlanned: 'नियोजित',
  basisCumulative: 'कुल योग',
  basisIncrement: 'अतिरिक्त',
  roadmapReconciles: (total: string) => `योजना ${total} तक का हिसाब देती है, जो लक्ष्य के बराबर है।`,
  roadmapGap: (total: string) => `योजना केवल ${total} तक का हिसाब देती है — लक्ष्य से कम।`,

  revisedHeading: 'इस लक्ष्य में बदलाव हुआ है',
  revisedNote: 'मूल लक्ष्य अभिलेख में सुरक्षित है; उसे मिटाया नहीं गया।',

  sourcesHeading: 'ये आँकड़े कहाँ से आए',
  sourceLink: 'स्रोत',
  labelTarget: 'लक्ष्य',
  labelAchieved: 'अब तक',
  labelMeasure: 'मापदंड',
  labelExcludes: 'यह आँकड़ा क्या छोड़ता है',
  labelCoverage: 'सत्यापन की सीमा',
  coverage: (verified: number, total: number) =>
    verified === total
      ? `इस शृंखला के सभी ${total} पाठ अपने स्रोत दस्तावेज़ों से मिलाकर जाँचे गए हैं`
      : `${total} में से ${verified} पाठ स्रोत दस्तावेज़ों से मिलाकर जाँचे गए हैं। ` +
        'बाक़ी दर्ज तो हैं पर प्रकाशित नहीं, और ऊपर किसी आँकड़े में शामिल नहीं हैं।',
  announcedBy: (who: string, when: string) => `${who} द्वारा ${when} को घोषित।`,
  verifiedBy: (who: string, when: string) => `${who} द्वारा ${when} को सत्यापित।`,
  downloadData: 'यह आँकड़ा डाउनलोड करें',

  notSayingHeading: 'यह पृष्ठ क्या नहीं कहता',
  notSayingIndividual: 'यह किसी व्यक्ति को ज़िम्मेदार नहीं ठहराता।',
  notSayingCause: 'यह अंतर के कारण के बारे में कोई दावा नहीं करता।',

  untranslatedNote: (n: number) =>
    n === 0
      ? 'स्रोत दस्तावेज़ों के नाम उसी भाषा में दिए गए हैं जिसमें वे प्रकाशित हुए।'
      : `इस पृष्ठ पर ${n} अंश अब भी अंग्रेज़ी में हैं, बिंदुदार रेखा से चिह्नित: उनका अनुवाद दर्ज नहीं है। ` +
        'स्रोत दस्तावेज़ों के नाम हमेशा उसी भाषा में रहते हैं जिसमें वे प्रकाशित हुए।',

  correctionsEmpty:
    'अभी तक कोई सुधार प्रकाशित नहीं हुआ। यह सटीकता का प्रमाण नहीं है — यह इस साइट के बारे में एक ' +
    'दावा है जिस पर संदेह करना उचित है।',
  footer: 'हर आँकड़े के साथ उसका स्रोत है। कोई भी असत्यापित आँकड़ा प्रकाशित नहीं होता।',
  scopeNote: (n: number) =>
    `${n} संकेतक प्रकाशित। यह एक प्रारंभिक संस्करण है: पूरे पैनल में 8–12 संकेतक होंगे, और निर्वाचन ` +
    'क्षेत्र का व्यय-लेखा अभी बना ही नहीं है। इसे सरकारी प्रदर्शन का समग्र आकलन न समझा जाए।',
};

export const COPY: Readonly<Record<Locale, Copy>> = { en, hi };

export const stateLabel = (state: MeasurementState, c: Copy): string =>
  state === 'measured' ? c.stateMeasured
  : state === 'no-data' ? c.stateNoData
  : state === 'deadline-passed' ? c.stateDeadlinePassed
  : c.stateRevised;
