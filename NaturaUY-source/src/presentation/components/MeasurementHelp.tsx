import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, InfoIcon } from './TabIcons';

/** General measurement conventions, without attributing bird-specific rules to other taxa. */
export function MeasurementHelp({ accent }: { accent: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const { colors, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return <>
    <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Qué significan las medidas de tamaño" style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }}><InfoIcon color={accent} size={20} /></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,30,24,0.60)' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar información de tamaño" />
        <View accessibilityViewIsModal style={{ padding: 24, paddingBottom: Math.max(insets.bottom, 24), borderTopWidth: 2, borderColor: accent, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: '#FFFFFF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}><Text accessibilityRole="header" style={[typography.title, { flex: 1, color: colors.text }]}>Cómo leer el tamaño</Text><Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><CloseIcon color={colors.text} /></Pressable></View>
          <Text style={[typography.body, { color: colors.textSecondary }]}>Cada valor indica la parte medida y su unidad. «Largo máximo» es un máximo registrado; «aproximado» señala una estimación.{ '\n\n' }Las medidas detalladas describen partes del cuerpo y no se suman al largo total.</Text>
        </View>
      </View>
    </Modal>
  </>;
}
