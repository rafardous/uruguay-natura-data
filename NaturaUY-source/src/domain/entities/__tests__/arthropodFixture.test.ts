import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ArthropodFixture {
  schemaVersion: number;
  scope: string;
  records: { scientificName: string; class: string; order: string; family: string; status?: string; reason?: string }[];
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../data/fixtures/arthropods.schema11.json'), 'utf8'),
) as ArthropodFixture;

describe('schema 11 arthropod fixtures', () => {
  it('covers the pilot classes and preserves the incomplete genus for review', () => {
    expect(fixture.schemaVersion).toBe(11);
    expect(fixture.scope).toBe('Uruguay');
    expect(fixture.records).toHaveLength(5);
    expect(new Set(fixture.records.map((record) => record.class))).toEqual(new Set(['Arachnida', 'Insecta', 'Malacostraca']));
    expect(fixture.records.find((record) => record.scientificName === 'Aedes aegypti')).toMatchObject({ class: 'Insecta', order: 'Diptera', family: 'Culicidae' });
    expect(fixture.records.find((record) => record.scientificName === 'Grammostola anthracina')).toMatchObject({ class: 'Arachnida', order: 'Araneae', family: 'Theraphosidae' });
    expect(fixture.records.find((record) => record.scientificName === 'Ligia exotica')).toMatchObject({ class: 'Malacostraca', order: 'Isopoda', family: 'Ligiidae' });
    expect(fixture.records.find((record) => record.scientificName === 'Neomysis americana')).toMatchObject({ class: 'Malacostraca', order: 'Mysida', family: 'Mysidae' });
    expect(fixture.records.find((record) => record.scientificName === 'Bothriurus')).toMatchObject({ status: 'needs_review', reason: expect.stringContaining('epithet') });
  });
});
