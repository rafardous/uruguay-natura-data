import { AA_NORMAL, contrastRatio, meetsAA, parseHex, relativeLuminance } from '../contrast';
import { CONTRAST_CONTRACT, darkColors, lightColors } from '../../../presentation/theme/tokens';

describe('contrast maths', () => {
  it('matches the WCAG reference values at the extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1F4034', '#F2F5EC')).toBeCloseTo(contrastRatio('#F2F5EC', '#1F4034'), 10);
  });

  it('expands shorthand hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
  });

  it('rejects malformed input rather than silently returning black', () => {
    expect(() => parseHex('nope')).toThrow();
    expect(() => parseHex('#12345')).toThrow();
  });

  it('reproduces the prototype failures this redesign set out to fix', () => {
    // Drawer muted text on the old #abc58d panel — the worst pair in the design.
    expect(contrastRatio('#5c7659', '#abc58d')).toBeLessThan(3);
    // Inactive bottom-nav label.
    expect(contrastRatio('#849087', '#f5f7f1')).toBeLessThan(AA_NORMAL);
    // A raw extracted accent used as text.
    expect(contrastRatio('#d65a45', '#fbfcf8')).toBeLessThan(AA_NORMAL);
  });
});

describe('theme contract', () => {
  it.each(['light', 'dark'] as const)('every %s pair meets WCAG AA', (scheme) => {
    const colors = scheme === 'dark' ? darkColors : lightColors;
    const failures: string[] = [];

    for (const pair of CONTRAST_CONTRACT) {
      const fg = colors[pair.fg];
      const bg = colors[pair.bg];
      if (fg.startsWith('rgba') || bg.startsWith('rgba')) continue;

      if (!meetsAA(fg, bg)) {
        failures.push(`${pair.name}: ${contrastRatio(fg, bg).toFixed(2)}:1`);
      }
    }

    expect(failures).toEqual([]);
  });
});
