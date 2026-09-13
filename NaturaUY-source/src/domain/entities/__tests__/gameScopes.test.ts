import { GAME_SCOPES, GAME_SCOPE_ORDER } from '../gameScopes';
import { QUIZ_SCOPES } from '../quiz';
import { PUZZLE_SCOPES } from '../puzzle';

describe('shared game scopes', () => {
  it('keeps quiz and puzzle categories aligned, including both fish classes', () => {
    expect(GAME_SCOPE_ORDER).toContain('arthropods');
    expect(QUIZ_SCOPES.fish.classes).toEqual(['Actinopterygii', 'Chondrichthyes']);
    expect(PUZZLE_SCOPES.fish.classes).toEqual(QUIZ_SCOPES.fish.classes);
    expect(PUZZLE_SCOPES.arachnids.classes).toEqual(GAME_SCOPES.arachnids.classes);
  });
});
