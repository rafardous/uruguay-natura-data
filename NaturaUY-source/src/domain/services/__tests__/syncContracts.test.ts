import { chunkForSync, favoriteChangesPayload, gameResultPayload } from '../syncContracts';

describe('lean sync contracts', () => {
  test('sends favorite timestamps and tombstones', () => expect(favoriteChangesPayload([{ codigo: 'UY-1', is_favorite: 0, updated_at: 42 }])).toEqual([{ catalogCode: 'UY-1', isFavorite: false, updatedAt: 42 }]));
  test('keeps mode and scope independent in game payload', () => expect(gameResultPayload({ mode: 'naming', scope: 'birds', best_score: 7, best_streak: 3, updated_at: 99, pending_games: 2 })).toEqual({ p_mode: 'naming', p_scope: 'birds', p_score: 7, p_streak: 3, p_updated_at: 99, p_games_delta: 2 }));
  test('chunks all puzzle records beyond the RPC batch limit', () => {
    const rows = Array.from({ length: 60 }, (_, index) => index);
    const batches = chunkForSync(rows, 24);
    expect(batches.map((batch) => batch.length)).toEqual([24, 24, 12]);
    expect(batches.flat()).toEqual(rows);
  });
});
