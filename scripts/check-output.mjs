#!/usr/bin/env node
/**
 * Checks the built site, not the source.
 *
 * Some guarantees live in templates rather than in typed code — that a page
 * names no individual beyond its verifier, that every figure ships with a
 * citation, that a locale's page does not leak the other's copy. A unit test on
 * a view model cannot see those. This reads what is actually going to be served.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';
const failures = [];
const fail = (file, message) => failures.push(`${file}: ${message}`);

async function* html(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* html(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

const pages = [];
for await (const file of html(DIST)) pages.push(file);
if (pages.length === 0) fail(DIST, 'no pages were built at all');

for (const file of pages) {
  const page = await readFile(file, 'utf8');
  const hindi = file.includes(`${DIST}/hi/`);

  // No individual is named beyond the verifier of record.
  if (/\b(Minister|Secretary|Chairman|Chairperson)\b/.test(page)) {
    fail(file, 'names an office-holder — only institutions and the verifier may appear');
  }
  // A locale must not leak the other's interface copy. The real guarantee
  // against unverified figures is enforced in the view layer, which throws;
  // what a built page can still get wrong is showing the wrong language.
  if (hindi) {
    for (const english of ['Where these figures come from', 'What this page does not say',
                           'Who is expected to build it', 'What the government says']) {
      if (page.includes(english)) fail(file, `Hindi page carries English interface copy: "${english}"`);
    }
  } else {
    for (const hindiCopy of ['ये आँकड़े कहाँ से आए', 'यह पृष्ठ क्या नहीं कहता']) {
      if (page.includes(hindiCopy)) fail(file, 'English page carries Hindi interface copy');
    }
  }
  // Every page declares its language and its alternate.
  if (!page.includes(`<html lang="${hindi ? 'hi' : 'en'}"`)) fail(file, 'wrong or missing lang attribute');
  if (!page.includes('hreflang="hi"') || !page.includes('hreflang="en"')) {
    fail(file, 'missing an hreflang alternate');
  }
  // No external requests beyond the font host and cited sources.
  const hosts = [...page.matchAll(/https?:\/\/([^/"')\s]+)/g)].map((m) => m[1]);
  const allowed = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|github\.com|nishtha2403\.github\.io|cea\.nic\.in|www\.pib\.gov\.in|pib\.gov\.in)$/;
  for (const host of new Set(hosts)) {
    if (!allowed.test(host)) fail(file, `unexpected external host: ${host}`);
  }
  // Two scripts are expected: search and the filter chips. Both are
  // progressive — every page is readable and complete without them.
  const scripts = (page.match(/<script/gi) ?? []).length;
  const expected = (page.includes('pagefind') ? 1 : 0) + (page.includes('data-filters') ? 1 : 0);
  if (scripts > expected) fail(file, `${scripts} script tags, expected at most ${expected}`);
}

// An indicator page must carry its citations.
const indicator = pages.find((p) => p.includes('nem-2047-100gw'));
if (!indicator) fail(DIST, 'the nuclear indicator page was not built');
else {
  const page = await readFile(indicator, 'utf8');
  for (const needle of ['Central Electricity Authority', 'Verified by Nishtha Sharma', 'cea.nic.in']) {
    if (!page.includes(needle)) fail(indicator, `missing citation detail: ${needle}`);
  }
}

if (failures.length > 0) {
  console.error(`Built output failed ${failures.length} check(s):\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`Built output passes all checks across ${pages.length} pages.`);
