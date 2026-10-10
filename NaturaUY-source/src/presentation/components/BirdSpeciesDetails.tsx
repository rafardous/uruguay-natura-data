import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Species } from '../../domain/entities/species';
import { formatSpeciesMeasurement } from '../../domain/services/measurementFormatting';
import { useTheme } from '../theme/ThemeProvider';
function Disclosure({ title, children, color }: { title: string; children: React.ReactNode; color?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false); const { colors, typography } = useTheme();
  return <View style={{ marginTop: 12 }}><Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={[typography.label, { color: color ?? colors.primary, flex: 1 }]}>{title}</Text><Text style={[typography.title, { color: color ?? colors.textMuted }]}>{open ? '−' : '+'}</Text></Pressable>{open && <View style={{ paddingVertical: 8, gap: 10 }}>{children}</View>}</View>;
}
const MEASURES: Record<string,string> = { body_length: 'Largo corporal', body_mass: 'Masa', wing_length: 'Largo de ala', tail_length: 'Cola', tarsus_length: 'Tarso', max_length: 'Largo máximo' };
const ECOLOGY: Record<string,string> = { terrestrial: 'Terrestre', arboreal: 'Arborícola', aquatic: 'Acuática', aerial: 'Aérea', fossorial: 'Subterránea', perching: 'Posada', generalist: 'Generalista', diurnal: 'Diurna', nocturnal: 'Nocturna', both: 'Diurna y nocturna', freshwater: 'Agua dulce', brackish: 'Agua salobre', marine: 'Marina', benthic: 'Bentónica', demersal: 'Demersal', pelagic: 'Pelágica' };
export function BirdConservation({ species }: { species: Species }): React.JSX.Element | null {
  const { colors, typography } = useTheme();
  const rows = [['Uruguay', species.conservation.nationalRedList], ['Global', species.conservation.iucnGlobal]] as const;
  if (!rows.some(([, assessment]) => assessment)) return null;
  return <Disclosure title="Estado de conservación">{rows.map(([scope, assessment]) => assessment && <Text key={scope} style={[typography.body, { color: colors.textSecondary }]}>{scope}: {assessment.category}{assessment.assessedAt ? ` · evaluación ${assessment.assessedAt.slice(0, 4)}` : ''}</Text>)}</Disclosure>;
}
export function BirdTechnicalMeasures({ species, color }: { species: Species; color: string }): React.JSX.Element | null {
  const { typography } = useTheme(); const measures = species.measurements.filter((m) => m.kind !== 'body_length' && m.kind !== 'max_length');
  return measures.length ? <Disclosure title="Medidas técnicas" color={color}>{measures.map((m,i) => <View key={`${m.kind}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}><Text style={[typography.body,{color,flex:1}]}>{MEASURES[m.kind]}</Text><Text style={[typography.label,{color}]}>{formatSpeciesMeasurement(m)}</Text></View>)}</Disclosure> : null;
}
export function BirdIdentification({ species, classification, onTaxonomy }: { species: Species; classification: {label:string;rank:string;value:string}[]; onTaxonomy:(rank:string)=>void }): React.JSX.Element {
  const { colors, typography } = useTheme(); const text = [typography.body,{color:colors.textSecondary}]; const guide = species.naturalHistory?.bird?.guide; const names = [...species.commonNames, ...(guide?.commonName ? [guide.commonName] : [])].filter((n, i, all)=>n.toLocaleLowerCase('es')!==species.displayName.toLocaleLowerCase('es') && all.findIndex((v)=>v.toLocaleLowerCase('es')===n.toLocaleLowerCase('es'))===i);
  return <Disclosure title="Identificación y clasificación">{names.length>0 && <Text style={text}>Otros nombres: {names.join(' · ')}</Text>}{species.acceptedName && species.acceptedName!==species.scientificName && <Text style={text}>Nombre aceptado: {species.acceptedName}</Text>}{guide?.englishName && <Text style={text}>En inglés: {guide.englishName}</Text>}{guide?.scientificName && guide.scientificName!==species.scientificName && <Text style={text}>Nombre histórico: {guide.scientificName}</Text>}{classification.map((item)=><Pressable key={item.rank} onPress={()=>onTaxonomy(item.rank)} accessibilityRole="link" accessibilityLabel={`Ver ${item.label}: ${item.value}`} style={{minHeight:44,flexDirection:'row',justifyContent:'space-between',gap:12}}><Text style={[typography.caption,{color:colors.textMuted}]}>{item.label}</Text><Text style={[typography.label,{color:colors.text,flexShrink:1}]}>{item.value} ›</Text></Pressable>)}</Disclosure>;
}
export function BirdEcologyDetails({ species }: { species:Species }): React.JSX.Element | null {
  const {colors,typography}=useTheme(); const rows=[['Modo de vida',species.ecology.lifeModes],['Actividad',species.ecology.activity],['Ambientes acuáticos',species.ecology.aquaticEnvironments],['Zona acuática',species.ecology.waterZones],['Microhábitat',species.ecology.microhabitats],['Rol trófico',species.ecology.trophicRoles],['Hospedadores',species.ecology.hosts],['Asociaciones vegetales',species.ecology.plantAssociations]] as const; const text=[typography.body,{color:colors.textSecondary}];
  if(!rows.some(([,v])=>v.length)&&species.ecology.depthMinM===null&&species.ecology.depthMaxM===null)return null;
  return <Disclosure title="Más sobre su ecología">{rows.filter(([,v])=>v.length).map(([label,v])=><Text key={label} style={text}>{label}: {v.map((i)=>ECOLOGY[i]??i).join(' · ')}</Text>)}{(species.ecology.depthMinM!==null||species.ecology.depthMaxM!==null)&&<Text style={text}>Profundidad: {species.ecology.depthMinM??'?'}–{species.ecology.depthMaxM??'?'} m</Text>}</Disclosure>;
}
export function BirdObservability({species}:{species:Species}):React.JSX.Element|null {
  const {colors,typography}=useTheme(); const v=species.observability; return v ? <Disclosure title="Registros y observabilidad"><Text style={[typography.body,{color:colors.textSecondary}]}>Índice {Math.round(v.score)}/100 · {v.occurrenceCount} registros · {v.occupiedCells} celdas de 10 km{'\n'}{v.periodStart.slice(0,4)}–{v.periodEnd.slice(0,4)}. Describe registros públicos; no estima población ni probabilidad de avistamiento.</Text></Disclosure> : null;
}
export function BirdSpeciesDescription({species}:{species:Species}):React.JSX.Element|null {
  const {colors,typography,spacing}=useTheme(); const [open,setOpen]=useState(false); const [long,setLong]=useState(false); const text=[typography.body,{color:colors.textSecondary}];
  if(!species.descripcion.trim())return null;
  return <View style={{marginTop:spacing.lg}}><Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[...text,{position:'absolute',opacity:0,width:'100%'}]} onTextLayout={(e)=>setLong(e.nativeEvent.lines.length>3)}>{species.descripcion}</Text><Text style={[typography.label,{color:colors.text,marginBottom:8}]}>Descripción</Text><Text style={text} numberOfLines={open?undefined:3}>{species.descripcion}</Text>{(long||open)&&<Pressable onPress={()=>setOpen(!open)} accessibilityRole="button" accessibilityState={{expanded:open}} style={{minHeight:44,justifyContent:'center'}}><Text style={[typography.label,{color:colors.primary}]}>{open?'Leer menos':'Leer más'}</Text></Pressable>}</View>;
}
