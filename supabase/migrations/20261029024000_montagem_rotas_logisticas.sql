create table if not exists public.rotas_logisticas (
  id uuid primary key default gen_random_uuid(),
  data_rota date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  nome text not null,
  motorista text null,
  veiculo text null,
  status text not null default 'montagem'
    check (status = any (array['montagem'::text,'liberada'::text,'concluida'::text,'cancelada'::text])),
  observacoes text null,
  criado_por uuid null references auth.users(id) on delete set null,
  atualizado_por uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entregas
  add column if not exists rota_logistica_id uuid null references public.rotas_logisticas(id) on delete set null,
  add column if not exists ordem_rota integer null check (ordem_rota is null or ordem_rota > 0);

create index if not exists rotas_logisticas_data_idx on public.rotas_logisticas(data_rota,status);
create index if not exists entregas_rota_logistica_idx on public.entregas(rota_logistica_id,ordem_rota);

alter table public.rotas_logisticas enable row level security;

drop policy if exists rotas_logisticas_read on public.rotas_logisticas;
create policy rotas_logisticas_read on public.rotas_logisticas
for select to authenticated
using (private.usuario_pode('entregas','visualizar'));

drop policy if exists rotas_logisticas_insert on public.rotas_logisticas;
create policy rotas_logisticas_insert on public.rotas_logisticas
for insert to authenticated
with check (private.usuario_pode('entregas','editar'));

drop policy if exists rotas_logisticas_update on public.rotas_logisticas;
create policy rotas_logisticas_update on public.rotas_logisticas
for update to authenticated
using (private.usuario_pode('entregas','editar'))
with check (private.usuario_pode('entregas','editar'));

drop policy if exists rotas_logisticas_delete on public.rotas_logisticas;
create policy rotas_logisticas_delete on public.rotas_logisticas
for delete to authenticated
using (private.usuario_pode('entregas','editar') and status='montagem');

grant select,insert,update,delete on public.rotas_logisticas to authenticated;
