#!/usr/bin/env node --experimental-strip-types
/**
 * Builds the SQLite query cache from the JSON records.
 *
 * The database is derived and disposable. It is deleted and rebuilt from
 * `data/` on every run, it is gitignored, and nothing writes to it except this
 * script — so there is no path by which a query cache becomes the thing of
 * record. If it disagrees with the JSON, the JSON is right.
 *
 * The `published` view enforces the render rule one more time at the query
 * layer: it excludes anything not verified, so a downstream consumer that
 * forgets the guard still cannot select an unverified figure.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import { currentRevision } from '../src/kernel/target.ts';
import { Store } from '../src/store/store.ts';

const OUT_DIR = 'build';
const OUT = `${OUT_DIR}/antar.sqlite`;

const store = new Store('data');
const targets = await store.loadAllTargets();

rmSync(OUT, { force: true });
mkdirSync(OUT_DIR, { recursive: true });
const db = new DatabaseSync(OUT);

db.exec(`
  CREATE TABLE target (
    id                 TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    measure            TEXT NOT NULL,
    unit               TEXT NOT NULL,
    source_series      TEXT NOT NULL,
    vintage            TEXT NOT NULL,
    class              TEXT NOT NULL CHECK (class IN ('PROMISE','BENCHMARK','FLOOR')),
    class_by           TEXT NOT NULL,
    class_rationale    TEXT NOT NULL,
    indicator_type     TEXT NOT NULL CHECK (indicator_type IN ('input','execution','output','outcome')),
    indicator_by       TEXT NOT NULL
  ) STRICT;

  CREATE TABLE revision (
    target_id     TEXT NOT NULL REFERENCES target(id),
    seq           INTEGER NOT NULL,
    supersedes    INTEGER,
    digits        TEXT NOT NULL,
    scale         INTEGER NOT NULL,
    unit          TEXT NOT NULL,
    due_by        INTEGER NOT NULL,
    announced_by  TEXT NOT NULL,
    announced_on  TEXT NOT NULL,
    source_url    TEXT NOT NULL,
    retrieved_on  TEXT NOT NULL,
    state         TEXT NOT NULL CHECK (state IN ('unverified','verified','rejected')),
    verified_by   TEXT,
    verified_on   TEXT,
    recorded_by   TEXT NOT NULL,
    recorded_on   TEXT NOT NULL,
    note          TEXT NOT NULL,
    PRIMARY KEY (target_id, seq)
  ) STRICT;

  -- The only view a renderer should read from.
  CREATE VIEW published AS
    SELECT t.id, t.title, t.measure, t.class, t.indicator_type,
           r.digits, r.scale, r.unit, r.due_by, r.announced_by,
           r.source_url, r.retrieved_on, r.verified_by, r.verified_on
    FROM target t
    JOIN revision r ON r.target_id = t.id
    WHERE r.state = 'verified'
      AND r.seq = (SELECT MAX(seq) FROM revision WHERE target_id = t.id);
`);

const insertTarget = db.prepare(
  `INSERT INTO target VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
);
const insertRevision = db.prepare(
  `INSERT INTO revision VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);

for (const target of targets) {
  insertTarget.run(
    target.id, target.title, target.measure.measure, target.measure.unit,
    target.measure.sourceSeries, target.measure.vintage,
    target.classification.value, target.classification.decidedBy, target.classification.rationale,
    target.indicatorType.value, target.indicatorType.decidedBy,
  );
  for (const r of target.revisions) {
    const v = r.value.verification;
    insertRevision.run(
      target.id, r.seq, r.supersedes ?? null,
      r.value.value.digits.toString(), r.value.value.scale, r.value.value.unit,
      r.dueBy, r.announcedBy, r.announcedOn,
      r.value.provenance.sourceUrl, r.value.provenance.retrievedOn,
      v.state,
      v.state === 'verified' ? v.verifiedBy : null,
      v.state === 'verified' ? v.verifiedOn : null,
      r.recordedBy, r.recordedOn, r.note,
    );
  }
}

const published = db.prepare('SELECT COUNT(*) AS n FROM published').get() as { n: number };
db.close();

console.log(
  `Built ${OUT}: ${targets.length} target(s), ${published.n} publishable.\n` +
    'Derived cache. Rebuilt from data/ on every run; never a source of truth.',
);
