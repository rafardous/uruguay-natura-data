import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Image as NativeImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';

import type { Species } from '../src/domain/entities/species';
import { speciesRepository, TAXON_RANKS, type SpeciesFilters } from '../src/data/repositories/speciesRepository';
import { CARD_HEIGHT, SpeciesCard, SpeciesCardSkeleton } from '../src/presentation/components/SpeciesCard';
import { FamilyGlyph } from '../src/presentation/components/FamilyGlyph';
import { BackIcon, ChevronRightIcon, LeafIcon, TaxonomyIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useFavorites } from '../src/presentation/hooks/FavoritesProvider';
import { useScrollDetentHaptics, useViewableItemHaptics } from '../src/presentation/hooks/useScrollDetentHaptics';
import { useSpeciesList } from '../src/presentation/hooks/useSpeciesList';
import { useTheme } from '../src/presentation/theme/ThemeProvider';
import { classVisual } from '../src/presentation/taxonomy/classVisuals';
import { spacing as space } from '../src/presentation/theme/tokens';
import { navigationBottomInset } from '../src/presentation/navigationPolicy';

type Node = Awaited<ReturnType<typeof speciesRepository.listTaxonChildren>>[number];
type TrailNode = Awaited<ReturnType<typeof speciesRepository.getTaxonTrail>>[number];
const ROW_HEIGHT = CARD_HEIGHT + space.lg;
const COLORS = { main: '#8A641B', pale: '#F1E3B9', text: '#293832', plant: '#396B4A' };
const RANKS: Record<string, { singular:string; plural:string }> = {
  kingdom:{singular:'Reino',plural:'reinos'}, phylum:{singular:'Filo',plural:'filos'}, subphylum:{singular:'Subfilo',plural:'subfilos'},
  class:{singular:'Clase',plural:'clases'}, order:{singular:'Orden',plural:'órdenes'}, family:{singular:'Familia',plural:'familias'}, genus:{singular:'Género',plural:'géneros'}, clade:{singular:'Grupo',plural:'grupos'},
};
const rankLabel=(rank:string)=>RANKS[rank]??{singular:'Grupo',plural:'grupos'};

function TaxonArt({node}:{node:Node}):React.JSX.Element {
  const {colors,radius}=useTheme(); const key=node.canonicalName.toLocaleLowerCase('es');
  if(key==='chordata')return <NativeImage source={require('../assets/images/taxonomy/chordata-vertebrates.png')} resizeMode="contain" style={styles.art} accessibilityLabel="Diversidad de vertebrados"/>;
  if(key==='arthropoda')return <NativeImage source={require('../assets/images/taxonomy/arthropoda-invertebrates.png')} resizeMode="contain" style={styles.art} accessibilityLabel="Diversidad de artrópodos"/>;
  if(key==='plantae'||key==='tracheophyta')return <View style={[styles.art,styles.artFallback,{backgroundColor:'#DDEBDD',borderRadius:radius.md}]}><LeafIcon color={COLORS.plant} size={50}/></View>;
  const visual=node.rank==='class'?classVisual(node.canonicalName):undefined;
  if(visual)return <NativeImage source={visual.image} resizeMode="contain" style={[styles.art,{backgroundColor:'#FDF7E7',borderRadius:radius.md}]} accessibilityLabel={visual.imageAccessibilityLabel}/>;
  if(node.representativeImageUrl)return <ExpoImage source={{uri:node.representativeImageUrl}} contentFit="cover" cachePolicy="memory-disk" style={[styles.art,{borderRadius:radius.md,backgroundColor:colors.surfaceVariant}]} accessibilityLabel={`Imagen ilustrativa de ${node.representativeName??node.canonicalName}`}/>;
  return <View style={[styles.art,styles.artFallback,{backgroundColor:colors.primaryContainer,borderRadius:radius.md}]}><FamilyGlyph clase={node.canonicalName} color={colors.onPrimaryContainer} size={45} opacity={.9}/></View>;
}

