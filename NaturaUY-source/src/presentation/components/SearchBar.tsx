import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_SCROLL_DISTANCE } from '../theme/tokens';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  collapseOffset?: SharedValue<number>;
  onFocusChange?: (focused: boolean) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  variant?: 'gradient' | 'surface';
}

export function SearchBar({ value, onChange, placeholder = 'Buscar una especie', onSubmit, collapseOffset, onFocusChange, onLayout, variant = 'gradient' }: SearchBarProps): React.JSX.Element {
  const { colors, radius, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const compactStyle = useAnimatedStyle(() => {
    const offset = collapseOffset?.value ?? 0;
    return {
      height: interpolate(offset, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [46, 40], Extrapolation.CLAMP),
      marginHorizontal: interpolate(offset, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [0, 4], Extrapolation.CLAMP),
      paddingHorizontal: interpolate(offset, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [13, 10], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        compactStyle,
        {
          backgroundColor: variant === 'surface' ? colors.surface : '#E8E9D8',
          borderColor: focused ? colors.primary : variant === 'surface' ? colors.primary : colors.border,
          borderRadius: radius.pill,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: focused ? 0.13 : 0,
          shadowRadius: 8,
          elevation: focused ? 3 : 0,
        },
      ]}
      onLayout={onLayout}
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
        onFocus={() => { setFocused(true); onFocusChange?.(true); }}
        onBlur={() => { setFocused(false); onFocusChange?.(false); }}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, padding: 0 },
});
