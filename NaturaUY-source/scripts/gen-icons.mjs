/**
 * Generates the app icon set from a single vector mark.
 * Run with `node scripts/gen-icons.mjs` after changing the brand colours.
 */
import sharp from 'sharp';

const INK = '#F2F5EC';
const GREEN = '#1F4034';

/** One palm frond, rotated `deg` around the crown. */
const frond = (deg) => {
  const rad = (d) => ((d - 90) * Math.PI) / 180;
  const cx = 256 + 150 * Math.cos(rad(deg));
  const cy = 300 + 150 * Math.sin(rad(deg));
  const ex = 256 + 205 * Math.cos(rad(deg - 12));
  const ey = 300 + 205 * Math.sin(rad(deg - 12));
  return `<path d="M256 300 Q${cx} ${cy} ${ex} ${ey}" stroke="COLOR" stroke-width="26" stroke-linecap="round" fill="none"/>`;
};

const mark = (color, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}
  ${[-64, -32, 0, 32, 64].map((d) => frond(d).replaceAll('COLOR', color)).join('\n  ')}
  <path d="M256 300 C250 358 248 410 245 452" stroke="${color}" stroke-width="30" stroke-linecap="round" fill="none"/>
  <circle cx="299" cy="330" r="17" fill="${color}"/>
  <circle cx="215" cy="337" r="13" fill="${color}"/>
</svg>`;

const jobs = [
  ['icon.png', mark(INK, GREEN), 1024],
  // Adaptive icons are masked by the launcher, so the foreground stays transparent
  // and the background colour comes from app.json.
  ['adaptive-icon.png', mark(INK, null), 1024],
  ['splash-icon.png', mark(GREEN, null), 512],
  ['favicon.png', mark(INK, GREEN), 48],
];

for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`assets/images/${name}`);
  console.log(`wrote assets/images/${name} (${size}px)`);
}
