export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('PUBLIC_APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function headersFor(request?: Request) {
  const origin = request?.headers.get('Origin');
  const allowed = [Deno.env.get('PUBLIC_APP_ORIGIN'), 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
  return { ...corsHeaders, ...(origin && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) };
}

export const json = (body: unknown, status = 200, request?: Request) => new Response(JSON.stringify(body), {
  status, headers: { ...headersFor(request), 'Content-Type': 'application/json; charset=utf-8' },
});

export function options(request: Request): Response | null {
  return request.method === 'OPTIONS' ? new Response('ok', { headers: headersFor(request) }) : null;
}
