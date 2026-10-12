import React, { act, useEffect } from 'react';
import { usePhotoReport } from '../usePhotoReport';
import { useMobileAuth } from '../../../auth/MobileAuthProvider';
import { submitPhotoReviewReport } from '../../../lib/mobileApi';

jest.mock('../../../auth/MobileAuthProvider', () => ({ useMobileAuth: jest.fn() }));
jest.mock('../../../lib/mobileApi', () => ({ submitPhotoReviewReport: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.4.0' } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: React.ReactElement) => { update: (element: React.ReactElement) => void; unmount: () => void } };
const auth = jest.mocked(useMobileAuth);
const submit = jest.mocked(submitPhotoReviewReport);
const refresh = jest.fn<Promise<boolean>, []>();
let report: ReturnType<typeof usePhotoReport>;
let root: ReturnType<typeof renderer.create>;
function Probe({ photos = true }: { photos?: boolean }) {
  const value = usePhotoReport('F_catus', photos);
  useEffect(() => { report = value; }, [value]);
  return null;
}
beforeEach(async () => {
  jest.useFakeTimers();
  submit.mockReset().mockResolvedValue(undefined);
  refresh.mockReset().mockResolvedValue(true);
  auth.mockReturnValue({ session: { user: { id: 'editor' } }, editorAccess: true, refreshEditorAccess: refresh } as unknown as ReturnType<typeof useMobileAuth>);
  await act(async () => { root = renderer.create(<Probe />); });
});
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });

test.each([null, false])('oculta la acción con acceso editorial %s', async (editorAccess) => {
  auth.mockReturnValue({ session: { user: { id: 'ordinary' } }, editorAccess, refreshEditorAccess: refresh } as unknown as ReturnType<typeof useMobileAuth>);
  await act(async () => root.update(<Probe />));
  expect(report.available).toBe(false);
  await report.send();
  expect(submit).not.toHaveBeenCalled();
});
test('oculta la acción sin fotos', async () => {
  await act(async () => root.update(<Probe photos={false} />));
  expect(report.available).toBe(false);
});
test('envía una sola vez ante dos pulsaciones y retira el aviso a los cuatro segundos', async () => {
  let finish!: () => void;
  submit.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = report.send(); void report.send(); });
  expect(report.busy).toBe(true);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await pending; });
  expect(report.notice).toBe('Reporte de fotos enviado');
  await act(async () => jest.advanceTimersByTime(3999));
  expect(report.notice).not.toBe('');
  await act(async () => jest.advanceTimersByTime(1));
  expect(report.notice).toBe('');
});
test('un fallo permite reintentar manualmente', async () => {
  submit.mockRejectedValueOnce(new Error('offline'));
  await act(async () => report.send());
  expect(report.notice).toBe('No se pudo enviar el reporte. Reintentá.');
  expect(report.busy).toBe(false);
  await act(async () => report.send());
  expect(report.notice).toBe('Reporte de fotos enviado');
});
test('no envía si el acceso editorial fue revocado', async () => {
  refresh.mockResolvedValueOnce(false);
  await act(async () => report.send());
  expect(submit).not.toHaveBeenCalled();
  expect(report.notice).toContain('No se pudo enviar');
});
test('no envía después de cambiar de cuenta durante la comprobación del permiso', async () => {
  let finish!: (allowed: boolean) => void;
  refresh.mockReturnValueOnce(new Promise<boolean>((resolve) => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = report.send(); });
  auth.mockReturnValue({ session: null, editorAccess: null, refreshEditorAccess: refresh } as unknown as ReturnType<typeof useMobileAuth>);
  await act(async () => root.update(<Probe />));
  await act(async () => { finish(true); await pending; });
  expect(submit).not.toHaveBeenCalled();
  expect(report.available).toBe(false);
  expect(report.notice).toBe('');
});
