import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function SpeciesEcologyTags({ title, values, accent, container, foreground, onPressValue, clickableValues = [] }: { title: string; values: string[]; accent: string; container?: string; foreground?: string; onPressValue?(value:string):void; clickableValues?:string[] }): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  const { typography, colors, radius } = useTheme();
  const labels = values.map((value) => value.trim()).filter((value, index, all) => value && all.findIndex((other) => other.toLocaleLowerCase('es') === value.toLocaleLowerCase('es')) === index);
  if (!labels.length) return null;
  return <View style={{ marginTop: 16 }}>
    <Text style={[typography.label, { color: accent }]}>{title}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{(expanded ? labels : labels.slice(0, 3)).map((value) => <Pressable key={value} disabled={!clickableValues.includes(value)} accessibilityRole={clickableValues.includes(value)?'button':undefined} accessibilityLabel={clickableValues.includes(value)?`Explorar ${value}`:value} onPress={()=>onPressValue?.(value)} style={{ maxWidth: '100%', flexShrink: 1, minHeight:clickableValues.includes(value)?44:undefined, justifyContent:'center',paddingHorizontal: 10, paddingVertical: 7, borderWidth: 0.5, borderColor: accent, backgroundColor: container ?? colors.surface, borderRadius: radius.sm }}><Text style={[typography.caption, { color: foreground ?? accent }]}>{value}{clickableValues.includes(value)?' ›':''}</Text></Pressable>)}</View>
    {labels.length > 3 && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? 'Ver menos' : 'Ver más'}: ${title}`} onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={[typography.label, { color: accent }]}>{expanded ? 'Ver menos' : `Ver ${labels.length - 3} más`}</Text></Pressable>}
  </View>;
}
