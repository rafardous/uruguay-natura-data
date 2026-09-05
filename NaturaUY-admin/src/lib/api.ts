import type { CatalogRelease, ChangeRequest, DashboardStats, MediaAsset, Profile, Revision, SpeciesPayload, SpeciesSummary, UserReport } from '../domain';
import { demoMedia, demoProfile, demoReleases, demoRevisions, demoSpecies, demoStats } from './demo';
import { isDemoMode, supabase } from './supabase';

const assertClient = () => {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
};

export interface SpeciesFilters {
  query?: string;
  taxonomicClass?: string;
  lifecycle?: string;
  validationState?: string;
  missing?: 'image' | 'audio' | 'description' | '';
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'recent';
}

function mediaUrl(path: unknown) {
  return path ? assertClient().storage.from('media-public').getPublicUrl(String(path)).data.publicUrl : null;
}

function rowToPayload(row: Record<string, any>): SpeciesPayload {
  return {
    scientificName: row.scientific_name,
    acceptedName: row.accepted_name ?? '',
    commonNames: [row.common_name, ...(row.alternate_common_names ?? [])],
    taxonomy: { kingdom: row.kingdom ?? '', phylum: row.phylum ?? '', class: row.class ?? '', order: row.order_name ?? '', family: row.family ?? '', genus: row.genus ?? '' },
    origin: row.origin ?? 'unknown',
    establishment: row.establishment ?? 'uncertain',
    seasonality: row.seasonality ?? 'unknown',
    presenceCertainty: row.presence_certainty ?? 'uncertain',
    abundanceStatus: row.abundance_status ?? '',
    conservation: { system: row.conservation_system ?? '', category: row.conservation_category ?? 'NE', source: row.conservation_source ?? '', assessedAt: row.conservation_assessed_at ?? '' },
    description: row.description ?? '',
    habitat: row.habitat ?? [],
    diet: row.diet ?? [],
    size: row.size ?? '',
    relevantNote: row.relevant_note ?? '',
    sourceReferences: row.source_references ?? [],
  };
}

function payloadToColumns(catalogCode: string, payload: SpeciesPayload) {
  const names = payload.commonNames.map((name) => name.trim()).filter(Boolean);
  return {
    catalog_code: catalogCode.trim(), scientific_name: payload.scientificName.trim(), accepted_name: payload.acceptedName.trim() || null,
    common_name: names[0] || payload.scientificName.trim(), alternate_common_names: names.slice(1),
    kingdom: payload.taxonomy.kingdom, phylum: payload.taxonomy.phylum, class: payload.taxonomy.class,
    order_name: payload.taxonomy.order, family: payload.taxonomy.family, genus: payload.taxonomy.genus,
    origin: payload.origin, establishment: payload.establishment, seasonality: payload.seasonality,
    presence_certainty: payload.presenceCertainty, abundance_status: payload.abundanceStatus,
    conservation_system: payload.conservation.system, conservation_category: payload.conservation.category,
    conservation_source: payload.conservation.source, conservation_assessed_at: payload.conservation.assessedAt || null,
    description: payload.description, habitat: payload.habitat, diet: payload.diet, size: payload.size,
    relevant_note: payload.relevantNote, source_references: payload.sourceReferences,
  };
}

function mapSpecies(row: Record<string, any>): SpeciesSummary {
  return {
    id: row.id,
    catalogCode: row.catalog_code,
    lifecycle: row.status === 'archived' ? 'retired' : 'active',
    revision: 1,
    validationState: 'validated',
    validatedBy: null,
    validatedAt: null,
    payload: rowToPayload(row),
    updatedAt: row.updated_at,
    updatedBy: 'Catálogo aprobado',
    imageUrl: mediaUrl(row.primary_thumbnail_path ?? row.primary_storage_path),
    hasAudio: Boolean(row.has_audio),
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode) return demoStats;
  const { data, error } = await assertClient().from('dashboard_stats').select('*').single();
  if (error) throw error;
  return {
    activeSpecies: data.active_species, retiredSpecies: data.archived_species,
    unreviewedSpecies: data.pending_changes, withImage: data.with_image, withAudio: data.with_audio,
    pendingMedia: data.pending_media, dirtyChanges: data.dirty_changes,
    lastRelease: data.last_release_version ? String(data.last_release_version) : null, lastPublishedAt: data.last_published_at,
  };
}

