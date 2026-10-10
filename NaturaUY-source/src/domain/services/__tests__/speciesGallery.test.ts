import { speciesGallery } from '../speciesGallery';
import type { SpeciesMedia } from '../../entities/species';

const image = (id: string, ordinal: number, isPrimary = false): SpeciesMedia => ({ id, ordinal, isPrimary, type: 'image', url: `https://example.test/${id}.jpg`, thumbnailUrl: `https://example.test/${id}-thumb.jpg`, attribution: `Autor ${id}`, license: 'CC BY 4.0', originalLicense: null, source: 'editorial', page: null, durationSeconds: null });
describe('speciesGallery', () => {
  it('keeps the primary first and ignores audio', () => {
    expect(speciesGallery({ photo: null, media: [image('second', 1), image('primary', 2, true), { ...image('audio', 3), type: 'audio' }] }).map((item) => item.id)).toEqual(['primary', 'second']);
  });
  it('does not duplicate the legacy projection of a primary asset', () => {
    const primary = image('primary', 1, true);
    expect(speciesGallery({ photo: { url: primary.thumbnailUrl!, fullUrl: primary.url, thumbAsset: null, attribution: primary.attribution, license: primary.license, source: 'editorial', page: null }, media: [primary] })).toHaveLength(1);
  });
  it('deduplicates thumbnail variants while preserving each selected image credit', () => {
    const primary = image('primary', 1);
    const duplicate = { ...image('duplicate', 2), thumbnailUrl: primary.thumbnailUrl };
    const items = speciesGallery({ photo: null, media: [primary, duplicate, image('second', 3)] });
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ attribution: 'Autor second', license: 'CC BY 4.0' });
  });
  it('supports zero photos and a legacy-only photo', () => {
    expect(speciesGallery({ photo: null, media: [] })).toEqual([]);
    expect(speciesGallery({ photo: { url: 'thumb', fullUrl: 'full', thumbAsset: null, attribution: 'Autora', license: 'CC-BY', originalLicense: 'CC BY 4.0', source: 'editorial', page: 'source' }, media: [] })[0]).toMatchObject({ url: 'full', license: 'CC BY 4.0' });
  });
});
