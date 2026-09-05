import { adminClient } from './shared';

const client = adminClient();
const { data: media, error } = await client.from('species_media').select('id,type,storage_path,thumbnail_path').eq('status', 'approved');
if (error) throw error;
let failures = 0;
for (const item of media ?? []) {
  const paths = [item.storage_path, item.type === 'image' ? item.thumbnail_path : null].filter(Boolean) as string[];
  for (const path of paths) {
    const { error: downloadError } = await client.storage.from('media-public').download(path);
    if (downloadError) { failures += 1; console.error(`${item.id}: ${path}: ${downloadError.message}`); }
  }
}
const { data: invalidPrimary, error: primaryError } = await client.from('species').select('id,primary_image_id,species_media!species_primary_image_id_fkey(id,type,status)').not('primary_image_id', 'is', null);
if (primaryError) throw primaryError;
for (const species of invalidPrimary ?? []) {
  const primary = Array.isArray(species.species_media) ? species.species_media[0] : species.species_media;
  if (!primary || primary.type !== 'image' || primary.status !== 'approved') { failures += 1; console.error(`${species.id}: invalid_primary_image`); }
}
console.log(JSON.stringify({ approvedMedia: media?.length ?? 0, failures }));
if (failures) process.exitCode = 1;
