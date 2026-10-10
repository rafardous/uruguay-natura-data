import { bundledAudioKey } from '../bundledAudioKey';

describe('approved bundled audio identity', () => {
  test('resolves the same recording after its URL becomes a public media URL', () => {
    expect(bundledAudioKey('https://example.test/m/species/asset.mp3', 'XC528334')).toBe('xc-528334.mp3');
    expect(bundledAudioKey('bundled://xc-528334.mp3')).toBe('xc-528334.mp3');
  });
  test('does not guess a recording from arbitrary URLs or accept malformed IDs', () => {
    expect(bundledAudioKey('https://example.test/xc-528334.mp3')).toBeNull();
    expect(bundledAudioKey('https://example.test/clip.mp3', '../../528334')).toBeNull();
    expect(bundledAudioKey('bundled://../../clip.mp3')).toBeNull();
  });
});
