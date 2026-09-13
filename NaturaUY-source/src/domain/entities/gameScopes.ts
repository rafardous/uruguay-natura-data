/** One source of truth for every game that filters the catalogue by group. */
export const GAME_SCOPES = {
  animals_all: { id: 'animals_all', label: 'Todos los animales', classes: [] as string[], taxa: ['Animalia'] },
  birds: { id: 'birds', label: 'Aves', classes: ['Aves'], taxa: ['Aves'] },
  mammals: { id: 'mammals', label: 'Mamíferos', classes: ['Mammalia'], taxa: ['Mammalia'] },
  reptiles: { id: 'reptiles', label: 'Reptiles', classes: ['Reptilia'], taxa: ['Reptilia'] },
  amphibians: { id: 'amphibians', label: 'Anfibios', classes: ['Amphibia'], taxa: ['Amphibia'] },
  fish: { id: 'fish', label: 'Peces', classes: ['Actinopterygii', 'Chondrichthyes'], taxa: ['Actinopterygii', 'Chondrichthyes'] },
  arthropods: { id: 'arthropods', label: 'Artrópodos', classes: ['Arachnida', 'Insecta', 'Malacostraca'], taxa: ['Arthropoda'] },
  arachnids: { id: 'arachnids', label: 'Arácnidos', classes: ['Arachnida'], taxa: ['Arachnida'] },
  insects: { id: 'insects', label: 'Insectos', classes: ['Insecta'], taxa: ['Insecta'] },
  crustaceans: { id: 'crustaceans', label: 'Crustáceos', classes: ['Malacostraca'], taxa: ['Malacostraca'] },
  plants: { id: 'plants', label: 'Plantas', classes: [] as string[], taxa: ['Plantae'] },
} satisfies Record<string, { id: string; label: string; classes: string[]; taxa: string[] }>;

export type GameScope = keyof typeof GAME_SCOPES;
export const GAME_SCOPE_ORDER: GameScope[] = ['animals_all', 'birds', 'mammals', 'reptiles', 'amphibians', 'fish', 'arthropods', 'arachnids', 'insects', 'crustaceans', 'plants'];
