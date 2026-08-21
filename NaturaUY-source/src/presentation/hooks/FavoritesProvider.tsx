import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useUserDatabase } from '../../data/db/UserDatabaseProvider';
import { favoritesRepository } from '../../data/repositories/favoritesRepository';

interface FavoritesContextValue {
  codigos: string[];
  isFavorite: (codigo: string) => boolean;
  toggle: (codigo: string) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/**
 * Favourites live in one place so the list, the detail sheet and the drawer
 * badge can never disagree about what is saved.
 */
export function FavoritesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const db = useUserDatabase();
  const [codigos, setCodigos] = useState<string[]>([]);

  useEffect(() => {
    void favoritesRepository.listCodigos(db).then(setCodigos);
  }, [db]);

  const toggle = useCallback(
    (codigo: string) => {
      // Flip locally first so the heart responds on the same frame as the tap.
      setCodigos((current) =>
        current.includes(codigo) ? current.filter((c) => c !== codigo) : [codigo, ...current],
      );
      void favoritesRepository.toggle(db, codigo);
    },
    [db],
  );

  const value = useMemo<FavoritesContextValue>(() => {
    // A Set, because `isFavorite` runs once per card on every list render —
    // `Array.includes` made that a linear scan per row.
    const saved = new Set(codigos);

    return {
      codigos,
      count: codigos.length,
      isFavorite: (codigo: string) => saved.has(codigo),
      toggle,
    };
  }, [codigos, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used inside <FavoritesProvider>');
  return context;
}
