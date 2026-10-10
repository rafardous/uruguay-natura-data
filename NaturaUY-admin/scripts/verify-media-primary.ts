import { adminClient } from './shared';

const client = adminClient();
const { data: media, error } = await client.from('species_media').select('id,species_id,type,is_primary,storage_path,thumbnail_path').eq('status', 'approved');
if (error) throw error;
let failures = 0;
for (const item of media ?? []) {
  const paths = [item.storage_path, item.type === 'image' ? item.thumbnail_path : null].filter(Boolean) as string[];
  for (const path of paths) {
    const guide = path.startsWith('guia-aves/');
    const { error: downloadError } = await client.storage.from(guide ? 'guia-aves' : 'media-public')
      .download(guide ? path.slice('guia-aves/'.length) : path);
    if (downloadError) { failures += 1; console.error(`${item.id}: ${path}: ${downloadError.message}`); }
  }
}
const imageSpecies = new Set((media ?? []).filter((item) => item.type === 'image').map((item) => item.species_id));
for (const speciesId of imageSpecies) {
  if ((media ?? []).filter((item) => item.species_id === speciesId && item.type === 'image' && item.is_primary).length !== 1) { failures += 1; console.error(`${speciesId}: invalid_primary_image`); }
}
console.log(JSON.stringify({ approvedMedia: media?.length ?? 0, failures }));
if (failures) process.exitCode = 1;
