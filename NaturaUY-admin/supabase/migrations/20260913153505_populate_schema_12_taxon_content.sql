-- Contenido didáctico mínimo para las raíces y ramas botánicas de schema 12.
-- Las familias y géneros se navegan desde taxa/taxon_names y no requieren
-- texto editorial inventado para cada nodo.

create index if not exists taxon_names_source_idx on public.taxon_names(source_id) where source_id is not null;

with src as (
  select id from public.catalog_sources where code='natura_uy_editorial'
), content(taxon_rank,kingdom,phylum,class_name,taxon_name,simple_name,description,sort_order) as (values
  ('kingdom','Animalia','','','Animalia','Animales','Seres vivos que obtienen energía alimentándose de otros organismos y que, en alguna etapa, suelen poder desplazarse.',0),
  ('kingdom','Plantae','','','Plantae','Plantas','Seres vivos que realizan fotosíntesis y sostienen gran parte de las redes de vida terrestres y acuáticas.',1),
  ('phylum','Animalia','Chordata','','Chordata','Vertebrados','Animales con notocorda en alguna etapa del desarrollo; incluye peces, anfibios, reptiles, aves y mamíferos.',0),
  ('phylum','Animalia','Arthropoda','','Arthropoda','Artrópodos','Animales con exoesqueleto y apéndices articulados, como insectos, arácnidos y crustáceos.',1),
  ('phylum','Plantae','Tracheophyta','','Tracheophyta','Plantas vasculares','Plantas con tejidos especializados que transportan agua y nutrientes; incluye licófitas, helechos, gimnospermas y plantas con flor.',0),
  ('class','Plantae','Tracheophyta','Lycopodiopsida','Lycopodiopsida','Licófitas','Un linaje antiguo de plantas vasculares que se reproduce mediante esporas.',0),
  ('class','Plantae','Tracheophyta','Polypodiopsida','Polypodiopsida','Helechos y afines','Plantas vasculares sin semillas que se reproducen mediante esporas.',1),
  ('class','Plantae','Tracheophyta','Gymnospermae','Gymnospermae','Gimnospermas','Plantas con semillas no encerradas en un fruto, como pinos, araucarias y efedras.',2),
  ('class','Plantae','Tracheophyta','Angiospermae','Angiospermae','Plantas con flor','Plantas que producen flores y semillas protegidas dentro de frutos.',3)
)
insert into public.taxon_content(
  taxon_rank,kingdom,phylum,class_name,taxon_name,language,simple_name,
  description,source_id,source_record_id,active
)
select content.taxon_rank,content.kingdom,content.phylum,content.class_name,
  content.taxon_name,'es-UY',content.simple_name,content.description,src.id,
  'schema-12-navigation',true
from content cross join src
on conflict(taxon_rank,class_name,taxon_name,language) do update set
  kingdom=excluded.kingdom,phylum=excluded.phylum,simple_name=excluded.simple_name,
  description=excluded.description,source_id=excluded.source_id,
  source_record_id=excluded.source_record_id,active=true,updated_at=now();
