interface Environment { MEDIA_STORAGE_ORIGIN?: string; GUIDE_STORAGE_ORIGIN?: string; VITE_SUPABASE_URL?: string }
interface RequestContext { params: { path?: string | string[] }; env: Environment }

function redirectToMedia({ params, env }: RequestContext): Response {
  const segments = Array.isArray(params.path) ? params.path : String(params.path ?? '').split('/');
  if (!segments.length || segments.some((part) => !/^[A-Za-z0-9._-]+$/.test(part)) || !/\.(webp|mp3)$/.test(segments.at(-1) ?? '')) return new Response('Not found', { status: 404 });
  const guide = segments[0] === 'guia-aves';
  const configuredOrigin = guide
    ? env.GUIDE_STORAGE_ORIGIN || (env.VITE_SUPABASE_URL ? `${env.VITE_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/guia-aves` : '')
    : env.MEDIA_STORAGE_ORIGIN || (env.VITE_SUPABASE_URL ? `${env.VITE_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/media-public` : '');
  let origin: URL;
  try { origin = new URL(configuredOrigin); } catch { return new Response('Media origin unavailable', { status: 503 }); }
  if (origin.protocol !== 'https:' || origin.username || origin.password) return new Response('Media origin unavailable', { status: 503 });
  origin.pathname = `${origin.pathname.replace(/\/$/, '')}/${(guide ? segments.slice(1) : segments).map(encodeURIComponent).join('/')}`;
  return new Response(null, { status: 302, headers: { Location: origin.toString(), 'Cache-Control': 'public, max-age=3600' } });
}

export async function onRequestGet(context: RequestContext): Promise<Response> { return redirectToMedia(context); }
export async function onRequestHead(context: RequestContext): Promise<Response> { return redirectToMedia(context); }
