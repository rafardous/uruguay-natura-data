import { adminClient } from './shared';
import type { CatalogRecord } from './catalog-data';
export async function loadHomeSpeciesSchedule(items: CatalogRecord[]) {
  const published = new Map(items.map(i => [i.species.id, i.species.catalog_code]));
  const rows: { day: string; slot: string; catalog_code: string }[] = [];
  const client=adminClient();
  for (let from=0;;from+=1000) {
    const {data,error}=await client.from('home_species_schedule').select('day,slot,species_id').eq('enabled',true).order('day').order('slot').range(from,from+999);
    if(error)throw error;
    for(const row of data) {const code=published.get(row.species_id);if(code)rows.push({day:row.day,slot:row.slot,catalog_code:code});}
    if(data.length<1000)return rows;
  }
}
