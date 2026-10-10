/** Verifica la carga manual y completa las aves de la guía con fotos externas. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { findImage } from '../../NaturaUY-source/scripts/catalog/05-media.ts';
import { ensureOwnerAttestation, mediaId, ownerAttestationPath } from './import-guide-photos.mjs';

const sha256 = (body) => createHash('sha256').update(body).digest('hex');
const option = (name, fallback) => { const index = process.argv.indexOf(name); return index < 0 ? fallback : process.argv[index + 1]; };
const licenseUrls = { CC0: 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/' };
const missing = (error) => Number(error?.statusCode ?? error?.status) === 404 || /not[ _-]?found|does not exist/i.test(String(error?.message ?? ''));

export function chooseGuidePhotos(family, external) {
  return [...family, ...external].slice(0, 2).map((item, index) => ({ ...item, ordinal: index + 1, is_primary: index === 0 }));
}

async function objectHash(client, path) {
  const guide = path.startsWith('guia-aves/');
  const { data, error } = await client.storage.from(guide ? 'guia-aves' : 'media-public')
    .download(guide ? path.slice('guia-aves/'.length) : path);
  if (error) { if (missing(error)) return null; throw new Error(`Storage ${path}: ${error.message}`); }
  if (!data) throw new Error(`Storage no devolvió ${path}`);
  const body = Buffer.from(await data.arrayBuffer());
  return { hash: sha256(body), body };
}

export async function uploadedFamily(client, item) {
  const [main, thumbnail] = await Promise.all([objectHash(client, item.storagePath), objectHash(client, item.thumbnailPath)]);
  if ((main && main.hash !== item.mainSha256) || (thumbnail && thumbnail.hash !== item.thumbnailSha256))
    throw new Error(`SHA-256 incorrecto en foto familiar ${item.number}/${item.ordinal}`);
  return Boolean(main && thumbnail);
}

function acceptable(candidate) {
  return candidate && ['inaturalist', 'wikimedia'].includes(candidate.source)
    && licenseUrls[candidate.license] === candidate.licenseUrl
    && candidate.fullUrl && candidate.attribution;
}

function archivedCandidate(row) {
  const imageUrl = row.selection_details?.originalImageUrl ?? row.source_url;
  if (!imageUrl || !licenseUrls[row.license] || row.license_url !== licenseUrls[row.license]) return null;
  const source = String(row.source).toLowerCase().includes('inaturalist') ? 'inaturalist'
    : String(row.source).toLowerCase().includes('wikimedia') ? 'wikimedia' : null;
  if (!source) return null;
  return { fullUrl: imageUrl, source, sourcePage: row.source_url, attribution: row.author,
    license: row.license, licenseUrl: row.license_url, originalLicense: row.original_license ?? row.license };
}

async function externalCandidates(species, existing, needed) {
  const result = existing.map(archivedCandidate).filter(acceptable);
  if (result.length < needed) {
    const fresh = await findImage(species.accepted_name ?? species.scientific_name, [species.scientific_name]);
    if (acceptable(fresh)) result.push(fresh);
  }
  return result.filter((item, index, all) => all.findIndex((other) => other.fullUrl === item.fullUrl) === index);
}

async function verifiedExistingExternal(client, row, number) {
  if (row.status !== 'approved' || !licenseUrls[row.license] || row.license_url !== licenseUrls[row.license]
    || !row.storage_path?.startsWith(`guia-aves/${String(number).padStart(3, '0')}/external/`) || !row.thumbnail_path) return null;
  const [main, thumbnail] = await Promise.all([objectHash(client, row.storage_path), objectHash(client, row.thumbnail_path)]);
  if (!main || !thumbnail || main.hash !== row.checksum_sha256
    || thumbnail.hash !== row.selection_details?.thumbnailSha256)
    throw new Error(`Medio externo aprobado sin objetos íntegros: ${row.id}`);
  return row;
}

async function prepareExternal(candidate, number, ordinal, speciesId, uploadedBy, client, apply) {
  const response = await fetch(candidate.fullUrl, { redirect: 'follow', signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Arapy-guide-media/1.0' } });
  if (!response.ok) throw new Error(`Foto externa HTTP ${response.status}`);
  const original = Buffer.from(await response.arrayBuffer());
  if (original.length > 20 * 1024 * 1024) throw new Error('Foto externa demasiado grande');
  const image = sharp(original, { failOn: 'error', limitInputPixels: 50_000_000 });
  const meta = await image.metadata();
  if (!meta.width || !meta.height || Math.max(meta.width, meta.height) < 1200 || meta.width * meta.height > 50_000_000) throw new Error('Resolución externa inválida');
  const main = await image.clone().rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
  const thumb = await image.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
  const token = sha256(candidate.fullUrl).slice(0, 12);
  const prefix = `guia-aves/${String(number).padStart(3, '0')}/external/0${ordinal}-${token}`;
  const mainPath = `${prefix}.webp`; const thumbPath = `${prefix}-480.webp`;
  const { data: duplicate, error: duplicateError } = await client.from('species_media')
    .select('id').eq('type', 'image').eq('status', 'approved').eq('checksum_sha256', sha256(main))
    .neq('species_id', speciesId).limit(1).maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) throw new Error(`Foto externa ya asignada a otra especie: ${duplicate.id}`);
  for (const [path, body] of [[mainPath, main], [thumbPath, thumb]]) {
    const remote = await objectHash(client, path);
    if (remote && remote.hash !== sha256(body)) throw new Error(`Ruta externa ocupada con otro contenido: ${path}`);
    if (!remote && apply) {
      const { error } = await client.storage.from('guia-aves').upload(path.slice('guia-aves/'.length), body, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
      if (error) throw error;
      const saved = await objectHash(client, path);
      if (!saved || saved.hash !== sha256(body)) throw new Error(`Falló verificación de ${path}`);
    }
  }
  const idHash = sha256(`${speciesId}:${ordinal}:${candidate.fullUrl}`);
  const id = `${idHash.slice(0, 8)}-${idHash.slice(8, 12)}-5${idHash.slice(13, 16)}-a${idHash.slice(17, 20)}-${idHash.slice(20, 32)}`;
  return { id, species_id: speciesId, type: 'image', ordinal, is_primary: ordinal === 1, status: 'approved',
    storage_path: mainPath, thumbnail_path: thumbPath, checksum_sha256: sha256(main),
    author: candidate.attribution, license: candidate.license, license_url: candidate.licenseUrl,
    original_license: candidate.originalLicense ?? candidate.license, source: candidate.source,
    source_url: candidate.sourcePage ?? candidate.fullUrl,
    selection_details: { originalImageUrl: candidate.fullUrl, thumbnailSha256: sha256(thumb) }, uploaded_by: uploadedBy };
}

async function fetchRows(client, table, ids, columns) {
  const result = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await client.from(table).select(columns).in(table === 'species' ? 'id' : 'species_id', ids.slice(offset, offset + 100));
    if (error) throw error;
    result.push(...data);
  }
  return result;
}

async function main() {
  const manifestPath = resolve(option('--manifest', join(homedir(), 'Pictures/NaturaUY/assigned-manifest.json')));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !['media-public', 'guia-aves'].includes(manifest.bucket)) throw new Error('Manifiesto assigned incompatible');
  const groups = new Map();
  for (const item of manifest.selected) groups.set(item.number, [...(groups.get(item.number) ?? []), item]);
  const speciesIds = [...new Set(manifest.selected.map((item) => item.speciesId))];
  if (!speciesIds.length || speciesIds.length !== groups.size) throw new Error('Manifiesto vacío o dos números apuntan a la misma especie');
  const url = process.env.SUPABASE_URL?.trim(); const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const uploadedBy = process.env.EDITORIAL_SYSTEM_USER_ID?.trim();
  if (!url || !key || !uploadedBy) throw new Error('Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o EDITORIAL_SYSTEM_USER_ID');
  const apply = process.argv.includes('--apply');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: editor, error: editorError } = await client.from('editor_access')
    .select('user_id').eq('user_id', uploadedBy).eq('active', true).single();
  if (editorError || !editor) throw new Error('EDITORIAL_SYSTEM_USER_ID no corresponde a un editor activo');
  const { error: rpcProbe } = await client.rpc('reconcile_guide_bird_media', { p_species_id: speciesIds[0], p_photos: [] });
  if (!rpcProbe?.message?.includes('guide_media_requires_one_or_two_photos'))
    throw new Error(`Falta la migración reconcile_guide_bird_media: ${rpcProbe?.message ?? 'respuesta inesperada'}`);
  const [speciesRows, mediaRows] = await Promise.all([
    fetchRows(client, 'species', speciesIds, 'id,class,status,scientific_name,accepted_name'),
    fetchRows(client, 'species_media', speciesIds, '*'),
  ]);
  const speciesById = new Map(speciesRows.map((row) => [row.id, row]));
  const evidencePath = ownerAttestationPath('Pedro Rinaldi', uploadedBy);
  const limit = Number(option('--limit', groups.size));
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit inválido');
  const summary = { species: 0, family: 0, external: 0, unchanged: 0, incomplete: [], failures: [] };
  const work = [...groups].slice(0, limit);
  let next = 0;
  const workers = Number(option('--workers', 4));
  if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw new Error('--workers debe ser 1–8');
  await Promise.all(Array.from({ length: workers }, async () => { while (next < work.length) {
    const [number, items] = work[next++];
    const speciesId = items[0].speciesId;
    const species = speciesById.get(speciesId);
    if (!species || species.class !== 'Aves' || species.status !== 'active' || items.length > 2) throw new Error(`Correspondencia remota inválida: ${number}`);
    const existing = mediaRows.filter((row) => row.species_id === speciesId && row.type === 'image');
    try {
      const family = [];
      for (const item of items.sort((a, b) => a.ordinal - b.ordinal)) {
        if (await uploadedFamily(client, item)) family.push({ id: mediaId(number, item.ordinal), species_id: speciesId, type: 'image',
          status: 'approved', storage_path: item.storagePath, thumbnail_path: item.thumbnailPath,
          checksum_sha256: item.mainSha256, author: 'Pedro Rinaldi', license: 'permission',
          source: 'Archivo fotográfico familiar', original_filename: item.original,
          evidence_path: evidencePath, authorization_evidence_ref: evidencePath, uploaded_by: uploadedBy });
      }
      if (apply && family.length) await ensureOwnerAttestation(client, evidencePath, 'Pedro Rinaldi', uploadedBy);
      const external = [];
      if (family.length < 2) {
        for (const row of existing) {
          if (family.length + external.length >= 2) break;
          const verified = await verifiedExistingExternal(client, row, number);
          if (verified) external.push(verified);
        }
      }
      if (family.length + external.length < 2 && !process.argv.includes('--family-only')) {
        let candidates = [];
        try { candidates = await externalCandidates(species, existing, 2 - family.length - external.length); }
        catch (error) { summary.failures.push({ number, reason: `búsqueda externa: ${error.message}` }); }
        for (const candidate of candidates) {
          if (family.length + external.length >= 2) break;
          if (external.some((row) => row.selection_details?.originalImageUrl === candidate.fullUrl)) continue;
          try { external.push(await prepareExternal(candidate, number, family.length + external.length + 1, speciesId, uploadedBy, client, apply)); }
          catch (error) { summary.failures.push({ number, reason: `externa: ${error.message}` }); }
        }
      }
      const photos = chooseGuidePhotos(family, external);
      if (!photos.length) { summary.incomplete.push(number); continue; }
      const active = existing.filter((row) => row.status === 'approved').sort((a, b) => a.ordinal - b.ordinal);
      if (active.length === photos.length
        && active.every((row, index) => row.id === photos[index].id && row.ordinal === photos[index].ordinal && row.is_primary === photos[index].is_primary)) {
        summary.unchanged += 1; continue;
      }
      if (apply) {
        const { error } = await client.rpc('reconcile_guide_bird_media', { p_species_id: speciesId, p_photos: photos });
        if (error) throw error;
      }
      summary.species += 1; summary.family += family.length; summary.external += external.length;
      if (photos.length < 2) summary.incomplete.push(number);
    } catch (error) { summary.failures.push({ number, reason: error.message }); }
  } }));
  console.log(JSON.stringify({ apply, ...summary }, null, 2));
  if (summary.failures.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
