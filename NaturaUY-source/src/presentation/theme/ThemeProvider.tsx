import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useUserDatabase } from '../../data/db/UserDatabaseProvider';
import { settingsRepository } from '../../data/repositories/settingsRepository';
import {
  darkColors,
  darkElevation,
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

const SETTING_KEY = 'theme_mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const db = useUserDatabase();
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let active = true;
    void settingsRepository.get(db, SETTING_KEY).then((stored) => {
      if (active && isThemeMode(stored)) setModeState(stored);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      // Update immediately; persistence is a background detail.
      setModeState(next);
      void settingsRepository.set(db, SETTING_KEY, next);
    },
    [db],
  );

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: ColorScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

    return {
      mode,
      setMode,
      theme: {
        scheme,
        colors: scheme === 'dark' ? darkColors : lightColors,
        spacing,
        radius,
        typography,
        elevation: scheme === 'dark' ? darkElevation : lightElevation,
      },
    };
  }, [mode, setMode, systemScheme]);

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
