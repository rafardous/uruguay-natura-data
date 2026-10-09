import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { required, stableUuid } from './shared';

const sourceRoot = resolve(import.meta.dirname, '../../NaturaUY-source');
const seed = JSON.parse(readFileSync(resolve(sourceRoot, 'data/raw/curated-plants/seed-100.json'), 'utf8')) as {
  arboles: Array<{ nombre: string; nombre_cientifico: string }>;
  otras_plantas_nativas: Array<{ nombre: string; nombre_cientifico: string }>;
};
const evidence = JSON.parse(readFileSync(resolve(sourceRoot, 'data/raw/curated-plants/baseline-evidence-100.json'), 'utf8')) as {
  records: Array<{ id: string; catalogCode: string; scientificName: string }>;
};
const selected = [...seed.arboles, ...seed.otras_plantas_nativas];
if (seed.arboles.length !== 50 || seed.otras_plantas_nativas.length !== 50 || new Set(selected.map((row) => row.nombre_cientifico)).size !== 100) {
  throw new Error('Selección botánica inválida: se requieren 50 + 50 especies únicas');
}
const byName = new Map(selected.map((row) => [row.nombre_cientifico, row]));
const evidenceByName = new Map(evidence.records.map((row) => [row.scientificName, row]));
const apply = process.argv.includes('--apply');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice(8)) : Number.POSITIVE_INFINITY;
if (!(limit > 0)) throw new Error('--limit debe ser positivo');

const client = createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${required('SUPABASE_EDITOR_ACCESS_TOKEN')}` } },
});
const { data: auth, error: authError } = await client.auth.getUser(required('SUPABASE_EDITOR_ACCESS_TOKEN'));
if (authError || !auth.user) throw new Error('Se requiere una sesión editorial válida');
const { data: access, error: accessError } = await client.from('editor_access').select('role,active').eq('user_id', auth.user.id).single();
if (accessError || access?.role !== 'admin' || access.active !== true) throw new Error('Se requiere una cuenta editorial administradora');
if (apply && process.env.EDITORIAL_BACKUP_VERIFIED !== 'true') throw new Error('Verificar y descargar un respaldo PostgreSQL cifrado antes de --apply');

type SpeciesRow = { id: string; catalog_code: string; scientific_name: string; common_name: string; kingdom: string; origin: string; status: string; primary_image_id: string | null; field_sources: Record<string, string[]> };
const rows: SpeciesRow[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await client.from('species').select('id,catalog_code,scientific_name,common_name,kingdom,origin,status,primary_image_id,field_sources').eq('kingdom', 'Plantae').range(from, from + 999);
  if (error) throw error;
  rows.push(...(data ?? []) as SpeciesRow[]);
  if (!data || data.length < 1000) break;
}
const active = rows.filter((row) => row.status === 'active');
const kept = rows.filter((row) => byName.has(row.scientific_name));
const missing = selected.filter((row) => !kept.some((item) => item.scientific_name === row.nombre_cientifico));
const identityMismatch = kept.filter((row) => {
  const prior = evidenceByName.get(row.scientific_name);
  return !prior || row.id !== stableUuid(`species:${prior.id}`) || row.catalog_code !== prior.catalogCode;
});
if (missing.length || identityMismatch.length) throw new Error(`Identidades botánicas incompatibles: faltantes=${missing.length}, diferencias=${identityMismatch.length}`);
const toArchive = active.filter((row) => !byName.has(row.scientific_name));
const toRename = active.filter((row) => byName.has(row.scientific_name) && row.common_name !== byName.get(row.scientific_name)!.nombre);
const report = {
  generatedAt: new Date().toISOString(),
  remotePlants: rows.length, activePlants: active.length, selected: 100,
  keep: kept.map((row) => ({ id: row.id, catalogCode: row.catalog_code, scientificName: row.scientific_name })),
  rename: toRename.map((row) => ({ id: row.id, current: row.common_name, next: byName.get(row.scientific_name)!.nombre })),
  archive: toArchive.map((row) => ({ id: row.id, catalogCode: row.catalog_code, scientificName: row.scientific_name })),
};
const reportDir = resolve(import.meta.dirname, '../data/reports');
mkdirSync(reportDir, { recursive: true });
writeFileSync(resolve(reportDir, 'plant-cutover-diff.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Flora remota: ${rows.length}; activas: ${active.length}; conservar: 100; renombrar: ${toRename.length}; archivar: ${toArchive.length}`);
if (!apply) process.exit(0);

