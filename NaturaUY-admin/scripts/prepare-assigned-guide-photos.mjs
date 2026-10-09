/** Copia derivados revisados a la carpeta que se sube al bucket guia-aves. */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseMapping } from './guide-photo-selection.mjs';
import { storagePath } from './import-guide-photos.mjs';

const sha256 = (body) => createHash('sha256').update(body).digest('hex');
const norm = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const option = (name, fallback) => { const index = process.argv.indexOf(name); return index < 0 ? fallback : process.argv[index + 1]; };
const root = resolve(import.meta.dirname, '..');
const pictureRoot = join(homedir(), 'Pictures', 'NaturaUY');

function parseCsv(csv) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') { if (quoted && csv[i + 1] === '"') { field += '"'; i += 1; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += char;
  }
  row.push(field); if (row.some(Boolean)) rows.push(row);
  const header = rows.shift();
  return rows.map((cells) => Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ''), cells[index] ?? ''])));
}

export function inferGuideMapping(number, filenames, catalogue) {
  const labels = filenames.filter((name) => !/foto\s+cedida/i.test(name));
  if (!labels.length || filenames.some((name) => /foto\s+cedida/i.test(name))) return null;
  const byScientific = new Map(catalogue.map((bird) => [norm(bird.nombre_cientifico), bird]));
  const byCommon = new Map();
  for (const bird of catalogue) byCommon.set(norm(bird.nombre_comun), [...(byCommon.get(norm(bird.nombre_comun)) ?? []), bird]);
  const evidence = [];
  for (const filename of labels) {
    const match = /^(\d{1,3})(?:\s*\(\d+\))?\s+(.+)\.[^.]+$/i.exec(filename);
    if (!match || Number(match[1]) !== number) continue;
    const label = match[2];
    const scientific = [...label.matchAll(/\(([A-Z][a-z]+\s+[a-z][a-z-]+)(?:\s+[a-z][a-z-]+)?\)/g)]
      .map((item) => byScientific.get(norm(item[1]))).filter(Boolean);
    const common = byCommon.get(norm(label.split(/\s*[-–]\s*|\s*\(/)[0])) ?? [];
    const matches = scientific.length ? scientific : common;
    if (!matches.length) return null;
    evidence.push([...new Set(matches.map((bird) => bird.species_id))]);
  }
  if (!evidence.length || evidence.some((ids) => ids.length !== 1)) return null;
  const ids = new Set(evidence.map(([id]) => id));
  return ids.size === 1 ? [...ids][0] : null;
}

async function listOriginalNames(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const number = Number(/^(\d{1,3})(?:\s|\.)/.exec(entry.name)?.[1]);
    if (!Number.isInteger(number) || number < 1 || number > 435) continue;
    result.set(number, [...(result.get(number) ?? []), entry.name]);
  }
  return result;
}

async function copyChecked(source, destination, expectedHash, expectedBytes) {
  const body = await readFile(source);
  if (body.length !== expectedBytes || body.length > 12 * 1024 * 1024) throw new Error(`Tamaño inválido para media-public: ${source}`);
  if (sha256(body) !== expectedHash) throw new Error(`Derivado alterado: ${source}`);
  await mkdir(dirname(destination), { recursive: true });
  try {
    if (sha256(await readFile(destination)) !== expectedHash) throw new Error(`Destino ocupado con otro contenido: ${destination}`);
    return;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await copyFile(source, destination);
  if (sha256(await readFile(destination)) !== expectedHash) throw new Error(`Falló la copia: ${destination}`);
}

export async function prepareAssigned({ photos, reduced, assigned, mappingPath, cataloguePath }) {
  const report = JSON.parse(await readFile(join(reduced, 'manifest.json'), 'utf8'));
  if (report.failedSelected?.length || report.ambiguities?.length) throw new Error('El manifiesto tiene fotos seleccionadas fallidas o ambiguas');
  const mapping = parseMapping(await readFile(mappingPath, 'utf8'));
  const catalogue = parseCsv(await readFile(cataloguePath, 'utf8')).filter((row) => row.estado === 'active');
  const originalNames = await listOriginalNames(photos);
  const byNumber = new Map();
  for (const item of report.selected) byNumber.set(item.number, [...(byNumber.get(item.number) ?? []), item]);
  const usedIds = new Set(); const selected = []; const omitted = []; const inferred = [];
  for (const [number, items] of byNumber) {
    const names = originalNames.get(number) ?? [];
    let speciesId = mapping.get(number);
    if (!speciesId) {
      speciesId = inferGuideMapping(number, names, catalogue);
      if (speciesId) inferred.push({ number, speciesId });
    }
    if (!speciesId || usedIds.has(speciesId)) { omitted.push({ number, reason: !speciesId ? 'sin_coincidencia_unica' : 'uuid_repetido' }); continue; }
    const eligible = items.filter((item) => !/foto\s+cedida/i.test(item.original));
    if (!eligible.length) { omitted.push({ number, reason: 'derechos_no_confirmados' }); continue; }
    usedIds.add(speciesId);
    for (const [index, item] of eligible.slice(0, 2).entries()) {
      const ordinal = index + 1;
      const mainPath = storagePath(number, ordinal);
      const thumbnailPath = storagePath(number, ordinal, true);
      selected.push({ ...item, ordinal, speciesId, storagePath: mainPath, thumbnailPath });
    }
  }
  const expected = new Set(selected.flatMap((item) => [item.storagePath, item.thumbnailPath]));
  try {
    const existing = async (directory, prefix = '') => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async (entry) => entry.isDirectory()
      ? existing(join(directory, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]))).flat();
    for (const path of await existing(assigned)) if (!expected.has(path)) throw new Error(`Archivo ajeno o antiguo en assigned: ${path}`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const item of selected) {
    await copyChecked(join(reduced, item.main), join(assigned, item.storagePath), item.mainSha256, item.mainBytes);
    await copyChecked(join(reduced, item.thumbnail), join(assigned, item.thumbnailPath), item.thumbnailSha256, item.thumbnailBytes);
  }
  const output = { schemaVersion: 1, generatedAt: new Date().toISOString(), bucket: 'guia-aves', selected, inferred, omitted };
  await writeFile(join(dirname(assigned), 'assigned-manifest.json'), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ species: usedIds.size, photos: selected.length, files: expected.size, inferred: inferred.length, omitted: omitted.length, manifest: join(dirname(assigned), 'assigned-manifest.json') }));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareAssigned({ photos: resolve(option('--photos', join(pictureRoot, 'Aves-originales'))), reduced: resolve(option('--reduced', join(pictureRoot, 'Aves-reducidas'))), assigned: resolve(option('--assigned', join(pictureRoot, 'assigned'))), mappingPath: resolve(option('--mapping', join(root, 'data/guide-birds/correspondencias_aves_1-435.csv'))), cataloguePath: resolve(option('--catalogue', join(root, 'data/guide-birds/aves_catalogo_para_correspondencias.csv'))) }).catch((error) => { console.error(error); process.exitCode = 1; });
}
