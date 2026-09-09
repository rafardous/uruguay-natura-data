import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';

type NetworkContextValue = { isOffline: boolean | null };
const NetworkContext = createContext<NetworkContextValue>({ isOffline: null });

export function NetworkProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [isOffline, setIsOffline] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    Network.getNetworkStateAsync().then((state) => {
      if (active) setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    }).catch(() => undefined);
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected === undefined && state.isInternetReachable === undefined) return;
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => { active = false; subscription.remove(); };
  }, []);
  return <NetworkContext.Provider value={{ isOffline }}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue { return useContext(NetworkContext); }

export function OfflineSnackbar(): React.JSX.Element | null {
  const { isOffline } = useNetwork();
  const [dismissed, setDismissed] = useState(false);
  const [previous, setPrevious] = useState<boolean | null>(null);
  useEffect(() => {
    if (isOffline === false) setDismissed(false);
    if (isOffline === true && previous === false) setDismissed(false);
    setPrevious(isOffline);
  }, [isOffline, previous]);
  if (isOffline !== true || dismissed) return null;
  return <View style={styles.wrap} pointerEvents="box-none">
    <View style={styles.snackbar} accessibilityRole="alert">
      <Text style={styles.text}>Sin conexión. Podés seguir navegando con el catálogo guardado en el dispositivo.</Text>
      <Pressable onPress={() => setDismissed(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar aviso de conexión"><Text style={styles.close}>Cerrar</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 88, zIndex: 80, alignItems: 'center' },
  snackbar: { maxWidth: 520, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#293832', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  text: { flex: 1, color: '#FFF9EA', fontSize: 13, lineHeight: 18 },
  close: { color: '#BDD0B7', fontSize: 13, fontWeight: '700' },
});
