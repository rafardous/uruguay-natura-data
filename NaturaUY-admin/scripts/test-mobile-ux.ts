import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL fixtures; no project URL, credentials or production writes.
const db = new PGlite();
const editor = 'e1000000-0000-4000-8000-000000000001';
const mobile = 'e1000000-0000-4000-8000-000000000002';
const other = 'e1000000-0000-4000-8000-000000000003';
const species = 'e2000000-0000-4000-8000-000000000001';
const description = 'Revisar fotos de esta especie: calidad o pertinencia de las imágenes.';
await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema private;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table auth.users(id uuid primary key);
  create table public.profiles(user_id uuid primary key references auth.users(id),display_name text);
  create table public.species(id uuid primary key,catalog_code text unique,common_name text);
  create table public.editor_access(user_id uuid primary key,role text,active boolean);
  create function public.has_editor_access() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from editor_access where user_id=auth.uid() and active) $$;
  create function public.require_editor() returns uuid language plpgsql as $$ begin if not public.has_editor_access() then raise exception 'editor_access_required'; end if; return auth.uid(); end $$;
  create table public.feedback (
    id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(user_id),
    type text not null check(type in ('bug','suggestion','review')),species_id uuid references species(id),
    message text not null check(length(trim(message)) between 10 and 4000),app_version text,
    status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
    resolved_by uuid references profiles(user_id),resolution_note text,created_at timestamptz not null default now(),resolved_at timestamptz
  );
  insert into auth.users values('${editor}'),('${mobile}'),('${other}');
  insert into profiles values('${editor}','Editora de prueba'),('${mobile}','Usuario de prueba'),('${other}','Otra cuenta');
  insert into editor_access values('${editor}','collaborator',true);
  insert into species values('${species}','UX_PHOTO_TEST','Especie de prueba de UX');
`);
const feedback = readFileSync(new URL('../supabase/migrations/202609060003_mobile_feedback_sync.sql', import.meta.url), 'utf8');
await db.exec(feedback.slice(0, feedback.indexOf('alter table public.game_stats')));
await db.exec(feedback.slice(feedback.indexOf('drop function if exists public.submit_feedback'), feedback.indexOf('grant execute on function public.sync_favorites')));
await db.exec(`
  alter table feedback enable row level security;
  create policy feedback_read on feedback for select to authenticated using(user_id=auth.uid() or public.has_editor_access());
  grant usage on schema public,auth,private to authenticated;
  grant select on profiles,species,feedback,feedback_queue to authenticated;
  revoke execute on function submit_feedback(text,text,text,text,text,text,text) from public,anon;
  grant execute on function submit_feedback(text,text,text,text,text,text,text) to authenticated;
`);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [editor]);
await db.exec('set role authenticated');
assert.equal((await db.query<{ allowed: boolean }>('select has_editor_access() allowed')).rows[0]?.allowed, true);
const reportId = (await db.query<{ id: string }>(
  "select submit_feedback('review',$1,'UX_PHOTO_TEST','1.4.0','species','android',null) id", [description],
)).rows[0]!.id;
const row = (await db.query<Record<string, unknown>>('select * from feedback_queue where id=$1', [reportId])).rows[0]!;
assert.equal(row.message, description);
assert.equal(row.catalog_code, 'UX_PHOTO_TEST');
assert.equal(row.species_id, species);
assert.equal(row.species_name, 'Especie de prueba de UX');
assert.equal(row.reporter_name, 'Editora de prueba');
assert.equal(row.type, 'review');
assert.equal(row.area, 'species');
assert.equal(row.status, 'open');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
assert.equal((await db.query<{ allowed: boolean }>('select has_editor_access() allowed')).rows[0]?.allowed, false);
assert.equal((await db.query('select * from feedback_queue')).rows.length, 0);
await db.exec('reset role');
const enriched = readFileSync(new URL('../supabase/migrations/20261011191403_enriched_games.sql', import.meta.url), 'utf8');
await db.exec(enriched.slice(enriched.indexOf('create table public.mobile_enriched_game_records')));
await db.exec(readFileSync(new URL('../supabase/migrations/20261012171935_mixed_guess_scope.sql', import.meta.url), 'utf8'));
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [mobile]);
await db.exec('set role authenticated');
const record = (scope: string, score: number) => ({ mode: 'guess_search', scope, best_score: score, best_time_ms: 0, fewest_moves: 0, played_at: 1000, updated_at: 1000 });
await db.query('select sync_enriched_game_records($1)', [JSON.stringify([record('animals_all:hard', 400), record('all:hard', 300)])]);
assert.equal((await db.query('select * from mobile_enriched_game_records')).rows.length, 2);
await assert.rejects(db.query('select sync_enriched_game_records($1)', [JSON.stringify([{ ...record('all:hard:3', 0), mode: 'jigsaw', best_time_ms: 1000, fewest_moves: 20 }])]), /check constraint/);
await db.exec('reset role');
console.log('UX móvil: reporte visible en feedback_queue, permisos/RLS y récord mixto independiente verificados en PostgreSQL local.');

if (!process.argv.includes('--serve')) {
  await db.close();
} else {
  const { createServer } = await import('vite');
  const server = await createServer({
    server: { host: '127.0.0.1', port: 5175, strictPort: true },
    plugins: [{
      name: 'isolated-mobile-ux-test', enforce: 'pre',
      resolveId(id) { if (id === '/__ux_entry.tsx') return id; },
      load(id) {
        if (id === '/__ux_entry.tsx') return `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ReportsPage} from '/src/pages/ReportsPage.tsx'; import '/src/styles.css'; createRoot(document.getElementById('root')).render(<main style={{padding:24}}><ReportsPage/></main>);`;
      },
      transform(_source, id) {
        if (id.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return `import {createClient} from '@supabase/supabase-js'; export const supabaseUrl='http://127.0.0.1:5175'; export const supabaseAnonKey='local-fixture-only'; export const supabaseConfigurationError=null; export const supabase=createClient(supabaseUrl,supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false}});`;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/rest/v1/feedback_queue')) {
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify([row])); return;
          }
          if (req.url === '/__ux_test') {
            res.setHeader('Content-Type', 'text/html');
            res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reportes · prueba local de UX</title></head><body><div id="root"></div><script type="module" src="/__ux_entry.tsx"></script></body></html>')); return;
          }
          next();
        });
      },
    }],
  });
  await server.listen();
  console.log('Panel real de Reportes con fixture local: http://127.0.0.1:5175/__ux_test');
}
