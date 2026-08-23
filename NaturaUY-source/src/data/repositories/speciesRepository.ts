import type { SQLiteDatabase } from 'expo-sqlite';

import type { Species } from '../../domain/entities/species';
import { rowToSpecies } from '../mappers/speciesMapper';
import type { SpeciesRow } from '../db/schema';

export const TAXON_RANKS = ['phylum', 'clase', 'orden', 'familia', 'genero'] as const;
export type TaxonRank = (typeof TAXON_RANKS)[number];
export type TaxonomyPath = Partial<Record<TaxonRank, string>>;
export const UNASSIGNED_TAXON = '__unassigned__';

export interface SpeciesFilters {
  /** Free text, matched against vernacular names, binomial, family and genus. */
  search?: string;
  /** Several ranks at once, used by the hierarchical taxonomy browser. */
  taxonomy?: TaxonomyPath;
  onlyNative?: boolean;
  /** Conservation rank >= 2 (priority or threatened). */
  onlyPriority?: boolean;
  onlyWithPhoto?: boolean;
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
function toFtsQuery(search: string): string | null {
  const tokens = search
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
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
  if (fts) {
    joins = 'JOIN species_fts ON species_fts.rowid = species.rowid';
    clauses.push('species_fts MATCH ?');
    params.push(fts);
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
  if (filters.onlyWithPhoto) clauses.push('species.image_url IS NOT NULL');

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
    return { items: rows.slice(0, limit).map(rowToSpecies), hasMore };
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
    return row ? rowToSpecies(row) : null;
  },

  async findManyByCodigo(db: SQLiteDatabase, codigos: string[]): Promise<Species[]> {
    if (codigos.length === 0) return [];
    const placeholders = codigos.map(() => '?').join(',');
    const rows = await db.getAllAsync<SpeciesRow>(
      `SELECT * FROM species WHERE codigo IN (${placeholders}) ORDER BY common_name COLLATE NOCASE`,
      codigos,
    );
    return rows.map(rowToSpecies);
  },

  /** One level of the taxonomic tree, constrained by every selected ancestor. */
  async listTaxonomyChildren(
    db: SQLiteDatabase,
    rank: TaxonRank,
    ancestors: TaxonomyPath,
  ): Promise<{ value: string; count: number }[]> {
    const clauses: string[] = [];
    const params: string[] = [];
    for (const ancestorRank of TAXON_RANKS) {
      const value = ancestors[ancestorRank];
      if (value !== undefined) {
        clauses.push(`${ancestorRank} = ?`);
        params.push(value === UNASSIGNED_TAXON ? '' : value);
      }
    }
    return db.getAllAsync<{ value: string; count: number }>(
      `SELECT CASE WHEN ${rank} = '' THEN '${UNASSIGNED_TAXON}' ELSE ${rank} END AS value,
              COUNT(*) AS count
       FROM species WHERE ${clauses.length > 0 ? clauses.join(' AND ') : '1 = 1'}
       GROUP BY ${rank} ORDER BY ${rank} = '' ASC, value COLLATE NOCASE ASC`,
      params,
    );
  },

  /**
   * Quiz pool: only species with a photo, since the question *is* the photo.
   * Loaded once per run so question generation stays synchronous and instant.
   */
  async findQuizPool(db: SQLiteDatabase, clase?: string): Promise<Species[]> {
    const rows = await db.getAllAsync<SpeciesRow>(
      `SELECT * FROM species
       WHERE image_url IS NOT NULL ${clase ? 'AND clase = ?' : ''}`,
      clase ? [clase] : [],
    );
    return rows.map(rowToSpecies);
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
