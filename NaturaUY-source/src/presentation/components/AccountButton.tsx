import { Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { useMobileAuth } from '../../auth/MobileAuthProvider';
import { LoginIcon } from './TabIcons';

export function AccountButton({ onPress, color, backgroundColor }: { onPress: () => void; color: string; backgroundColor?: string }): React.JSX.Element {
  const { profile } = useMobileAuth();
  return <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={profile ? `Cuenta de ${profile.displayName}` : 'Iniciar sesión'} style={[styles.button, { backgroundColor }]}>
    {profile?.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} contentFit="cover" style={styles.avatar} /> : <LoginIcon color={color} />}
  </Pressable>;
}

const styles = StyleSheet.create({ button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 }, avatar: { width: 30, height: 30, borderRadius: 15 } });
