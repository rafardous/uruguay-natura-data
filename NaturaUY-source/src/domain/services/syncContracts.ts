export interface FavoriteChangeInput { codigo: string; is_favorite: number; updated_at: number }

export const favoriteChangesPayload = (rows: readonly FavoriteChangeInput[]) => rows.map((row) => ({ catalogCode: row.codigo, isFavorite: row.is_favorite === 1, updatedAt: row.updated_at }));

export const gameResultPayload = (row: { mode: string; scope: string; best_score: number; best_streak: number; updated_at: number; pending_games: number }) => ({ p_mode: row.mode, p_scope: row.scope, p_score: row.best_score, p_streak: row.best_streak, p_updated_at: row.updated_at, p_games_delta: row.pending_games });
