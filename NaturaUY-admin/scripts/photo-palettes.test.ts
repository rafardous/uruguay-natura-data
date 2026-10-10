import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { paletteForImage, paletteForSeed } from './photo-palettes';
import { contrastRatio } from '../../NaturaUY-source/src/shared/color/contrast';
import { lightColors } from '../../NaturaUY-source/src/presentation/theme/tokens';

test('las fotos de distinto color producen acentos propios y legibles', async () => {
  const palettes = await Promise.all(['#e53b2e', '#287add', '#e4ac2c'].map(async (background) => {
    const image = await sharp({ create: { width: 40, height: 40, channels: 3, background } }).webp().toBuffer();
    return paletteForImage(image);
  }));
  assert.equal(new Set(palettes.map((palette) => palette.accentLight)).size, 3);
  for (const palette of palettes) {
    assert.ok(contrastRatio(palette.accentLight, lightColors.surface) >= 4.5);
    assert.ok(contrastRatio(palette.onContainerLight, palette.containerLight) >= 4.5);
  }
});

test('colores claros y casi grises conservan contraste y derivación determinista', () => {
  for (const seed of ['#ffffff', '#000000', '#777777', '#a8dfef']) {
    const palette = paletteForSeed(seed);
    assert.deepEqual(palette, paletteForSeed(seed));
    assert.ok(contrastRatio(palette.accentLight, lightColors.surface) >= 4.5);
    assert.ok(contrastRatio(palette.onContainerLight, palette.containerLight) >= 4.5);
  }
});
