import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Image as SvgImage, Line, Text as SvgText } from 'react-native-svg';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import type { LearningIllustration as Illustration } from '../../domain/entities/learning';
import type { Species } from '../../domain/entities/species';
import { speciesRepository } from '../../data/repositories/speciesRepository';
import { thumbnailFor } from '../../data/assets/thumbMap';
import { useTheme } from '../theme/ThemeProvider';
import { SpeciesImage } from './SpeciesImage';

/** Diagramas que se acomodan al ancho disponible y reutilizan las fotos y créditos del catálogo. */
export function LearningIllustration({ illustration, compact = false }: { illustration: Illustration; compact?: boolean }): React.JSX.Element {
  const { colors, typography, radius } = useTheme();
  return <View style={[styles.figure, compact && styles.compactFigure, { backgroundColor: colors.surfaceVariant, borderRadius: radius.lg }]}>
    {!compact && <Text style={[typography.label, { color: colors.text, marginBottom: 12 }]}>{illustration.title}</Text>}
    {illustration.layout === 'tree' ? <TaxonomyTree compact={compact} /> : <View style={illustration.layout === 'sequence' ? styles.sequence : styles.compare}>
      {illustration.items.map((item, index) => <Fragment key={`${item.speciesCode ?? item.label}:${index}`}>
        {illustration.layout === 'sequence' && <View style={styles.stepRow}><View style={[styles.stepDot, { backgroundColor: colors.primaryContainer }]}><Text style={[styles.stepNumber, { color: colors.onPrimaryContainer }]}>{index + 1}</Text></View><View style={styles.stepContent}>
          {item.speciesCode ? <LearningPhoto code={item.speciesCode} label={item.label} caption={item.caption} compact={compact} /> : <><Text style={[typography.label, { color: colors.text }]}>{item.label}</Text>{item.caption && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 3 }]}>{item.caption}</Text>}</>}
          {index < illustration.items.length - 1 && <View style={[styles.timeline, { backgroundColor: colors.outline }]} />}
        </View></View>}
        {illustration.layout === 'compare' && <View style={styles.compareItem}>
          {item.speciesCode ? <LearningPhoto key={item.speciesCode} code={item.speciesCode} label={item.label} caption={item.caption} compact={compact} /> : <><View style={[styles.compareNode, { backgroundColor: colors.primaryContainer }]}><Text style={[typography.label, { color: colors.onPrimaryContainer, textAlign: 'center' }]}>{item.label}</Text></View>{item.caption && <Text style={[typography.caption, styles.captionText, { color: colors.textSecondary }]}>{item.caption}</Text>}</>}
        </View>}
      </Fragment>)}
    </View>}
  </View>;
}

function LearningPhoto({ code, label, caption, compact }: { code: string; label: string; caption?: string; compact: boolean }): React.JSX.Element {
  const db = useSQLiteContext(); const router = useRouter(); const { colors, typography } = useTheme();
  const [species, setSpecies] = useState<Species | null>(null);
  useEffect(() => {
    let active = true;
    void speciesRepository.findByCodigo(db, code).then(value => { if (active) setSpecies(value); }).catch(() => { if (active) setSpecies(null); });
    return () => { active = false; };
  }, [code, db]);
  const diameter = compact ? 64 : 96;
  const image = <View style={[styles.photo, { height: diameter, width: diameter, backgroundColor: colors.surface, borderColor: colors.outline, borderRadius: diameter / 2 }]}>
    {species ? <SpeciesImage species={species} height={diameter} borderRadius={diameter / 2} bordered={false} contentFit="contain" /> : <Text style={[typography.caption, { color: colors.textSecondary, padding: 8, textAlign: 'center' }]}>{label}</Text>}
  </View>;
  const description = <View style={styles.caption}><Text style={[typography.label, styles.photoLabel, { color: colors.text }]} numberOfLines={2}>{label}</Text>{caption && <Text style={[typography.caption, styles.captionText, { color: colors.textSecondary }]}>{caption}</Text>}</View>;
  if (compact) return <>{image}{description}</>;
  return <>
    <Pressable accessibilityRole="link" accessibilityLabel={`Ver ${label} y sus fuentes en el catálogo`} onPress={() => router.push(`/species/${code}` as never)}>{image}</Pressable>
    {description}
    <View style={styles.credits}>
      <Text style={[typography.caption, styles.creditText, { color: colors.textMuted }]}>{species?.photo ? `${species.photo.attribution} · ${species.photo.license === 'permission' ? 'Autorización de uso' : species.photo.license}` : 'Foto del catálogo. Créditos en la ficha de la especie.'}</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push(`/species/${code}` as never)} style={styles.link}><Text style={[typography.caption, { color: colors.primary }]}>Ver especie y fuentes ↗</Text></Pressable>
    </View>
  </>;
}

