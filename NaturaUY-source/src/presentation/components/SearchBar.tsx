import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}

export function SearchBar({ value, onChange, placeholder = 'Buscar especie', onSubmit }: SearchBarProps): React.JSX.Element {
  const { colors, radius, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: '#E8E9D8',
          borderColor: focused ? colors.primary : colors.border,
          borderRadius: radius.pill,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: focused ? 0.13 : 0,
          shadowRadius: 8,
          elevation: focused ? 3 : 0,
        },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, padding: 0 },
});
