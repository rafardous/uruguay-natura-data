import type { CatalogRelease, ChangeRequest, CollaboratorApplication, DashboardStats, HomeNews, MediaAsset, NavigationCounts, Profile, Revision, SpeciesPayload, SpeciesSummary, UserReport } from '../domain';
import { supabase } from './supabase';

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

function resolveSpeciesImage(media: Array<Record<string, any>>) {
  const images = media.filter((item) => item.type === 'image');
  const approved = images.find((item) => item.status === 'approved' && item.is_primary)
    ?? images.find((item) => item.status === 'approved');
  const legacy = images.find((item) => item.status === 'archived' && item.license === 'legacy' && item.source_url);
  const selected = approved ?? legacy;
  const storedUrl = approved ? mediaUrl(approved.thumbnail_path ?? approved.storage_path) : null;
  return {
    imageUrl: storedUrl ?? (selected?.source_url ? String(selected.source_url) : null),
    imageSourceUrl: selected?.source_url ? String(selected.source_url) : null,
    imageIsLegacy: !approved && Boolean(legacy),
  };
}

function rowToPayload(row: Record<string, any>): SpeciesPayload {
  const traits = row.traits && typeof row.traits === 'object' ? row.traits : {};
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
    traits: {
      measurements: Array.isArray(traits.measurements) ? traits.measurements : [],
      lifeModes: Array.isArray(traits.lifeModes) ? traits.lifeModes : [],
      activity: Array.isArray(traits.activity) ? traits.activity : [],
      aquaticEnvironments: Array.isArray(traits.aquaticEnvironments) ? traits.aquaticEnvironments : [],
      waterZones: Array.isArray(traits.waterZones) ? traits.waterZones : [],
      depthMinM: typeof traits.depthMinM === 'number' ? traits.depthMinM : null,
      depthMaxM: typeof traits.depthMaxM === 'number' ? traits.depthMaxM : null,
      sources: Array.isArray(traits.sources) ? traits.sources : [],
    },
    relevantNote: row.relevant_note ?? '',
    sourceReferences: row.field_sources?.general ?? [],
  };
}

function payloadToColumns(catalogCode: string, payload: SpeciesPayload) {
  const names = [...new Map(payload.commonNames
    .map((name) => name.normalize('NFC').replace(/\s+/g, ' ').trim()).filter(Boolean)
    .map((name) => [name.normalize('NFKC').replace(/\p{Cf}/gu, '').toLocaleLowerCase('es'), name])).values()];
  return {
    catalog_code: catalogCode.trim(), scientific_name: payload.scientificName.trim(), accepted_name: payload.acceptedName.trim() || null,
    common_name: names[0] || payload.scientificName.trim(), alternate_common_names: names.slice(1),
    kingdom: payload.taxonomy.kingdom, phylum: payload.taxonomy.phylum, class: payload.taxonomy.class,
    order_name: payload.taxonomy.order, family: payload.taxonomy.family, genus: payload.taxonomy.genus,
    origin: payload.origin, establishment: payload.establishment, seasonality: payload.seasonality,
    presence_certainty: payload.presenceCertainty, abundance_status: payload.abundanceStatus,
    conservation_system: payload.conservation.system, conservation_category: payload.conservation.category,
    conservation_source: payload.conservation.source, conservation_assessed_at: payload.conservation.assessedAt || null,
    description: payload.description, habitat: payload.habitat, diet: payload.diet, size: payload.size, traits: payload.traits,
    relevant_note: payload.relevantNote, field_sources: { general: payload.sourceReferences.filter(Boolean) },
  };
}

