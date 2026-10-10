/**
 * Conversión local e importación privilegiada de fotos de la guía de aves.
 * Los originales sólo se leen. La carga exige las confirmaciones de copia y
 * correspondencias, y registra la declaración privada del titular si se solicita.
 * Completa el preflight remoto antes de escribir un objeto o una fila.
 */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { analyzePhotos, listPhotos, parseMapping } from './guide-photo-selection.mjs';

const MAX_PUBLIC_OBJECT_BYTES = 12 * 1024 * 1024;
const REQUIRED_CONFIRMATIONS = [
  '--confirm-photos-copied',
  '--confirm-mapping-reviewed',
];

function option(key) {
  const index = process.argv.indexOf(key);
  return index < 0 ? null : process.argv[index + 1];
}

function requireOption(key) {
  const value = option(key);
  if (!value || value.startsWith('--')) throw new Error(`Falta ${key}`);
  return value;
}

function positiveNumberOption(key) {
  const value = Number(requireOption(key));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} debe ser un número positivo`);
  return value;
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

export function mediaId(number, ordinal) {
  const hex = sha256(`natura-uy:guia-aves:${number}:${ordinal}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function storagePath(number, ordinal, thumbnail = false) {
  return `guia-aves/${String(number).padStart(3, '0')}/${String(ordinal).padStart(2, '0')}${thumbnail ? '-480' : ''}.webp`;
}

