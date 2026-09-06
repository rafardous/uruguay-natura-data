import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Catalog entry point kept as a stable URL; the catalogue UI lives in Explore. */
export default function SpeciesIndexScreen(): null {
  const router = useRouter();
  const params = useLocalSearchParams<{ native?: string; priority?: string }>();
  useEffect(() => {
    router.replace({ pathname: '/explore', params: { all: '1', native: params.native, priority: params.priority } });
  }, [params.native, params.priority, router]);
  return null;
}
