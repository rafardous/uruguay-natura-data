const HABITAT_LABELS: Record<string, string> = {
  agroecosistema: 'Agroecosistemas',
  costa_playa_dunas: 'Costa, playas y dunas',
  humedal: 'Humedales',
  laguna_estero: 'Lagunas y esteros',
  mar_abierto: 'Mar abierto',
  mar_costero: 'Mar costero',
  matorral: 'Matorrales',
  monte_nativo: 'Monte nativo',
  pastizal_campo_natural: 'Pastizales y campo natural',
  rio_arroyo: 'Ríos y arroyos',
  roquedal_sierras: 'Roquedales y sierras',
  urbano_suburbano: 'Áreas urbanas y suburbanas',
};

const DIET_LABELS: Record<string, string> = {
  algae: 'Algas',
  amphibians_reptiles: 'Anfibios y reptiles',
  birds_mammals: 'Aves y mamíferos',
  carrion: 'Carroña',
  fish: 'Peces',
  fruit: 'Frutos',
  invertebrates: 'Invertebrados',
  nectar: 'Néctar',
  other_plant_material: 'Materia vegetal',
  seeds: 'Semillas',
};

const SEASONALITY_LABELS: Record<string, string> = {
  resident: 'Residente todo el año',
  migratory: 'Migratoria',
  summer_visitor: 'Visitante estival',
};

const ABUNDANCE_LABELS: Record<string, string> = {
  abundant: 'Abundante',
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Rara',
  occasional: 'Ocasional',
};

const SOURCE_LABELS: Record<string, string> = {
  avonet: 'AVONET',
  biodiversidata: 'Biodiversidata',
  inaturalist: 'iNaturalist',
  ministerio: 'Ministerio de Ambiente',
  research: 'Bibliografía científica',
  snap: 'SNAP',
  tetrapodtraits_v3: 'TetrapodTraits v3',
  uruguay_species_database: 'Base de especies de Uruguay',
  wikimedia: 'Wikimedia Commons',
};

function humanize(value: string): string {
  const text = value.replaceAll('_', ' ');
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}

export const habitatLabel = (value: string): string => HABITAT_LABELS[value] ?? humanize(value);
export const dietLabel = (value: string): string => DIET_LABELS[value] ?? humanize(value);
export const seasonalityLabel = (value: string): string => SEASONALITY_LABELS[value] ?? humanize(value);
export const abundanceLabel = (value: string): string => ABUNDANCE_LABELS[value] ?? humanize(value);
export const sourceLabel = (value: string): string => SOURCE_LABELS[value] ?? humanize(value);
