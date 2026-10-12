import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { guessRepository } from '../../src/data/repositories/guessRepository';
import { enrichedGameRepository } from '../../src/data/repositories/enrichedGameRepository';
import { KNOWLEDGE_LEVELS } from '../../src/domain/entities/quiz';
import type { KnowledgeLevel, Species } from '../../src/domain/entities/species';
import { CLUE_LABELS, guessOptions, guessSuggestions, submitGuess, type GuessRound, type GuessState } from '../../src/domain/services/guessGame';
import { Chip } from '../../src/presentation/components/Chip';
import { BackIcon } from '../../src/presentation/components/TabIcons';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { haptics } from '../../src/presentation/haptics';
import { useMobileSync } from '../../src/sync/MobileSyncProvider';

const INITIAL: GuessState = { guesses: [], status: 'playing', score: 0 };
function ActionButton({text,onPress,disabled=false}:{text:string;onPress:()=>void;disabled?:boolean}):React.JSX.Element {
  const {colors,radius,typography}=useTheme();
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.button,{backgroundColor:colors.play,borderRadius:radius.pill,opacity:disabled?.45:1}]}><Text style={[typography.label,{color:colors.onPlay}]}>{text}</Text></Pressable>;
}
export default function GuessScreen(): React.JSX.Element {
  const db=useSQLiteContext(), userDb=useUserDatabase(), router=useRouter(), insets=useSafeAreaInsets();
  const {colors,spacing,radius,typography}=useTheme(); const {requestSync}=useMobileSync();
  const scope = 'all' as const; const [level,setLevel]=useState<KnowledgeLevel>('hard');
  const [mode,setMode]=useState<'search'|'choices'>('search');
  const [catalog,setCatalog]=useState<Awaited<ReturnType<typeof guessRepository.load>>|null>(null);
  const [loading,setLoading]=useState(false), [error,setError]=useState('');
  const [round,setRound]=useState<GuessRound|null>(null), [state,setState]=useState<GuessState>(INITIAL);
  const [query,setQuery]=useState(''), [selected,setSelected]=useState<Species|null>(null);
  const stateRef=useRef(state);
  useEffect(()=>{let active=true;setLoading(true);setCatalog(null);setError('');
    void guessRepository.load(db,scope,level).then(data=>{if(active)setCatalog(data);}).catch(()=>{if(active)setError('No pudimos leer las pistas del catálogo. Volvé a intentar.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[db,scope,level]);
  const start=useCallback(()=>{
    if(!catalog?.targets.length)return;
    const different=catalog.targets.filter(t=>t.species.codigo!==round?.answer.codigo);
    const pool=different.length?different:catalog.targets;
    const target=pool[Math.floor(Math.random()*pool.length)]!;
    setRound({answer:target.species,clues:target.clues,options:guessOptions(target.species,catalog.candidates)});
    stateRef.current=INITIAL;setState(INITIAL);setQuery('');setSelected(null);setError('');
  },[catalog,round]);
  const answer=async()=>{
    if(!round||!selected||!catalog)return;
    const next=submitGuess(stateRef.current,round,selected.codigo,catalog.candidates,mode);
    if(next===stateRef.current)return;
    stateRef.current=next;setState(next);setSelected(null);setQuery('');Keyboard.dismiss();
    if(next.status==='won')haptics.success();else haptics.tap();
    if(next.status!=='playing'){
      const now=Date.now();
      try{await enrichedGameRepository.submit(userDb,{mode:mode==='search'?'guess_search':'guess_choices',scope:`${scope}:${level}`,best_score:next.score,best_time_ms:0,fewest_moves:0,played_at:now,updated_at:now});void requestSync();}
      catch{setError('La partida terminó, pero no pudimos guardar el récord.');}
    }
  };
  const finished=state.status!=='playing';
  const suggestions=catalog?guessSuggestions(catalog.candidates,query,state.guesses):[];
  return <View style={{flex:1,backgroundColor:colors.background,paddingTop:insets.top+spacing.sm}}>
    <View style={styles.header}><Pressable accessibilityLabel="Volver" onPress={()=>round?(setRound(null),setState(INITIAL)):router.back()} style={[styles.back,{backgroundColor:colors.surface,borderRadius:radius.pill}]}><BackIcon color={colors.text}/></Pressable><View><Text style={[typography.headerTitle,{color:colors.text}]}>Adiviná</Text><Text style={[typography.caption,{color:colors.textMuted}]}>{round?(mode==='choices'?'Con opciones':'Buscador'):'Una especie, cinco pistas'}</Text></View></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:spacing.lg,paddingBottom:insets.bottom+32,gap:spacing.md}}>
      {!round?<>
        <Text style={[typography.body,{color:colors.textSecondary}]}>Descubrí una especie por sus pistas. Tenés cinco intentos: cada respuesta incorrecta revela otra pista. Cuanto antes aciertes, más puntos ganás.</Text>
        <Text style={[typography.cardTitle,{color:colors.text}]}>Cómo querés responder</Text>
        <View style={styles.wrap}><Chip label="Buscador" selected={mode==='search'} accent={colors.play} onAccent={colors.onPlay} onPress={()=>setMode('search')}/><Chip label="Fácil · con opciones" selected={mode==='choices'} accent={colors.play} onAccent={colors.onPlay} onPress={()=>setMode('choices')}/></View>
        <Text style={[typography.caption,{color:colors.textMuted}]}>Buscador: 500 a 100 puntos. Con opciones: 250 a 50 puntos. Los récords se guardan por separado.</Text>
        <Text style={[typography.cardTitle,{color:colors.text}]}>Especies que pueden aparecer</Text>
        <View style={styles.wrap}>{KNOWLEDGE_LEVELS.map(item=><Chip key={item.id} label={item.label} selected={level===item.id} accent={colors.play} onAccent={colors.onPlay} onPress={()=>setLevel(item.id)}/>)}</View>
        {loading?<ActivityIndicator color={colors.play}/>:<Text style={[typography.caption,{color:colors.textMuted}]}>{catalog?.targets.length?`${catalog.targets.length} especies con cinco pistas disponibles offline.`:'Todavía no hay especies con cinco pistas completas en este nivel. Probá otro nivel.'}</Text>}
        <ActionButton text="Empezar" onPress={start} disabled={loading||!catalog?.targets.length||(mode==='choices'&&(catalog?.candidates.length??0)<6)}/>
      </>:<>
        <View style={[styles.status,{backgroundColor:colors.surfaceVariant,borderRadius:radius.lg}]}><Text style={[typography.label,{color:colors.text}]}>{finished?state.status==='won'?'¡La encontraste!':'Se terminaron los intentos':`${5-state.guesses.length} intentos disponibles`}</Text><Text style={[typography.cardTitle,{color:colors.play}]}>{finished?`${state.score} puntos`:`Por ${Math.max(1,5-state.guesses.length)*(mode==='choices'?50:100)} puntos`}</Text></View>
        {round.clues.map((clue,index)=>{const visible=finished||index<=state.guesses.length;return <View key={clue.kind} style={[styles.clue,{backgroundColor:visible?colors.surface:colors.surfaceVariant,borderRadius:radius.lg}]}><Text style={[typography.caption,{color:colors.play}]}>{index+1} · {clue.kind==='diet'&&round.answer.taxonomy.kingdom==='Plantae'?'Nutrición':CLUE_LABELS[clue.kind]}</Text><Text style={[typography.body,{color:visible?colors.text:colors.textMuted}]}>{visible?clue.body:'Se revela después de una respuesta incorrecta.'}</Text></View>;})}
        {!finished?<>
          {mode==='search'?<>
            <TextInput accessibilityLabel="Buscar una especie por nombre común o científico" placeholder="Nombre común o científico" placeholderTextColor={colors.textMuted} value={query} onChangeText={text=>{setQuery(text);setSelected(null);}} autoCorrect={false} style={[styles.input,typography.body,{color:colors.text,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:radius.md}]}/>
            {suggestions.map(item=><Pressable key={item.codigo} accessibilityRole="button" accessibilityState={{selected:selected?.codigo===item.codigo}} onPress={()=>setSelected(item)} style={[styles.option,{backgroundColor:selected?.codigo===item.codigo?colors.surfaceVariant:colors.surface,borderRadius:radius.md}]}><Text style={[typography.label,{color:colors.text}]}>{item.displayName}</Text><Text style={[typography.caption,{color:colors.textSecondary,fontStyle:'italic'}]}>{item.scientificName}</Text></Pressable>)}
            {!!query.trim()&&!suggestions.length&&<Text style={[typography.caption,{color:colors.textMuted}]}>No encontramos ese nombre. Seleccioná una especie de las sugerencias; escribir no consume intentos.</Text>}
          </>:round.options.map(item=><Pressable key={item.codigo} disabled={state.guesses.includes(item.codigo)} accessibilityRole="button" accessibilityState={{selected:selected?.codigo===item.codigo,disabled:state.guesses.includes(item.codigo)}} onPress={()=>setSelected(item)} style={[styles.option,{backgroundColor:selected?.codigo===item.codigo?colors.surfaceVariant:colors.surface,borderRadius:radius.md,opacity:state.guesses.includes(item.codigo)?.4:1}]}><Text style={[typography.label,{color:colors.text}]}>{item.displayName}</Text><Text style={[typography.caption,{color:colors.textSecondary,fontStyle:'italic'}]}>{item.scientificName}</Text></Pressable>)}
          <ActionButton text={selected?`Responder: ${selected.displayName}`:'Elegí una especie'} onPress={()=>void answer()} disabled={!selected}/>
        </>:<View style={[styles.clue,{backgroundColor:colors.surface,borderRadius:radius.lg}]}><SpeciesImage species={round.answer} height={190}/><Text style={[typography.cardTitle,{color:colors.text}]}>{round.answer.displayName}</Text><Text style={[typography.body,{color:colors.textSecondary,fontStyle:'italic'}]}>{round.answer.scientificName}</Text><ActionButton text="Otra especie" onPress={start}/><ActionButton text="Ver ficha" onPress={()=>router.push(`/species/${round.answer.codigo}`)}/></View>}
        {state.guesses.length>0&&<Text style={[typography.caption,{color:colors.textMuted}]}>Tus respuestas: {state.guesses.map(code=>catalog?.candidates.find(s=>s.codigo===code)?.displayName??code).join(' · ')}</Text>}
      </>}
      {!!error&&<Text accessibilityRole="alert" style={[typography.body,{color:colors.text}]}>{error}</Text>}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({header:{paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:12},back:{width:44,height:44,alignItems:'center',justifyContent:'center'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},button:{minHeight:52,padding:14,alignItems:'center',justifyContent:'center'},clue:{padding:16,gap:8},status:{padding:16,flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'space-between'},input:{minHeight:52,padding:14,borderWidth:1},option:{padding:14,gap:4}});
