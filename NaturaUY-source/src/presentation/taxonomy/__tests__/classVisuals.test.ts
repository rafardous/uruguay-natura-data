import { CHORDATA_CLASS_ORDER, CLASS_VISUALS } from '../classVisuals';

describe('Chordata class visuals', () => {
  test('keeps the requested class order', () => {
    expect(Object.keys(CHORDATA_CLASS_ORDER)).toEqual(['Mammalia', 'Reptilia', 'Aves', 'Amphibia', 'Actinopterygii', 'Chondrichthyes']);
  });

  test('uses the softer aquatic and amphibian palette', () => {
    expect(CLASS_VISUALS.Actinopterygii.colors).toEqual(['#D8E4E6', '#C7D5D8']);
    expect(CLASS_VISUALS.Amphibia.colors).toEqual(['#D8E5DD', '#C5D5CA']);
  });
});
