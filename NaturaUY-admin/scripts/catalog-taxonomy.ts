import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseRow } from './catalog-data';

export interface PublishedTaxonomy {
  nodes: DatabaseRow[];
  links: DatabaseRow[];
  names: DatabaseRow[];
}

/** Keep editorial IDs and the complete ancestor path of published species only. */
export function selectPublishedTaxonomy(speciesIds: Set<string>, nodes: DatabaseRow[], links: DatabaseRow[], names: DatabaseRow[]): PublishedTaxonomy {
  const byId = new Map(nodes.map((node) => [String(node.taxon_id), node]));
  const selected = links.filter((link) => speciesIds.has(String(link.species_id)));
  const included = new Set<string>();
  const expanded = new Map<string, DatabaseRow>();
  for (const link of selected) {
    let id: string | null = String(link.taxon_id);
    const path = new Set<string>();
    while (id) {
      if (path.has(id)) throw new Error(`Taxonomic cycle: ${id}`);
      path.add(id);
      const node = byId.get(id);
      if (!node) throw new Error(`Missing editorial taxon: ${id}`);
      included.add(id);
      expanded.set(`${link.species_id}:${id}`, { species_id: link.species_id, taxon_id: id, is_primary: true });
      id = node.parent_id ? String(node.parent_id) : null;
    }
  }
  for (const id of speciesIds) if (![...expanded.values()].some((link) => link.species_id === id)) throw new Error(`Published species without taxonomy: ${id}`);
  return { nodes: nodes.filter((node) => included.has(String(node.taxon_id))), links: [...expanded.values()], names: names.filter((name) => included.has(String(name.taxon_id))) };
}

export function writePublishedTaxonomy(db: DatabaseSync, taxonomy: PublishedTaxonomy, sources: DatabaseRow[]): void {
  db.exec(`
    CREATE TABLE taxa(taxon_id TEXT PRIMARY KEY, parent_id TEXT REFERENCES taxa(taxon_id) DEFERRABLE INITIALLY DEFERRED, rank TEXT NOT NULL, canonical_name TEXT NOT NULL, simple_name TEXT, description TEXT NOT NULL DEFAULT '', identifiers TEXT NOT NULL, sources TEXT NOT NULL, sort_order INTEGER NOT NULL);
    CREATE INDEX idx_taxa_parent_sort ON taxa(parent_id,sort_order,canonical_name);
    CREATE INDEX idx_taxa_rank_name ON taxa(rank,canonical_name);
    CREATE TABLE species_taxa(stable_id TEXT NOT NULL REFERENCES species(stable_id), taxon_id TEXT NOT NULL REFERENCES taxa(taxon_id), is_primary INTEGER NOT NULL, PRIMARY KEY(stable_id,taxon_id));
    CREATE INDEX idx_species_taxa_taxon ON species_taxa(taxon_id,stable_id);
    CREATE TABLE taxon_names(taxon_id TEXT NOT NULL REFERENCES taxa(taxon_id), name TEXT NOT NULL, language TEXT NOT NULL, name_type TEXT NOT NULL, source_code TEXT, PRIMARY KEY(taxon_id,name,language,name_type));
    CREATE TABLE taxon_closure(ancestor_id TEXT NOT NULL REFERENCES taxa(taxon_id), descendant_id TEXT NOT NULL REFERENCES taxa(taxon_id), depth INTEGER NOT NULL, PRIMARY KEY(ancestor_id,descendant_id));
    CREATE INDEX idx_taxon_closure_descendant ON taxon_closure(descendant_id,depth);
  `);
  const sourceCodes = new Map(sources.map((source) => [String(source.id), source.code]));
  const insertNode = db.prepare('INSERT INTO taxa VALUES (?,?,?,?,?,?,?,?,?)');
  const insertLink = db.prepare('INSERT INTO species_taxa VALUES (?,?,?)');
  const insertName = db.prepare('INSERT INTO taxon_names VALUES (?,?,?,?,?)');
  taxonomy.nodes.forEach((node) => insertNode.run(node.taxon_id,node.parent_id,node.rank,node.canonical_name,node.simple_name,node.description ?? '',JSON.stringify(node.identifiers ?? {}),JSON.stringify((node.source_ids ?? []).map((id: string) => sourceCodes.get(id) ?? id)),node.sort_order ?? 0));
  taxonomy.links.forEach((link) => insertLink.run(link.species_id,link.taxon_id,link.is_primary ? 1 : 0));
  taxonomy.names.forEach((name) => insertName.run(name.taxon_id,name.name,name.language,name.name_type,sourceCodes.get(String(name.source_id)) ?? null));
  db.exec(`INSERT INTO taxon_closure WITH RECURSIVE closure(ancestor_id,descendant_id,depth) AS (SELECT taxon_id,taxon_id,0 FROM taxa UNION ALL SELECT t.parent_id,c.descendant_id,c.depth+1 FROM closure c JOIN taxa t ON t.taxon_id=c.ancestor_id WHERE t.parent_id IS NOT NULL) SELECT * FROM closure;`);
}
