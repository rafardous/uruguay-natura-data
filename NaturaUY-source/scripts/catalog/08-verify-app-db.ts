/** Stage 08 — exercise the generated asset with the app's real query shapes. */
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { PATHS, readJson } from './lib';

const dbPath = process.env.NATURA_CATALOG_DB_PATH ?? resolve(PATHS.catalog, '../../assets/db/natura.db');
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
const invalidPhotoLicenses = scalar("SELECT COUNT(*) AS n FROM species WHERE image_url IS NOT NULL AND image_license NOT IN ('CC0','CC-BY-4.0','permission')");
const unknownOrigin = scalar('SELECT COUNT(*) AS n FROM species WHERE origin IS NULL');
const schemaVersion = (db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined)?.value;
const dataVersion = (db.prepare("SELECT value FROM meta WHERE key = 'data_version'").get() as { value: string } | undefined)?.value;
const hasMediaTable = scalar("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'species_media'");
const hasAudioExternalId = scalar("SELECT COUNT(*) AS n FROM pragma_table_info('species_media') WHERE name = 'external_id'");
const hasAudioOriginalLicense = scalar("SELECT COUNT(*) AS n FROM pragma_table_info('species_media') WHERE name = 'original_license'");
const invalidAudioDurations = scalar("SELECT COUNT(*) AS n FROM species_media WHERE media_type='audio' AND (duration_seconds IS NULL OR duration_seconds <= 0 OR duration_seconds > 15)");
const duplicateAudioExternalIds = scalar("SELECT COUNT(*) AS n FROM (SELECT external_id FROM species_media WHERE media_type='audio' AND external_id IS NOT NULL GROUP BY external_id HAVING COUNT(*) > 1)");
const hasTraitsColumn = scalar("SELECT COUNT(*) AS n FROM pragma_table_info('species') WHERE name = 'traits'");
const hasTaxonIdentifiersColumn = scalar("SELECT COUNT(*) AS n FROM pragma_table_info('species') WHERE name = 'taxon_identifiers'");
const hasNaturalHistoryColumn = scalar("SELECT COUNT(*) AS n FROM pragma_table_info('species') WHERE name = 'natural_history'");
const hasDistributionSummaryColumn = scalar("SELECT COUNT(*) AS n FROM pragma_table_info('species') WHERE name = 'distribution_summary'");
const invalidTraits = scalar("SELECT COUNT(*) AS n FROM species WHERE json_valid(traits) = 0 OR json_type(traits) <> 'object'");
const invalidSchema11Objects = scalar("SELECT COUNT(*) AS n FROM species WHERE json_valid(taxon_identifiers) = 0 OR json_type(taxon_identifiers) <> 'object' OR json_valid(natural_history) = 0 OR json_type(natural_history) <> 'object' OR json_valid(distribution_summary) = 0 OR json_type(distribution_summary) <> 'object'");
const missingPrimarySearchNames = scalar(`SELECT COUNT(*) AS n FROM species
  WHERE NOT EXISTS (
    SELECT 1 FROM json_each(species.common_names)
    WHERE LOWER(TRIM(json_each.value)) = LOWER(TRIM(species.common_name))
  )`);
const duplicateCommonNames = scalar(`SELECT COUNT(*) AS n FROM species
  WHERE json_array_length(common_names) > (
    SELECT COUNT(DISTINCT lower(replace(replace(replace(trim(json_each.value),char(173),''),char(8203),''),char(65279),'')))
    FROM json_each(species.common_names)
  )`);
const redistributedFishBase = scalar(`SELECT COUNT(*) AS n FROM species
  WHERE EXISTS (SELECT 1 FROM json_each(species.sources) WHERE lower(json_extract(json_each.value,'$.source'))='fishbase')
     OR EXISTS (SELECT 1 FROM json_each(json_extract(species.traits,'$.sources')) WHERE lower(json_each.value)='fishbase')`);
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
const catalogSources = scalar('SELECT COUNT(*) AS n FROM catalog_sources');
const featuredFacts = scalar("SELECT COUNT(*) AS n FROM species_facts WHERE id LIKE 'featured-%' AND source_code IS NOT NULL");
const simpleTaxa = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE simple_name IS NOT NULL AND TRIM(simple_name) <> ''");
const simpleChordata = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE taxon_rank='phylum' AND taxon_name='Chordata' AND simple_name='Vertebrados'");
const simpleMammalia = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE taxon_rank='class' AND taxon_name='Mammalia' AND simple_name='Mamíferos'");
const simpleArthropoda = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE taxon_rank='phylum' AND taxon_name='Arthropoda' AND simple_name='Artrópodos'");
const taxaNodes = scalar("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='taxa'");
const speciesTaxaTable = scalar("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='species_taxa'");
const arthropodSubphyla = scalar("SELECT COUNT(*) AS n FROM taxa WHERE rank='subphylum' AND canonical_name IN ('Chelicerata','Hexapoda','Crustacea')");
const arthropodSubphylumContent = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE taxon_rank='subphylum' AND taxon_name IN ('Chelicerata','Hexapoda','Crustacea') AND simple_name IS NOT NULL AND TRIM(description) <> ''");
const linkedTaxa = scalar('SELECT COUNT(*) AS n FROM species_taxa');
const arthropodClasses = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE taxon_rank='class' AND taxon_name IN ('Arachnida','Insecta','Malacostraca') AND simple_name IS NOT NULL");
const arthropodOrderDescriptions = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE class_name IN ('Arachnida','Insecta','Malacostraca') AND taxon_rank='order' AND TRIM(description) <> ''");
const incompleteArthropodCardContent = scalar(`SELECT COUNT(*) AS n FROM taxon_content WHERE (
  (taxon_rank='phylum' AND taxon_name='Arthropoda')
  OR (taxon_rank='subphylum' AND taxon_name IN ('Chelicerata','Hexapoda','Crustacea'))
  OR (taxon_rank='class' AND taxon_name IN ('Arachnida','Insecta','Malacostraca'))
  OR (taxon_rank='order' AND class_name IN ('Arachnida','Insecta','Malacostraca'))
  ) AND (simple_name IS NULL OR TRIM(simple_name)='' OR LENGTH(TRIM(description)) < 100)`);
