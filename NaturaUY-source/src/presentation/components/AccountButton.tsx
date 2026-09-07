import { Pressable, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';

import { useMobileAuth } from '../../auth/MobileAuthProvider';
import { LoginIcon } from './TabIcons';

export function AccountButton({ onPress, color, backgroundColor }: { onPress: () => void; color: string; backgroundColor?: string }): React.JSX.Element {
  const { profile, session } = useMobileAuth();
  const avatarUrl = profile?.avatarUrl ?? (typeof session?.user.user_metadata?.avatar_url === 'string' ? session.user.user_metadata.avatar_url : typeof session?.user.user_metadata?.picture === 'string' ? session.user.user_metadata.picture : null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => setAvatarFailed(false), [avatarUrl]);
  return <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={profile ? `Cuenta de ${profile.displayName}` : session ? 'Tu cuenta Natura UY' : 'Iniciar sesión'} style={[styles.button, { backgroundColor }]}>
    {avatarUrl && !avatarFailed ? <Image source={{ uri: avatarUrl }} contentFit="cover" onError={() => setAvatarFailed(true)} style={styles.avatar} /> : <LoginIcon color={color} />}
  </Pressable>;
}

const styles = StyleSheet.create({ button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 }, avatar: { width: 44, height: 44, borderRadius: 22 } });
