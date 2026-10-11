import React, { act, useEffect } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { speciesRepository, type SpeciesFilters, type Page } from '../../../data/repositories/speciesRepository';
import type { Species } from '../../../domain/entities/species';
import { makeSpecies } from '../../../testing/speciesFactory';
import { useSpeciesList, type SpeciesListState } from '../useSpeciesList';

// El renderer instalado por jest-expo no incluye declaraciones TypeScript.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as {
  create: (element: React.ReactElement) => { update: (element: React.ReactElement) => void; unmount: () => void };
};
let mockDb = {} as SQLiteDatabase;
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('../../../data/repositories/speciesRepository', () => ({ speciesRepository: { findPaged: jest.fn(), count: jest.fn() } }));
const findPaged = jest.mocked(speciesRepository.findPaged);
const count = jest.mocked(speciesRepository.count);
let current: SpeciesListState;
let root: ReturnType<typeof renderer.create> | undefined;

function Probe({ filters }: { filters: SpeciesFilters }) {
  const state = useSpeciesList(filters);
  useEffect(() => { current = state; }, [state]);
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function mount(filters: SpeciesFilters = {}) {
  await act(async () => { root = renderer.create(<Probe filters={filters} />); });
}
beforeEach(() => {
  mockDb = {} as SQLiteDatabase;
  findPaged.mockReset();
  count.mockReset().mockResolvedValue(2);
});
afterEach(async () => { await act(async () => { root?.unmount(); root = undefined; }); });

test('una respuesta atrasada no reemplaza el filtro actual', async () => {
  const old = deferred<Page<Species>>();
  const next = deferred<Page<Species>>();
  const selected = makeSpecies();
  findPaged.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  await mount({ search: 'ave' });
  await act(async () => { root!.update(<Probe filters={{ search: 'carpincho' }} />); });
  await act(async () => { next.resolve({ items: [selected], hasMore: false }); });
  expect(current.items).toEqual([selected]);
  await act(async () => { old.resolve({ items: [makeSpecies()], hasMore: true }); });
  expect(current.items).toEqual([selected]);
  expect(current.loading).toBe(false);
});

test('conserva las páginas al volver y separa la caché de cada catálogo', async () => {
  const first = makeSpecies();
  const second = makeSpecies();
  findPaged.mockResolvedValueOnce({ items: [first], hasMore: true }).mockResolvedValueOnce({ items: [second], hasMore: false });
  await mount();
  await act(async () => { current.loadMore(); });
  await act(async () => { root!.unmount(); });
  await mount();
  expect(current.items).toEqual([first, second]);
  expect(findPaged).toHaveBeenCalledTimes(2);
  mockDb = {} as SQLiteDatabase;
  findPaged.mockResolvedValueOnce({ items: [], hasMore: false });
  await act(async () => { root!.update(<Probe filters={{}} />); });
  expect(findPaged).toHaveBeenCalledTimes(3);
  expect(current.items).toEqual([]);
});

test('evita páginas duplicadas y permite reintentar un error sin perder lo cargado', async () => {
  const first = makeSpecies();
  const second = makeSpecies();
  const page = deferred<Page<Species>>();
  findPaged.mockResolvedValueOnce({ items: [first], hasMore: true }).mockReturnValueOnce(page.promise);
  await mount();
  await act(async () => { current.loadMore(); current.loadMore(); });
  expect(findPaged).toHaveBeenCalledTimes(2);
  await act(async () => { page.reject(new Error('SQLite ocupada')); });
  expect(current.items).toEqual([first]);
  expect(current.loadingMore).toBe(false);
  findPaged.mockResolvedValueOnce({ items: [second], hasMore: false });
  await act(async () => { current.loadMore(); });
  expect(current.items).toEqual([first, second]);
  expect(current.hasMore).toBe(false);
});

test('descarta una página pendiente al cambiar de filtro', async () => {
  const page = deferred<Page<Species>>();
  const selected = makeSpecies();
  findPaged.mockResolvedValueOnce({ items: [makeSpecies()], hasMore: true }).mockReturnValueOnce(page.promise)
    .mockResolvedValueOnce({ items: [selected], hasMore: false });
  await mount();
  await act(async () => { current.loadMore(); });
  await act(async () => { root!.update(<Probe filters={{ onlyNative: true }} />); });
  await act(async () => { page.resolve({ items: [makeSpecies()], hasMore: false }); });
  expect(current.items).toEqual([selected]);
  expect(current.loadingMore).toBe(false);
});
