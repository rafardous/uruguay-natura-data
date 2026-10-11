import { buildGuessClues, clueRevealsAnswer, guessOptions, guessSuggestions, submitGuess, type GameClue, type GuessState } from '../guessGame';
import { makeSpecies } from '../../../testing/speciesFactory';
const answer=makeSpecies({codigo:'target',displayName:'Ñandú',scientificName:'Rhea americana',commonNames:['Ñandú','Ñandú grande'],acceptedName:'Rhea americana'});
const candidates=[answer,...Array.from({length:7},()=>makeSpecies())];
const clues:GameClue[]=['habitat','diet','behavior','appearance','decisive'].map((kind,index)=>({kind:kind as GameClue['kind'],body:`Pista editorial número ${index+1}`,sortOrder:index+1}));
const round={answer,clues,options:candidates.slice(0,6)};
const initial:GuessState={guesses:[],status:'playing',score:0};
describe('Adiviá',()=>{
  it('scores all five attempts in both modes',()=>{
    for(const mode of ['search','choices'] as const){let state=initial;for(let i=1;i<=5;i++){
      expect(submitGuess(state,round,'target',candidates,mode).score).toBe((6-i)*(mode==='search'?100:50));
      state=submitGuess(state,round,candidates[i]!.codigo,candidates,mode);
    }expect(state.status).toBe('lost');expect(state.guesses).toHaveLength(5);expect(submitGuess(state,round,'target',candidates,mode)).toBe(state);}
  });
  it('invalid, repeated, and post-finish answers consume no attempts',()=>{
    expect(submitGuess(initial,round,'invalid',candidates,'search')).toBe(initial);
    expect(submitGuess(initial,round,candidates[6]!.codigo,candidates,'choices')).toBe(initial);
    const wrong=submitGuess(initial,round,candidates[1]!.codigo,candidates,'search');
    expect(submitGuess(wrong,round,candidates[1]!.codigo,candidates,'search')).toBe(wrong);
    const won=submitGuess(initial,round,'target',candidates,'search');
    expect(submitGuess(won,round,candidates[2]!.codigo,candidates,'search')).toBe(won);
  });
  it('searches aliases, scientific names, accents and omits used species',()=>{
    expect(guessSuggestions(candidates,'nandu grande',[])[0]?.codigo).toBe('target');
    expect(guessSuggestions(candidates,'rhea amer',[])[0]?.codigo).toBe('target');
    expect(guessSuggestions(candidates,'rhea',['target'])).toEqual([]);
    expect(guessSuggestions(candidates,' ',[])).toEqual([]);
  });
  it('requires five safe clues and respects editorial order',()=>{
    expect(buildGuessClues(answer)).toEqual([]);
    expect(buildGuessClues(answer,clues)).toHaveLength(5);
    expect(buildGuessClues(answer,clues.map(c=>({...c,sortOrder:6-c.sortOrder})))[0]?.kind).toBe('decisive');
    expect(buildGuessClues(answer,clues.map(c=>c.kind==='appearance'?{...c,body:'El ñandú tiene patas largas.'}:c))).toEqual([]);
    expect(clueRevealsAnswer('Se llama RHEA AMERICANA.',answer)).toBe(true);
    expect(clueRevealsAnswer('Se encuentra en el campo.',answer)).toBe(false);
  });
  it('uses published habitat, diet and facts without inventing missing attributes',()=>{
    const enriched={...answer,ecology:{...answer.ecology,lifeModes:['terrestrial']},facts:[{id:'f',body:'El macho cuida a las crías.',sortOrder:0}]};
    expect(buildGuessClues(enriched,[clues[3]!]).map(c=>c.kind)).toEqual(['habitat','diet','behavior','appearance','decisive']);
    expect(buildGuessClues(enriched)).toEqual([]);
  });
  it('chooses six unique options including the answer',()=>{
    const options=guessOptions(answer,candidates);expect(options).toHaveLength(6);expect(new Set(options.map(s=>s.codigo)).size).toBe(6);expect(options.some(s=>s.codigo===answer.codigo)).toBe(true);
  });
});
