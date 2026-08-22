import { GROUPS, PATHS, readJson, slug, writeJson } from './lib';

interface Item { scientificName: string; evidence: Array<{ source: string; sourceName: string; commonNames: string[]; origin: string | null; sourceRecord: string | null }>; resolution: { status: string; acceptedName: string | null; sourceStatus: string | null; taxonomy: Record<string, string | null> }; }
function main(): void {
  const all = readJson<Item[]>(PATHS.resolved);
  for (const group of GROUPS) {
    // An unresolved name has no accepted species name and must remain an audit
    // item, never become a guessed entry in the provisional catalogue.
    const catalog = all.filter((row) => row.evidence.some((e) => e.taxonomy.class === group) && row.resolution.acceptedName !== null).map((row) => {
      const commonNames = [...new Set(row.evidence.flatMap((e) => e.commonNames).map((x) => x.trim()).filter(Boolean))];
      const originEvidence = [...new Set(row.evidence.map((e) => e.origin).filter(Boolean))];
      const origin = originEvidence.length === 1 && ['native', 'introduced'].includes(originEvidence[0]!) ? originEvidence[0] : null;
      return { id: slug(row.resolution.acceptedName!), scientificName: row.resolution.acceptedName, commonName: commonNames[0] ?? null, taxonomy: { kingdom: 'Animalia', phylum: 'Chordata', class: group, order: row.resolution.taxonomy.order, family: row.resolution.taxonomy.family, genus: row.resolution.taxonomy.genus }, origin, seasonality: null, abundanceStatus: null, description: null, habitat: [], diet: null, size: null, relevantNote: null, media: { image: null, audio: null }, sources: row.evidence.map((e) => ({ source: e.source, record: e.sourceRecord })), reviewStatus: row.resolution.status === 'resolved' ? 'unreviewed' : 'needs_review' };
    });
    writeJson(`${PATHS.catalog}/${group.toLowerCase()}.json`, catalog);
    console.log(`  ${group}: ${catalog.length}`);
  }
}
main();
