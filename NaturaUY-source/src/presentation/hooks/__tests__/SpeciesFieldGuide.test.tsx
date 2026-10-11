import React, { act } from 'react';
import { BirdFieldGuide } from '../../components/BirdFieldGuide';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { makeSpecies } from '../../../testing/speciesFactory';
import type { BirdNaturalHistory, Species } from '../../../domain/entities/species';

jest.mock('../../components/TabIcons', () => ({ CloseIcon: () => null, InfoIcon: () => null }));

// El renderer instalado por jest-expo no incluye declaraciones TypeScript.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as {
  create: (element: React.ReactElement) => { toJSON: () => unknown; unmount: () => void };
};
let root: ReturnType<typeof renderer.create> | undefined;
async function renderGuide(species: Species, bird?: BirdNaturalHistory) {
  await act(async () => {
    root = renderer.create(<ThemeProvider><BirdFieldGuide species={species} bird={bird} accent="#345A3D" container="#DAE5CD" foreground="#233129" /></ThemeProvider>);
  });
  return JSON.stringify(root!.toJSON());
}
afterEach(async () => { await act(async () => { root?.unmount(); root = undefined; }); });

test.each(['unknown', 'uncertain'] as const)('no muestra una presencia %s como si fuera información confirmada', async (seasonality) => {
  const species = makeSpecies({ seasonality });
  const tree = await renderGuide(species);
  expect(tree).not.toContain('Presencia en Uruguay');
});

test('el mamífero conserva medidas y separa hábitat, dieta, modo de vida y actividad', async () => {
  const species = makeSpecies({ abundanceStatus: 'common', seasonality: null });
  species.taxonomy.clase = 'Mammalia';
  species.ecology.lifeModes = ['terrestrial'];
  species.ecology.activity = ['diurnal'];
  species.measurements = [{ kind: 'body_length', value: 1300, unit: 'mm', estimated: false, provenance: 'verified', basis: 'body_length', sourceCode: 'test', sourceRecordId: null }];
  const tree = await renderGuide(species);
  for (const label of ['Tamaño', 'Especie ', 'común', '1,3 m', 'Dónde vive', 'Qué come', 'Modo de vida', 'Actividad']) expect(tree).toContain(label);
  expect(tree).not.toContain('Ecología');
});

test('el calendario migratorio marca los meses con ticks y conserva su significado accesible', async () => {
  const bird: BirdNaturalHistory = { measurements: [], habitat: [], diet: [], abundanceCode: null,
    guide: { sourceCode: 'azpiroz_2003', year: 2003, number: 75, page: 55, commonName: null, englishName: null, scientificName: null },
    presence: { code: 'VI', label: 'Visitante de invierno', note: 'Presente de abril a setiembre.', months: [4, 5, 6, 7, 8, 9], outsidePeriod: false } };
  const tree = await renderGuide(makeSpecies(), bird);
  expect(tree).toContain('✓');
  expect(tree).toContain('Abril: período habitual según la guía');
  expect(tree).toContain('Enero: fuera del período habitual');
});
