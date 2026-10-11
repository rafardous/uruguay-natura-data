import { useMemo } from 'react';

import type { Species, SpeciesPalette } from '../../domain/entities/species';
import { useTheme } from './ThemeProvider';

export interface ResolvedPalette {
    accent: string;
    container: string;
    onContainer: string;
}

export function resolvePalette(palette: SpeciesPalette): ResolvedPalette {
  return {
        accent: palette.accentLight,
        container: palette.containerLight,
        onContainer: palette.onContainerLight,
      };
}

export function useSpeciesPalette(species: Species | null | undefined): ResolvedPalette {
  const { colors } = useTheme();

  return useMemo(() => {
    if (!species) {
      return { accent: colors.primary, container: colors.primaryContainer, onContainer: colors.onPrimaryContainer };
    }
    return resolvePalette(species.palette);
  }, [species, colors]);
}
