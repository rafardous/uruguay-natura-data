import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Species } from '../../domain/entities/species';
import { formatSpeciesMeasurement } from '../../domain/services/measurementFormatting';
import { SpeciesEcologyTags } from './SpeciesEcologyTags';
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
export function BirdEcologyDetails({ species, accent, container, foreground }: { species: Species; accent: string; container: string; foreground: string }): React.JSX.Element {
  const { typography, colors } = useTheme();
  const ecology = species.ecology;
  const rows: [string, string[]][] = [
    ['Modo de vida', ecology.lifeModes], ['Actividad', ecology.activity],
    ['Ambiente acuático', ecology.aquaticEnvironments], ['Zona de agua', ecology.waterZones],
    ['Microhábitat', ecology.microhabitats], ['Rol trófico', ecology.trophicRoles],
    ['Hospedadores', ecology.hosts], ['Asociaciones con plantas', ecology.plantAssociations],
  ];
  const depth = ecology.depthMinM !== null && ecology.depthMaxM !== null
    ? ecology.depthMinM + '–' + ecology.depthMaxM + ' m'
    : ecology.depthMinM !== null ? 'Desde ' + ecology.depthMinM + ' m'
      : ecology.depthMaxM !== null ? 'Hasta ' + ecology.depthMaxM + ' m' : null;
  return <View>
    {rows.map(([title, values]) => <SpeciesEcologyTags key={title} title={title} values={values.map((value) => ECOLOGY[value] ?? value)} accent={accent} container={container} foreground={foreground} />)}
    {depth && <View style={{ marginTop: 16 }}><Text style={[typography.label, { color: accent }]}>Profundidad</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>{depth}</Text></View>}
  </View>;
}
export function BirdObservability({species}:{species:Species}):React.JSX.Element|null {
  const {colors,typography}=useTheme(); const v=species.observability; return v ? <Disclosure title="Registros y observabilidad"><Text style={[typography.body,{color:colors.textSecondary}]}>Índice {Math.round(v.score)}/100 · {v.occurrenceCount} registros · {v.occupiedCells} celdas de 10 km{'\n'}{v.periodStart.slice(0,4)}–{v.periodEnd.slice(0,4)}. Describe registros públicos; no estima población ni probabilidad de avistamiento.</Text></Disclosure> : null;
}
export function BirdSpeciesDescription({species}:{species:Species}):React.JSX.Element|null {
  const {colors,typography,spacing}=useTheme(); const [open,setOpen]=useState(false); const [long,setLong]=useState(false); const text=[typography.body,{color:colors.textSecondary}];
  if(!species.descripcion.trim())return null;
  return <View style={{marginTop:spacing.lg}}><Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[...text,{position:'absolute',opacity:0,width:'100%'}]} onTextLayout={(e)=>setLong(e.nativeEvent.lines.length>3)}>{species.descripcion}</Text><Text style={[typography.label,{color:colors.text,marginBottom:8}]}>Descripción</Text><Text style={text} numberOfLines={open?undefined:3}>{species.descripcion}</Text>{(long||open)&&<Pressable onPress={()=>setOpen(!open)} accessibilityRole="button" accessibilityState={{expanded:open}} style={{minHeight:44,justifyContent:'center'}}><Text style={[typography.label,{color:colors.primary}]}>{open?'Leer menos':'Leer más'}</Text></Pressable>}</View>;
}