export async function listSpecies(filters: SpeciesFilters = {}): Promise<{ rows: SpeciesSummary[]; count: number }> {
  if (isDemoMode) return { rows: demoSpecies, count: demoSpecies.length };
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 50;
  let request = assertClient().from('species_editor').select('*', { count: 'exact' });
  if (filters.query) {
    const query = filters.query.replaceAll(',', '').trim();
    request = request.or(`common_name.ilike.%${query}%,scientific_name.ilike.%${query}%,family.ilike.%${query}%,catalog_code.ilike.%${query}%`);
  }
  if (filters.taxonomicClass) request = request.eq('class', filters.taxonomicClass);
  if (filters.lifecycle) request = request.eq('status', filters.lifecycle === 'retired' ? 'archived' : filters.lifecycle);
  if (filters.missing === 'image') request = request.is('primary_storage_path', null);
  if (filters.missing === 'audio') request = request.eq('has_audio', false);
  if (filters.missing === 'description') request = request.or('description.is.null,description.eq.');
  request = filters.sort === 'recent'
    ? request.order('updated_at', { ascending: false })
    : request.order('common_name');
  const { data, count, error } = await request.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []).map(mapSpecies), count: count ?? 0 };
}

export async function getSpecies(id: string): Promise<{ species: SpeciesSummary; revisions: Revision[] }> {
  if (isDemoMode) {
    const species = demoSpecies.find((item) => item.id === id);
    if (!species) throw new Error('Especie no encontrada');
    return { species, revisions: demoRevisions(species) };
  }
  const client = assertClient();
  const [{ data: row, error }, { data: audits, error: auditError }] = await Promise.all([
    client.from('species_editor').select('*').eq('id', id).single(),
    client.from('species_audit_history').select('*').eq('species_id', id).order('id', { ascending: false }),
  ]);
  if (error) throw error;
  if (auditError) throw auditError;
  const species = mapSpecies(row);
  return {
    species,
    revisions: (audits ?? []).map((audit, index) => ({
      id: String(audit.id), revision: (audits?.length ?? 0) - index, payload: species.payload,
      validationState: 'validated', editedBy: audit.proposed_by_name, editedAt: audit.created_at,
      validatedBy: audit.validated_by_name, validatedAt: audit.created_at,
      reason: `Campos aprobados: ${Object.keys(audit.after_values ?? {}).join(', ') || 'alta inicial'}`,
    })),
  };
}

function changedColumns(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key])));
}

export async function saveSpecies(input: { id?: string; catalogCode: string; payload: SpeciesPayload; baseUpdatedAt: string | null; reason: string }): Promise<string> {
  if (isDemoMode) return crypto.randomUUID();
  const columns = payloadToColumns(input.catalogCode, input.payload);
  let proposedChanges: Record<string, unknown> = columns;
  if (input.id) {
    const { data: current, error: currentError } = await assertClient().from('species').select('*').eq('id', input.id).single();
    if (currentError) throw currentError;
    proposedChanges = changedColumns(current, columns);
    if (!Object.keys(proposedChanges).length) throw new Error('No hay cambios para enviar.');
  }
  const { data, error } = await assertClient().rpc('submit_species_change', {
    p_species_id: input.id ?? null,
    p_change_type: input.id ? 'update' : 'create',
    p_proposed_changes: proposedChanges,
    p_comment: input.reason || null,
  });
  if (error) throw error;
  return String(data);
}

export async function findOwnPendingCreateRequest(catalogCode: string): Promise<string | null> {
  if (isDemoMode) return null;
  const client = assertClient();
  const { data: user, error: userError } = await client.auth.getUser();
  if (userError || !user.user) throw userError ?? new Error('No hay una sesión activa.');
  const { data, error } = await client.from('species_change_requests').select('id')
    .eq('proposed_by', user.user.id).eq('change_type', 'create').eq('status', 'pending')
    .contains('proposed_changes', { catalog_code: catalogCode }).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function submitLifecycleChange(species: SpeciesSummary, status: 'active' | 'archived', reason: string) {
  if (isDemoMode) return;
  const { error } = await assertClient().rpc('submit_species_change', {
    p_species_id: species.id, p_change_type: 'update', p_proposed_changes: { status }, p_comment: reason,
  });
  if (error) throw error;
}

export async function listChangeRequests(): Promise<ChangeRequest[]> {
  if (isDemoMode) return [];
  const { data, error } = await assertClient().from('change_request_queue').select('*').eq('status', 'pending').order('created_at');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, speciesId: row.species_id, catalogCode: row.catalog_code, scientificName: row.scientific_name,
    commonName: row.common_name, changeType: row.change_type, currentValues: row.current_values ?? {}, proposedChanges: row.proposed_changes,
    proposedBy: row.proposed_by, proposedByName: row.proposed_by_name, comment: row.comment ?? '', createdAt: row.created_at,
  }));
}

export async function approveChangeRequest(id: string, confirmSelfValidation: boolean) {
  if (isDemoMode) return;
  const { error } = await assertClient().rpc('approve_species_change', { p_request_id: id, p_confirm_self_validation: confirmSelfValidation });
  if (error) throw error;
}

