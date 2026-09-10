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
const schemaVersion = (db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined)?.value;
const dataVersion = (db.prepare("SELECT value FROM meta WHERE key = 'data_version'").get() as { value: string } | undefined)?.value;
const hasMediaTable = scalar("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'species_media'");
const birdOrders = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE class_name='Aves' AND taxon_rank='order'");
const linkedBirdOrderDescriptions = scalar(`SELECT COUNT(*) AS n FROM (
  SELECT DISTINCT species.orden
  FROM species
  JOIN taxon_content content
    ON content.class_name = species.clase
   AND content.taxon_rank = 'order'
   AND content.taxon_name = species.orden
   AND content.language = 'es-UY'
  WHERE species.clase = 'Aves' AND TRIM(content.description) <> ''
)`);
const reptileOrders = scalar("SELECT COUNT(DISTINCT orden) AS n FROM species WHERE clase='Reptilia' AND orden<>''");
const reptilesWithoutOrder = scalar("SELECT COUNT(*) AS n FROM species WHERE clase='Reptilia' AND orden=''");
const linkedReptileOrderDescriptions = scalar(`SELECT COUNT(*) AS n FROM (
  SELECT DISTINCT species.orden FROM species JOIN taxon_content content
    ON content.class_name=species.clase AND content.taxon_rank='order'
   AND content.taxon_name=species.orden AND content.language='es-UY'
  WHERE species.clase='Reptilia' AND TRIM(content.description)<>''
)`);
const linkedMammalOrderDescriptions = scalar(`SELECT COUNT(*) AS n FROM (
  SELECT DISTINCT species.orden FROM species JOIN taxon_content content
    ON content.class_name=species.clase AND content.taxon_rank='order'
   AND content.taxon_name=species.orden AND content.language='es-UY'
  WHERE species.clase='Mammalia' AND TRIM(content.description)<>''
)`);
const triviaQuestions = scalar('SELECT COUNT(*) AS n FROM trivia_questions');

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
  schemaVersion !== '8' && `schema_version=${schemaVersion ?? 'missing'}, expected 8`,
  dataVersion !== '1' && `data_version=${dataVersion ?? 'missing'}, expected 1`,
  birdOrders !== 27 && `bird order descriptions=${birdOrders}, expected 27`,
  linkedBirdOrderDescriptions !== 27 && `bird order descriptions linked to catalogue=${linkedBirdOrderDescriptions}, expected 27`,
  reptileOrders !== 3 && `reptile orders=${reptileOrders}, expected 3`,
  reptilesWithoutOrder !== 0 && `reptiles without order=${reptilesWithoutOrder}, expected 0`,
  linkedReptileOrderDescriptions !== 3 && `reptile order descriptions linked=${linkedReptileOrderDescriptions}, expected 3`,
  linkedMammalOrderDescriptions !== 9 && `mammal order descriptions linked=${linkedMammalOrderDescriptions}, expected 9`,
  triviaQuestions < 10 && `trivia questions=${triviaQuestions}, expected at least 10`,
  hasMediaTable !== 1 && 'species_media table missing',
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
