import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { useMobileAuth } from '../../auth/MobileAuthProvider';
import { submitPhotoReviewReport } from '../../lib/mobileApi';

/** One-tap report; no offline queue or retry that could silently duplicate it. */
export function usePhotoReport(catalogCode: string | undefined, hasPhotos: boolean) {
  const { session, editorAccess, refreshEditorAccess } = useMobileAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const identity = `${session?.user.id ?? ''}:${catalogCode ?? ''}`;
  const currentIdentity = useRef(identity);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { currentIdentity.current = identity; setNotice(''); }, [identity]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const available = Boolean(session && editorAccess === true && hasPhotos && catalogCode);
  const send = useCallback(async (): Promise<void> => {
    if (!available || !catalogCode || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      const allowed = await refreshEditorAccess();
      if (!mounted.current || currentIdentity.current !== identity) return;
      if (!allowed) throw new Error('editor_access_required');
      await submitPhotoReviewReport(catalogCode, Constants.expoConfig?.version ?? '1.4.0');
      if (mounted.current && currentIdentity.current === identity) setNotice('Reporte de fotos enviado');
    } catch {
      if (mounted.current && currentIdentity.current === identity) setNotice('No se pudo enviar el reporte. Reintentá.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [available, catalogCode, identity, refreshEditorAccess]);
  return { available, busy, notice, send };
}
