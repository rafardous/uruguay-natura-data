interface Env { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; }

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const url = `${env.SUPABASE_URL}/storage/v1/object/public/catalog-public/manifest.json`;
  const response = await fetch(url, { headers: { apikey: env.SUPABASE_ANON_KEY } });
  if (!response.ok) return new Response(JSON.stringify({ error: 'manifest_unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  return new Response(response.body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300', ETag: response.headers.get('ETag') ?? '' } });
};
