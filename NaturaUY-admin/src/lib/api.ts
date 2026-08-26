import type { CatalogRelease, DashboardStats, MediaAsset, Profile, Revision, SpeciesPayload, SpeciesSummary, UserReport } from '../domain';
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
}

function mapSpecies(row: Record<string, unknown>): SpeciesSummary {
  return {
    id: String(row.id), catalogCode: String(row.catalog_code), lifecycle: row.lifecycle as SpeciesSummary['lifecycle'],
    revision: Number(row.revision), validationState: row.validation_state as SpeciesSummary['validationState'],
    validatedBy: row.validated_by_name ? String(row.validated_by_name) : null,
    validatedAt: row.validated_at ? String(row.validated_at) : null,
    payload: row.payload as unknown as SpeciesPayload, updatedAt: String(row.updated_at),
    updatedBy: String(row.updated_by_name ?? 'Sistema'), imageUrl: row.image_url ? String(row.image_url) : null,
    hasAudio: Boolean(row.has_audio),
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode) return demoStats;
  const { data, error } = await assertClient().from('dashboard_stats').select('*').single();
  if (error) throw error;
  return {
    activeSpecies: data.active_species, retiredSpecies: data.retired_species,
    unreviewedSpecies: data.unreviewed_species, withImage: data.with_image, withAudio: data.with_audio,
    pendingMedia: data.pending_media, dirtyChanges: data.dirty_changes,
    lastRelease: data.last_release ? String(data.last_release) : null, lastPublishedAt: data.last_published_at,
  };
}

export async function listSpecies(filters: SpeciesFilters = {}): Promise<{ rows: SpeciesSummary[]; count: number }> {
  if (isDemoMode) {
    const query = filters.query?.trim().toLocaleLowerCase('es') ?? '';
    const rows = demoSpecies.filter((item) => {
      const text = `${item.payload.commonNames.join(' ')} ${item.payload.scientificName} ${item.payload.taxonomy.family} ${item.catalogCode}`.toLocaleLowerCase('es');
      return (!query || text.includes(query)) && (!filters.taxonomicClass || item.payload.taxonomy.class === filters.taxonomicClass)
        && (!filters.lifecycle || item.lifecycle === filters.lifecycle) && (!filters.validationState || item.validationState === filters.validationState)
        && (!filters.missing || (filters.missing === 'image' ? !item.imageUrl : filters.missing === 'audio' ? !item.hasAudio : !item.payload.description));
    });
    return { rows, count: rows.length };
  }
  const page = filters.page ?? 0; const pageSize = filters.pageSize ?? 50;
  let request = assertClient().from('species_current').select('*', { count: 'exact' });
  if (filters.query) request = request.or(`search_text.ilike.%${filters.query.replaceAll(',', '')}%,catalog_code.ilike.%${filters.query.replaceAll(',', '')}%`);
  if (filters.taxonomicClass) request = request.eq('taxonomic_class', filters.taxonomicClass);
  if (filters.lifecycle) request = request.eq('lifecycle', filters.lifecycle);
  if (filters.validationState) request = request.eq('validation_state', filters.validationState);
  if (filters.missing === 'image') request = request.is('image_url', null);
  if (filters.missing === 'audio') request = request.eq('has_audio', false);
  if (filters.missing === 'description') request = request.eq('has_description', false);
  const { data, count, error } = await request.order('display_name').range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []).map((row) => mapSpecies(row)), count: count ?? 0 };
}

export async function getSpecies(id: string): Promise<{ species: SpeciesSummary; revisions: Revision[] }> {
  if (isDemoMode) {
    const species = demoSpecies.find((item) => item.id === id); if (!species) throw new Error('Especie no encontrada');
    return { species, revisions: demoRevisions(species) };
  }
  const client = assertClient();
  const [{ data: row, error }, { data: revisions, error: revisionError }] = await Promise.all([
    client.from('species_current').select('*').eq('id', id).single(),
    client.from('species_revision_history').select('*').eq('species_id', id).order('revision', { ascending: false }),
  ]);
  if (error) throw error; if (revisionError) throw revisionError;
  return {
    species: mapSpecies(row),
    revisions: (revisions ?? []).map((revision) => ({
      id: revision.id, revision: revision.revision, payload: revision.payload,
      validationState: revision.validation_state, editedBy: revision.edited_by_name,
      editedAt: revision.edited_at, validatedBy: revision.validated_by_name,
      validatedAt: revision.validated_at, reason: revision.reason,
    })),
  };
}

export async function saveSpecies(input: { id?: string; catalogCode: string; payload: SpeciesPayload; expectedRevision: number; reason: string }): Promise<string> {
  if (isDemoMode) {
    const now = new Date().toISOString(); const existing = demoSpecies.find((item) => item.id === input.id);
    if (existing) { if (existing.revision !== input.expectedRevision) throw new Error('revision_conflict'); Object.assign(existing, { payload: input.payload, revision: existing.revision + 1, validationState: 'unreviewed', updatedAt: now, updatedBy: demoProfile.displayName }); return existing.id; }
    const id = crypto.randomUUID(); demoSpecies.unshift({ id, catalogCode: input.catalogCode, lifecycle: 'active', revision: 1, validationState: 'unreviewed', validatedBy: null, validatedAt: null, payload: input.payload, updatedAt: now, updatedBy: demoProfile.displayName, imageUrl: null, hasAudio: false }); return id;
  }
  const { data, error } = await assertClient().rpc('save_species', { p_species_id: input.id ?? null, p_catalog_code: input.catalogCode, p_payload: input.payload, p_expected_revision: input.expectedRevision, p_reason: input.reason });
  if (error) throw error; return String(data);
}

