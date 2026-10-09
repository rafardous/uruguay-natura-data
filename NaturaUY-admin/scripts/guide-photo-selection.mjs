import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

export const supported = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff']);

export async function listPhotos(root) {
  const found = [];
  async function visit(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      if (item.isDirectory()) await visit(path);
      else if (item.isFile() && supported.has(extname(item.name).toLowerCase())) found.push({ path, relativePath: relative(root, path) });
    }
  }
  await visit(root);
  return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'es', { numeric: true }));
}

export function analyzePhotos(files, overrides = {}) {
  const groups = new Map();
  for (const file of files) {
    const filename = file.relativePath.split(/[\\/]/).at(-1);
    const stem = filename.slice(0, -extname(filename).length);
    const match = /^(\d{1,3})(?: \((\d+)\))?$/.exec(stem);
    if (!match) continue;
    const number = Number(match[1]);
    if (number < 1 || number > 435) continue;
    const variant = match[2] === undefined ? 0 : Number(match[2]);
    if (match[2] !== undefined && variant < 1) continue;
    const group = groups.get(number) ?? new Map();
    group.set(variant, [...(group.get(variant) ?? []), file]);
    groups.set(number, group);
  }
  const appliedOverrides = new Set();
  for (const [number, variants] of groups) {
    for (const [variant, matches] of variants) {
      const key = `${number}:${variant}`;
      if (!Object.hasOwn(overrides, key)) continue;
      if (matches.length < 2) throw new Error(`La excepción ${key} ya no corresponde a fotos ambiguas`);
      const chosen = matches.find((file) => file.relativePath === overrides[key]);
      if (!chosen) throw new Error(`La excepción ${key} no coincide con ningún archivo: ${overrides[key]}`);
      variants.set(variant, [chosen]);
      appliedOverrides.add(key);
    }
  }
  for (const key of Object.keys(overrides)) {
    if (!appliedOverrides.has(key)) throw new Error(`Excepción de selección sin correspondencia: ${key}`);
  }
  const ambiguities = [...groups.entries()].flatMap(([number, variants]) =>
    [...variants.entries()].filter(([, matches]) => matches.length > 1)
      .map(([variant, matches]) => ({ number, variant, files: matches.map((file) => file.relativePath) })));
  const ambiguousNumbers = new Set(ambiguities.map((item) => item.number));
  const selected = [...groups.entries()].sort((a, b) => a[0] - b[0]).flatMap(([number, variants]) => {
    if (ambiguousNumbers.has(number)) return [];
    return [...variants.entries()].sort(([a], [b]) => a - b).slice(0, 2)
      .map(([variant, matches], index) => ({ number, variant, ordinal: index + 1, ...matches[0] }));
  });
  return { selected, ambiguities };
}

export function selectPhotos(files) {
  const result = analyzePhotos(files);
  if (result.ambiguities.length) {
    const first = result.ambiguities[0];
    throw new Error(`Foto ambigua para ${first.number} (${first.variant}): ${first.files.join(' y ')}`);
  }
  return result.selected;
}

export function parseMapping(csv) {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.shift()?.trim() !== 'numero_guia,species_id,revisado') throw new Error('Encabezado requerido: numero_guia,species_id,revisado');
  const map = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    const [rawNumber, speciesId, reviewed, ...extra] = line.split(',').map((cell) => cell.trim());
    const number = Number(rawNumber);
    if (extra.length || !Number.isInteger(number) || number < 1 || number > 435 || map.has(number)) throw new Error(`Número duplicado o inválido: ${line}`);
    if (reviewed !== 'si' && reviewed !== 'no') throw new Error(`Revisión inválida para ${number}`);
    if (reviewed === 'si' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(speciesId)) throw new Error(`Falta species_id UUID válido para ${number}`);
    if (reviewed === 'no' && speciesId) throw new Error(`El número ${number} tiene species_id pero no está revisado`);
    map.set(number, reviewed === 'si' ? speciesId.toLowerCase() : null);
  }
  return map;
}
