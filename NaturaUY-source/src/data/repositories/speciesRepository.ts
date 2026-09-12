import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { KnowledgeLevel, Species } from '../../domain/entities/species';
import { rowToSpecies } from '../mappers/speciesMapper';
import type { SpeciesFactRow, SpeciesGameRuleRow, SpeciesMediaRow, SpeciesObservabilityRow, SpeciesRow } from '../db/schema';

export const TAXON_RANKS = ['phylum', 'clase', 'orden', 'familia', 'genero'] as const;
export type TaxonRank = (typeof TAXON_RANKS)[number];
export type TaxonomyPath = Partial<Record<TaxonRank, string>>;
export const UNASSIGNED_TAXON = '__unassigned__';
export interface TaxonOption { value:string; count:number; description:string|null; simpleName:string|null; representativeImageUrl:string|null; representativeName:string|null }

function databaseRank(rank: TaxonRank): string {
  return rank === 'orden' ? 'order' : rank === 'familia' ? 'family' : rank === 'clase' ? 'class' : rank === 'genero' ? 'genus' : rank;
}

export interface SpeciesFilters {
  /** Free text, matched against vernacular names, binomial, family and genus. */
  search?: string;
  /** Several ranks at once, used by the hierarchical taxonomy browser. */
  taxonomy?: TaxonomyPath;
  onlyNative?: boolean;
  /** Conservation rank >= 2 (priority or threatened). */
  onlyPriority?: boolean;
  /** Exact conservation rank, used by curated home highlights. */
  conservationRank?: number;
  onlyWithPhoto?: boolean;
  onlyWithRelevantNote?: boolean;
  classes?: string[];
  habitats?: string[];
  diets?: string[];
  seasonalities?: string[];
}

export interface Page<T> {
  items: T[];
  /** Whether another page exists after this one. */
  hasMore: boolean;
}

/**
 * FTS5 treats punctuation as syntax, so raw user input can throw. Tokens are
 * reduced to word characters and turned into prefix queries, which is what
 * makes search feel responsive while typing.
 */
function foldSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizedColumn(column: string): string {
  let expression = `LOWER(COALESCE(species.${column}, ''))`;
  for (const [from, to] of [['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u'], ['ü', 'u'], ['ñ', 'n']] as const) {
    expression = `REPLACE(${expression}, '${from}', '${to}')`;
  }
  return expression;
}