function SpeciesResults({taxonId,title}:{taxonId:string;title:string}):React.JSX.Element {
  const {colors,spacing,typography}=useTheme(); const insets=useSafeAreaInsets(); const router=useRouter(); const {isFavorite,toggle}=useFavorites();
  const filters=useMemo<SpeciesFilters>(()=>({taxonId}),[taxonId]); const {items,total,loading,loadingMore,loadMore}=useSpeciesList(filters);
  const onScroll=useScrollDetentHaptics(ROW_HEIGHT,taxonId); const bottomInset=navigationBottomInset(insets.bottom,spacing.lg);
  const renderItem=useCallback(({item,index}:{item:Species;index:number})=><View style={{paddingHorizontal:spacing.lg,paddingBottom:spacing.lg}}><SpeciesCard species={item} index={index} favorite={isFavorite(item.codigo)} onPress={(codigo)=>router.push(`/species/${codigo}`)} onToggleFavorite={toggle}/></View>,[isFavorite,router,spacing.lg,toggle]);
  if(loading)return <ScrollView contentContainerStyle={{padding:spacing.lg,gap:spacing.lg}}>{Array.from({length:3},(_,index)=><SpeciesCardSkeleton key={index}/>)}</ScrollView>;
  return <FlashList data={items} renderItem={renderItem} keyExtractor={(item)=>item.codigo} onScroll={onScroll} scrollEventThrottle={32} onEndReached={loadMore} onEndReachedThreshold={.6} showsVerticalScrollIndicator={false}
    ListHeaderComponent={<View style={{paddingHorizontal:spacing.lg,paddingTop:spacing.md,paddingBottom:spacing.lg}}><Text style={[typography.eyebrow,{color:colors.primary}]}>{title.toLocaleUpperCase('es')}</Text><Text style={[typography.title,{color:colors.text,marginTop:5}]}>{total} {total===1?'especie':'especies'}</Text></View>}
    ListFooterComponent={loadingMore?<ActivityIndicator color={colors.primary} style={{paddingBottom:bottomInset}}/>:<View style={{height:bottomInset}}/>}/>;
}

