import type { SpeciesPayload, SpeciesSummary } from '../domain';
import { mediaUrl, payloadToColumns } from './api';
import { editorialClient, editorialRpc } from './editorial';

export type GalleryRow = Record<string, any> & { id:string; type:'image'|'audio'; status:string; ordinal:number; is_primary:boolean; url:string|null; thumb:string|null };
export type GalleryChoice = { id:string; type:'image'|'audio'; ordinal:number; is_primary:boolean; metadata?:Record<string,string> };
export function gallerySnapshot(rows: GalleryRow[]) {
  return rows.filter(r=>r.status==='approved'||(r.status==='archived'&&r.license==='legacy'&&!r.removed_by_editor)).sort((a,b)=>a.id.localeCompare(b.id)).map(r=>Object.fromEntries(['id','status','ordinal','is_primary','checksum_sha256','author','source','license','source_url','removed_by_editor'].map(k=>[k,r[k]??null])));
}
export function galleryChoices(rows: GalleryRow[]):GalleryChoice[] {
  return rows.filter(r=>r.status==='approved').sort((a,b)=>Number(b.is_primary)-Number(a.is_primary)||a.ordinal-b.ordinal).map((r,i)=>({id:r.id,type:r.type,ordinal:r.type==='audio'?1:i+1,is_primary:r.is_primary}));
}
export function normalizedChoices(choices:GalleryChoice[]):GalleryChoice[] {
  let index=0;
  return choices.map(c=>({...c,ordinal:c.type==='audio'?1:++index,is_primary:c.type==='image'&&index===1}));
}
export async function speciesMedia(id:string):Promise<GalleryRow[]> {
  const {data,error}=await editorialClient().from('species_media').select('*').eq('species_id',id).order('created_at');
  if(error)throw error;
  return (data??[]).map(r=>({...r,url:mediaUrl(r.storage_path)??(r.status==='archived'&&r.license==='legacy'?r.source_url:null),thumb:mediaUrl(r.thumbnail_path??r.storage_path)??(r.status==='archived'&&r.license==='legacy'?r.source_url:null)}));
}
export async function saveVisualSpecies(species:SpeciesSummary,payload:SpeciesPayload,before:GalleryRow[],choices:GalleryChoice[],reason:string,apply:boolean,confirm:boolean,galleryDirty:boolean) {
  const old=payloadToColumns(species.catalogCode,species.payload), next=payloadToColumns(species.catalogCode,payload);
  const fields=Object.fromEntries(Object.entries(next).filter(([key,value])=>key!=='catalog_code'&&JSON.stringify(value)!==JSON.stringify(old[key as keyof typeof old])));
  const changed=galleryDirty;
  return editorialRpc('submit_visual_species_change',{p_species_id:species.id,p_expected_updated_at:species.updatedAt,p_fields:fields,p_gallery_before:changed?gallerySnapshot(before):null,p_gallery:changed?normalizedChoices(choices):null,p_reason:reason,p_apply:apply,p_confirm:confirm});
}
export async function reserveEditorMedia(speciesId:string,values:Record<string,unknown>,replaceId:string|null) {
  const data=await editorialRpc('reserve_editor_media',{p_species_id:speciesId,p_values:values,p_replace_id:replaceId}) as {media_id:string;incoming_path:string}[];
  if(!data[0])throw new Error('No se pudo reservar el medio.');
  return data[0];
}
