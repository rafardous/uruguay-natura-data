import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { BirdNaturalHistory, Species } from '../../domain/entities/species';
import { abundanceLabel, dietLabel, habitatLabel, seasonalityLabel } from '../../domain/catalogLabels';
import { BIRD_ABUNDANCE, BIRD_DIETS, BIRD_HABITATS, birdMeasureLabel, formatBirdMeasure } from '../../domain/services/birdGuide';
import { formatSpeciesMeasurement } from '../../domain/services/measurementFormatting';
import { CloseIcon, InfoIcon } from './TabIcons';
import { useTheme } from '../theme/ThemeProvider';
import { BirdEcologyDetails, BirdObservability, BirdTechnicalMeasures } from './BirdSpeciesDetails';
import { SpeciesEcologyTags } from './SpeciesEcologyTags';

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SET','OCT','NOV','DIC'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];

function GuideTags({ title, values, historical, accent, container, foreground }: { title: string; values: string[]; historical: boolean; accent: string; container: string; foreground: string }): React.JSX.Element | null {
  return <SpeciesEcologyTags title={title} values={values} accent={accent} />;
}

export function BirdFieldGuide({ bird: suppliedBird, species, accent, container, foreground }: { bird?: BirdNaturalHistory; species: Species; accent: string; container: string; foreground: string }): React.JSX.Element {
  const { colors, typography, radius, spacing } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const bird = suppliedBird ?? { measurements: [], presence: null, habitat: [], diet: [], abundanceCode: null, guide: null };
  const [sizeInfo, setSizeInfo] = useState(false);
  const [presenceInfo, setPresenceInfo] = useState(false);
  const abundance = bird.abundanceCode ? BIRD_ABUNDANCE[bird.abundanceCode] : species.abundanceStatus ? abundanceLabel(species.abundanceStatus) : null;
  const habitats = bird.habitat.length ? bird.habitat.map((code) => BIRD_HABITATS[code] ?? code) : species.ecology.habitats.map(habitatLabel);
  const diets = bird.diet.length ? bird.diet.map((code) => BIRD_DIETS[code] ?? code) : species.ecology.diet.map(dietLabel);
  return <View style={{ marginTop: spacing.lg }}>
    <View style={[styles.card, { backgroundColor: container, borderRadius: radius.lg }]}>
      <View style={styles.heading}><Text style={[typography.label, { color: foreground }]}>Tamaño</Text><Pressable onPress={() => setSizeInfo(true)} accessibilityRole="button" accessibilityLabel="Qué significan las medidas de tamaño" style={styles.info}><InfoIcon size={20} color={foreground} /></Pressable></View>
      <View style={styles.measurements}>
        {bird.measurements.map((measure) => <View key={`${measure.kind}-${measure.sex ?? ''}`} style={styles.measure}><Text style={[typography.caption, { color: foreground }]}>{birdMeasureLabel(measure)}</Text><Text style={[typography.title, { color: foreground, marginTop: 4 }]}>{formatBirdMeasure(measure.valueCm)}</Text></View>)}
        {!bird.measurements.length && <View style={styles.measure}><Text style={[typography.caption, { color: foreground }]}>Largo corporal</Text><Text style={[typography.body, { color: foreground }]}>{species.measurements.filter((measure) => measure.kind === 'body_length' || measure.kind === 'max_length').map(formatSpeciesMeasurement).join(' · ') || 'Sin datos disponibles'}</Text></View>}
      </View>
      <BirdTechnicalMeasures species={species} color={foreground} />
    </View>
    {abundance && <View style={[styles.abundance, { borderBottomColor: colors.border }]}><Text style={[typography.caption, { color: colors.textMuted }]}>Abundancia{!bird.abundanceCode ? ' · catálogo' : ''}</Text><Text style={[typography.label, { color: colors.text }]}>{abundance}</Text></View>}
    {(bird.presence || species.seasonality) && <View style={styles.section}>
      <Text style={[typography.label, { color: accent }]}>Presencia en Uruguay</Text>
      <Pressable onPress={() => setPresenceInfo(!presenceInfo)} accessibilityRole="button" accessibilityState={{ expanded: presenceInfo }} style={styles.presenceHeading}><Text style={[typography.body, { color: colors.text, flex: 1 }]}>{bird.presence?.label ?? seasonalityLabel(species.seasonality!)}</Text><Text style={[typography.label, { color: accent }]}>{presenceInfo ? '−' : '+'}</Text></Pressable>
      {Boolean(bird.presence?.months.length) && <>
        <View style={[styles.calendar, (fontScale > 1.25 || width < 360) && { flexWrap: 'wrap' }]}>{MONTHS.map((label, index) => { const present = bird.presence!.months.includes(index + 1); return <View key={index} accessible accessibilityLabel={`${MONTH_NAMES[index]}: ${present ? 'período habitual según la guía' : 'fuera del período habitual'}`} style={[styles.month, (fontScale > 1.25 || width < 360) && { flexBasis: '15%', flexGrow: 1 }, { backgroundColor: present ? container : colors.surfaceVariant, borderRadius: radius.sm }]}><Text style={[typography.caption, { color: present ? foreground : colors.textMuted, fontSize: 10 }]}>{label}</Text><Text style={{ color: present ? foreground : colors.textMuted }}>{present ? '●' : '·'}</Text></View>; })}</View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>● Período habitual</Text>
      </>}
      {presenceInfo && <Text style={[typography.body, { color: colors.textSecondary }]}>{bird.presence ? `${bird.presence.note}${bird.presence.outsidePeriod ? ' Puede observarse fuera del período habitual.' : ''}\nReferencia histórica de 2003; no indica la probabilidad actual de avistamiento.` : 'Estacionalidad del catálogo, de otras fuentes.'}</Text>}
      <BirdObservability species={species} />
    </View>}
    <GuideTags title="Dónde vive" values={habitats} historical={Boolean(bird.habitat.length)} accent={accent} container={container} foreground={foreground} />
    <GuideTags title="Qué come" values={diets} historical={Boolean(bird.diet.length)} accent={accent} container={container} foreground={foreground} />
    <BirdEcologyDetails species={species} />
    <Modal visible={sizeInfo} transparent animationType="fade" onRequestClose={() => setSizeInfo(false)}>
      <View style={[styles.modalRoot, { backgroundColor: 'rgba(16,30,24,0.60)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSizeInfo(false)} accessibilityLabel="Cerrar información de tamaño" />
        <View accessibilityViewIsModal style={[styles.infoSheet, { backgroundColor: '#FFFFFF', borderTopWidth: 2, borderColor: accent, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
          <View style={styles.heading}><Text accessibilityRole="header" style={[typography.title, { color: colors.text, flex: 1 }]}>Cómo leer el tamaño</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setSizeInfo(false)} style={styles.info}><CloseIcon color={colors.text} size={22} /></Pressable></View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}><Text style={typography.label}>Largo corporal. </Text>Medida total aproximada del ave, en centímetros.</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}><Text style={typography.label}>Envergadura. </Text>De punta a punta de las alas abiertas; no es el largo de un ala.</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}><Text style={typography.label}>Macho y hembra. </Text>Son medidas separadas, no un rango.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  reference: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, paddingBottom: 8 },
  card: { paddingHorizontal: 14, paddingVertical: 8 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  info: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }, measurements: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, measure: { flexBasis: '42%', flexGrow: 1 },
  abundance: { minHeight: 54, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 0.5, marginTop: 8 },
  section: { marginTop: 24, gap: 10 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tag: { paddingHorizontal: 10, paddingVertical: 7, maxWidth: '100%', borderWidth: 0.5 },
  expand: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, presenceHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  calendar: { flexDirection: 'row', gap: 3 }, month: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, infoSheet: { padding: 24, maxHeight: '80%' },
});