function toFtsQuery(search: string): string | null {
  const tokens = search
    .toLocaleLowerCase('es-UY')
    .split(/[^\p{L}\p{N}]+/u)
    .map(foldSearch)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

interface BuiltQuery {
  where: string;
  joins: string;
  params: (string | number)[];
}

function buildQuery(filters: SpeciesFilters): BuiltQuery {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  let joins = '';

  const fts = filters.search ? toFtsQuery(filters.search) : null;
  if (fts && Platform.OS !== 'web') {
    joins = 'JOIN species_fts ON species_fts.rowid = species.rowid';
    clauses.push('species_fts MATCH ?');
    params.push(fts);
  } else if (fts) {
    // The SQLite WASM runtime used by Expo on web is not compiled with FTS5.
    // Keep browser search functional with a tokenized, parameterized fallback.
    const tokens = filters.search!
      .toLocaleLowerCase('es-UY')
      .split(/[^\p{L}\p{N}]+/u)
      .map(foldSearch)
      .filter((token) => token.length > 0);
    for (const token of tokens) {
      clauses.push(`(
        ${normalizedColumn('common_name')} LIKE ? OR
        ${normalizedColumn('scientific_name')} LIKE ? OR
        ${normalizedColumn('familia')} LIKE ? OR
        ${normalizedColumn('genero')} LIKE ?
      )`);
      params.push(...Array<string>(4).fill(`%${token}%`));
    }
  }

  for (const rank of TAXON_RANKS) {
    const value = filters.taxonomy?.[rank];
    if (value !== undefined) {
      clauses.push(`species.${rank} = ?`);
      params.push(value === UNASSIGNED_TAXON ? '' : value);
    }
  }
  if (filters.onlyNative) clauses.push('species.nativa = 1');
  if (filters.onlyPriority) clauses.push('species.conservation_rank >= 2');
  if (filters.conservationRank !== undefined) {
    clauses.push('species.conservation_rank = ?');
    params.push(filters.conservationRank);
  }
  if (filters.onlyWithPhoto) clauses.push('species.image_url IS NOT NULL');
  if (filters.onlyWithRelevantNote) clauses.push("species.relevant_note IS NOT NULL AND TRIM(species.relevant_note) <> ''");

  const addIn = (column: string, values?: string[]): void => {
    if (!values?.length) return;
    clauses.push(`species.${column} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  };
  addIn('clase', filters.classes);
  addIn('seasonality', filters.seasonalities);

  const addJsonAny = (column: 'habitat' | 'diet', values?: string[]): void => {
    if (!values?.length) return;
    clauses.push(`json_valid(species.${column}) AND EXISTS (
      SELECT 1 FROM json_each(species.${column}) WHERE json_each.value IN (${values.map(() => '?').join(',')})
    )`);
    params.push(...values);
  };
  addJsonAny('habitat', filters.habitats);
  addJsonAny('diet', filters.diets);

  return {
    joins,
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

/**
 * The only entry point to the catalogue. Discover, Favourites and search all
 * funnel through `findPaged`, so paging and filtering behave identically
 * everywhere.
 */
export const speciesRepository = {
  async findPaged(
    db: SQLiteDatabase,
    filters: SpeciesFilters,
    limit: number,
    offset: number,
  ): Promise<Page<Species>> {
    const { where, joins, params } = buildQuery(filters);

    // Fetch one extra row to learn whether another page exists, which avoids a
    // second COUNT query on every scroll.
    const rows = await db.getAllAsync<SpeciesRow>(
      `SELECT species.* FROM species ${joins} ${where}
       ORDER BY species.common_name COLLATE NOCASE ASC
       LIMIT ? OFFSET ?`,
      [...params, limit + 1, offset],
    );

    const hasMore = rows.length > limit;
    return { items: rows.slice(0, limit).map((row) => rowToSpecies(row)), hasMore };
  },

  async count(db: SQLiteDatabase, filters: SpeciesFilters): Promise<number> {
    const { where, joins, params } = buildQuery(filters);
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM species ${joins} ${where}`,
      params,
    );
    return row?.n ?? 0;
  },

  async findByCodigo(db: SQLiteDatabase, codigo: string): Promise<Species | null> {
    const row = await db.getFirstAsync<SpeciesRow>('SELECT * FROM species WHERE codigo = ?', [codigo]);
    if (!row) return null;
    try {
      const stableId = row.stable_id ?? '';
      const [media, facts, observability, rules] = await Promise.all([
        db.getAllAsync<SpeciesMediaRow>('SELECT * FROM species_media WHERE stable_id = ? ORDER BY media_type, ordinal', [stableId]),
        db.getAllAsync<SpeciesFactRow>('SELECT * FROM species_facts WHERE stable_id = ? ORDER BY sort_order, id', [stableId]),
        db.getFirstAsync<SpeciesObservabilityRow>('SELECT * FROM species_observability WHERE stable_id = ?', [stableId]),
        db.getAllAsync<SpeciesGameRuleRow>('SELECT * FROM species_game_rules WHERE stable_id = ? ORDER BY game_key', [stableId]),
      ]);
      return {
        ...rowToSpecies(row, media),
        facts: facts.map((fact) => ({
          id: fact.id,
          body: fact.body,
          sortOrder: fact.sort_order,
          sourceCode: fact.source_code ?? null,
          sourceRecordId: fact.source_record_id ?? null,
        })),
        observability: observability ? {
          methodVersion: observability.method_version, periodStart: observability.period_start, periodEnd: observability.period_end,
          occurrenceCount: observability.occurrence_count, occupiedCells: observability.occupied_cells,
          yearsObserved: observability.years_observed, score: observability.score, band: observability.band,
          comparisonClass: observability.comparison_class,
        } : null,
        gameRules: rules.map((rule) => ({ gameKey: rule.game_key, enabled: rule.enabled === 1, minKnowledgeLevel: rule.min_knowledge_level })),
      };
    } catch {
      // The app can still open a pre-schema-6 bundled catalogue while the
      // validated update is downloaded for the next launch.
      return rowToSpecies(row);
    }
  },

  async findManyByCodigo(db: SQLiteDatabase, codigos: string[]): Promise<Species[]> {
    if (codigos.length === 0) return [];
    const placeholders = codigos.map(() => '?').join(',');
    const rows = await db.getAllAsync<SpeciesRow>(
      `SELECT * FROM species WHERE codigo IN (${placeholders}) ORDER BY common_name COLLATE NOCASE`,
      codigos,
    );
    return rows.map((row) => rowToSpecies(row));
  },

  /** One level of the taxonomic tree, constrained by every selected ancestor. */
  async listTaxonomyChildren(
    db: SQLiteDatabase,
    rank: TaxonRank,
    ancestors: TaxonomyPath,
  ): Promise<TaxonOption[]> {
    const clauses: string[] = [];
    const params: string[] = [];
    for (const ancestorRank of TAXON_RANKS) {
      const value = ancestors[ancestorRank];
      if (value !== undefined) {
        clauses.push(`${ancestorRank} = ?`);
        params.push(value === UNASSIGNED_TAXON ? '' : value);
      }
    }
    const rows = await db.getAllAsync<{ value: string; count: number }>(
      `SELECT CASE WHEN ${rank} = '' THEN '${UNASSIGNED_TAXON}' ELSE ${rank} END AS value,
              COUNT(*) AS count
       FROM species WHERE ${clauses.length > 0 ? clauses.join(' AND ') : '1 = 1'}
       GROUP BY ${rank} ORDER BY ${rank} = '' ASC, value COLLATE NOCASE ASC`,
      params,
    );
    return Promise.all(rows.map(async (row) => {
      let description: string | null = null;
      let simpleName: string | null = null;
      try {
        const content = await db.getFirstAsync<{description:string;simple_name:string|null}>(
          `SELECT description,simple_name FROM taxon_content WHERE taxon_rank=? AND class_name=? AND taxon_name=? AND language='es-UY'`,
          [databaseRank(rank), rank === 'clase' ? row.value : ancestors.clase ?? '', row.value],
        );
        description = content?.description ?? null;
        simpleName = content?.simple_name ?? null;
      } catch {
        try {
          const content = await db.getFirstAsync<{description:string}>(
            `SELECT description FROM taxon_content WHERE taxon_rank=? AND class_name=? AND taxon_name=? AND language='es-UY'`,
            [databaseRank(rank), ancestors.clase ?? '', row.value],
          );
          description = content?.description ?? null;
        } catch { /* A pre-schema-8 catalogue remains readable. */ }
      }
      const imageClauses = [...clauses, `${rank} = ?`, 'image_url IS NOT NULL'];
      const representative = await db.getFirstAsync<{image_url:string;common_name:string}>(
        `SELECT image_url,common_name FROM species WHERE ${imageClauses.join(' AND ')} ORDER BY RANDOM() LIMIT 1`,
        [...params, row.value === UNASSIGNED_TAXON ? '' : row.value],
      );
      return { ...row, description, simpleName, representativeImageUrl: representative?.image_url ?? null, representativeName: representative?.common_name ?? null };
    }));
  },

  async getTaxonContent(
    db: SQLiteDatabase,
    rank: TaxonRank,
    className: string,
    taxonName: string,
  ): Promise<{ description: string; simpleName: string | null } | null> {
    try {
      const row = await db.getFirstAsync<{ description: string; simple_name: string | null }>(
        `SELECT description,simple_name FROM taxon_content
         WHERE taxon_rank=? AND class_name=? AND taxon_name=? AND language='es-UY'`,
        [databaseRank(rank), rank === 'clase' ? taxonName : className, taxonName],
      );
      return row ? { description: row.description, simpleName: row.simple_name } : null;
    } catch {
      try {
        const row = await db.getFirstAsync<{ description: string }>(
          `SELECT description FROM taxon_content WHERE taxon_rank=? AND class_name=? AND taxon_name=? AND language='es-UY'`,
          [databaseRank(rank), className, taxonName],
        );
        return row ? { description: row.description, simpleName: null } : null;
      } catch { return null; }
    }
  },

  /**
   * Quiz pool: only species with a photo, since the question *is* the photo.
   * Loaded once per run so question generation stays synchronous and instant.
   */
  async findQuizPool(db: SQLiteDatabase, classes: string[] = [], knowledgeLevel: KnowledgeLevel = 'hard', gameKey = 'quiz'): Promise<Species[]> {
    const classClause = classes.length > 0 ? `AND clase IN (${classes.map(() => '?').join(',')})` : '';
    const allowed = knowledgeLevel === 'easy' ? ['easy'] : knowledgeLevel === 'medium' ? ['easy', 'medium'] : ['easy', 'medium', 'hard'];
    const rows = await db.getAllAsync<SpeciesRow>(
      `SELECT species.* FROM species
       LEFT JOIN species_game_rules rule ON rule.stable_id=species.stable_id AND rule.game_key=?
       WHERE image_url IS NOT NULL AND COALESCE(rule.enabled,1)=1
         AND COALESCE(rule.min_knowledge_level,species.knowledge_level,'hard') IN (${allowed.map(() => '?').join(',')}) ${classClause}`,
      [gameKey, ...allowed, ...classes],
    );
    return rows.map((row) => rowToSpecies(row));
  },

  /** Rich, offline pool used by Clasificar at class, order and family level. */
  async findClassificationPool(db: SQLiteDatabase, limit = 220): Promise<Species[]> {
    const rows = await db.getAllAsync<SpeciesRow>(
      `SELECT species.* FROM species
       LEFT JOIN species_game_rules rule ON rule.stable_id=species.stable_id AND rule.game_key='classify'
       WHERE image_url IS NOT NULL AND clase <> '' AND orden <> '' AND familia <> ''
         AND COALESCE(rule.enabled, 1)=1
       ORDER BY RANDOM() LIMIT ?`,
      [limit],
    );
    return rows.map((row) => rowToSpecies(row));
  },

  /** Offline pool for ¿Dónde vive?, restricted to species with a photo and habitat data. */
  async findHabitatPool(db: SQLiteDatabase, limit = 300): Promise<Species[]> {
    const rows = await db.getAllAsync<SpeciesRow>(
      `SELECT species.* FROM species
       LEFT JOIN species_game_rules rule ON rule.stable_id=species.stable_id AND rule.game_key='habitat'
       WHERE image_url IS NOT NULL AND json_valid(habitat) AND json_array_length(habitat) > 0
         AND COALESCE(rule.enabled, 1)=1
       ORDER BY RANDOM() LIMIT ?`,
      [limit],
    );
    return rows.map((row) => rowToSpecies(row));
  },

  async listFilterValues(db: SQLiteDatabase, field: 'habitat' | 'diet' | 'seasonality'): Promise<string[]> {
    if (field === 'seasonality') {
      const rows = await db.getAllAsync<{ value: string }>(
        `SELECT DISTINCT seasonality AS value FROM species
         WHERE seasonality IS NOT NULL AND seasonality <> '' ORDER BY value COLLATE NOCASE`,
      );
      return rows.map((row) => row.value);
    }
    const rows = await db.getAllAsync<{ value: string }>(
      `SELECT DISTINCT json_each.value AS value FROM species, json_each(species.${field})
       WHERE json_valid(species.${field}) AND json_each.value <> '' ORDER BY value COLLATE NOCASE`,
    );
    return rows.map((row) => row.value);
  },

  async stats(db: SQLiteDatabase): Promise<{ total: number; withPhoto: number; families: number }> {
    const row = await db.getFirstAsync<{ total: number; withPhoto: number; families: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) AS withPhoto,
              COUNT(DISTINCT familia) AS families
       FROM species`,
    );
    return row ?? { total: 0, withPhoto: 0, families: 0 };
  },
};
