import { describe, expect, it } from 'vitest';
import { computeGap } from '../src/kernel/gap.ts';
import { quantity } from '../src/kernel/quantity.ts';
import { series } from '../src/kernel/series.ts';
import { reviseTarget } from '../src/kernel/target.ts';
import { isoDate, targetYear } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { renderAllLocales, renderTargetPage, slugFor } from '../src/render/page.ts';
import { type Locale, LOCALES, STRINGS } from '../src/render/strings.ts';
import { ceaSource, FOUNDER, nuclearMeasure, nuclearTarget, pibSource } from './fixtures.ts';

const capacity = (value: string, asOf = '2025-12-31') =>
  series(nuclearMeasure, [
    {
      asOf: isoDate(asOf),
      value: verify(attest(quantity(value, 'GW'), ceaSource), FOUNDER, asOf, 'Row checked against the CEA report.'),
    },
  ]);

const page = (locale: Locale, target = nuclearTarget(), s = capacity('8.18')) =>
  renderTargetPage(target, computeGap(target, s), locale);

describe('one language per page', () => {
  it('renders English at the root with no Hindi in it', () => {
    const html = page('en');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('Target');
    expect(html).toContain('Achieved so far');
    // No Devanagari anywhere except the link offering the Hindi page.
    const withoutSwitchLink = html.replace(/<nav>[\s\S]*?<\/nav>/, '');
    expect(withoutSwitchLink).not.toMatch(/[ऀ-ॿ]/);
  });

  it('renders Hindi with no English template copy in it', () => {
    const html = page('hi');
    expect(html).toContain('<html lang="hi"');
    expect(html).toContain('लक्ष्य');
    expect(html).toContain('अब तक');
    expect(html).not.toContain('Achieved so far');
    expect(html).not.toContain('This is division, not a forecast');
  });

  it('links the two together and declares them with hreflang', () => {
    const en = page('en');
    const hi = page('hi');
    expect(en).toContain('<link rel="alternate" hreflang="hi"');
    expect(en).toContain('href="hi/nem-2047-100gw.html"');
    expect(hi).toContain('<link rel="alternate" hreflang="en"');
    expect(hi).toContain('href="../nem-2047-100gw.html"');
    expect(slugFor(nuclearTarget())).toBe('nem-2047-100gw');
  });

  it('renders every locale from one call', () => {
    const pages = renderAllLocales(nuclearTarget(), computeGap(nuclearTarget(), capacity('8.18')));
    expect(Object.keys(pages).sort()).toEqual(['en', 'hi']);
  });
});

describe('translations cannot drift', () => {
  it('gives every locale the same key set', () => {
    const reference = Object.keys(STRINGS.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(STRINGS[locale]).sort(), `locale ${locale}`).toEqual(reference);
    }
  });

  it('gives every locale the same shape for each key', () => {
    for (const locale of LOCALES) {
      for (const key of Object.keys(STRINGS.en) as (keyof typeof STRINGS.en)[]) {
        expect(typeof STRINGS[locale][key], `${locale}.${String(key)}`).toBe(typeof STRINGS.en[key]);
      }
    }
  });

  it('leaves no locale with an untranslated English string', () => {
    // Every Hindi value that is a plain string must actually differ from English,
    // except the two switch labels, which are deliberately written in the
    // language they point at.
    const exempt = new Set(['switchToHi', 'switchToEn', 'dir']);
    for (const key of Object.keys(STRINGS.en) as (keyof typeof STRINGS.en)[]) {
      if (exempt.has(key)) continue;
      const en = STRINGS.en[key];
      const hi = STRINGS.hi[key];
      if (typeof en === 'string' && typeof hi === 'string') {
        expect(hi, `hi.${String(key)} is still English`).not.toBe(en);
      }
    }
  });
});

describe('the record is never translated', () => {
  it('renders recorded values verbatim in both locales', () => {
    const en = page('en');
    const hi = page('hi');
    for (const html of [en, hi]) {
      // Target title, institution and measure come from the record as recorded.
      expect(html).toContain('100 GW of nuclear power capacity by 2047');
      expect(html).toContain('Ministry of Finance');
      expect(html).toContain('Central Electricity Authority');
      expect(html).toContain('Installed nuclear electricity generation capacity, all-India');
    }
  });

  it('shows identical figures in both locales', () => {
    for (const html of [page('en'), page('hi')]) {
      expect(html).toContain('100 GW');
      expect(html).toContain('8.18 GW');
      expect(html).toContain('91.82 GW');
      expect(html).toContain('8.18 %');
    }
  });

  it('renders a revision note verbatim in both locales', () => {
    const revised = reviseTarget(nuclearTarget(), {
      value: verify(attest(quantity('100', 'GW'), pibSource), FOUNDER, '2027-03-01', 'Read against revised document'),
      dueBy: targetYear(2052),
      announcedBy: 'Ministry of Finance',
      announcedOn: '2027-02-01',
      provenance: pibSource,
      recordedBy: FOUNDER,
      recordedOn: '2027-03-01',
      note: 'Deadline moved from 2047 to 2052 in the FY28 budget speech.',
    });
    expect(page('en', revised)).toContain('Deadline moved from 2047 to 2052');
    expect(page('hi', revised)).toContain('Deadline moved from 2047 to 2052');
    expect(page('hi', revised)).toContain('इस लक्ष्य में बदलाव हुआ है');
  });
});

describe('what every page must do', () => {
  it('carries a citation and a verifier for every figure', () => {
    for (const html of [page('en'), page('hi')]) {
      expect(html).toContain('Press Information Bureau');
      // The verifier is named on the page. The handle is a record key and
      // has no business being shown to a reader.
      expect(html).toContain('Nishtha Sharma');
      expect(html).not.toContain('nishtha.sharma');
      expect(html).toContain('pib.gov.in');
    }
  });

  it('labels the required rate as division rather than a forecast', () => {
    expect(page('en')).toContain('This is division, not a forecast');
    expect(page('hi')).toContain('पूर्वानुमान नहीं');
  });

  it('states what it is not claiming, in each language', () => {
    expect(page('en')).toContain('does not assign responsibility to any individual');
    expect(page('hi')).toContain('किसी व्यक्ति को ज़िम्मेदार नहीं ठहराता');
  });

  it('names no individual beyond the verifier of record', () => {
    for (const html of [page('en'), page('hi')]) {
      expect(html).not.toMatch(/Minister\b|Secretary|Chairman/);
      expect(html).toContain('Ministry of Finance');
    }
  });

  it('makes no external requests, so it opens on a bad connection', () => {
    for (const html of [page('en'), page('hi')]) {
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/https?:\/\/(?!pib\.gov\.in|cea\.nic\.in)/);
      expect(html).not.toMatch(/@import|fonts\.googleapis/);
    }
  });

  it('escapes record text rather than trusting it', () => {
    const target = nuclearTarget();
    const hostile = { ...target, title: '<script>alert(1)</script>' };
    const html = renderTargetPage(hostile, computeGap(target, capacity('8.18')), 'en');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('cannot be built from an unverified figure', () => {
    const target = nuclearTarget();
    const unverified = series(nuclearMeasure, [
      { asOf: isoDate('2025-12-31'), value: attest(quantity('8.18', 'GW'), ceaSource) },
    ]);
    expect(() => renderTargetPage(target, computeGap(target, unverified), 'en')).toThrow(
      /no verified observation/,
    );
  });
});
