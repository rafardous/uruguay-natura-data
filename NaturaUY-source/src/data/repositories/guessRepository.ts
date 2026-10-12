import type { SQLiteDatabase } from 'expo-sqlite';
import { rowToSpecies } from '../mappers/speciesMapper';
import type { SpeciesRow } from '../db/schema';
import type { KnowledgeLevel, Species } from '../../domain/entities/species';
import { GAME_SCOPES, type GameScope } from '../../domain/entities/gameScopes';
import { buildGuessClues, type GameClue } from '../../domain/services/guessGame';

export const guessRepository = {
  async load(db: SQLiteDatabase, scope: GameScope | 'all', level: KnowledgeLevel): Promise<{ candidates: Species[]; targets: { species: Species; clues: GameClue[] }[] }> {
    const allowed = level==='easy'?['easy']:level==='medium'?['easy','medium']:['easy','medium','hard'];
    const taxa = scope === 'all' ? ['Animalia', 'Plantae'] : GAME_SCOPES[scope].taxa;
    const rows = await db.getAllAsync<SpeciesRow>(`SELECT s.* FROM species s LEFT JOIN species_game_rules r ON r.stable_id=s.stable_id AND r.game_key='guess'
      WHERE COALESCE(r.enabled,1)=1 AND COALESCE(r.min_knowledge_level,s.knowledge_level,'hard') IN (${allowed.map(()=>'?').join(',')})
      AND EXISTS(SELECT 1 FROM species_taxa st JOIN taxa t ON t.taxon_id=st.taxon_id WHERE st.stable_id=s.stable_id AND t.canonical_name IN (${taxa.map(()=>'?').join(',')}))`, [...allowed,...taxa]);
    const facts = await db.getAllAsync<{ stable_id: string; id: string; body: string; sort_order: number; source_code: string | null }>(`SELECT f.* FROM species_facts f JOIN catalog_sources s ON s.code=f.source_code WHERE s.use_policy='redistributable' ORDER BY f.sort_order,f.id`);
    const hasClues = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='species_game_clues'");
    const clues = hasClues ? await db.getAllAsync<GameClue & { stable_id: string }>('SELECT stable_id,kind,body,sort_order AS sortOrder,source_code AS sourceCode FROM species_game_clues ORDER BY sort_order') : [];
    const candidates = rows.map(row => ({ ...rowToSpecies(row), facts: facts.filter(f=>f.stable_id===row.stable_id).map(f=>({id:f.id,body:f.body,sortOrder:f.sort_order,sourceCode:f.source_code})) }));
    return { candidates, targets: candidates.map((species,index)=>({species,clues:buildGuessClues(species,clues.filter(c=>c.stable_id===rows[index]!.stable_id))})).filter(item=>item.clues.length===5) };
  },
};
