import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import {
  lightColors,
  lightElevation,
  radius,
  spacing,
  typography,
  type ElevationSet,
  type ThemeColors,
} from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface Theme {
  colors: ThemeColors;
  scheme: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: ElevationSet;
}

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const setMode = useCallback((_next: ThemeMode) => {}, []);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      mode: 'light',
      setMode,
      theme: {
        scheme: 'light',
        colors: lightColors,
        spacing,
        radius,
        typography,
        elevation: lightElevation,
      },
    };
  }, [setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}

export const useTheme = (): Theme => useThemeContext().theme;

export function useThemeMode(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const { mode, setMode } = useThemeContext();
  return { mode, setMode };
}
