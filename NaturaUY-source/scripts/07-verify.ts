/**
 * Stage 07 — quality gate.
 *
 * Reports catalogue coverage and, more importantly, fails the build if any
 * generated colour pair would be illegible. Contrast is the thing most likely
 * to regress silently, so it is enforced here rather than left to review.
 */
import { DatabaseSync } from 'node:sqlite';

import { AA_NORMAL, contrastRatio } from '../src/shared/color/contrast';
import { CONTRAST_CONTRACT, darkColors, lightColors } from '../src/presentation/theme/tokens';
import { PATHS } from './lib/paths';

interface SpeciesRow {
  codigo: string;
  clase: string;
  image_url: string | null;
  thumb_asset: string | null;
  image_license: string | null;
  image_attribution: string | null;
  accent_light: string;
  accent_dark: string;
  container_light: string;
  on_container_light: string;
  container_dark: string;
  on_container_dark: string;
}

const pct = (n: number, total: number): string => `${Math.round((n / total) * 100)}%`;

function checkStaticTheme(): string[] {
  const failures: string[] = [];

  for (const [themeName, colors] of [
    ['light', lightColors],
    ['dark', darkColors],
  ] as const) {
    for (const pair of CONTRAST_CONTRACT) {
      const fg = colors[pair.fg];
      const bg = colors[pair.bg];
      // Scrim tokens are rgba() and not part of any text pair.
      if (fg.startsWith('rgba') || bg.startsWith('rgba')) continue;

      const ratio = contrastRatio(fg, bg);
      if (ratio < AA_NORMAL) {
        failures.push(`  ${themeName}: ${pair.name} = ${ratio.toFixed(2)}:1 (needs ${AA_NORMAL})`);
      }
    }
  }

  return failures;
}

function main(): void {
  const db = new DatabaseSync(PATHS.db, { readOnly: true });
  const rows = db.prepare('SELECT * FROM species').all() as unknown as SpeciesRow[];

  console.log(`07-verify: ${rows.length} species\n`);

  // ---- coverage -----------------------------------------------------------
  const withPhoto = rows.filter((r) => r.image_url);
  const withThumb = rows.filter((r) => r.thumb_asset);
  console.log(`Photo coverage:     ${withPhoto.length}/${rows.length} (${pct(withPhoto.length, rows.length)})`);
  console.log(`Bundled thumbnails: ${withThumb.length}/${rows.length} (${pct(withThumb.length, rows.length)})`);

  const byClass = new Map<string, { total: number; withPhoto: number }>();
  for (const row of rows) {
    const entry = byClass.get(row.clase) ?? { total: 0, withPhoto: 0 };
    entry.total++;
    if (row.image_url) entry.withPhoto++;
    byClass.set(row.clase, entry);
  }

  console.log('\nCoverage by class:');
  for (const [clase, { total, withPhoto: n }] of [...byClass.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${clase.padEnd(18)} ${String(n).padStart(4)}/${String(total).padEnd(4)} ${pct(n, total).padStart(4)}`);
  }

  // ---- licence hygiene ----------------------------------------------------
  const missingAttribution = withPhoto.filter((r) => !r.image_license || !r.image_attribution);
  console.log(`\nLicence/attribution present: ${withPhoto.length - missingAttribution.length}/${withPhoto.length}`);

  // ---- contrast gate ------------------------------------------------------
  const failures = checkStaticTheme();

  for (const row of rows) {
    const checks: [string, string, string][] = [
      ['accent_light on light surface', row.accent_light, lightColors.surface],
      ['accent_dark on dark surface', row.accent_dark, darkColors.surface],
      ['on_container_light', row.on_container_light, row.container_light],
      ['on_container_dark', row.on_container_dark, row.container_dark],
    ];
    for (const [label, fg, bg] of checks) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < AA_NORMAL) {
        failures.push(`  ${row.codigo}: ${label} = ${ratio.toFixed(2)}:1`);
      }
    }
  }

  db.close();

  if (missingAttribution.length > 0) {
    failures.push(`  ${missingAttribution.length} photos lack licence or attribution (CC BY requires credit)`);
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`FAILED — ${failures.length} contrast/licence violation(s):`);
    for (const failure of failures.slice(0, 30)) console.error(failure);
    if (failures.length > 30) console.error(`  ...and ${failures.length - 30} more`);
    process.exit(1);
  }

  console.log(`PASSED — every theme pair and all ${rows.length * 4} generated colour pairs meet WCAG AA (${AA_NORMAL}:1).`);
}

main();