export async function rejectChangeRequest(id: string) {
  if (isDemoMode) return;
  const { error } = await assertClient().rpc('reject_species_change', { p_request_id: id });
  if (error) throw error;
}

export async function listMedia(): Promise<MediaAsset[]> {
  if (isDemoMode) return demoMedia;
  const { data, error } = await assertClient().from('media_queue').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, jobId: row.job_id ?? null, speciesId: row.species_id, speciesName: row.species_name ?? 'Alta pendiente',
    kind: row.type, state: row.processing_status === 'failed' ? 'failed' : row.processing_status === 'processing' ? 'processing' : row.processing_status === 'pending' ? 'incoming' : row.status === 'approved' ? 'ready' : row.status === 'pending' ? 'pending' : row.status,
    author: row.author, license: row.license, sourceUrl: row.source_url ?? '', uploadedBy: row.uploaded_by_name,
    createdAt: row.created_at, error: row.processing_error ?? null,
  }));
}

export interface ReservedMediaUpload { mediaId: string; jobId: string; changeRequestId: string; incomingPath: string }
export async function reserveMediaUpload(input: { speciesId: string | null; changeRequestId?: string | null; kind: 'image' | 'audio'; author: string; license: MediaAsset['license']; source: string; sourceUrl: string; originalFilename: string; makePrimary: boolean; confirmRights: boolean; clipStartSeconds?: number; clipDurationSeconds?: number }): Promise<ReservedMediaUpload> {
  if (isDemoMode) return { mediaId: crypto.randomUUID(), jobId: crypto.randomUUID(), changeRequestId: crypto.randomUUID(), incomingPath: 'demo' };
  const { data, error } = await assertClient().rpc('reserve_species_media_upload', {
    p_species_id: input.speciesId, p_change_request_id: input.changeRequestId ?? null, p_type: input.kind,
    p_author: input.author, p_license: input.license, p_source: input.source,
    p_source_url: input.sourceUrl || null, p_original_filename: input.originalFilename,
    p_make_primary: input.makePrimary, p_confirm_rights: input.confirmRights,
    p_clip_start_seconds: input.clipStartSeconds ?? null, p_clip_duration_seconds: input.clipDurationSeconds ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { mediaId: row.media_id, jobId: row.job_id, changeRequestId: row.change_request_id, incomingPath: row.incoming_path };
}

export async function requestMediaProcessing(jobId: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await assertClient().functions.invoke('request-media-processing', { body: { jobId } });
  if (error) throw error;
}

export async function listReleases(): Promise<CatalogRelease[]> {
  if (isDemoMode) return demoReleases;
  const { data, error } = await assertClient().from('catalog_release_history').select('*').order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, dataVersion: row.version, status: row.status, requestedBy: row.requested_by_name, requestedAt: row.requested_at, publishedAt: row.published_at, speciesCount: row.species_count, databaseSize: row.database_size, qualityReportUrl: row.quality_report_url, error: row.error }));
}

export async function requestPublish(): Promise<void> {
  if (isDemoMode) return;
  const { data, error } = await assertClient().rpc('request_catalog_publish');
  if (error) throw error;
  const dispatch = await assertClient().functions.invoke('request-catalog-publish', { body: { releaseId: data } });
  if (dispatch.error) throw dispatch.error;
}

export async function listUsers(): Promise<Profile[]> {
  if (isDemoMode) return [demoProfile];
  const { data, error } = await assertClient().from('admin_profiles').select('*').order('display_name');
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.user_id, displayName: row.display_name, email: row.email, role: row.role, active: row.active, mfaRequired: row.role === 'admin' }));
}

export async function inviteUser(email: string, displayName: string, role: Profile['role']): Promise<void> {
  if (isDemoMode) return;
  const { error } = await assertClient().functions.invoke('invite-user', { body: { email, displayName, role } });
  if (error) throw error;
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  if (isDemoMode) return;
  const { error } = await assertClient().functions.invoke('set-user-active', { body: { userId, active } });
  if (error) throw error;
}

export async function listUserReports(): Promise<UserReport[]> {
  if (isDemoMode) return [];
  const { data, error } = await assertClient().from('feedback_queue').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, kind: row.type, speciesId: row.species_id, description: row.message, state: row.status, reporterId: row.user_id, createdAt: row.created_at }));
}

export async function resolveUserReport(report: UserReport): Promise<void> {
  if (isDemoMode) return;
  const functionName = report.kind === 'bug' ? 'resolve_bug_report' : report.kind === 'suggestion' ? 'resolve_suggestion' : 'resolve_review_request';
  const { error } = await assertClient().rpc(functionName, { p_id: report.id });
  if (error) throw error;
}
