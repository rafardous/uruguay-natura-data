export interface TaxonOptionLike {
  value: string;
}

const PHYLUM_PRIORITY = ['chordata', 'arthropoda'] as const;

/** Keeps the two app-level phyla predictable while leaving new branches alphabetical. */
export function orderPhylumOptions<T extends TaxonOptionLike>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftName = left.value.trim().toLocaleLowerCase('es');
    const rightName = right.value.trim().toLocaleLowerCase('es');
    const leftPriority = PHYLUM_PRIORITY.indexOf(leftName as (typeof PHYLUM_PRIORITY)[number]);
    const rightPriority = PHYLUM_PRIORITY.indexOf(rightName as (typeof PHYLUM_PRIORITY)[number]);
    const leftRank = leftPriority === -1 ? PHYLUM_PRIORITY.length : leftPriority;
    const rightRank = rightPriority === -1 ? PHYLUM_PRIORITY.length : rightPriority;
    return leftRank - rightRank || left.value.localeCompare(right.value, 'es');
  });
}
