import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KNOWLEDGE_LEVELS, type KnowledgeLevel } from '../../src/domain/entities/quiz';
import { Chip } from '../../src/presentation/components/Chip';
import { BackIcon } from '../../src/presentation/components/TabIcons';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';

export default function TriviaSetupScreen(): React.JSX.Element {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { colors, spacing, radius, typography } = useTheme();
  const [level,setLevel]=useState<KnowledgeLevel>('easy');
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.screen,{ paddingTop: insets.top + spacing.sm,paddingHorizontal:spacing.lg,paddingBottom:insets.bottom+spacing.xl }]}>
    <View style={styles.header}><Pressable onPress={()=>router.back()} style={[styles.back,{backgroundColor:colors.surface,borderRadius:radius.pill}]}><BackIcon color={colors.text}/></Pressable><Text style={[typography.headerTitle,{color:colors.text}]}>Trivia</Text></View>
    <Text style={[typography.body,{color:colors.textMuted}]}>Seis preguntas de opción múltiple sobre la naturaleza de Uruguay, con una explicación breve después de responder.</Text>
    <View><Text style={[typography.cardTitle,{color:colors.text}]}>Elegí la dificultad</Text><View style={styles.levels}>{KNOWLEDGE_LEVELS.map((item)=><View key={item.id} style={[styles.level,{borderRadius:radius.lg,borderColor:level===item.id?colors.play:colors.border,backgroundColor:level===item.id?colors.surfaceVariant:colors.surface}]}><Chip label={item.label} selected={level===item.id} accent={colors.play} onAccent={colors.onPlay} onPress={()=>setLevel(item.id)}/><Text style={[typography.body,{color:colors.textSecondary,marginTop:8}]}>{item.description}</Text></View>)}</View><Text style={[typography.caption,{color:colors.textMuted,marginTop:10}]}>Las preguntas generales aparecen en todos los niveles. Más adelante, las preguntas sobre especies respetarán la dificultad editorial de cada una.</Text></View>
    <Pressable onPress={()=>router.push({pathname:'/game/trivia',params:{level}} as never)} style={[styles.start,{backgroundColor:colors.play,borderRadius:radius.pill}]}><Text style={[typography.label,{color:colors.onPlay}]}>Empezar</Text></Pressable>
  </ScrollView>;
}
const styles=StyleSheet.create({screen:{flexGrow:1,gap:24},header:{flexDirection:'row',alignItems:'center',gap:12},back:{width:44,height:44,alignItems:'center',justifyContent:'center'},levels:{gap:10,marginTop:12},level:{padding:14,borderWidth:1},start:{minHeight:52,alignItems:'center',justifyContent:'center'}});
