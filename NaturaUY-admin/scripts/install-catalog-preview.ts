import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Sólo copia artefactos ya validados del publicador; nunca escribe SQLite a mano.
const preview=resolve(import.meta.dirname,'../dist/catalog-preview');
const mobile=resolve(import.meta.dirname,'../../NaturaUY-source');
const manifest=JSON.parse(readFileSync(resolve(preview,'manifest.json'),'utf8'));
if(manifest.schema_version!==15||manifest.published_at!==null)throw new Error('Not an unpublished schema 15 preview');
const db=new DatabaseSync(resolve(preview,'natura.db'),{readOnly:true});
if(db.prepare('pragma integrity_check').get()?.integrity_check!=='ok'||db.prepare('pragma foreign_key_check').all().length)throw new Error('Invalid preview database');
db.close();
const backup=resolve(import.meta.dirname,'../../.tmp/habitats/bundled-before-preview');
mkdirSync(backup,{recursive:true});
const target=resolve(mobile,'assets/db/natura.db');
if(!existsSync(resolve(backup,'natura.db')))copyFileSync(target,resolve(backup,'natura.db'));
copyFileSync(resolve(preview,'natura.db'),target);
for(const name of readdirSync(preview).filter(name=>name.endsWith('.json')&&!['manifest.json','quality-report.json','build-metadata.json'].includes(name))) {
  const destination=resolve(mobile,'data/catalog',name);
  if(existsSync(destination)&&!existsSync(resolve(backup,name)))copyFileSync(destination,resolve(backup,name));
  copyFileSync(resolve(preview,name),destination);
}
writeFileSync(resolve(mobile,'src/data/db/bundledCatalogVersion.ts'),`// Generado por install-catalog-preview.ts desde el publicador PostgreSQL.\nexport const BUNDLED_CATALOG_VERSION = { schema: ${manifest.schema_version}, data: ${manifest.data_version} } as const;\n`);
console.log(`Expo web: preview v${manifest.data_version}/schema ${manifest.schema_version} instalada. user.db y manifiesto remoto preservados.`);
