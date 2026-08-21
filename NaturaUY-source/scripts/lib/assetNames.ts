/**
 * Maps species códigos to on-disk asset filenames.
 *
 * SNAP códigos are case-sensitive identifiers and the dataset genuinely
 * contains a pair that differs only by case ("o_flavesce" / "O_flavesce").
 * Written verbatim, the second silently overwrote the first on macOS's
 * case-insensitive filesystem — and Metro, whose resolver *is* case-sensitive,
 * then failed to bundle. Filenames are therefore lowercased (so behaviour is
 * identical on every filesystem) with a stable suffix for any collision.
 */

export type AssetNameMap = ReadonlyMap<string, string>;

export function buildAssetNames(codigos: readonly string[]): AssetNameMap {
  const byLower = new Map<string, string[]>();
  for (const codigo of codigos) {
    const key = codigo.toLowerCase();
    const group = byLower.get(key);
    if (group) group.push(codigo);
    else byLower.set(key, [codigo]);
  }

  const names = new Map<string, string>();
  for (const [lower, group] of byLower) {
    if (group.length === 1) {
      names.set(group[0]!, lower);
      continue;
    }
    // Sorted so the suffix is stable across runs regardless of input order.
    [...group].sort().forEach((codigo, index) => {
      names.set(codigo, `${lower}__${index + 1}`);
    });
  }

  return names;
}
