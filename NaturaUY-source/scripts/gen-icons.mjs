/** Export the approved Arapy artwork for Expo without redrawing its details. */
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const asset = (name) => fileURLToPath(new URL(`../assets/images/${name}`, import.meta.url));
const jobs = [
  ['arapy-icon-master.png', 'icon.png', 1024],
  ['arapy-icon-master.png', 'logo.png', 1024],
  ['arapy-logo-master.png', 'adaptive-icon.png', 1024],
  ['arapy-logo-master.png', 'splash-icon.png', 512],
  ['arapy-icon-master.png', 'favicon.png', 48],
];

for (const [source, target, size] of jobs) {
  await sharp(asset(source)).resize(size, size).png().toFile(asset(target));
  console.log(`wrote assets/images/${target} (${size}px)`);
}
