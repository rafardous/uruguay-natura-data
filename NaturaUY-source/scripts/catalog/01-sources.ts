import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, relative, resolve } from 'node:path';
import { PATHS, ROOT, downloadOnce, ensureDirs, writeJson } from './lib';

const SOURCES = [
  { id: 'biodiversidata', title: 'Tetrápodos de Uruguay', type: 'occurrence', license: 'CC BY 4.0', url: 'https://cloud.gbif.org/uy/archive.do?r=tetrapodos_de_uruguay', target: PATHS.biodiversity },
  { id: 'ministerio', title: 'Especies de fauna del Uruguay evaluadas y reportadas en Listas Rojas', type: 'checklist', license: null, url: 'https://cloud.gbif.org/uy/archive.do?r=listas_rojas_fauna_uy', target: PATHS.ministry },
] as const;

const OPTIONAL_OPEN_ARTHROPOD_SOURCES = [
  { id: 'udelar_spider_collection', title: 'Colección de arañas de Facultad de Ciencias, UdelaR', license: 'CC BY 4.0', doi: '10.15468/u6fa5g', url: process.env.NATURA_DWCA_UDELAR_SPIDERS_URL ?? 'https://cloud.gbif.org/uy/archive.do?r=coleccion_aranas_fcien_1', target: PATHS.arthropodOpen.udelarSpiders },
  { id: 'uruguay_hymenoptera_parasitoids', title: 'Parasitoides de Uruguay', license: 'CC BY 4.0', doi: '10.15468/mu3rcs', url: process.env.NATURA_DWCA_HYMENOPTERA_URL ?? 'https://cloud.gbif.org/uy/archive.do?r=parasitoides_uruguay_2025', target: PATHS.arthropodOpen.hymenoptera },
  { id: 'rocha_temporary_pools', title: 'Metacomunidad de charcos temporales de Rocha', license: 'CC BY 4.0', doi: '10.15468/s7yrey', url: process.env.NATURA_DWCA_ROCHA_POOLS_URL ?? 'https://cloud.gbif.org/uy/archive.do?r=uy_ponds_2008', target: PATHS.arthropodOpen.rochaPools },
] as const;

async function main(): Promise<void> {
  ensureDirs();
  for (const source of SOURCES) console.log(`${source.id}: ${await downloadOnce(source.url, source.target)}`);
  for (const source of OPTIONAL_OPEN_ARTHROPOD_SOURCES) {
    console.log(`${source.id}: ${await downloadOnce(source.url, source.target)}`);
  }
  if (!existsSync(PATHS.historical)) copyFileSync(`${ROOT}/resources/outputSNAP.json`, PATHS.historical);
  const manifestEntry = (source: { id: string; title: string; type: string; license: string | null; url: string; doi?: string; target?: string; usePolicy?: string }) => {
    const target = source.target;
    const exists = target ? existsSync(target) : false;
    const bytes = exists && target ? readFileSync(target) : null;
    const suffix = target ? extname(target).toLowerCase() : '';
    const format = suffix === '.xls' ? 'html-table-latin1' : suffix.replace(/^\./u, '') || 'unknown';
    return {
      id: source.id,
      title: source.title,
      type: source.type,
      license: source.license,
      url: source.url,
      doi: source.doi ?? null,
      retrievedAt: new Date().toISOString(),
      rawFile: target ? relative(resolve(ROOT, 'data'), target).replaceAll('\\', '/') : null,
      format,
      sizeBytes: exists && target ? statSync(target).size : null,
      sha256: bytes ? createHash('sha256').update(bytes).digest('hex') : null,
      usePolicy: source.usePolicy ?? 'redistributable_snapshot',
    };
  };
  writeJson(`${PATHS.raw}/sources.json`, {
    schemaVersion: 2,
    retrievedAt: new Date().toISOString(),
    sources: [
      ...SOURCES.map((source) => manifestEntry(source)),
      ...OPTIONAL_OPEN_ARTHROPOD_SOURCES.map((source) => manifestEntry({ ...source, type: 'occurrence' })),
      manifestEntry({ id: 'ecoregistros_insectos_uruguay', title: 'EcoRegistros: insectos de Uruguay', type: 'discovery_reference', license: 'restricted', url: 'https://www.ecoregistros.org/site/pais.php?id=55&idgrupoclase=2&page=2', target: resolve(PATHS.raw, 'ecoregistros.org/insectos-uruguay/restricted/insectos-Uruguay.xls'), usePolicy: 'discovery_only_no_redistribution' }),
    ],
  });
  console.log('Historical SNAP export: preserved as data/raw/otras_fuentes/outputSNAP.json');
}
main().catch((error: unknown) => { console.error(error); process.exit(1); });
