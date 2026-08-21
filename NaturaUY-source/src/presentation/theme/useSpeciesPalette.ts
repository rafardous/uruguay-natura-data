import { useMemo } from 'react';

import type { Species, SpeciesPalette } from '../../domain/entities/species';
import { useTheme } from './ThemeProvider';

/** The species accent resolved for whichever theme is active. */
export interface ResolvedPalette {
  /** Safe as text or icon colour on `colors.surface`. */
  accent: string;
  /** Tinted fill for chips and stat tiles. */
  container: string;
  /** Safe as text on `container`. */
  onContainer: string;
}

export function resolvePalette(palette: SpeciesPalette, scheme: 'light' | 'dark'): ResolvedPalette {
  return scheme === 'dark'
    ? {
        accent: palette.accentDark,
        container: palette.containerDark,
        onContainer: palette.onContainerDark,
      }
    : {
        accent: palette.accentLight,
        container: palette.containerLight,
        onContainer: palette.onContainerLight,
      };
}

/**
 * Layer two of the theme system: the per-species accent.
 *
 * Both variants were generated and contrast-checked at build time, so this hook
 * only picks one — there is no runtime colour maths and no way to end up with
 * an illegible pairing.
 */
export function useSpeciesPalette(species: Species | null | undefined): ResolvedPalette {
  const { scheme, colors } = useTheme();

  return useMemo(() => {
    if (!species) {
      return { accent: colors.primary, container: colors.primaryContainer, onContainer: colors.onPrimaryContainer };
    }
    return resolvePalette(species.palette, scheme);
  }, [species, scheme, colors]);
}
