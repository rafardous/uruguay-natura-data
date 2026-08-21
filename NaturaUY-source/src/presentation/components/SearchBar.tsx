import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Buscar especie' }: SearchBarProps): React.JSX.Element {
  const { colors, radius, typography } = useTheme();

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <Svg width={19} height={19} viewBox="0 0 24 24">
        <Circle cx="11" cy="11" r="7" stroke={colors.textMuted} strokeWidth={2} fill="none" />
        <Path d="M20 20l-4-4" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      </Svg>

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Buscar especies"
        style={[typography.body, styles.input, { color: colors.text }]}
      />

      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Limpiar búsqueda">
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M6 6l12 12M18 6L6 18"
              stroke={colors.textMuted}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, padding: 0 },
});
