import { useEffect, useState } from 'react';
import { Notice } from './Ui';
import type { SpeciesSummary } from '../domain';
import { submitContentChange, listGameClues } from '../lib/api';
import { GAME_LABELS, readAll, type GameRule, type GameKey } from '../lib/editorial';

export function GameRulesEditor({ species, onChange }: { species: SpeciesSummary[]; onChange(): Promise<unknown> }) {
  const [rules, setRules] = useState<GameRule[]>([]), [speciesId, setSpeciesId] = useState('');
  const [game, setGame] = useState<GameKey>('quiz'), [enabled, setEnabled] = useState(true), [level, setLevel] = useState('');
  const [note, setNote] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [clueCount,setClueCount]=useState(0);
  useEffect(()=>{if(!speciesId){setClueCount(0);return;}void listGameClues(speciesId).then(rows=>setClueCount(rows.length)).catch(()=>setClueCount(0));},[speciesId]);
  const selected=species.find(s=>s.id===speciesId);
  const reasons:string[]=[];
  if(selected&&!enabled)reasons.push('Excluida explícitamente de respuestas y opciones.');
  if(selected&&['quiz','puzzle','jigsaw'].includes(game)&&(!selected.imageUrl||selected.imageIsLegacy))reasons.push('Falta una foto procesada y aprobada.');
  if(selected&&game==='guess'&&clueCount!==5)reasons.push(`Tiene ${clueCount}/5 pistas aprobadas; necesita cinco pistas ordenadas.`);
  if(selected&&game==='habitat'&&!selected.payload.ecology.habitats.length)reasons.push('Faltan ambientes documentados.');
  if(selected&&game==='classify'&&!selected.payload.taxonomy.class)reasons.push('Falta clasificación taxonómica.');
  useEffect(() => { void readAll<GameRule>('species_game_rules').then(setRules).catch(e => setMessage(e.message)); }, [species]);
  useEffect(() => { const rule = rules.find(r => r.species_id === speciesId && r.game_key === game); setEnabled(rule?.enabled ?? true); setLevel(rule?.min_knowledge_level ?? ''); setNote(rule?.note ?? ''); }, [rules, speciesId, game]);
  async function save() {
    setBusy(true); setMessage('');
    try { const rule = rules.find(r => r.species_id === speciesId && r.game_key === game); await submitContentChange({ contentType: 'game_rule', entityId: rule?.id, speciesId, values: { game_key: game, enabled, min_knowledge_level: level || null, note }, comment: note }); await onChange(); setMessage('Selección enviada para revisión.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }
  return <section className="panel editor-panel"><h2>Especies por juego</h2><p>Elegí qué especies pueden ser respuestas y opciones. Sin una regla específica se aplica la selección automática; también se exige una imagen, clasificación o pistas suficientes según el juego.</p><div className="form-grid"><label className="field"><span>Juego</span><select value={game} onChange={e => setGame(e.target.value as GameKey)}>{Object.entries(GAME_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="field"><span>Especie del juego</span><select value={speciesId} onChange={e => setSpeciesId(e.target.value)}><option value="">Elegí una especie</option>{species.map(s => <option key={s.id} value={s.id}>{s.payload.commonNames[0]} · {s.payload.scientificName}</option>)}</select></label><label className="field"><span>Participación</span><select value={String(enabled)} onChange={e => setEnabled(e.target.value === 'true')}><option value="true">Incluir</option><option value="false">Excluir</option></select></label><label className="field"><span>Nivel mínimo para este juego</span><select value={level} onChange={e => setLevel(e.target.value)}><option value="">Usar dificultad de la especie</option><option value="easy">Fácil</option><option value="medium">Medio</option><option value="hard">Difícil</option></select></label><label className="field full"><span>Motivo de la selección</span><textarea value={note} onChange={e => setNote(e.target.value)} /></label></div>{selected&&<Notice kind={reasons.length?"info":"success"}>{reasons.length?reasons.join(" "):"Cumple los requisitos de especie para este juego. La selección final también respeta nivel y contenido del catálogo."}</Notice>}<button className="primary" disabled={busy || !speciesId || !note.trim()} onClick={() => void save()}>Enviar selección para revisión</button>{message && <Notice>{message}</Notice>}<h3>Selección aprobada · {GAME_LABELS[game]}</h3><div className="editorial-list">{rules.filter(r => r.game_key === game).map(r => <button key={r.id} className="secondary" onClick={() => setSpeciesId(r.species_id)}>{species.find(s => s.id === r.species_id)?.payload.commonNames[0] ?? r.species_id} · {r.enabled ? 'Incluida' : 'Excluida'} · {r.min_knowledge_level ?? 'Nivel de especie'}</button>)}</div></section>;
}