function mapSpecies(row: Record<string, any>): SpeciesSummary {
  const media = (row.media ?? []) as Array<Record<string, any>>;
  const image = resolveSpeciesImage(media);
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
    ...image,
    hasAudio: media.some((item) => item.type === 'audio' && item.status === 'approved'),
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
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
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 50;
  let request = assertClient().from('species_editor').select('*', { count: 'exact' });
  if (filters.query) {
    const query = filters.query.replaceAll(',', '').trim();
    request = request.or(`search_names.ilike.%${query}%,scientific_name.ilike.%${query}%,family.ilike.%${query}%,catalog_code.ilike.%${query}%`);
  }
  if (filters.taxonomicClass) request = request.eq('class', filters.taxonomicClass);
  if (filters.lifecycle) request = request.eq('status', filters.lifecycle === 'retired' ? 'archived' : filters.lifecycle);
  // Media filtering is performed client-side because the lean view exposes a JSON gallery.
  if (filters.missing === 'description') request = request.or('description.is.null,description.eq.');
  request = filters.sort === 'recent'
    ? request.order('updated_at', { ascending: false })
    : request.order('common_name');
  const { data, count, error } = await request.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  const rows = (data ?? []).map(mapSpecies).filter((item) => filters.missing === 'image' ? !item.imageUrl : filters.missing === 'audio' ? !item.hasAudio : true);
  return { rows, count: filters.missing ? rows.length : count ?? 0 };
}

export async function getSpecies(id: string): Promise<{ species: SpeciesSummary; revisions: Revision[] }> {
  const client = assertClient();
  const [{ data: row, error }, { data: audits, error: auditError }] = await Promise.all([
    client.from('species_editor').select('*').eq('id', id).single(),
    client.from('species_changes').select('*').eq('species_id', id).eq('status', 'approved').order('reviewed_at', { ascending: false }),
  ]);
  if (error) throw error;
  if (auditError) throw auditError;
  const species = mapSpecies(row);
  return {
    species,
    revisions: (audits ?? []).map((audit, index) => ({
      id: String(audit.id), revision: (audits?.length ?? 0) - index, payload: species.payload,
      validationState: 'validated', editedBy: audit.proposed_by, editedAt: audit.created_at,
      validatedBy: audit.reviewed_by, validatedAt: audit.reviewed_at,
      reason: `Campos aprobados: ${Object.keys(audit.after_values ?? {}).join(', ') || 'alta inicial'}`,
    })),
  };
}

function changedColumns(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key])));
}

export async function saveSpecies(input: { id?: string; catalogCode: string; payload: SpeciesPayload; baseUpdatedAt: string | null; reason: string }): Promise<string> {
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
    p_proposed_values: proposedChanges,
    p_comment: input.reason || null,
  });
  if (error) throw error;
  return String(data);
}

export async function findOwnPendingCreateRequest(catalogCode: string): Promise<string | null> {
  const client = assertClient();
  const { data: user, error: userError } = await client.auth.getUser();
  if (userError || !user.user) throw userError ?? new Error('No hay una sesión activa.');
  const { data, error } = await client.from('species_changes').select('id')
    .eq('proposed_by', user.user.id).eq('change_type', 'create').eq('status', 'pending')
    .contains('proposed_values', { catalog_code: catalogCode }).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function submitLifecycleChange(species: SpeciesSummary, status: 'active' | 'archived', reason: string) {
  const { error } = await assertClient().rpc('submit_species_change', {
    p_species_id: species.id, p_change_type: status === 'archived' ? 'archive' : 'update', p_proposed_values: { status }, p_comment: reason,
  });
  if (error) throw error;
}

export async function listChangeRequests(): Promise<ChangeRequest[]> {
  const client = assertClient();
  const { data, error } = await client.from('change_request_queue').select('*').eq('status', 'pending').order('created_at');
  if (error) throw error;
  const speciesIds = [...new Set((data ?? []).map((row) => row.species_id).filter(Boolean))];
  const imageBySpecies = new Map<string, string | null>();
  if (speciesIds.length) {
    const { data: speciesRows, error: speciesError } = await client.from('species_editor').select('id,media').in('id', speciesIds);
    if (speciesError) throw speciesError;
    for (const row of speciesRows ?? []) imageBySpecies.set(row.id, resolveSpeciesImage(row.media ?? []).imageUrl);
  }
  return (data ?? []).map((row) => ({
    id: row.id, speciesId: row.species_id, catalogCode: row.catalog_code, scientificName: row.scientific_name,
    commonName: row.common_name, changeType: row.change_type, currentValues: row.before_values ?? {}, proposedChanges: row.proposed_values,
    proposedBy: row.proposed_by, proposedByName: row.proposed_by_name, comment: row.comment ?? '', createdAt: row.created_at,
    imageUrl: row.species_id ? imageBySpecies.get(row.species_id) ?? null : null,
  }));
}

export async function getNavigationCounts(): Promise<NavigationCounts> {
  const client = assertClient();
  const [reviews, content, reports] = await Promise.all([
    client.from('species_changes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('content_changes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('feedback').select('id', { count: 'exact', head: true }).in('status', ['open', 'reviewing']),
  ]);
  if (reviews.error) throw reviews.error;
  if (content.error) throw content.error;
  if (reports.error) throw reports.error;
  return { pendingReviews: reviews.count ?? 0, pendingContent: content.count ?? 0, openReports: reports.count ?? 0 };
}

export interface CatalogSource { id: string; code: string; name: string; license: string; usePolicy: string }
export interface ContentChangeRow { id: string; contentType: string; entityId: string | null; speciesId: string | null; speciesName: string | null; proposedValues: Record<string, unknown>; proposedByName: string; comment: string; createdAt: string }
export interface EnrichmentCandidateRow { id:string; scientificName:string; fieldPath:string; currentValue:unknown; proposedValue:unknown; sourceCode:string; confidence:number|null; status:string; rationale:string }
export interface TaxonContentRow { id:string; taxonRank:'phylum'|'class'|'order'|'family'; kingdom:string; phylum:string; className:string; taxonName:string; simpleName:string|null; language:string; description:string; sourceId:string; active:boolean }
export interface ApprovedImageRow { id:string; speciesId:string; label:string }

export async function listCatalogSources(): Promise<CatalogSource[]> {
  const { data, error } = await assertClient().from('catalog_sources').select('id,code,name,license,use_policy').eq('active', true).order('name');
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name, license: row.license, usePolicy: row.use_policy }));
}

