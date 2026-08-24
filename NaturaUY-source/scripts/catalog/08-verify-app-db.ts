/** Stage 08 — exercise the generated asset with the app's real query shapes. */
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { PATHS, readJson } from './lib';

const dbPath = resolve(PATHS.catalog, '../../assets/db/natura.db');
if (!existsSync(dbPath)) throw new Error('assets/db/natura.db does not exist — run data:catalog-db');

const catalogIds = new Set(
  readdirSync(PATHS.catalog)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => readJson<Array<{ id: string }>>(resolve(PATHS.catalog, file)))
    .map((item) => item.id),
);

const db = new DatabaseSync(dbPath, { readOnly: true });
const scalar = (sql: string): number => (db.prepare(sql).get() as { n: number }).n;
const integrity = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
const species = scalar('SELECT COUNT(*) AS n FROM species');
const fts = scalar('SELECT COUNT(*) AS n FROM species_fts');
const duplicateCodes = scalar('SELECT COUNT(*) AS n FROM (SELECT codigo FROM species GROUP BY codigo HAVING COUNT(*) > 1)');
const missingRequired = scalar(`SELECT COUNT(*) AS n FROM species
  WHERE scientific_name = '' OR common_name = '' OR common_names = '' OR phylum = '' OR clase = ''`);
const photos = scalar('SELECT COUNT(*) AS n FROM species WHERE image_url IS NOT NULL');
const unknownOrigin = scalar('SELECT COUNT(*) AS n FROM species WHERE origin IS NULL');

// Same joins/filters/order used by speciesRepository.findPaged.
const searchProbe = db.prepare(`SELECT species.codigo FROM species
  JOIN species_fts ON species_fts.rowid = species.rowid
  WHERE species_fts MATCH ? AND species.image_url IS NOT NULL
  ORDER BY species.common_name COLLATE NOCASE LIMIT ? OFFSET ?`).all('"a"*', 11, 0);
const taxaProbe = db.prepare(`SELECT familia AS value, COUNT(*) AS count FROM species
  WHERE familia <> '' GROUP BY familia ORDER BY count DESC, value ASC LIMIT 5`).all();
const quizProbe = db.prepare('SELECT * FROM species WHERE image_url IS NOT NULL LIMIT 10').all();
const hierarchyProbe = db.prepare(`SELECT phylum, clase, orden, familia, genero, COUNT(*) AS count
  FROM species GROUP BY phylum, clase, orden, familia, genero LIMIT 10`).all();
const missingOrder = scalar("SELECT COUNT(*) AS n FROM species WHERE orden = ''");
const unassignedOrderBranch = db.prepare(`SELECT
  CASE WHEN orden = '' THEN '__unassigned__' ELSE orden END AS value, COUNT(*) AS count
  FROM species WHERE orden = '' GROUP BY orden`).get() as { value: string; count: number } | undefined;

const failures = [
  integrity !== 'ok' && `integrity_check=${integrity}`,
  species !== catalogIds.size && `species=${species}, expected unique catalog ids=${catalogIds.size}`,
  fts !== species && `fts=${fts}, species=${species}`,
  duplicateCodes > 0 && `duplicate codigo values=${duplicateCodes}`,
  missingRequired > 0 && `rows missing required app fields=${missingRequired}`,
  photos > 0 && quizProbe.length === 0 && 'quiz query returned no rows',
  photos > 0 && searchProbe.length === 0 && 'FTS/photo query returned no rows',
  taxaProbe.length === 0 && 'taxon aggregation returned no rows',
  hierarchyProbe.length === 0 && 'taxonomy hierarchy returned no rows',
  missingOrder > 0 && (!unassignedOrderBranch || unassignedOrderBranch.value !== '__unassigned__' || unassignedOrderBranch.count !== missingOrder) &&
    'unassigned taxonomy branch does not preserve every species without order',
].filter(Boolean);

db.close();
if (failures.length > 0) throw new Error(`app database verification failed:\n- ${failures.join('\n- ')}`);

console.log(`08-verify-app-db: OK — ${species} species, ${photos} photos, ${unknownOrigin} without established origin`);
console.log(`  integrity, unique IDs, FTS, paging, filters, taxonomy hierarchy and quiz queries passed`);