export default function TaxonomyScreen():React.JSX.Element {
  const db=useSQLiteContext(); const {colors,radius,spacing,typography,elevation}=useTheme(); const insets=useSafeAreaInsets(); const router=useRouter();
  const params=useLocalSearchParams<{taxonId?:string;phylum?:string;subfilo?:string;clase?:string;orden?:string;familia?:string;genero?:string;returnToSpecies?:string}>();
  const legacyTarget=[...TAXON_RANKS].reverse().map((rank)=>[rank,params[rank]] as const).find(([,value])=>Boolean(value));
  const legacyTargetKey=legacyTarget?`${legacyTarget[0]}|${legacyTarget[1]}`:'';
  const [trail,setTrail]=useState<TrailNode[]>([]); const [children,setChildren]=useState<Node[]>([]); const [loading,setLoading]=useState(true); const breadcrumbRef=useRef<ScrollView>(null);
  const current=trail.at(-1)??null; const currentId=current?.taxonId??null; const bottomInset=navigationBottomInset(insets.bottom,spacing.lg); const visibleHaptics=useViewableItemHaptics(currentId??'taxonomy-root');
  useEffect(()=>{let active=true;setLoading(true);void speciesRepository.listTaxonChildren(db,currentId).then((items)=>{if(active){setChildren(items);setLoading(false);}}).catch(()=>{if(active){setChildren([]);setLoading(false);}});return()=>{active=false;};},[db,currentId]);
  useEffect(()=>{let active=true;const load=async()=>{let id=params.taxonId??null;if(!id&&legacyTarget){id=await speciesRepository.resolveLegacyTaxon(db,legacyTarget[0],legacyTarget[1]!);}if(id){const next=await speciesRepository.getTaxonTrail(db,id);if(active)setTrail(next);}};void load();return()=>{active=false;};
    // The serialized key is stable; legacyTarget is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[db,params.taxonId,legacyTargetKey]);
  const goBack=useCallback(()=>{haptics.tap();if(params.returnToSpecies){router.back();return;}if(trail.length)setTrail((value)=>value.slice(0,-1));else router.back();},[params.returnToSpecies,router,trail.length]);
  useFocusEffect(useCallback(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{goBack();return true;});return()=>sub.remove();},[goBack]));
  const select=(node:Node)=>{haptics.tick();setTrail((value)=>[...value,{taxonId:node.taxonId,parentId:node.parentId,rank:node.rank,canonicalName:node.canonicalName,simpleName:node.simpleName,description:node.description}]);};
  const nextRank=children[0]?.rank??null; const nextLabel=nextRank?rankLabel(nextRank):null;
  const nextArticle=nextLabel&&['Reino','Filo','Subfilo','Orden','Género','Grupo'].includes(nextLabel.singular)?'un':'una';
  // SQLite already applies the editorial sort_order. This preserves Chordata
  // before Arthropoda and the botanical groups in their didactic sequence.
  const ordered=useMemo(()=>children,[children]);
  const showSpecies=Boolean(current)&&!loading&&children.length===0;
  return <View style={[styles.screen,{backgroundColor:colors.background}]}><View style={{paddingTop:insets.top+spacing.sm,paddingHorizontal:spacing.lg}}><View style={styles.headerRow}><Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={trail.length?'Volver un nivel':'Volver a Descubrir'} style={({pressed})=>[styles.backButton,elevation.low,{backgroundColor:pressed?colors.surfaceVariant:colors.surface,borderRadius:radius.pill}]}><BackIcon color={colors.text}/></Pressable><View style={[styles.iconTile,{backgroundColor:colors.primaryContainer,borderRadius:radius.md}]}>{trail.some((node)=>node.canonicalName==='Plantae')?<LeafIcon color={colors.onPrimaryContainer}/>:<TaxonomyIcon color={colors.onPrimaryContainer} size={23}/>}</View><View style={styles.flex}><Text style={[typography.eyebrow,{color:colors.textMuted}]}>{nextLabel?.singular.toLocaleUpperCase('es')??'ESPECIES'}</Text><Text style={[typography.title,{color:colors.text,marginTop:2}]}>{nextLabel?`Elegí ${nextArticle} ${nextLabel.singular.toLocaleLowerCase('es')}`:`Especies de ${current?.simpleName??current?.canonicalName??'Arapy'}`}</Text></View></View>
    {trail.length>0&&<ScrollView ref={breadcrumbRef} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={()=>breadcrumbRef.current?.scrollToEnd({animated:true})} contentContainerStyle={[styles.breadcrumb,{paddingTop:spacing.lg,paddingBottom:spacing.sm}]}>{trail.map((node,index)=><View key={node.taxonId} style={styles.crumbGroup}>{index>0&&<View style={[styles.crumbConnector,{backgroundColor:COLORS.main}]}><ChevronRightIcon color={COLORS.main} size={14}/></View>}<Pressable onPress={()=>setTrail(trail.slice(0,index+1))} style={[styles.crumb,{backgroundColor:index===trail.length-1?COLORS.main:COLORS.pale,borderRadius:radius.md}]}><Text style={[typography.caption,{color:index===trail.length-1?'#F5E8C4':colors.textMuted}]}>{rankLabel(node.rank).singular}</Text><Text style={[typography.label,{color:index===trail.length-1?'#FFF9EA':COLORS.text}]}>{node.canonicalName}</Text></Pressable></View>)}</ScrollView>}</View><View style={[styles.divider,{backgroundColor:colors.border,marginTop:spacing.md}]}/><View style={styles.flex}>
    {showSpecies?<SpeciesResults taxonId={currentId!} title={current?.simpleName??current?.canonicalName??'Especies'}/>:loading&&children.length===0?<View style={styles.loading}><ActivityIndicator color={colors.primary}/></View>:<FlatList data={ordered} keyExtractor={(item)=>item.taxonId} showsVerticalScrollIndicator={false} onViewableItemsChanged={visibleHaptics.onViewableItemsChanged} viewabilityConfig={visibleHaptics.viewabilityConfig} contentContainerStyle={{padding:spacing.lg,paddingBottom:bottomInset,gap:spacing.sm}}
      ListHeaderComponent={<View style={{marginBottom:spacing.sm,gap:spacing.md}}>{current&&Boolean(current.description)&&<View style={[styles.description,{backgroundColor:colors.surfaceVariant,borderColor:colors.border,borderRadius:radius.lg}]}><Text style={[typography.eyebrow,{color:COLORS.main}]}>ACERCA DEL {rankLabel(current.rank).singular.toLocaleUpperCase('es')}</Text><View style={styles.titleRow}><Text style={[typography.cardTitle,styles.scientific,styles.flex,{color:colors.text}]}>{current.canonicalName}</Text>{current.simpleName&&<Text style={[typography.label,styles.simpleName,{color:current.canonicalName==='Plantae'?COLORS.plant:COLORS.main}]}>{current.simpleName}</Text>}</View><Text style={[typography.body,{color:colors.textSecondary,marginTop:7}]}>{current.description}</Text></View>}<Text style={[typography.body,{color:colors.textSecondary}]}>{children.length} {children.length===1?nextLabel?.singular.toLocaleLowerCase('es'):nextLabel?.plural} en este nivel</Text></View>}
      renderItem={({item,index})=>{const visual=item.rank==='class'?classVisual(item.canonicalName):undefined;const prominent=['kingdom','phylum','class','order'].includes(item.rank);return <MotiView from={{opacity:0,translateY:8}} animate={{opacity:1,translateY:0}} transition={{type:'timing',duration:180,delay:Math.min(index,6)*18}}><Pressable onPress={()=>select(item)} accessibilityRole="button" accessibilityLabel={`${item.canonicalName}, ${item.count} especies`} style={({pressed})=>[styles.taxonRow,prominent&&styles.prominentRow,elevation.low,{backgroundColor:visual?visual.colors[0]:pressed?colors.surfaceVariant:colors.surface,borderColor:colors.border,borderRadius:radius.lg,opacity:pressed?.92:1}]}>{visual&&<LinearGradient pointerEvents="none" colors={[...visual.colors]} style={[StyleSheet.absoluteFill,{borderRadius:radius.lg}]}/>} {prominent&&<TaxonArt node={item}/>}<View style={styles.flex}><Text style={[typography.eyebrow,{color:visual?.mutedForeground??colors.textMuted}]}>{rankLabel(item.rank).singular.toLocaleUpperCase('es')}</Text><View style={styles.titleRow}><Text style={[typography.cardTitle,styles.scientific,styles.flex,{color:visual?.foreground??colors.text}]} numberOfLines={2}>{item.canonicalName}</Text>{item.simpleName&&<Text style={[typography.label,styles.simpleName,{color:item.canonicalName==='Plantae'?COLORS.plant:visual?.foreground??COLORS.main}]} numberOfLines={2}>{item.simpleName}</Text>}</View>{item.description&&<Text style={[typography.body,{color:visual?.mutedForeground??colors.textSecondary,marginTop:5}]} numberOfLines={prominent?3:2}>{item.description}</Text>}</View><View style={styles.rowEnd}><View style={[styles.count,{backgroundColor:colors.primaryContainer,borderRadius:radius.pill}]}><Text style={[typography.caption,{color:colors.onPrimaryContainer}]}>{item.count}</Text></View><ChevronRightIcon color={colors.textMuted}/></View></Pressable></MotiView>;}}/>}</View></View>;
}