export async function listContentChanges(): Promise<ContentChangeRow[]> {
  const { data, error } = await assertClient().from('content_review_queue').select('*').eq('status', 'pending').order('created_at');
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, contentType: row.content_type, entityId: row.entity_id, speciesId: row.species_id, speciesName: row.common_name ?? row.scientific_name ?? null, proposedValues: row.proposed_values ?? {}, proposedByName: row.proposed_by_name, comment: row.comment ?? '', createdAt: row.created_at }));
}

export async function listTaxonContent(): Promise<TaxonContentRow[]> {
  const { data,error }=await assertClient().from('taxon_content').select('id,taxon_rank,kingdom,phylum,class_name,taxon_name,simple_name,language,description,source_id,active').eq('active',true).order('class_name').order('taxon_rank').order('taxon_name');
  if(error)throw error;
  return (data??[]).map((row)=>({id:row.id,taxonRank:row.taxon_rank,kingdom:row.kingdom,phylum:row.phylum,className:row.class_name,taxonName:row.taxon_name,simpleName:row.simple_name??null,language:row.language,description:row.description,sourceId:row.source_id,active:row.active}));
}

export async function listApprovedImages(speciesId?:string):Promise<ApprovedImageRow[]> {
  let request=assertClient().from('species_media').select('id,species_id,author,source,species(common_name)').eq('type','image').eq('status','approved').order('created_at',{ascending:false}).limit(250);
  if(speciesId)request=request.eq('species_id',speciesId);
  const {data,error}=await request;if(error)throw error;
  return (data??[]).map((row:any)=>({id:row.id,speciesId:row.species_id,label:`${row.species?.common_name??'Especie'} · ${row.author} · ${row.source}`}));
}

export async function submitContentChange(input: { contentType: 'abundance'|'game_profile'|'game_rule'|'fact'|'trivia'|'taxon_content'; entityId?: string|null; speciesId?: string|null; operation?: 'upsert'|'archive'; values: Record<string, unknown>; comment?: string }): Promise<string> {
  const { data, error } = await assertClient().rpc('submit_content_change', { p_content_type: input.contentType, p_entity_id: input.entityId ?? null, p_species_id: input.speciesId ?? null, p_operation: input.operation ?? 'upsert', p_proposed_values: input.values, p_comment: input.comment ?? null });
  if (error) throw error;
  return String(data);
}