const { error: schemaError } = await client.from('plant_profiles').select('height_min_cm,height_max_cm').limit(1);
if (schemaError) throw new Error(`Aplicar schema 13/14 y la migración del perfil botánico antes del recorte: ${schemaError.message}`);
const notReady: string[] = [];
const approvedImages = new Map<string, Array<{
  id: string; ordinal: number;
  storage_path: string | null; thumbnail_path: string | null; author: string | null;
  source: string | null; source_url: string | null; license: string | null;
  license_url: string | null; evidence_path: string | null;
}>>();
for (let offset = 0; offset < kept.length; offset += 100) {
  const { data, error } = await client.from('species_media')
    .select('id,species_id,ordinal,storage_path,thumbnail_path,author,source,source_url,license,license_url,evidence_path')
    .in('species_id', kept.slice(offset, offset + 100).map((row) => row.id))
    .eq('type', 'image').eq('status', 'approved');
  if (error) throw error;
  for (const image of data ?? []) approvedImages.set(image.species_id, [...(approvedImages.get(image.species_id) ?? []), image]);
}
for (const row of kept) {
  if (row.status !== 'active' || row.origin !== 'native' || !Array.isArray(row.field_sources?.origin) || !row.field_sources.origin.length) {
    notReady.push(`${row.scientific_name}: origen nativo sin fuente aprobada`);
  }
  const photos = (approvedImages.get(row.id) ?? []).sort((a, b) => a.ordinal - b.ordinal);
  const valid = photos.find((image) => image.id === row.primary_image_id) ?? photos[0];
  if (!valid || !(
    ['CC0', 'CC-BY-4.0', 'permission'].includes(valid.license ?? '')
    && valid.author && valid.source && valid.source_url
    && valid.storage_path && valid.thumbnail_path
    && (valid.license === 'permission' ? valid.evidence_path : valid.license_url)
  )) notReady.push(`${row.scientific_name}: falta foto principal aprobada con atribución y derechos`);
  else {
    for (const path of [valid.storage_path!, valid.thumbnail_path!]) {
      const { error } = await client.storage.from('media-public').info(path);
      if (error) notReady.push(`${row.scientific_name}: falta objeto ${path}`);
    }
  }
}
if (notReady.length) throw new Error(`Recorte bloqueado: las 100 plantas deben tener origen nativo documentado y foto aprobada en Storage (${notReady.length} faltantes). Primeros casos:\n${notReady.slice(0, 12).join('\n')}`);
const { data: pending, error: pendingError } = await client.from('species_changes').select('id,species_id,change_type,comment').eq('status', 'pending').eq('change_type', 'archive');
if (pendingError) throw pendingError;
const pendingArchive = new Map((pending ?? []).filter((row) => row.comment === 'Recorte curado de flora a 100 especies').map((row) => [row.species_id, row.id]));
const work = [
  ...toRename.map((row) => ({ type: 'update' as const, row })),
  ...toArchive.map((row) => ({ type: 'archive' as const, row })),
].slice(0, limit);
for (const [index, item] of work.entries()) {
  const { row, type } = item;
  let changeId = type === 'archive' ? pendingArchive.get(row.id) : undefined;
  if (!changeId) {
    const proposed = type === 'archive' ? {} : {
      common_name: byName.get(row.scientific_name)!.nombre,
      field_sources: { ...row.field_sources, commonName: ['natura_uy_editorial: seed-100'] },
    };
    const { data, error } = await client.rpc('submit_species_change', {
      p_species_id: row.id, p_change_type: type, p_proposed_values: proposed,
      p_comment: type === 'archive' ? 'Recorte curado de flora a 100 especies' : 'Nombre común de la selección botánica de 100 especies',
    });
    if (error) throw new Error(`${type} ${row.scientific_name}: ${error.message}`);
    changeId = String(data);
  }
  const { error } = await client.rpc('review_species_change', { p_change_id: changeId, p_approve: true, p_confirm_self_validation: true });
  if (error) throw new Error(`Revisión ${row.scientific_name}: ${error.message}`);
  if ((index + 1) % 25 === 0 || index + 1 === work.length) console.log(`Aprobadas ${index + 1}/${work.length} revisiones; se puede reanudar el comando`);
}
const { count, error: countError } = await client.from('species').select('id', { count: 'exact', head: true }).eq('kingdom', 'Plantae').eq('status', 'active');
if (countError) throw countError;
console.log(`Plantas activas tras el lote: ${count}`);