export async function speciesAction(action: 'retire_species' | 'restore_species' | 'validate_revision', speciesId: string, expectedRevision: number, reason = ''): Promise<void> {
  if (isDemoMode) {
    const species = demoSpecies.find((item) => item.id === speciesId); if (!species) return;
    if (species.revision !== expectedRevision) throw new Error('revision_conflict');
    if (action === 'retire_species') species.lifecycle = 'retired'; else if (action === 'restore_species') species.lifecycle = 'active'; else { species.validationState = 'validated'; species.validatedBy = demoProfile.displayName; species.validatedAt = new Date().toISOString(); }
    return;
  }
  const args = action === 'validate_revision' ? { p_species_id: speciesId, p_expected_revision: expectedRevision } : { p_species_id: speciesId, p_expected_revision: expectedRevision, p_reason: reason };
  const { error } = await assertClient().rpc(action, args); if (error) throw error;
}

export async function rollbackRevision(speciesId: string, revision: number, expectedRevision: number, reason: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await assertClient().rpc('rollback_revision', { p_species_id: speciesId, p_revision: revision, p_expected_revision: expectedRevision, p_reason: reason }); if (error) throw error;
}

export async function listMedia(): Promise<MediaAsset[]> {
  if (isDemoMode) return demoMedia;
  const { data, error } = await assertClient().from('media_queue').select('*').order('created_at', { ascending: false }); if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, jobId: row.job_id ?? null, speciesId: row.species_id, speciesName: row.species_name, kind: row.kind, state: row.state, author: row.author, license: row.license, sourceUrl: row.source_url ?? '', uploadedBy: row.uploaded_by_name, createdAt: row.created_at, error: row.error }));
}

export async function createMediaAsset(input: { speciesId: string; kind: 'image' | 'audio'; author: string; license: MediaAsset['license']; sourceUrl: string; evidenceKey: string | null; incomingKey: string; clipStartSeconds?: number; clipDurationSeconds?: number }): Promise<string> {
  if (isDemoMode) return crypto.randomUUID();
  const { data, error } = await assertClient().rpc('create_media_asset', { p_species_id: input.speciesId, p_kind: input.kind, p_author: input.author, p_license: input.license, p_source_url: input.sourceUrl || null, p_evidence_key: input.evidenceKey, p_incoming_key: input.incomingKey, p_terms_version: '2026-08-26', p_clip_start_seconds: input.clipStartSeconds ?? null, p_clip_duration_seconds: input.clipDurationSeconds ?? null });
  if (error) throw error; return String(data);
}

export async function requestMediaProcessing(jobId: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await assertClient().functions.invoke('request-media-processing', { body: { jobId } }); if (error) throw error;
}

export async function listReleases(): Promise<CatalogRelease[]> {
  if (isDemoMode) return demoReleases;
  const { data, error } = await assertClient().from('catalog_release_history').select('*').order('data_version', { ascending: false }); if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, dataVersion: row.data_version, status: row.status, requestedBy: row.requested_by_name, requestedAt: row.requested_at, publishedAt: row.published_at, speciesCount: row.species_count, databaseSize: row.database_size, qualityReportUrl: row.quality_report_url, error: row.error }));
}

export async function requestPublish(): Promise<void> {
  if (isDemoMode) { demoStats.dirtyChanges = 0; return; }
  const { data, error } = await assertClient().rpc('request_publish'); if (error) throw error;
  const dispatch = await assertClient().functions.invoke('request-catalog-publish', { body: { releaseId: data } }); if (dispatch.error) throw dispatch.error;
}

export async function listUsers(): Promise<Profile[]> {
  if (isDemoMode) return [demoProfile, { id: '2', displayName: 'Agustín Morelle', email: 'agustin@natura.uy', role: 'collaborator', active: true, mfaRequired: false }];
  const { data, error } = await assertClient().from('admin_profiles').select('*').order('display_name'); if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, role: row.role, active: row.is_active, mfaRequired: row.mfa_required }));
}

export async function inviteUser(email: string, displayName: string, role: Profile['role']): Promise<void> {
  if (isDemoMode) return;
  const { error } = await assertClient().functions.invoke('invite-user', { body: { email, displayName, role } }); if (error) throw error;
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  if (isDemoMode) return;
  const { error } = await assertClient().functions.invoke('set-user-active', { body: { userId, active } }); if (error) throw error;
}

export async function listUserReports(): Promise<UserReport[]> {
  if (isDemoMode) return [];
  const { data, error } = await assertClient().from('editor_report_queue').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, kind: row.kind, catalogCode: row.catalog_code, description: row.description,
    appVersion: row.app_version, platform: row.platform, state: row.state,
    reporterName: row.reporter_name, reporterAlias: row.reporter_alias, createdAt: row.created_at,
  }));
}

export async function resolveUserReport(id: string, state: 'reviewing' | 'resolved' | 'dismissed', note = ''): Promise<void> {
  if (isDemoMode) return;
  const { error } = await assertClient().rpc('resolve_user_report', { p_report_id: id, p_state: state, p_resolution_note: note || null });
  if (error) throw error;
}
