-- Reproducible correction for the GBIF backbone shape that placed the three
-- reptile orders represented in Uruguay in `class` and left `order_name` empty.
do $$
begin
  if exists (
    select 1 from public.species
    where class='Reptilia' and family not in (
      'Alligatoridae','Chelidae','Cheloniidae','Dermochelyidae','Emydidae',
      'Amphisbaenidae','Anomalepididae','Boidae','Colubridae','Diploglossidae',
      'Elapidae','Gekkonidae','Gymnophthalmidae','Leiosauridae','Leptotyphlopidae',
      'Liolaemidae','Phyllodactylidae','Scincidae','Teiidae','Tropiduridae','Viperidae'
    )
  ) then
    raise exception 'unmapped_reptile_family';
  end if;
end $$;

update public.species
set order_name = case
  when family='Alligatoridae' then 'Crocodylia'
  when family in ('Chelidae','Cheloniidae','Dermochelyidae','Emydidae') then 'Testudines'
  else 'Squamata'
end,
field_sources = jsonb_set(
  coalesce(field_sources,'{}'::jsonb),
  '{taxonomy.order}',
  '["reptile_database: https://reptile-database.reptarium.cz/"]'::jsonb,
  true
),
updated_at = now()
where class='Reptilia';

with content(class_name,taxon_name,description,source_record_id) as (values
  ('Reptilia','Crocodylia','Reptiles semiacuáticos de cuerpo robusto, hocico alargado, mandíbulas potentes y piel reforzada por placas. Los ojos y las narinas elevados les permiten vigilar y respirar con gran parte del cuerpo sumergida.','reptilia-orders.json'),
  ('Reptilia','Squamata','Reptiles de piel cubierta por escamas que mudan periódicamente. Presentan un cráneo relativamente móvil y una enorme diversidad de formas y modos de desplazamiento; el orden reúne linajes con patas, sin patas y excavadores.','reptilia-orders.json'),
  ('Reptilia','Testudines','Reptiles cuyo tronco está protegido por un caparazón formado por espaldar y plastrón, integrado al esqueleto. Carecen de dientes y cortan el alimento con un pico córneo.','reptilia-orders.json'),
  ('Mammalia','Artiodactyla','Mamíferos ungulados cuyo peso se apoya principalmente sobre dos dedos centrales. La mayoría es herbívora y presenta distintas adaptaciones digestivas para aprovechar materiales vegetales.','mammalia-orders.json'),
  ('Mammalia','Carnivora','Mamíferos con caninos desarrollados y dientes carniceros adaptados para cortar, además de mandíbulas fuertes. Incluye formas terrestres y acuáticas, con dietas que no siempre son exclusivamente carnívoras.','mammalia-orders.json'),
  ('Mammalia','Cetacea','Mamíferos completamente acuáticos, de cuerpo hidrodinámico, miembros anteriores transformados en aletas y orificios respiratorios en la parte superior de la cabeza. Dependen especialmente del sonido para comunicarse, orientarse o localizar alimento.','mammalia-orders.json'),
  ('Mammalia','Chiroptera','Únicos mamíferos capaces de vuelo activo. Sus alas son membranas sostenidas principalmente por dedos muy alargados; muchas especies utilizan ecolocalización para orientarse y encontrar alimento.','mammalia-orders.json'),
  ('Mammalia','Cingulata','Mamíferos con una coraza de placas óseas dérmicas cubierta por escudos córneos. Poseen extremidades robustas y garras fuertes, adecuadas para excavar, y un hocico generalmente alargado.','mammalia-orders.json'),
  ('Mammalia','Didelphimorphia','Marsupiales americanos de gestación breve, cuyas crías nacen muy poco desarrolladas y completan gran parte de su crecimiento prendidas a las mamas. El marsupio puede estar bien formado, ser reducido o faltar.','mammalia-orders.json'),
  ('Mammalia','Lagomorpha','Mamíferos herbívoros con dos pares de incisivos superiores y dientes de crecimiento continuo. Su aparato digestivo aprovecha la vegetación mediante fermentación en el ciego y reingestión de cecotrofos.','mammalia-orders.json'),
  ('Mammalia','Pilosa','Mamíferos con garras grandes y curvas, metabolismo relativamente bajo y dentición reducida o ausente según el linaje. Sus cuerpos están adaptados para trepar, excavar o acceder a alimentos muy especializados.','mammalia-orders.json'),
  ('Mammalia','Rodentia','Mamíferos con un único par de incisivos superiores y otro inferior que crecen durante toda la vida. El esmalte más duro en la cara frontal mantiene un borde cortante al roer.','mammalia-orders.json')
), source as (
  select id from public.catalog_sources where code='natura_uy_editorial'
)
insert into public.taxon_content(taxon_rank,class_name,taxon_name,description,source_id,source_record_id)
select 'order',content.class_name,content.taxon_name,content.description,source.id,content.source_record_id
from content cross join source
on conflict(taxon_rank,class_name,taxon_name,language) do update set
  description=excluded.description,
  source_id=excluded.source_id,
  source_record_id=excluded.source_record_id,
  active=true,
  updated_at=now();

update public.species
set relevant_note='Practica parasitismo de cría: la hembra deposita sus huevos en nidos de otras aves, que luego pueden incubarlos y alimentar a los pichones.',
    field_sources=jsonb_set(coalesce(field_sources,'{}'::jsonb),'{relevant_note}','["natura_uy_editorial: síntesis sobre parasitismo de cría"]'::jsonb,true),
    updated_at=now()
where scientific_name='Molothrus bonariensis';

do $$
begin
  if (select count(*) from public.species where class='Reptilia' and coalesce(order_name,'')='') <> 0
     or (select count(distinct order_name) from public.species where class='Reptilia') <> 3 then
    raise exception 'reptile_order_validation_failed';
  end if;
end $$;
