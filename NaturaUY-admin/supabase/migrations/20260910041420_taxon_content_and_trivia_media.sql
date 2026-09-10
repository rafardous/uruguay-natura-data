-- Contenido editorial reutilizable para cualquier rango y clase, más soporte
-- multimedia opcional para trivia. Las 27 descripciones iniciales de Aves se
-- mantienen también en data/taxonomy/aves-orders.json para el pipeline local.

insert into public.catalog_sources(code,name,url,publisher,license,use_policy,citation)
values ('natura_uy_editorial','Síntesis editorial Natura UY','https://uruguay-natura-data.pages.dev/','Natura UY','CC BY 4.0','redistributable','Equipo editorial de Natura UY')
on conflict(code) do update set name=excluded.name,url=excluded.url,publisher=excluded.publisher,license=excluded.license,use_policy=excluded.use_policy,citation=excluded.citation,active=true;

create table public.taxon_content (
  id uuid primary key default gen_random_uuid(),
  taxon_rank text not null check (taxon_rank in ('order','family')),
  kingdom text not null default 'Animalia',
  phylum text not null default 'Chordata',
  class_name text not null,
  taxon_name text not null,
  language text not null default 'es-UY',
  description text not null check (length(trim(description)) between 30 and 800),
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_record_id text,
  active boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(taxon_rank,class_name,taxon_name,language)
);
create index taxon_content_lookup_idx on public.taxon_content(class_name,taxon_rank,taxon_name) where active;

alter table public.trivia_questions add column image_media_id uuid references public.species_media(id) on delete set null;

alter table public.content_changes drop constraint content_changes_content_type_check;
alter table public.content_changes add constraint content_changes_content_type_check
  check (content_type in ('abundance','game_profile','game_rule','fact','trivia','taxon_content'));

