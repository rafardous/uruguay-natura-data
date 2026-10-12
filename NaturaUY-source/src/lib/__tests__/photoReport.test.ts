import { getEditorAccess, PHOTO_REVIEW_DESCRIPTION, submitPhotoReviewReport } from '../mobileApi';
import { mobileSupabase } from '../supabase';

jest.mock('../supabase', () => ({ mobileSupabase: { rpc: jest.fn() } }));
const rpc = jest.mocked(mobileSupabase!.rpc);
beforeEach(() => rpc.mockReset());

test('consulta el permiso editorial del servidor sin inferirlo del perfil móvil', async () => {
  rpc.mockResolvedValueOnce({ data: true, error: null } as never);
  expect(await getEditorAccess()).toBe(true);
  expect(rpc).toHaveBeenCalledWith('has_editor_access');
  rpc.mockResolvedValueOnce({ data: false, error: null } as never);
  expect(await getEditorAccess()).toBe(false);
});

test('envía un reporte de ficha con el motivo por fotos, versión y plataforma', async () => {
  rpc.mockResolvedValueOnce({ data: 'test-report-id', error: null } as never);
  await submitPhotoReviewReport('F_catus', '1.4.0');
  expect(rpc).toHaveBeenCalledWith('submit_feedback', {
    p_type: 'review', p_area: 'species', p_catalog_code: 'F_catus', p_message: PHOTO_REVIEW_DESCRIPTION,
    p_app_version: '1.4.0', p_platform: expect.stringMatching(/^(android|ios|web|unknown)$/), p_reference_url: null,
  });
});

test('propaga los fallos de envío para no informar un éxito falso', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') } as never);
  await expect(submitPhotoReviewReport('F_catus', '1.4.0')).rejects.toThrow('offline');
});
