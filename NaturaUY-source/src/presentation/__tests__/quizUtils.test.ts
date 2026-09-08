import { isNewPersonalRecord, upcomingQuizImageUrls } from '../quizUtils';

describe('quiz utilities', () => {
  test('only scores strictly above the previous best', () => {
    expect(isNewPersonalRecord(4, 5)).toBe(true);
    expect(isNewPersonalRecord(4, 4)).toBe(false);
    expect(isNewPersonalRecord(4, 3)).toBe(false);
  });

  test('prefetches at most two unique medium image URLs', () => {
    const species = [
      { photo: { url: 'a' } },
      { photo: { url: 'a' } },
      { photo: { url: 'b' } },
      { photo: { url: 'c' } },
      { photo: null },
    ];
    expect(upcomingQuizImageUrls(species)).toEqual(['a', 'b']);
  });
});
