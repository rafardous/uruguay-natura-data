/** Rasterize the editable Arapy SVG master into platform-specific Expo assets. */
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const asset = (name) => fileURLToPath(new URL(`../assets/images/${name}`, import.meta.url));
const mark = JSON.parse(readFileSync(asset('arapy-brand.json'), 'utf8'));
const background = mark.background;
const symbol = asset('arapy-symbol.svg');
const output = async (name, source) => sharp(source).png().toFile(asset(name));
const artwork = (width) => sharp(symbol).resize({ width }).png().toBuffer();
// One geometry source feeds both the editable SVG and the animated native paths.
const paths = mark.paths.map(({ id, d, fill, fillRule }) => `<path id="${id}" d="${d}" fill="${fill}" fill-rule="${fillRule ?? 'nonzero'}"/>`).join('\n');
writeFileSync(symbol, `<svg xmlns="http://www.w3.org/2000/svg" width="502" height="412" viewBox="${mark.viewBox}"><title>Arapy: sapito de Darwin</title>\n${paths}\n</svg>\n`);

const appArtwork = await artwork(930);
await output('arapy-app-icon.png', await sharp({ create: { width: 1024, height: 1024, channels: 4, background } })
  .composite([{ input: appArtwork, left: 47, top: 130 }]).png().toBuffer());

// Keep the foreground within Android's central 66 dp safe area on its 108 dp canvas.
const adaptiveArtwork = await artwork(650);
await output('arapy-adaptive-foreground.png', await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: adaptiveArtwork, left: 187, top: 245 }]).png().toBuffer());

const logo = await sharp(symbol).trim().resize({ width: 900 }).png().toBuffer();
await output('arapy-logo.png', logo);
await output('arapy-splash.png', await sharp(symbol).resize({ width: 460 }).png().toBuffer());
await output('arapy-favicon.png', await sharp(asset('arapy-app-icon.png')).resize(48, 48).png().toBuffer());

for (const [name, size] of [['arapy-app-icon.png', 1024], ['arapy-adaptive-foreground.png', 1024], ['arapy-logo.png', 'trimmed'], ['arapy-splash.png', 460], ['arapy-favicon.png', 48]]) {
  console.log(`wrote assets/images/${name} (${size})`);
}
