import * as tus from 'tus-js-client';

import { isDemoMode, supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export interface UploadProgress { sent: number; total: number; percent: number; }

export async function uploadIncoming(file: File, objectName: string, onProgress: (progress: UploadProgress) => void): Promise<void> {
  if (isDemoMode || !supabase) { onProgress({ sent: file.size, total: file.size, percent: 100 }); return; }
  const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
  if (!token) throw new Error('La sesión expiró. Volvé a iniciar sesión.');
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${token}`, apikey: supabaseAnonKey, 'x-upsert': 'false' },
      metadata: { bucketName: 'incoming', objectName, contentType: file.type || 'application/octet-stream', cacheControl: '3600' },
      chunkSize: 6 * 1024 * 1024,
      removeFingerprintOnSuccess: true,
      onError: (error) => reject(error),
      onProgress: (sent, total) => onProgress({ sent, total, percent: total ? Math.round(sent / total * 100) : 0 }),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previous) => { if (previous[0]) upload.resumeFromPreviousUpload(previous[0]); upload.start(); }).catch(reject);
  });
}

export async function uploadEvidence(file: File, objectName: string): Promise<string> {
  if (isDemoMode || !supabase) return objectName;
  const { error } = await supabase.storage.from('media-evidence').upload(objectName, file, { upsert: false });
  if (error) throw error; return objectName;
}