function outputIsInsideInput(input, output) {
  const rel = relative(input, output);
  return !rel || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

async function reusableWebp(path, sourceModifiedAt, maxSide) {
  try {
    const info = await stat(path);
    if (info.mtimeMs < sourceModifiedAt) return null;
    const body = await readFile(path);
    const metadata = await sharp(body, { failOn: 'error' }).metadata();
    if (metadata.format !== 'webp' || !metadata.width || !metadata.height
      || Math.max(metadata.width, metadata.height) > maxSide) return null;
    return body;
  } catch {
    return null;
  }
}

async function convertPhotos(photos, output) {
  await access(photos, constants.R_OK);
  if (outputIsInsideInput(photos, output)) throw new Error('--out debe estar fuera de --photos');

  const files = await listPhotos(photos);
  if (!files.length) throw new Error('No hay fotos compatibles en --photos');
  const overridePath = resolve(import.meta.dirname, '../data/guide-birds/selection-overrides.json');
  const selectionOverrides = JSON.parse(await readFile(overridePath, 'utf8'));
  const { selected, ambiguities } = analyzePhotos(files, selectionOverrides);
  const chosen = new Map(selected.map((file) => [file.path, file]));
  const manifest = [];
  const failures = [];
  let reused = 0;

  for (const file of files) {
    const target = join(output, 'todas', `${file.relativePath}.webp`);
    const image = sharp(file.path, { failOn: 'error', limitInputPixels: 50_000_000 });
    const entry = chosen.get(file.path);
    const thumbnailTarget = entry ? join(output, 'miniaturas', `${file.relativePath}.webp`) : null;
    let metadata;
    let main;
    let thumbnail;
    let mainWasReused = false;
    let thumbnailWasReused = false;
    try {
      metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 50_000_000) throw new Error('Dimensiones inválidas o superiores a 50 millones de píxeles');
      const sourceInfo = await stat(file.path);
      main = await reusableWebp(target, sourceInfo.mtimeMs, 1600);
      thumbnail = thumbnailTarget ? await reusableWebp(thumbnailTarget, sourceInfo.mtimeMs, 480) : null;
      mainWasReused = Boolean(main);
      thumbnailWasReused = Boolean(thumbnail);
      if (!main) main = await image.clone().rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
      if (thumbnailTarget && !thumbnail) thumbnail = await image.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
      if (mainWasReused) reused += 1;
    } catch (error) {
      failures.push({ original: file.relativePath, error: error instanceof Error ? error.message : String(error) });
      console.warn(`Omitida ${file.relativePath}: ${failures.at(-1).error}`);
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    if (!mainWasReused) await writeFile(target, main);
    if (!entry) continue;
    await mkdir(dirname(thumbnailTarget), { recursive: true });
    if (!thumbnailWasReused) await writeFile(thumbnailTarget, thumbnail);
    manifest.push({
      number: entry.number,
      variant: entry.variant,
      ordinal: entry.ordinal,
      original: file.relativePath,
      main: relative(output, target),
      thumbnail: relative(output, thumbnailTarget),
      mainBytes: main.length,
      thumbnailBytes: thumbnail.length,
      mainSha256: sha256(main),
      thumbnailSha256: sha256(thumbnail),
      storagePath: storagePath(entry.number, entry.ordinal),
      thumbnailPath: storagePath(entry.number, entry.ordinal, true),
    });
  }
  manifest.sort((a, b) => a.number - b.number || a.ordinal - b.ordinal);

  const report = {
    generatedAt: new Date().toISOString(),
    sourceRoot: photos,
    photosConverted: files.length - failures.length,
    photosReused: reused,
    photosSelected: manifest.length,
    speciesWithPhotos: new Set(manifest.map((entry) => entry.number)).size,
    failures,
    failedSelected: failures.filter((failure) => selected.some((entry) => entry.relativePath === failure.original)),
    ambiguities,
    selected: manifest,
  };
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Preparadas ${report.photosConverted} fotos (${reused} reutilizadas); ${manifest.length} seleccionadas de ${report.speciesWithPhotos} números; ${failures.length} omitida(s) y ${ambiguities.length} ambigüedad(es). Originales intactos.`);
  return report;
}

function isMissingObject(error) {
  const status = Number(error?.statusCode ?? error?.status ?? 0);
  return status === 404 || /not[ _-]?found|does not exist/i.test(String(error?.message ?? ''));
}

async function downloadAndHash(client, path) {
  const { data, error } = await client.storage.from('guia-aves').download(path.slice('guia-aves/'.length));
  if (error) {
    if (isMissingObject(error)) return null;
    throw new Error(`No se pudo comprobar ${path}: ${error.message}`);
  }
  if (!data) throw new Error(`Storage no devolvió contenido para ${path}`);
  const body = Buffer.from(await data.arrayBuffer());
  return { hash: sha256(body), bytes: body.length };
}

async function fetchExistingMedia(client, speciesIds) {
  const rows = [];
  for (let offset = 0; offset < speciesIds.length; offset += 100) {
    const ids = speciesIds.slice(offset, offset + 100);
    const { data, error } = await client.from('species_media')
      .select('id,status,species_id,type,ordinal,is_primary,storage_path,thumbnail_path,checksum_sha256,author,license,source,evidence_path,authorization_evidence_ref,original_filename')
      .in('species_id', ids)
      .eq('type', 'image');
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

async function fetchMappedSpecies(client, speciesIds) {
  const rows = [];
  for (let offset = 0; offset < speciesIds.length; offset += 100) {
    const { data, error } = await client.from('species').select('id,class,status').in('id', speciesIds.slice(offset, offset + 100));
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

function sameExistingRow(row, expected) {
  return row.status === 'approved'
    && row.species_id === expected.species_id
    && Number(row.ordinal) === expected.ordinal
    && row.is_primary === expected.is_primary
    && row.storage_path === expected.storage_path
    && row.thumbnail_path === expected.thumbnail_path
    && row.checksum_sha256 === expected.checksum_sha256
    && row.author === expected.author
    && row.license === 'permission'
    && row.source === 'Archivo fotográfico familiar'
    && row.evidence_path === expected.evidence_path
    && row.authorization_evidence_ref === expected.authorization_evidence_ref
    && row.original_filename === expected.original_filename;
}

export function planGuidePhotoUploads(selected, mapping, existing) {
  const existingBySpecies = new Map();
  for (const row of existing) existingBySpecies.set(row.species_id, [...(existingBySpecies.get(row.species_id) ?? []), row]);
  const selectedByNumber = new Map();
  for (const item of selected) selectedByNumber.set(item.number, [...(selectedByNumber.get(item.number) ?? []), item]);

  const planned = [];
  const skipped = [];
  for (const [number, unsortedCandidates] of selectedByNumber) {
    const candidates = [...unsortedCandidates].sort((a, b) => a.ordinal - b.ordinal);
    const speciesId = mapping.get(number);
    if (!speciesId) throw new Error(`Falta correspondencia revisada para ${number}`);
    const rows = existingBySpecies.get(speciesId) ?? [];
    for (const candidate of candidates) {
      const ordinal = candidate.ordinal;
      const id = mediaId(number, ordinal);
      const prior = rows.find((row) => row.id === id);
      if (prior && (prior.status !== 'approved' || prior.original_filename !== candidate.original)) {
        throw new Error(`El medio importado ${id} ya existe con otra selección o estado (guía ${number})`);
      }
      planned.push({ item: { ...candidate, ordinal, storagePath: storagePath(number, ordinal), thumbnailPath: storagePath(number, ordinal, true) }, speciesId, alreadyRegistered: Boolean(prior) });
    }
  }
  return { planned, skipped };
}

export function selectReviewedPhotos(selected, mapping) {
  const numbers = [...new Set(selected.map((entry) => entry.number))];
  return {
    selected: selected.filter((entry) => mapping.get(entry.number)),
    reviewedNumbers: numbers.filter((number) => mapping.get(number)),
    missingNumbers: numbers.filter((number) => !mapping.get(number)),
  };
}

export function summarizeGuidePlan(report, mapping) {
  const { selected, reviewedNumbers, missingNumbers } = selectReviewedPhotos(report.selected, mapping);
  const byNumber = new Map();
  for (const item of selected) byNumber.set(item.number, [...(byNumber.get(item.number) ?? []), item]);
  if (new Set(reviewedNumbers.map((number) => mapping.get(number))).size !== reviewedNumbers.length) {
    throw new Error('Dos números revisados apuntan a la misma especie');
  }
  for (const [number, photos] of byNumber) {
    if (photos.length < 1 || photos.length > 2 || photos.some((photo, index) => photo.ordinal !== index + 1
      || photo.storagePath !== storagePath(number, index + 1)
      || photo.thumbnailPath !== storagePath(number, index + 1, true))) {
      throw new Error(`Selección o rutas inválidas para el número ${number}`);
    }
  }
  return {
    reviewedNumbers: reviewedNumbers.length,
    selectedPhotos: selected.length,
    numbersWithOnePhoto: [...byNumber].filter(([, photos]) => photos.length === 1).map(([number]) => number),
    numbersWithoutReviewedLink: missingNumbers,
    estimatedStorageMiB: Number((selected.reduce((sum, item) => sum + item.mainBytes + item.thumbnailBytes, 0) / 1024 / 1024).toFixed(2)),
  };
}

async function uploadVerified(client, path, body, expectedHash) {
  const { error } = await client.storage.from('guia-aves').upload(path.slice('guia-aves/'.length), body, {
    contentType: 'image/webp', upsert: false, cacheControl: '31536000',
  });
  if (error) {
    const raced = await downloadAndHash(client, path);
    if (!raced || raced.hash !== expectedHash) throw error;
  }
  const uploaded = await downloadAndHash(client, path);
  if (!uploaded || uploaded.hash !== expectedHash) throw new Error(`Falló la verificación SHA-256 posterior a la carga: ${path}`);
}

export function ownerAttestationPath(author, uploadedBy) {
  return `declaraciones/guia-aves-${sha256(`${author.trim()}:${uploadedBy.trim()}`).slice(0, 32)}.txt`;
}

export async function ensureOwnerAttestation(client, path, author, uploadedBy) {
  const bucket = client.storage.from('media-evidence');
  const statement = `El titular de Arapy declara que ${author} autorizó la publicación de sus fotos de aves en la aplicación.`;
  const matches = (text) => text.includes(`Autor: ${author}\n`) && text.includes(`Registrada por: ${uploadedBy}\n`) && text.includes(`Declaración: ${statement}\n`);
  const prior = await bucket.download(path);
  if (prior.data) {
    if (!matches(await prior.data.text())) {
      throw new Error(`La declaración existente en ${path} no coincide con esta carga`);
    }
    return;
  }
  if (!isMissingObject(prior.error)) throw new Error(`No se pudo comprobar la declaración privada: ${prior.error?.message ?? 'sin respuesta'}`);
  const body = Buffer.from(`Arapy — declaración de autorización\nAutor: ${author}\nRegistrada por: ${uploadedBy}\nFecha: ${new Date().toISOString()}\nDeclaración: ${statement}\n`);
  const { error } = await bucket.upload(path, body, { contentType: 'text/plain', upsert: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  const saved = await bucket.download(path);
  if (saved.error || !saved.data) throw new Error(`No se pudo verificar la declaración privada ${path}`);
  if (!matches(await saved.data.text())) throw new Error(`La declaración guardada en ${path} no coincide`);
}

async function uploadPhotos(report, output) {
  const missingConfirmations = REQUIRED_CONFIRMATIONS.filter((flag) => !process.argv.includes(flag));
  if (missingConfirmations.length) throw new Error(`La carga está bloqueada. Faltan confirmaciones: ${missingConfirmations.join(', ')}`);
  if (report.failedSelected.length) throw new Error(`La carga está bloqueada por ${report.failedSelected.length} foto(s) seleccionada(s) sin convertir; revisar manifest.json`);
  if (report.ambiguities.length) throw new Error(`La carga está bloqueada por fotos ambiguas: ${report.ambiguities.map((item) => `${item.number} (${item.variant})`).join(', ')}`);

  const mappingPath = resolve(requireOption('--mapping'));
  const mapping = parseMapping(await readFile(mappingPath, 'utf8'));
  const { selected: reviewedSelected, reviewedNumbers, missingNumbers } = selectReviewedPhotos(report.selected, mapping);
  if (missingNumbers.length) console.warn(`Sin correspondencia revisada; no se subirán fotos de: ${missingNumbers.join(', ')}`);
  if (!reviewedSelected.length) throw new Error('No hay fotos con correspondencia revisada para cargar');
  const mappedIds = reviewedNumbers.map((number) => mapping.get(number));
  if (new Set(mappedIds).size !== mappedIds.length) throw new Error('Dos números de la guía apuntan a la misma especie');

  const author = requireOption('--author').trim();
  const uploadedBy = process.env.EDITORIAL_SYSTEM_USER_ID?.trim();
  const recordOwnerAttestation = process.argv.includes('--record-owner-attestation');
  if (recordOwnerAttestation && option('--evidence-path')) throw new Error('Elegí --record-owner-attestation o --evidence-path, no ambos');
  const evidencePath = recordOwnerAttestation && uploadedBy
    ? ownerAttestationPath(author, uploadedBy)
    : requireOption('--evidence-path').trim();
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (author.length < 2 || !evidencePath || !uploadedBy) throw new Error('Faltan autor, evidencia o EDITORIAL_SYSTEM_USER_ID');
  if (!url || !key) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en la sesión local');
  const storageBudgetBytes = Math.floor(positiveNumberOption('--storage-budget-mib') * 1024 * 1024);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const [{ data: evidence, error: evidenceError }, { data: editor, error: editorError }] = await Promise.all([
    recordOwnerAttestation ? Promise.resolve({ data: true, error: null }) : client.storage.from('media-evidence').download(evidencePath),
    client.from('editor_access').select('user_id,active').eq('user_id', uploadedBy).eq('active', true).single(),
  ]);
  if (evidenceError || !evidence) throw new Error(`No se encontró la autorización en media-evidence/${evidencePath}`);
  if (editorError || !editor) throw new Error('EDITORIAL_SYSTEM_USER_ID no corresponde a un acceso editorial activo');

  const species = await fetchMappedSpecies(client, mappedIds);
  if (species.length !== mappedIds.length || species.some((item) => item.class !== 'Aves' || item.status !== 'active')) {
    throw new Error('Una correspondencia apunta fuera de las aves activas');
  }
  const { error: rpcProbe } = await client.rpc('replace_guide_bird_media', { p_species_id: mappedIds[0], p_photos: [] });
  if (!rpcProbe || !rpcProbe.message.includes('guide_media_requires_one_or_two_photos')) {
    throw new Error(`Falta la migración transaccional de medios o falló su comprobación: ${rpcProbe?.message ?? 'respuesta inesperada'}`);
  }

  const existing = await fetchExistingMedia(client, mappedIds);
  const existingBySpecies = new Map();
  for (const row of existing) existingBySpecies.set(row.species_id, [...(existingBySpecies.get(row.species_id) ?? []), row]);

  const plan = planGuidePhotoUploads(reviewedSelected, mapping, existing);
  console.log(`Sustitución por especie: ${plan.planned.length} foto(s) preparadas; los medios previos se archivarán en la misma transacción que registra las nuevas.`);

  const prepared = [];
  for (const planned of plan.planned) {
    const { item, speciesId, alreadyRegistered } = planned;
    const main = await readFile(join(output, item.main));
    const thumbnail = await readFile(join(output, item.thumbnail));
    if (sha256(main) !== item.mainSha256 || sha256(thumbnail) !== item.thumbnailSha256) throw new Error(`Los derivados cambiaron desde el manifest: ${item.original}`);
    if (main.length > MAX_PUBLIC_OBJECT_BYTES || thumbnail.length > MAX_PUBLIC_OBJECT_BYTES) throw new Error(`Objeto mayor al límite de 12 MiB de media-public: ${item.original}`);
    const rows = existingBySpecies.get(speciesId) ?? [];
    const id = mediaId(item.number, item.ordinal);
    const dbRow = {
      id,
      species_id: speciesId,
      type: 'image',
      ordinal: item.ordinal,
      is_primary: item.ordinal === 1,
      status: 'approved',
      storage_path: item.storagePath,
      thumbnail_path: item.thumbnailPath,
      author,
      license: 'permission',
      source: 'Archivo fotográfico familiar',
      original_filename: item.original,
      evidence_path: evidencePath,
      authorization_evidence_ref: evidencePath,
      uploaded_by: uploadedBy,
      checksum_sha256: item.mainSha256,
      processed_at: new Date().toISOString(),
    };
    const old = rows.find((row) => row.id === id);
    if (old && !sameExistingRow(old, dbRow)) throw new Error(`El medio ${id} ya existe con metadatos distintos (guía ${item.number}/${item.ordinal})`);
    prepared.push({ item, main, thumbnail, dbRow, alreadyRegistered });
  }

  for (const entry of prepared) {
    const rows = existingBySpecies.get(entry.dbRow.species_id) ?? [];
    const collision = rows.find((row) => row.id !== entry.dbRow.id
      && (row.storage_path === entry.dbRow.storage_path || row.thumbnail_path === entry.dbRow.thumbnail_path));
    if (collision) throw new Error(`Ruta estable ocupada por ${collision.id}: ${entry.item.storagePath}`);
  }

  let newStorageBytes = 0;
  for (const entry of prepared) {
    for (const [path, expectedHash, body] of [
      [entry.item.storagePath, entry.item.mainSha256, entry.main],
      [entry.item.thumbnailPath, entry.item.thumbnailSha256, entry.thumbnail],
    ]) {
      const remote = await downloadAndHash(client, path);
      if (remote && remote.hash !== expectedHash) throw new Error(`Ruta de Storage ocupada por otro contenido: ${path}`);
      if (!remote) newStorageBytes += body.length;
    }
  }
  if (newStorageBytes > storageBudgetBytes) {
    throw new Error(`La carga necesita ${(newStorageBytes / 1024 / 1024).toFixed(2)} MiB y supera el presupuesto confirmado de ${(storageBudgetBytes / 1024 / 1024).toFixed(2)} MiB`);
  }
  console.log(`Preflight completo: ${prepared.length} fotos, ${(newStorageBytes / 1024 / 1024).toFixed(2)} MiB nuevos como máximo.`);

  if (recordOwnerAttestation) await ensureOwnerAttestation(client, evidencePath, author, uploadedBy);

  for (const entry of prepared) {
    await uploadVerified(client, entry.item.storagePath, entry.main, entry.item.mainSha256);
    await uploadVerified(client, entry.item.thumbnailPath, entry.thumbnail, entry.item.thumbnailSha256);
  }
  for (const number of reviewedNumbers) {
    const speciesId = mapping.get(number);
    const photos = prepared.filter((entry) => entry.dbRow.species_id === speciesId).map((entry) => entry.dbRow);
    const { error } = await client.rpc('replace_guide_bird_media', { p_species_id: speciesId, p_photos: photos });
    if (error) throw new Error(`No se pudo sustituir medios de la guía ${number}: ${error.message}`);
  }
  console.log(`Carga terminada: ${prepared.length} fotos verificadas para ${reviewedNumbers.length} especies; las anteriores permanecen archivadas.`);
}

async function main() {
  const output = resolve(requireOption('--out'));
  if (process.argv.includes('--plan')) {
    const report = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
    const mapping = parseMapping(await readFile(resolve(requireOption('--mapping')), 'utf8'));
    if (report.failedSelected?.length || report.ambiguities?.length) throw new Error('El manifiesto contiene fotos seleccionadas fallidas o ambiguas');
    console.log(JSON.stringify(summarizeGuidePlan(report, mapping), null, 2));
    return;
  }
  const photos = resolve(requireOption('--photos'));
  const report = await convertPhotos(photos, output);
  if (process.argv.includes('--upload')) await uploadPhotos(report, output);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