export async function reviewContentChange(id: string, approve: boolean, confirmSelfValidation: boolean): Promise<void> {
  const { error } = await assertClient().rpc('review_content_change', { p_change_id: id, p_approve: approve, p_confirm_self_validation: confirmSelfValidation });
  if (error) throw error;
}

export async function listEnrichmentCandidates(): Promise<EnrichmentCandidateRow[]> {
  const { data,error }=await assertClient().from('enrichment_candidates').select('id,scientific_name,field_path,current_value,proposed_value,confidence,status,rationale,catalog_sources(code)').in('status',['pending','conflict']).order('created_at').limit(500);
  if(error)throw error;
  return (data??[]).map((row:any)=>({id:row.id,scientificName:row.scientific_name,fieldPath:row.field_path,currentValue:row.current_value,proposedValue:row.proposed_value,sourceCode:row.catalog_sources?.code??'',confidence:row.confidence,status:row.status,rationale:row.rationale??''}));
}

export async function triageEnrichmentCandidate(id:string,accept:boolean):Promise<void>{
  const {error}=await assertClient().rpc('triage_enrichment_candidate',{p_candidate_id:id,p_accept:accept,p_comment:accept?'Promovido a revisión editorial':'Descartado durante la curaduría'});if(error)throw error;
}

export async function approveChangeRequest(id: string, confirmSelfValidation: boolean) {
  const { error } = await assertClient().rpc('review_species_change', { p_change_id: id, p_approve: true, p_confirm_self_validation: confirmSelfValidation });
  if (error) throw error;
}

export async function rejectChangeRequest(id: string) {
  const { error } = await assertClient().rpc('review_species_change', { p_change_id: id, p_approve: false, p_confirm_self_validation: false });
  if (error) throw error;
}

export async function listMedia(): Promise<MediaAsset[]> {
  const { data, error } = await assertClient().from('media_queue').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, jobId: row.id, speciesId: row.species_id, speciesName: row.species_name ?? 'Alta pendiente',
    kind: row.type, state: row.status === 'reserved' ? 'incoming' : row.status === 'ready' ? 'pending' : row.status === 'approved' ? 'ready' : row.status,
    author: row.author, license: row.license, originalLicense: row.original_license ?? null, externalId: row.external_id ?? null,
    authorizationEvidenceRef: row.authorization_evidence_ref ?? null, sourceUrl: row.source_url ?? '', uploadedBy: row.uploaded_by_name,
    createdAt: row.created_at, error: row.processing_error ?? null,
  }));
}

export interface ReservedMediaUpload { mediaId: string; jobId: string; changeRequestId: string | null; incomingPath: string }
export async function reserveMediaUpload(input: { speciesId: string | null; changeRequestId?: string | null; kind: 'image' | 'audio'; author: string; license: MediaAsset['license']; source: string; sourceUrl: string; originalFilename: string; makePrimary: boolean; confirmRights: boolean; clipStartSeconds?: number; clipDurationSeconds?: number }): Promise<ReservedMediaUpload> {
  const { data, error } = await assertClient().rpc('reserve_species_media_upload', {
    p_species_id: input.speciesId, p_change_id: input.changeRequestId ?? null, p_type: input.kind,
    p_author: input.author, p_license: input.license, p_source: input.source,
    p_source_url: input.sourceUrl || null, p_original_filename: input.originalFilename,
    p_is_primary: input.makePrimary, p_evidence_path: input.license === 'permission' ? `pending/${crypto.randomUUID()}` : null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { mediaId: row.media_id, jobId: row.media_id, changeRequestId: input.changeRequestId ?? null, incomingPath: row.incoming_path };
}

export async function requestMediaProcessing(mediaId: string): Promise<void> {
  const { error } = await assertClient().functions.invoke('request-media-processing', { body: { mediaId } });
  if (error) throw error;
}

export async function listReleases(): Promise<CatalogRelease[]> {
  const { data, error } = await assertClient().from('catalog_release_history').select('*').order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, dataVersion: row.version, status: row.status, requestedBy: row.requested_by_name, requestedAt: row.requested_at, publishedAt: row.published_at, speciesCount: row.species_count, databaseSize: row.database_size, qualityReportUrl: row.quality_report_url, error: row.error }));
}

