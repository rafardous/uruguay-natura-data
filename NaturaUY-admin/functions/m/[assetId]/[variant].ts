interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  MEDIA_PRIMARY: 'supabase' | 'r2';
  MEDIA_BACKUP?: R2Bucket;
}

interface RouteRow {
  kind: 'image' | 'audio';
  main_key: string | null;
  thumbnail_key: string | null;
  app_audio_key: string | null;
  external_url: string | null;
  checksum_sha256: string | null;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const assetId = String(params.assetId); const variant = String(params.variant);
  if (!['main', 'thumb', 'audio'].includes(variant)) return new Response('Variante no encontrada', { status: 404 });
  const route = `${env.SUPABASE_URL}/rest/v1/public_media_routes?asset_id=eq.${encodeURIComponent(assetId)}&select=kind,main_key,thumbnail_key,app_audio_key,external_url,checksum_sha256`;
  const response = await fetch(route, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` } });
  if (!response.ok) return new Response('Catálogo de medios no disponible', { status: 502 });
  const [row] = await response.json<RouteRow[]>();
  const key = variant === 'main' ? row?.main_key : variant === 'thumb' ? row?.thumbnail_key : row?.app_audio_key;
  if (!row) return new Response('Medio no encontrado', { status: 404 });
  if (!key && row.external_url) return Response.redirect(row.external_url, 302);
  if (!key) return new Response('Medio no encontrado', { status: 404 });

  if (env.MEDIA_PRIMARY === 'r2' && env.MEDIA_BACKUP) {
    const object = await env.MEDIA_BACKUP.get(key);
    if (!object) return new Response('Medio no encontrado', { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
  }
  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/media-public/${key.split('/').map(encodeURIComponent).join('/')}`;
  return Response.redirect(publicUrl, 302);
};