const redundantBirdSimpleName = scalar("SELECT COUNT(*) AS n FROM taxon_content WHERE class_name IN ('Aves','Actinopterygii','Chondrichthyes') AND taxon_rank='class' AND simple_name IS NOT NULL");

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
  schemaVersion !== '11' && `schema_version=${schemaVersion ?? 'missing'}, expected 11`,
  dataVersion !== '1' && `data_version=${dataVersion ?? 'missing'}, expected 1`,
  birdOrders !== 27 && `bird order descriptions=${birdOrders}, expected 27`,
  linkedBirdOrderDescriptions !== 27 && `bird order descriptions linked to catalogue=${linkedBirdOrderDescriptions}, expected 27`,
  reptileOrders !== 3 && `reptile orders=${reptileOrders}, expected 3`,
  reptilesWithoutOrder !== 0 && `reptiles without order=${reptilesWithoutOrder}, expected 0`,
  linkedReptileOrderDescriptions !== 3 && `reptile order descriptions linked=${linkedReptileOrderDescriptions}, expected 3`,
  linkedMammalOrderDescriptions !== 9 && `mammal order descriptions linked=${linkedMammalOrderDescriptions}, expected 9`,
  triviaQuestions < 10 && `trivia questions=${triviaQuestions}, expected at least 10`,
  catalogSources < 10 && `catalog sources=${catalogSources}, expected at least 10`,
  featuredFacts !== 8 && `featured facts=${featuredFacts}, expected 8`,
  simpleTaxa < 10 && `taxa with simple names=${simpleTaxa}, expected at least 10`,
  simpleChordata !== 1 && 'Chordata simple name missing',
  simpleMammalia !== 1 && 'Mammalia simple name missing',
  simpleArthropoda !== 1 && 'Arthropoda simple name missing',
  taxaNodes !== 1 && 'taxa table missing',
  speciesTaxaTable !== 1 && 'species_taxa table missing',
  arthropodSubphyla !== 3 && `arthropod subphyla=${arthropodSubphyla}, expected 3`,
  arthropodSubphylumContent !== 3 && `arthropod subphylum content=${arthropodSubphylumContent}, expected 3`,
  linkedTaxa < species && `species taxon links=${linkedTaxa}, expected at least ${species}`,
  arthropodClasses !== 3 && `arthropod class descriptions=${arthropodClasses}, expected 3`,
  arthropodOrderDescriptions < 3 && `arthropod order descriptions=${arthropodOrderDescriptions}, expected at least 3`,
  incompleteArthropodCardContent > 0 && `arthropod cards missing a simple name or substantial description=${incompleteArthropodCardContent}`,
  redundantBirdSimpleName > 0 && 'redundant simple names were added for birds or fish classes',
  hasMediaTable !== 1 && 'species_media table missing',
  hasAudioExternalId !== 1 && 'species_media.external_id column missing',
  hasAudioOriginalLicense !== 1 && 'species_media.original_license column missing',
  invalidAudioDurations > 0 && `audio clips outside the 15 second contract=${invalidAudioDurations}`,
  duplicateAudioExternalIds > 0 && `duplicate audio external IDs=${duplicateAudioExternalIds}`,
  hasTraitsColumn !== 1 && 'species.traits column missing',
  hasTaxonIdentifiersColumn !== 1 && 'species.taxon_identifiers column missing',
  hasNaturalHistoryColumn !== 1 && 'species.natural_history column missing',
  hasDistributionSummaryColumn !== 1 && 'species.distribution_summary column missing',
  invalidTraits > 0 && `invalid structured traits=${invalidTraits}`,
  invalidSchema11Objects > 0 && `invalid schema 11 JSON objects=${invalidSchema11Objects}`,
  missingPrimarySearchNames > 0 && `species whose primary name is absent from common_names=${missingPrimarySearchNames}`,
  duplicateCommonNames > 0 && `species with duplicate common names=${duplicateCommonNames}`,
  redistributedFishBase > 0 && `FishBase data leaked into the offline catalog=${redistributedFishBase}`,
  species !== catalogIds.size && `species=${species}, expected unique catalog ids=${catalogIds.size}`,
  fts !== species && `fts=${fts}, species=${species}`,
  duplicateCodes > 0 && `duplicate codigo values=${duplicateCodes}`,
  missingRequired > 0 && `rows missing required app fields=${missingRequired}`,
  invalidPhotoLicenses > 0 && `published images with unacceptable license=${invalidPhotoLicenses}`,
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
console.log(`  integrity, schema 11 sources/taxonomy/facts, traits, arthropod history, common names, FTS, paging, filters and quiz queries passed`);
