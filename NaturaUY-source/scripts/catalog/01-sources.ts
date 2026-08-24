import { copyFileSync, existsSync } from 'node:fs';
import { PATHS, ROOT, downloadOnce, ensureDirs, writeJson } from './lib';

const SOURCES = [
  { id: 'biodiversidata', title: 'Tetrápodos de Uruguay', type: 'occurrence', license: 'CC BY 4.0', url: 'https://cloud.gbif.org/uy/archive.do?r=tetrapodos_de_uruguay', target: PATHS.biodiversity },
  { id: 'ministerio', title: 'Especies de fauna del Uruguay evaluadas y reportadas en Listas Rojas', type: 'checklist', license: null, url: 'https://cloud.gbif.org/uy/archive.do?r=listas_rojas_fauna_uy', target: PATHS.ministry },
] as const;

async function main(): Promise<void> {
  ensureDirs();
  for (const source of SOURCES) console.log(`${source.id}: ${await downloadOnce(source.url, source.target)}`);
  if (!existsSync(PATHS.historical)) copyFileSync(`${ROOT}/resources/outputSNAP.json`, PATHS.historical);
  writeJson(`${PATHS.raw}/sources.json`, { retrievedAt: new Date().toISOString(), sources: SOURCES.map(({ target, ...source }) => ({ ...source, rawFile: target })) });
  console.log('Historical SNAP export: preserved as data/raw/otras_fuentes/outputSNAP.json');
}
main().catch((error: unknown) => { console.error(error); process.exit(1); });