function TaxonomyTree({ compact }: { compact: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const nodes = [
    { x: 180, y: 28, label: 'VIDA', radius: 22, fill: colors.primary, text: colors.onPrimary },
    { x: 58, y: 99, label: 'PLANTAS', radius: 30, fill: colors.primaryContainer, text: colors.onPrimaryContainer },
    { x: 180, y: 99, label: 'ANIMALES', radius: 33, fill: colors.surface, text: colors.text },
    { x: 302, y: 99, label: 'HONGOS', radius: 29, fill: colors.accent, text: colors.onAccent },
  ];
  const speciesNodes = [
    { x: 58, code: 'plant-erythrina-crista-galli', label: 'CEIBO' },
    { x: 138, code: 'P_coronata', label: 'AVE' },
    { x: 222, code: 'H_hydrocha', label: 'MAMÍFERO' },
  ];
  return <View style={[styles.tree, compact && styles.compactTree]} accessibilityLabel="Árbol taxonómico: de la vida salen grupos cada vez más precisos, con fotos de ceibo, ave y mamífero">
    <Svg width="100%" height={compact ? 116 : 202} viewBox="0 0 360 202">
      <Defs>{speciesNodes.map((node) => <ClipPath key={node.code} id={`taxonomy-${node.code}`}><Circle cx={node.x} cy="164" r="20" /></ClipPath>)}</Defs>
      <Line x1="180" y1="50" x2="180" y2="65" stroke={colors.primary} strokeWidth="4" strokeLinecap="round" />
      <Line x1="58" y1="65" x2="302" y2="65" stroke={colors.primary} strokeWidth="4" strokeLinecap="round" />
      {[58, 180, 302].map((x) => <Line key={x} x1={x} y1="65" x2={x} y2="69" stroke={colors.primary} strokeWidth="4" strokeLinecap="round" />)}
      <Line x1="180" y1="132" x2="180" y2="143" stroke={colors.primary} strokeWidth="4" strokeLinecap="round" />
      <Line x1="58" y1="129" x2="58" y2="144" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" />
      <Line x1="138" y1="143" x2="222" y2="143" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" />
      <Line x1="138" y1="143" x2="138" y2="144" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" />
      <Line x1="222" y1="143" x2="222" y2="144" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" />
      {nodes.map((node) => <Fragment key={node.label}>
        <Circle cx={node.x} cy={node.y} r={node.radius} fill={node.fill} stroke={colors.primary} strokeWidth={node.label === 'VIDA' ? 0 : 2.5} />
        <SvgText x={node.x} y={node.y + 3} fill={node.text} fontSize={node.label === 'ANIMALES' ? 8 : 9} fontWeight="700" textAnchor="middle">{node.label}</SvgText>
      </Fragment>)}
      {speciesNodes.map((node) => <Fragment key={node.code}>
        <Circle cx={node.x} cy="164" r="22" fill={colors.surface} stroke={colors.primary} strokeWidth="2.5" />
        {thumbnailFor(node.code) !== null && <SvgImage href={thumbnailFor(node.code)!} x={node.x - 20} y="144" width="40" height="40" preserveAspectRatio="xMidYMid slice" clipPath={`url(#taxonomy-${node.code})`} />}
        <SvgText x={node.x} y="197" fill={colors.textSecondary} fontSize={node.label === 'MAMÍFERO' ? 8 : 9} fontWeight="700" textAnchor="middle">{node.label}</SvgText>
      </Fragment>)}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  figure: { padding: 12, marginTop: 16 }, compactFigure: { padding: 6, marginTop: 0 }, compare: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 12 }, sequence: { gap: 2 },
  compareItem: { flexGrow: 1, flexBasis: 118, minWidth: 110, maxWidth: 160, alignItems: 'center', paddingVertical: 4 },
  photo: { overflow: 'hidden', borderWidth: 2, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, caption: { paddingTop: 7, alignItems: 'center', maxWidth: 150 }, photoLabel: { textAlign: 'center' }, captionText: { textAlign: 'center', marginTop: 3 },
  credits: { alignItems: 'center', paddingTop: 5 }, creditText: { textAlign: 'center', fontSize: 10 }, link: { minHeight: 34, justifyContent: 'center' },
  compareNode: { minWidth: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', padding: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 }, stepDot: { marginTop: 1, width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, stepNumber: { fontSize: 12, fontWeight: '800' }, stepContent: { flex: 1, minHeight: 48, justifyContent: 'center', paddingBottom: 12 }, timeline: { position: 'absolute', left: -26, top: 27, width: 2, height: 36 },
  tree: { height: 176, alignItems: 'center', justifyContent: 'center' }, compactTree: { height: 112 },
});