create or replace function private.submit_taxon_content_change(p_entity_id uuid,p_proposed_values jsonb,p_comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.require_editor(); v_id uuid;
begin
  if jsonb_typeof(p_proposed_values)<>'object'
     or p_proposed_values->>'taxon_rank' not in ('order','family')
     or length(trim(coalesce(p_proposed_values->>'class_name','')))=0
     or length(trim(coalesce(p_proposed_values->>'taxon_name','')))=0
     or length(trim(coalesce(p_proposed_values->>'description',''))) not between 30 and 800
  then raise exception 'invalid_taxon_content'; end if;
  insert into public.content_changes(content_type,entity_id,species_id,operation,proposed_values,proposed_by,comment)
  values('taxon_content',p_entity_id,null,'upsert',p_proposed_values,v_actor,nullif(trim(p_comment),'')) returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_content_change(p_content_type text,p_entity_id uuid,p_species_id uuid,p_operation text,p_proposed_values jsonb,p_comment text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  if p_content_type='taxon_content' then
    if p_operation<>'upsert' or p_species_id is not null then raise exception 'invalid_taxon_content_change'; end if;
    return private.submit_taxon_content_change(p_entity_id,p_proposed_values,p_comment);
  end if;
  return private.submit_content_change(p_content_type,p_entity_id,p_species_id,p_operation,p_proposed_values,p_comment);
end $$;

create or replace function private.review_taxon_content_change(p_change_id uuid,p_approve boolean,p_confirm_self_validation boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.require_editor(); v_change public.content_changes; v_id uuid; v_before jsonb:='{}'::jsonb;
begin
  select * into v_change from public.content_changes where id=p_change_id and content_type='taxon_content' for update;
  if not found or v_change.status<>'pending' then raise exception 'change_not_pending'; end if;
  if v_change.proposed_by=v_actor and not p_confirm_self_validation then raise exception 'self_validation_confirmation_required'; end if;
  if not p_approve then
    update public.content_changes set status='rejected',reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
    return p_change_id;
  end if;
  v_id:=coalesce(v_change.entity_id,gen_random_uuid());
  select to_jsonb(t) into v_before from public.taxon_content t where t.id=v_change.entity_id;
  insert into public.taxon_content(id,taxon_rank,kingdom,phylum,class_name,taxon_name,language,description,source_id,source_record_id,active,created_by,reviewed_by)
  values(v_id,v_change.proposed_values->>'taxon_rank',coalesce(nullif(trim(v_change.proposed_values->>'kingdom'),''),'Animalia'),coalesce(nullif(trim(v_change.proposed_values->>'phylum'),''),'Chordata'),trim(v_change.proposed_values->>'class_name'),trim(v_change.proposed_values->>'taxon_name'),coalesce(nullif(trim(v_change.proposed_values->>'language'),''),'es-UY'),trim(v_change.proposed_values->>'description'),(v_change.proposed_values->>'source_id')::uuid,nullif(trim(v_change.proposed_values->>'source_record_id'),''),true,v_change.proposed_by,v_actor)
  on conflict(id) do update set taxon_rank=excluded.taxon_rank,kingdom=excluded.kingdom,phylum=excluded.phylum,class_name=excluded.class_name,taxon_name=excluded.taxon_name,language=excluded.language,description=excluded.description,source_id=excluded.source_id,source_record_id=excluded.source_record_id,active=true,reviewed_by=v_actor,updated_at=now();
  update public.content_changes set entity_id=v_id,status='approved',before_values=coalesce(v_before,'{}'::jsonb),after_values=v_change.proposed_values,reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
  return v_id;
end $$;

create or replace function public.review_content_change(p_change_id uuid,p_approve boolean,p_confirm_self_validation boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_type text; v_id uuid; v_media uuid;
begin
  select content_type into v_type from public.content_changes where id=p_change_id;
  if v_type='taxon_content' then return private.review_taxon_content_change(p_change_id,p_approve,p_confirm_self_validation); end if;
  v_id:=private.review_content_change(p_change_id,p_approve,p_confirm_self_validation);
  if p_approve and v_type='trivia' then
    select nullif(proposed_values->>'image_media_id','')::uuid into v_media from public.content_changes where id=p_change_id;
    if v_media is not null and not exists(
      select 1 from public.species_media m join public.trivia_questions q on q.id=v_id
      where m.id=v_media and m.type='image' and m.status='approved' and (q.species_id is null or m.species_id=q.species_id)
    ) then raise exception 'invalid_trivia_image'; end if;
    update public.trivia_questions set image_media_id=v_media where id=v_id;
  end if;
  return v_id;
end $$;

alter table public.taxon_content enable row level security;
create policy taxon_content_editor_read on public.taxon_content for select to authenticated using(public.has_editor_access());
revoke all on public.taxon_content from anon,authenticated;
grant select on public.taxon_content to authenticated;
grant usage on schema private to authenticated;
revoke all on function private.submit_taxon_content_change(uuid,jsonb,text),private.review_taxon_content_change(uuid,boolean,boolean) from public,anon;
grant execute on function private.submit_taxon_content_change(uuid,jsonb,text),private.review_taxon_content_change(uuid,boolean,boolean) to authenticated;
revoke execute on function public.submit_content_change(text,uuid,uuid,text,jsonb,text),public.review_content_change(uuid,boolean,boolean) from public,anon;
grant execute on function public.submit_content_change(text,uuid,uuid,text,jsonb,text),public.review_content_change(uuid,boolean,boolean) to authenticated;

insert into public.taxon_content(taxon_rank,class_name,taxon_name,description,source_id,source_record_id)
select 'order','Aves',v.name,v.description,s.id,'aves-orders.json'
from public.catalog_sources s
cross join (values
('Accipitriformes','Aves rapaces principalmente diurnas, de vista aguda, pico curvo y garras fuertes. Suelen capturar presas o alimentarse de carroña.'),
('Anseriformes','Aves acuáticas de cuerpo robusto, patas palmeadas y pico adaptado a filtrar, pastar o capturar alimento en el agua.'),
('Apodiformes','Aves de vuelo muy ágil, alas largas y patas pequeñas. Incluye formas que se alimentan en el aire y otras especializadas en visitar flores.'),
('Caprimulgiformes','Aves crepusculares o nocturnas, de plumaje críptico, ojos grandes y boca amplia para capturar insectos durante el vuelo.'),
('Cariamiformes','Aves terrestres de patas largas y corredoras, con cuello erguido y pico fuerte. Buscan pequeños animales y otros alimentos sobre el suelo.'),
('Charadriiformes','Grupo diverso ligado sobre todo a costas, humedales y campos abiertos. Reúne aves caminadoras o nadadoras con picos muy variados según su alimento.'),
('Ciconiiformes','Aves zancudas grandes, de patas, cuello y pico largos. Recorren aguas someras y pastizales en busca de presas.'),
('Columbiformes','Aves compactas, de cabeza pequeña y vuelo potente. Se alimentan principalmente de semillas y frutos y beben mediante succión.'),
('Coraciiformes','Aves de cabeza relativamente grande, pico firme y colores a menudo vistosos. Muchas cazan desde una percha y nidifican en cavidades o barrancas.'),
('Cuculiformes','Aves de cuerpo alargado y cola larga, con dos dedos orientados hacia adelante y dos hacia atrás. Varias especies tienen reproducción parasitaria.'),
('Falconiformes','Rapaces diurnas de vuelo veloz, pico ganchudo y garras fuertes. Matan principalmente con el pico y persiguen presas en espacios abiertos.'),
('Galliformes','Aves terrestres de cuerpo robusto, alas cortas y patas fuertes para caminar y escarbar. Su vuelo suele ser breve y explosivo.'),
('Gruiformes','Conjunto variado de aves terrestres y de humedal. Muchas presentan patas largas, dedos extendidos y cuerpos aptos para moverse entre vegetación densa.'),
('Nyctibiiformes','Aves nocturnas de plumaje críptico, boca ancha y ojos grandes. Permanecen inmóviles sobre ramas y capturan insectos al vuelo.'),
('Passeriformes','El orden más diverso de aves. Se caracteriza por patas adaptadas a posarse, tres dedos hacia adelante y uno hacia atrás, y una gran variedad de cantos y dietas.'),
('Pelecaniformes','Aves acuáticas medianas o grandes, por lo general de cuello y pico largos. Se alimentan de peces y otros animales en costas, lagunas y bañados.'),
('Phoenicopteriformes','Aves acuáticas altas, de patas y cuello muy largos. Su pico curvado filtra pequeños organismos y partículas en aguas someras.'),
('Piciformes','Aves con pies fuertes, habitualmente con dos dedos hacia adelante y dos hacia atrás. Muchas trepan troncos y poseen picos adaptados a perforar o extraer alimento.'),
('Podicipediformes','Aves buceadoras de agua dulce o costera, con patas ubicadas muy atrás y dedos lobulados. Nadan con gran eficiencia, pero caminan con dificultad.'),
('Procellariiformes','Aves marinas de alas largas y vuelo planeado, con narinas tubulares y gran sentido del olfato. Pasan la mayor parte de su vida en mar abierto.'),
('Psittaciformes','Aves de pico curvo y potente, lengua carnosa y pies prensiles con dos dedos hacia adelante y dos hacia atrás. Manipulan frutos y semillas con gran destreza.'),
('Rheiformes','Aves terrestres grandes e incapaces de volar, con cuello y patas largos. Corren a gran velocidad y recorren ambientes abiertos en busca de alimento.'),
('Sphenisciformes','Aves marinas no voladoras, con alas transformadas en aletas y cuerpo hidrodinámico. Se impulsan bajo el agua para capturar peces y otros organismos.'),
('Strigiformes','Rapaces principalmente nocturnas, con ojos orientados al frente, disco facial y vuelo silencioso. Detectan y capturan presas con oído y visión muy desarrollados.'),
('Suliformes','Aves acuáticas con los cuatro dedos unidos por membranas. Muchas bucean o persiguen peces y descansan en costas, islas o árboles cercanos al agua.'),
('Tinamiformes','Aves terrestres de cuerpo compacto, cabeza pequeña y plumaje discreto. Caminan y corren entre pastizales o montes y sólo vuelan distancias cortas.'),
('Trogoniformes','Aves de bosque, de postura erguida, cola larga y plumaje llamativo. Capturan frutos e invertebrados y suelen nidificar en cavidades.')
) as v(name,description)
where s.code='natura_uy_editorial'
on conflict(taxon_rank,class_name,taxon_name,language) do update set description=excluded.description,source_id=excluded.source_id,source_record_id=excluded.source_record_id,active=true,updated_at=now();

-- Preguntas iniciales de demostración; son contenido editorial redistribuible.
with src as (select id from public.catalog_sources where code='natura_uy_editorial'), q(id,prompt,explanation) as (values
('81000000-0000-4000-8000-000000000001'::uuid,'¿Qué característica ayuda a reconocer a muchas aves rapaces diurnas?','El pico curvo y las garras fuertes facilitan capturar y manipular presas.'),
('81000000-0000-4000-8000-000000000002'::uuid,'¿Para qué sirven principalmente las patas palmeadas de muchas aves acuáticas?','La membrana entre los dedos aumenta la superficie que empuja el agua al nadar.'),
('81000000-0000-4000-8000-000000000003'::uuid,'¿Cuál es el orden de aves con mayor diversidad de especies?','Passeriformes reúne más de la mitad de las especies de aves conocidas.'),
('81000000-0000-4000-8000-000000000004'::uuid,'¿Qué significa que un ave tenga plumaje críptico?','Su color y patrón ayudan a confundirse con el ambiente y pasar inadvertida.'),
('81000000-0000-4000-8000-000000000005'::uuid,'¿Qué adaptación distingue a los pingüinos durante la natación?','Sus alas evolucionaron como aletas rígidas que los impulsan bajo el agua.'),
('81000000-0000-4000-8000-000000000006'::uuid,'¿Dónde pasan la mayor parte de su vida los Procellariiformes?','Son aves oceánicas adaptadas a recorrer enormes distancias sobre mar abierto.'),
('81000000-0000-4000-8000-000000000007'::uuid,'¿Qué ventaja aporta el disco facial de búhos y lechuzas?','Ayuda a dirigir los sonidos hacia los oídos y mejora la localización de presas.'),
('81000000-0000-4000-8000-000000000008'::uuid,'¿Cómo obtienen alimento los flamencos en aguas someras?','Filtran pequeños organismos y partículas con un pico especializado.'),
('81000000-0000-4000-8000-000000000009'::uuid,'¿Qué indica que una especie sea nativa de Uruguay?','Que forma parte de la biota del territorio por procesos naturales, no por introducción humana.'),
('81000000-0000-4000-8000-000000000010'::uuid,'¿Abundancia y estado de conservación significan lo mismo?','No: abundancia describe cuán frecuente es una especie; conservación estima su riesgo y prioridades de protección.'),
('81000000-0000-4000-8000-000000000011'::uuid,'¿Qué grupo de vertebrados posee plumas?','Las plumas son una característica exclusiva de las aves actuales.'),
('81000000-0000-4000-8000-000000000012'::uuid,'¿Qué describe la estacionalidad de una especie?','Indica en qué períodos del año suele estar presente, por ejemplo como residente o migratoria.')
)
insert into public.trivia_questions(id,prompt,explanation,source_id,source_record_id,active)
select q.id,q.prompt,q.explanation,src.id,'trivia-demo-v1',true from q cross join src
on conflict(id) do update set prompt=excluded.prompt,explanation=excluded.explanation,source_id=excluded.source_id,active=true,updated_at=now();

with opts(question_id,correct,wrong1,wrong2,wrong3) as (values
('81000000-0000-4000-8000-000000000001'::uuid,'Pico curvo y garras fuertes','Pico plano y patas palmeadas','Cuello sin plumas','Alas transformadas en aletas'),
('81000000-0000-4000-8000-000000000002'::uuid,'Impulsarse en el agua','Trepar troncos','Correr sobre rocas','Sujetar frutos'),
('81000000-0000-4000-8000-000000000003'::uuid,'Passeriformes','Rheiformes','Sphenisciformes','Phoenicopteriformes'),
('81000000-0000-4000-8000-000000000004'::uuid,'Que se camufla con el ambiente','Que refleja luz ultravioleta','Que cambia cada estación','Que es impermeable'),
('81000000-0000-4000-8000-000000000005'::uuid,'Alas transformadas en aletas','Dedos prensiles','Pico filtrador','Cola muy larga'),
('81000000-0000-4000-8000-000000000006'::uuid,'En mar abierto','En pastizales secos','En montes serranos','En ciudades'),
('81000000-0000-4000-8000-000000000007'::uuid,'Dirigir sonidos hacia los oídos','Filtrar alimento','Regular la temperatura','Respirar bajo el agua'),
('81000000-0000-4000-8000-000000000008'::uuid,'Filtrando con el pico','Perforando troncos','Cazando en vuelo','Escarbando el suelo'),
('81000000-0000-4000-8000-000000000009'::uuid,'Llegó por procesos naturales','Fue liberada recientemente','Sólo vive en cautiverio','Siempre es abundante'),
('81000000-0000-4000-8000-000000000010'::uuid,'No, miden dimensiones diferentes','Sí, son sinónimos','Sólo en aves','Sólo si la especie es nativa'),
('81000000-0000-4000-8000-000000000011'::uuid,'Aves','Mamíferos','Reptiles','Anfibios'),
('81000000-0000-4000-8000-000000000012'::uuid,'Cuándo está presente durante el año','Cuántos individuos existen','Qué riesgo de extinción tiene','Qué come habitualmente')
)
insert into public.trivia_options(question_id,body,is_correct,sort_order)
select question_id,body,is_correct,sort_order from opts cross join lateral (values(correct,true,0),(wrong1,false,1),(wrong2,false,2),(wrong3,false,3)) o(body,is_correct,sort_order)
on conflict(question_id,sort_order) do update set body=excluded.body,is_correct=excluded.is_correct;

create or replace function public.request_catalog_publish() returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.require_admin(); v_id uuid; v_version bigint; v_last timestamptz;
begin
  select coalesce(max(published_at),'epoch'::timestamptz) into v_last from public.catalog_releases where status='published';
  if not exists(select 1 from public.species_changes c where c.status='approved' and c.reviewed_at>v_last)
     and not exists(select 1 from public.content_changes c where c.status='approved' and c.reviewed_at>v_last)
     and not exists(select 1 from public.species_observability_snapshots o where o.generated_at>v_last)
     and not exists(select 1 from public.taxon_content t where t.updated_at>v_last)
  then raise exception 'catalog_not_dirty'; end if;
  select id into v_id from public.catalog_releases where status in ('pending','building') order by requested_at desc limit 1; if v_id is not null then return v_id; end if;
  select coalesce(max(version),0)+1 into v_version from public.catalog_releases;
  insert into public.catalog_releases(version,schema_version,requested_by) values(v_version,8,v_actor) returning id into v_id; return v_id;
end $$;
alter table public.catalog_releases alter column schema_version set default 8;
