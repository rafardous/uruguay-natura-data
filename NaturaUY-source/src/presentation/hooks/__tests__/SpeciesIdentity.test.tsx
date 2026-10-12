import React, { act } from 'react';
import { Alert } from 'react-native';
import { alternateSpeciesNames, SpeciesNames, SpeciesSecondaryNames } from '../../components/SpeciesIdentity';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { makeSpecies } from '../../../testing/speciesFactory';
jest.mock('../../components/TabIcons', () => ({ ChevronRightIcon: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as {
  create: (element: React.ReactElement) => { toJSON: () => unknown; root: { findByProps: (props: object) => { props: { onPress: () => void } } }; unmount: () => void };
};
let root: ReturnType<typeof renderer.create>;
afterEach(async () => { await act(async () => root?.unmount()); jest.restoreAllMocks(); });

test('el nombre común queda solo; los alternativos acompañan al científico con prefijo', async () => {
  const species = makeSpecies({ displayName: 'Pingüino de Magallanes', scientificName: 'Spheniscus magellanicus', commonNames: ['Pingüino de Magallanes', ' Pingüino patagónico ', 'pingüino patagónico', ''], acceptedName: 'Spheniscus magellanicus' });
  expect(alternateSpeciesNames(species)).toEqual([{ label: 'Otro nombre común', value: 'Pingüino patagónico' }]);
  await act(async () => { root = renderer.create(<ThemeProvider><SpeciesNames species={species} /></ThemeProvider>); });
  expect(JSON.stringify(root.toJSON())).not.toContain('patagónico');
  await act(async () => root.unmount());
  await act(async () => { root = renderer.create(<ThemeProvider><SpeciesSecondaryNames species={species} /></ThemeProvider>); });
  const tree = JSON.stringify(root.toJSON());
  expect(tree).toContain('Spheniscus magellanicus');
  expect(tree).toContain('Otros nombres: ');
  const alert = jest.spyOn(Alert, 'alert');
  root.root.findByProps({ accessibilityRole: 'button' }).props.onPress();
  expect(alert).toHaveBeenCalledWith('Otros nombres', 'Otro nombre común: Pingüino patagónico');
});

test('no repite el científico ni muestra Otros nombres si no hay alternativos', async () => {
  const species = makeSpecies({ displayName: 'Genus species', scientificName: 'Genus species', commonNames: ['GENUS SPECIES'] });
  await act(async () => { root = renderer.create(<ThemeProvider><SpeciesSecondaryNames species={species} /></ThemeProvider>); });
  expect(root.toJSON()).toBeNull();
});
