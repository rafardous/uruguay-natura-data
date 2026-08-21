import { buildAssetNames } from '../assetNames';

describe('buildAssetNames', () => {
  it('lowercases every name so behaviour matches on case-sensitive filesystems', () => {
    const names = buildAssetNames(['V_chilensi', 'But_capita']);

    expect(names.get('V_chilensi')).toBe('v_chilensi');
    expect(names.get('But_capita')).toBe('but_capita');
  });

  it('disambiguates códigos that differ only by case', () => {
    // The real pair from the SNAP dataset. Written verbatim, one silently
    // overwrote the other on macOS and broke the Metro bundle.
    const names = buildAssetNames(['o_flavesce', 'O_flavesce']);

    const a = names.get('o_flavesce')!;
    const b = names.get('O_flavesce')!;

    expect(a).not.toBe(b);
    expect(a.toLowerCase()).not.toBe(b.toLowerCase());
  });

  it('is stable regardless of input order', () => {
    const forward = buildAssetNames(['o_flavesce', 'O_flavesce']);
    const reverse = buildAssetNames(['O_flavesce', 'o_flavesce']);

    expect(forward.get('o_flavesce')).toBe(reverse.get('o_flavesce'));
    expect(forward.get('O_flavesce')).toBe(reverse.get('O_flavesce'));
  });

  it('produces a unique filename for every código', () => {
    const codigos = ['A_one', 'a_one', 'A_ONE', 'B_two'];
    const names = buildAssetNames(codigos);

    const generated = codigos.map((c) => names.get(c)!);
    expect(new Set(generated).size).toBe(codigos.length);
    // And unique even after lowercasing, which is what the filesystem compares.
    expect(new Set(generated.map((n) => n.toLowerCase())).size).toBe(codigos.length);
  });

  it('covers every código it is given', () => {
    const codigos = ['X_a', 'Y_b', 'y_b'];
    const names = buildAssetNames(codigos);
    expect(codigos.every((c) => names.has(c))).toBe(true);
  });
});
