#!/usr/bin/env node
/**
 * Fails the build on casts that would launder an unverified value past the type
 * system.
 *
 * The kernel's guarantees rest on branded types, and every branded type has
 * exactly one escape hatch: `as`. That is fine inside a constructor that has
 * just validated the value, and it is a hole everywhere else. This makes the
 * hole visible instead of trusting review to catch it.
 *
 * To use one deliberately, say why on the line above:
 *
 *   // antar-allow-cast: validated against TARGET_CLASSES immediately above
 *   const cls = raw as TargetClass;
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOTS = ['src', 'scripts'];
// antar-allow-cast: this is the detector's own pattern, not a cast
const PATTERN = /\bas any\b|as unknown as|@ts-ignore|@ts-nocheck/;
const ALLOW = /antar-allow-cast:/;

/** brand.ts is where branding is defined; its cast is the sanctioned one. */
const EXEMPT = new Set(['src/kernel/brand.ts']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|mts|mjs)$/.test(entry.name)) yield path;
  }
}

const findings = [];
for (const root of ROOTS) {
  for await (const file of walk(root)) {
    if (EXEMPT.has(file)) continue;
    const lines = (await readFile(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (!PATTERN.test(line)) return;
      const previous = lines[i - 1] ?? '';
      if (ALLOW.test(previous) || ALLOW.test(line)) return;
      findings.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
}

if (findings.length > 0) {
  console.error('Unsafe casts can bypass the kernel guarantees:\n');
  for (const f of findings) console.error(`  ${f}`);
  console.error(
    '\nEither remove the cast, or justify it with a "// antar-allow-cast: <reason>" comment above it.',
  );
  process.exit(1);
}
console.log('No unsafe casts.');
