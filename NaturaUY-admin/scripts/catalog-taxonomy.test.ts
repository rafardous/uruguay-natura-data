import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { selectPublishedTaxonomy, writePublishedTaxonomy } from './catalog-taxonomy';

const nodes = [
  {taxon_id:'root',parent_id:null,rank:'kingdom',canonical_name:'Animalia',simple_name:'Animales'},
  {taxon_id:'aves',parent_id:'root',rank:'class',canonical_name:'Aves',simple_name:'Aves'},
  {taxon_id:'rhea',parent_id:'aves',rank:'genus',canonical_name:'Rhea',simple_name:null},
  {taxon_id:'excluded',parent_id:null,rank:'genus',canonical_name:'Excluded',simple_name:null},
];
test('published taxonomy preserves editorial IDs and expands ancestry without excluded plants', () => {
  const taxonomy = selectPublishedTaxonomy(new Set(['bird']),nodes,[{species_id:'bird',taxon_id:'rhea'},{species_id:'archived',taxon_id:'excluded'}],[{taxon_id:'aves',name:'Aves',language:'la',name_type:'canonical'}]);
  assert.deepEqual(taxonomy.nodes.map((node) => node.taxon_id), ['root','aves','rhea']);
  assert.equal(taxonomy.links.length,3);
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;CREATE TABLE species(stable_id TEXT PRIMARY KEY);INSERT INTO species VALUES (\'bird\');BEGIN');
  writePublishedTaxonomy(db,taxonomy,[]);
  db.exec('COMMIT');
  assert.equal(db.prepare("SELECT count(*) AS n FROM species_taxa WHERE taxon_id='root'").get()!.n,1);
  assert.equal(db.prepare("SELECT depth FROM taxon_closure WHERE ancestor_id='root' AND descendant_id='rhea'").get()!.depth,2);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  db.close();
});
test('taxonomy blocks missing paths, broken parents and cycles', () => {
  assert.throws(() => selectPublishedTaxonomy(new Set(['bird']),nodes,[],[]), /without taxonomy/);
  assert.throws(() => selectPublishedTaxonomy(new Set(['bird']),nodes,[{species_id:'bird',taxon_id:'missing'}],[]), /Missing editorial/);
  assert.throws(() => selectPublishedTaxonomy(new Set(['bird']),[{...nodes[0],parent_id:'root'}],[{species_id:'bird',taxon_id:'root'}],[]), /cycle/);
});
