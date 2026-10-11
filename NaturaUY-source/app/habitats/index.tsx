import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitatCatalog } from '../../src/presentation/hooks/useHabitatCatalog';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { BackIcon } from '../../src/presentation/components/TabIcons';
import { HabitatArt } from '../../src/presentation/components/HabitatArt';
import { navigationBottomInset } from '../../src/presentation/navigationPolicy';
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');

export default function HabitatsScreen() {
  const router=useRouter();const insets=useSafeAreaInsets();const {family}=useLocalSearchParams<{family?:string}>();const {items,aliases,loading,error}=useHabitatCatalog();const {colors,spacing,typography,radius}=useTheme();const [query,setQuery]=useState('');
  const groups=items.filter(h=>h.kind==='group');const selected=groups.find(h=>h.code===family);
  const shown=useMemo(()=>{
    if(query.trim()){const q=fold(query.trim());const matches=new Set(Object.entries(aliases).filter(([name])=>fold(name).includes(q)).map(([,code])=>code));return items.filter(h=>(!family||h.familyCode===family)&&(fold(h.name).includes(q)||matches.has(h.code)));}
    return family?items.filter(h=>h.familyCode===family&&h.kind!=='group'):groups;
  },[items,aliases,query,family,groups]);
  return <View style={{flex:1,backgroundColor:colors.background}}><ScrollView contentContainerStyle={{paddingTop:insets.top+spacing.lg,paddingHorizontal:spacing.lg,paddingBottom:navigationBottomInset(insets.bottom),gap:spacing.md}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Pressable onPress={()=>family?router.replace('/habitats' as never):router.back()} accessibilityRole="button" accessibilityLabel={family?'Volver a todos los ambientes':'Volver a Descubrir'} style={{padding:12,backgroundColor:colors.surface,borderRadius:30}}><BackIcon color={colors.text}/></Pressable><View style={{flex:1}}><Text style={[typography.eyebrow,{color:colors.textMuted}]}>DESCUBRIR</Text><Text style={[typography.title,{color:colors.text}]}>{selected?.name??'Ambientes de Uruguay'}</Text></View></View>
    <Text style={[typography.body,{color:colors.textSecondary}]}>{selected?.content.description??'Conocé los paisajes, el agua y la vegetación donde vive nuestra biodiversidad.'}</Text>
    {selected&&<Pressable onPress={()=>router.push(`/habitats/${selected.code}` as never)}><Text style={[typography.label,{color:selected.color}]}>Conocer esta familia y sus especies ›</Text></Pressable>}
    <SearchBar value={query} onChange={setQuery} placeholder="Buscar un ambiente" accessibilityLabel="Buscar ambientes"/>
    {loading&&<ActivityIndicator color={colors.primary}/>}{!!error&&<Text style={[typography.body,{color:colors.textSecondary}]}>No se pudieron cargar los ambientes: {error}</Text>}
    {!loading&&!error&&shown.length===0&&<Text style={[typography.body,{color:colors.textSecondary}]}>{items.length?'No encontramos ambientes con ese nombre.':'Esta versión del catálogo todavía no incluye ambientes.'}</Text>}
    {shown.map(h=><Pressable key={h.id} onPress={()=>router.push((h.kind==='group'&&!query?`/habitats?family=${h.code}`:`/habitats/${h.code}`) as never)} accessibilityRole="button" accessibilityLabel={`${h.name}, ${h.count} especies del catálogo`} style={{backgroundColor:colors.surface,borderRadius:radius.lg,overflow:'hidden',borderWidth:1,borderColor:`${h.color}35`}}><HabitatArt habitat={h}/><View style={{padding:16,gap:6}}><Text style={[typography.cardTitle,{color:colors.text}]}>{h.name} ›</Text><Text numberOfLines={2} style={[typography.caption,{color:colors.textSecondary}]}>{h.content.description}</Text><Text style={[typography.label,{color:h.color}]}>{h.count} especies del catálogo{h.kind==='aggregate'?' · Asociación amplia':''}</Text></View></Pressable>)}
    <Text style={[typography.caption,{color:colors.textMuted}]}>Clasificación editorial de Arapy. Los ambientes pueden superponerse; los conteos no representan toda la biodiversidad del país.</Text>
  </ScrollView></View>;
}
