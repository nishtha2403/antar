import { describe, expect, it } from 'vitest';
import { computeGap } from '../src/kernel/gap.ts';
import { quantity } from '../src/kernel/quantity.ts';
import { series } from '../src/kernel/series.ts';
import { reviseTarget } from '../src/kernel/target.ts';
import { isoDate, targetYear } from '../src/kernel/time.ts';
import { attest, verify } from '../src/kernel/verification.ts';
import { renderTargetPage } from '../src/render/page.ts';
import { ceaSource, FOUNDER, nuclearMeasure, nuclearTarget, pibSource } from './fixtures.ts';

const capacity = (value: string, asOf = '2025-12-31') =>
  series(nuclearMeasure, [
    {
      asOf: isoDate(asOf),
      value: verify(attest(quantity(value, 'GW'), ceaSource), FOUNDER, asOf, 'Row checked against the CEA report.'),
    },
  ]);

const page = (target = nuclearTarget(), s = capacity('8.18')) =>
  renderTargetPage(target, computeGap(target, s));

describe('the citizen page', () => {
  it('renders the figures and the gap', () => {
    const html = page();
    expect(html).toContain('100 GW');
    expect(html).toContain('8.18 GW');
    expect(html).toContain('91.82 GW');
    expect(html).toContain('8.18 %');
  });

  it('carries a citation and a verifier for every figure it shows', () => {
    const html = page();
    expect(html).toContain('Press Information Bureau');
    expect(html).toContain('Central Electricity Authority');
    expect(html).toContain('Verified by n.sharma');
    expect(html).toContain('pib.gov.in');
  });

  it('labels the required rate as division rather than a forecast', () => {
    expect(page()).toContain('This is division, not a forecast');
  });

  it('states what it is not claiming', () => {
    const html = page();
    expect(html).toContain('does not assign responsibility to any individual');
    expect(html).toContain('no claim about why the gap exists');
  });

  it('names no individual beyond the verifier of record', () => {
    const html = page();
    // The only person on the page is the verifier. No minister, no official.
    expect(html).not.toMatch(/Minister|Secretary|Chairman/);
    expect(html).toContain('Ministry of Finance'); // an institution, from the record
  });

  it('shows revision history on the page rather than behind a link', () => {
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
    const html = page(revised, capacity('8.18'));
    expect(html).toContain('This target has been revised');
    expect(html).toContain('Deadline moved from 2047 to 2052');
    expect(html).toContain('was not overwritten');
  });

  it('defaults to Hindi', () => {
    expect(page()).toContain('<html lang="hi">');
    expect(page()).toContain('लक्ष्य');
  });

  it('makes no external requests, so it opens on a bad connection', () => {
    const html = page();
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\/(?!pib\.gov\.in|cea\.nic\.in)/);
    expect(html).not.toMatch(/@import|fonts\.googleapis/);
  });

  it('escapes record text rather than trusting it', () => {
    const target = nuclearTarget();
    const hostile = { ...target, title: '<script>alert(1)</script>' };
    const html = renderTargetPage(hostile, computeGap(target, capacity('8.18')));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('cannot be built from an unverified figure', () => {
    const target = nuclearTarget();
    const unverified = series(nuclearMeasure, [
      { asOf: isoDate('2025-12-31'), value: attest(quantity('8.18', 'GW'), ceaSource) },
    ]);
    expect(() => renderTargetPage(target, computeGap(target, unverified))).toThrow(
      /no verified observation/,
    );
  });
});