const styles=StyleSheet.create({screen:{flex:1},flex:{flex:1},headerRow:{flexDirection:'row',alignItems:'center',gap:11},backButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},iconTile:{width:44,height:44,alignItems:'center',justifyContent:'center'},breadcrumb:{alignItems:'center'},crumbGroup:{flexDirection:'row',alignItems:'center'},crumbConnector:{width:24,height:2,alignItems:'center',justifyContent:'center'},crumb:{minWidth:92,paddingHorizontal:12,paddingVertical:8},divider:{height:StyleSheet.hairlineWidth},loading:{flex:1,alignItems:'center',justifyContent:'center'},description:{padding:16,borderWidth:StyleSheet.hairlineWidth},taxonRow:{minHeight:82,flexDirection:'row',alignItems:'center',gap:12,padding:14,borderWidth:StyleSheet.hairlineWidth,overflow:'hidden'},prominentRow:{minHeight:132},art:{width:88,height:88},artFallback:{alignItems:'center',justifyContent:'center'},titleRow:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:4},simpleName:{flexBasis:'42%',maxWidth:'42%',textAlign:'right',lineHeight:18},scientific:{fontStyle:'italic'},rowEnd:{alignItems:'center',gap:7},count:{minWidth:36,alignItems:'center',paddingHorizontal:8,paddingVertical:6}});