export async function requestPublish(): Promise<void> {
  const { data, error } = await assertClient().rpc('request_catalog_publish');
  if (error) throw error;
  const dispatch = await assertClient().functions.invoke('request-catalog-publish', { body: { releaseId: data } });
  if (dispatch.error) throw dispatch.error;
}

export async function listUsers(): Promise<Profile[]> {
  const { data, error } = await assertClient().from('admin_profiles').select('*').order('display_name');
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.user_id, displayName: row.display_name, email: row.email, role: row.role, active: row.active }));
}

export async function inviteUser(email: string, displayName: string, role: Profile['role']): Promise<void> {
  const { error } = await assertClient().functions.invoke('invite-user', { body: { email, displayName, role } });
  if (error) throw error;
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const { error } = await assertClient().functions.invoke('set-user-active', { body: { userId, active } });
  if (error) throw error;
}

export async function listUserReports(): Promise<UserReport[]> {
  const { data, error } = await assertClient().from('feedback_queue').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, kind: row.type, area: row.area ?? (row.type === 'review' ? 'species' : 'general'), platform: row.platform ?? 'unknown', appVersion: row.app_version ?? null, referenceUrl: row.reference_url ?? null, speciesId: row.species_id, speciesName: row.species_name ?? null, catalogCode: row.catalog_code ?? null, description: row.message, state: row.status, reporterId: row.user_id, reporterName: row.reporter_name ?? null, createdAt: row.created_at, resolutionNote: row.resolution_note ?? null }));
}

export async function resolveUserReport(report: UserReport, status: 'reviewing' | 'resolved' | 'dismissed', note?: string): Promise<void> {
  const { error } = await assertClient().rpc('resolve_feedback', { p_id: report.id, p_status: status, p_note: note ?? null });
  if (error) throw error;
}

export async function updateSpeciesAudioMetadata(input: { mediaId: string; externalId: string; originalLicense: string; authorizationEvidenceRef: string }): Promise<void> {
  const { error } = await assertClient().rpc('update_species_audio_metadata', {
    p_media_id: input.mediaId,
    p_external_id: input.externalId,
    p_original_license: input.originalLicense,
    p_authorization_evidence_ref: input.authorizationEvidenceRef,
  });
  if (error) throw error;
}

export async function listHomeNews(): Promise<HomeNews[]> {
  const { data, error } = await assertClient().from('home_news').select('*').order('status').order('sort_order').order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, title: row.title, source: row.source, articleUrl: row.article_url,
    imageUrl: row.image_url ?? null, publishedAt: row.published_at ?? null,
    status: row.status, sortOrder: row.sort_order, updatedAt: row.updated_at,
  }));
}

export async function saveHomeNews(input: Omit<HomeNews, 'id' | 'updatedAt'> & { id?: string }): Promise<string> {
  const { data, error } = await assertClient().rpc('save_home_news', {
    p_id: input.id ?? null, p_title: input.title, p_source: input.source,
    p_article_url: input.articleUrl, p_image_url: input.imageUrl,
    p_published_at: input.publishedAt, p_status: input.status, p_sort_order: input.sortOrder,
  });
  if (error) throw error;
  return String(data);
}

export async function archiveHomeNews(id: string): Promise<void> {
  const { error } = await assertClient().rpc('archive_home_news', { p_id: id });
  if (error) throw error;
}

export async function listCollaboratorApplications(): Promise<CollaboratorApplication[]> {
  const { data, error } = await assertClient().from('collaborator_applications').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, contactName: row.contact_name, contactEmail: row.contact_email,
    interests: row.interests ?? [], experience: row.experience, motivation: row.motivation,
    availability: row.availability, referenceUrl: row.reference_url ?? null,
    status: row.status, reviewerNote: row.reviewer_note ?? null,
    createdAt: row.created_at, reviewedAt: row.reviewed_at ?? null,
  }));
}

export async function reviewCollaboratorApplication(id: string, status: CollaboratorApplication['status'], note?: string): Promise<void> {
  const { error } = await assertClient().rpc('review_collaborator_application', { p_id: id, p_status: status, p_note: note ?? null });
  if (error) throw error;
}
