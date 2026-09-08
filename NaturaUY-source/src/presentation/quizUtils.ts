export const isNewPersonalRecord = (previousBestScore: number, score: number): boolean => score > previousBestScore;

export function upcomingQuizImageUrls(species: { photo: { url: string } | null }[], limit = 2): string[] {
  return [...new Set(species.map((item) => item.photo?.url).filter((url): url is string => Boolean(url)))].slice(0, limit);
}
