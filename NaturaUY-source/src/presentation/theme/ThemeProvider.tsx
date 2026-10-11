import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  lightColors,
  lightElevation,
  radius,
  spacing,
  typography,
  type ElevationSet,
  type ThemeColors,
} from './tokens';

export interface Theme {
  colors: ThemeColors;
  scheme: 'light';
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: ElevationSet;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const value = useMemo<Theme>(() => {
    return {
      scheme: 'light',
      colors: lightColors,
      spacing,
      radius,
      typography,
      elevation: lightElevation,
    };
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
