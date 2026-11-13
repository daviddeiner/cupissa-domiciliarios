-- CUPISSA DOMICILIARIOS · GPS y navegación
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- No modifica tablas ni funciones existentes.
create table if not exists public.cupissa_domiciliarios_ubicaciones (
  domiciliario_id uuid not null references public.cupissa_domiciliarios(id) on delete cascade,
  pedido_id text not null,
  latitud double precision not null,
  longitud double precision not null,
  precision_m double precision,
  rumbo double precision,
  velocidad double precision,
  actualizado_en timestamptz not null default now(),
  estado text not null default 'EN_RUTA',
  entrega_latitud double precision,
  entrega_longitud double precision,
  entrega_precision_m double precision,
  entregado_gps_en timestamptz,
  primary key (domiciliario_id,pedido_id)
);
create index if not exists cupissa_domiciliarios_ubicaciones_pedido_idx
  on public.cupissa_domiciliarios_ubicaciones(pedido_id);
create index if not exists cupissa_domiciliarios_ubicaciones_actualizado_idx
  on public.cupissa_domiciliarios_ubicaciones(actualizado_en desc);
alter table public.cupissa_domiciliarios_ubicaciones enable row level security;
revoke all on public.cupissa_domiciliarios_ubicaciones from anon, authenticated;
grant all on public.cupissa_domiciliarios_ubicaciones to service_role;

create or replace view public.cupissa_gestion_ubicaciones_domiciliarios
with (security_invoker = true) as
select
  u.domiciliario_id,
  d.nombres,
  d.apellidos,
  d.telefono,
  u.pedido_id,
  u.latitud,
  u.longitud,
  u.precision_m,
  u.rumbo,
  u.velocidad,
  u.actualizado_en,
  u.estado,
  u.entrega_latitud,
  u.entrega_longitud,
  u.entrega_precision_m,
  u.entregado_gps_en
from public.cupissa_domiciliarios_ubicaciones u
left join public.cupissa_domiciliarios d on d.id=u.domiciliario_id;

comment on table public.cupissa_domiciliarios_ubicaciones is
'Historial de última ubicación GPS por pedido y coordenadas capturadas al confirmar cada entrega. Solo se escribe mediante la Edge Function con service_role.';

REVOKE ALL ON public.cupissa_gestion_ubicaciones_domiciliarios FROM anon, authenticated;
GRANT SELECT ON public.cupissa_gestion_ubicaciones_domiciliarios TO service_role;
