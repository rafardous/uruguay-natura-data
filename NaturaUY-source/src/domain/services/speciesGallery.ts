import type { Species } from '../entities/species';

export interface SpeciesGalleryItem {
  id: string;
  url: string;
  thumbnailUrl: string;
  attribution: string;
  license: string;
  page: string | null;
}

/** A primary media row and its legacy photo projection represent one image. */
export function speciesGallery(species: Pick<Species, 'photo' | 'media'>): SpeciesGalleryItem[] {
  const images = species.media.filter((item) => item.type === 'image').sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.ordinal - b.ordinal);
  const primary = images.find((item) => item.isPrimary);
  const candidates: SpeciesGalleryItem[] = [
    ...(species.photo && !primary ? [{ id: 'primary', url: species.photo.fullUrl, thumbnailUrl: species.photo.url, attribution: species.photo.attribution, license: species.photo.originalLicense ?? species.photo.license, page: species.photo.page }] : []),
    ...images.map((item) => ({ id: item.id, url: item.url, thumbnailUrl: item.thumbnailUrl ?? item.url, attribution: item.attribution, license: item.originalLicense ?? item.license, page: item.page })),
  ];
  return candidates.filter((item, index) => item.url && !candidates.slice(0, index).some((previous) => previous.id === item.id || previous.url === item.url || previous.thumbnailUrl === item.thumbnailUrl));
}
