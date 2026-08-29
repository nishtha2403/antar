#!/usr/bin/env node
/**
 * Records the Hindi translations of text held in the record.
 *
 * These are translations of the project's own descriptive text — titles, measure
 * definitions, milestone labels, institution names. They are not translations of
 * source documents, and no citation is translated: a reader following a citation
 * needs the title the document actually has.
 *
 * Each entry carries the name of the person who recorded it. As with the
 * classification rationales, the wording here was drafted and then adopted; a
 * translation nobody has read is a claim nobody has checked.
 *
 *   node scripts/record-translations.ts [--dry-run]
 */
import { FOUNDER, displayName } from '../src/kernel/people.ts';
import { translationEntry, translations } from '../src/kernel/translation.ts';
import { Store } from '../src/store/store.ts';

const dryRun = process.argv.includes('--dry-run');
const ON = '2026-08-30';

const e = (source: string, text: string, note?: string) =>
  translationEntry(source, text, FOUNDER, ON, note);

const hi = translations('hi', [
  e(
    '100 GW of nuclear power capacity by 2047',
    '2047 तक 100 गीगावाट परमाणु बिजली क्षमता',
  ),
  e(
    'Installed nuclear electricity generation capacity in service, all-India, utilities',
    'अखिल भारतीय स्तर पर चालू परमाणु बिजली उत्पादन क्षमता (सार्वजनिक उपयोगिताएँ)',
    '"in service" is rendered as चालू rather than स्थापित, because the distinction between ' +
      'capacity in service and capacity that exists is the whole point of this measure.',
  ),
  e(
    'Capacity that is built but under long-term outage. CEA removed 100 MW of nuclear ' +
      'capacity from this figure with effect from 31 May 2025, to be added back if it ' +
      'generates again. This is therefore capacity in service, not capacity that exists.',
    'वह क्षमता जो बन तो चुकी है पर लंबे समय से बंद पड़ी है। केंद्रीय विद्युत प्राधिकरण ने ' +
      '31 मई 2025 से इस आँकड़े में से 100 मेगावाट परमाणु क्षमता हटा दी है; यदि वह दोबारा बिजली ' +
      'बनाने लगे तो उसे फिर जोड़ दिया जाएगा। इसलिए यह चालू क्षमता है, मौजूद क्षमता नहीं।',
  ),
  e(
    'CEA Monthly Installed Capacity Report, ALL INDIA Total, Nuclear column',
    'सीईए मासिक स्थापित क्षमता रिपोर्ट, अखिल भारतीय कुल, परमाणु स्तंभ',
  ),
  e(
    'Ministry of Finance, Union Budget 2025-26',
    'वित्त मंत्रालय, केंद्रीय बजट 2025-26',
    'The ministry\'s own Hindi name, not a translation of the English words.',
  ),
  e('In service today', 'आज चालू'),
  e(
    'Expected by 2031-32, from projects under construction',
    '2031-32 तक अपेक्षित, निर्माणाधीन परियोजनाओं से',
  ),
  e(
    'Envisaged beyond 2032, indigenous PHWR and LWR',
    '2032 के बाद परिकल्पित, स्वदेशी PHWR और LWR',
    'Reactor type abbreviations are left in Latin script: they are how the technologies are ' +
      'referred to in Indian technical and press usage, including in Hindi.',
  ),
  e('Balance expected from other parties', 'शेष क्षमता अन्य पक्षों से अपेक्षित'),
  e('NPCIL (existing fleet)', 'एनपीसीआईएल (मौजूदा संयंत्र)'),
  e('NPCIL', 'एनपीसीआईएल'),
  e(
    'Other Public Sector Enterprises (Central and State)',
    'अन्य सार्वजनिक क्षेत्र के उपक्रम (केंद्र और राज्य)',
  ),
  e('State Governments', 'राज्य सरकारें'),
  e('Private sector', 'निजी क्षेत्र'),
  e('Joint Ventures', 'संयुक्त उपक्रम'),
]);

console.log(`\nhi — ${hi.entries.size} entries, recorded by ${displayName(FOUNDER)} on ${ON}\n`);
for (const [source, entry] of hi.entries) {
  console.log(`  ${source.slice(0, 52).padEnd(54)}${entry.text.slice(0, 46)}`);
}

if (dryRun) console.log('\nDry run. Nothing written.\n');
else {
  await new Store('data').saveTranslations(hi);
  console.log('\nWritten to data/translations/hi.json\n');
}
