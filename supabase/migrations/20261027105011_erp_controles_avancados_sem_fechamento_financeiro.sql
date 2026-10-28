-- Configuracoes avancadas (sem fechamento financeiro por periodo)
alter table public.empresa_config
  add column if not exists desconto_max_vendedor numeric not null default 10,
  add column if not exists margem_minima_percentual numeric not null default 0,
  add column if not exists validade_orcamento_dias integer not null default 7,
  add column if not exists bloquear_cliente_inadimplente boolean not null default true,
  add column if not exists exigir_aprovacao_limite_credito boolean not null default true,
  add column if not exists reservar_estoque_pedido boolean not null default true,
  add column if not exists sessao_inatividade_minutos integer not null default 30,
  add column if not exists campos_obrigatorios jsonb not null default '{}'::jsonb;

alter table public.produtos
  add column if not exists estoque_reposicao numeric,
  add column if not exists custo_medio numeric;

update public.produtos
set estoque_reposicao = coalesce(estoque_reposicao, estoque_minimo),
    custo_medio = coalesce(custo_medio, custo)
where estoque_reposicao is null or custo_medio is null;

alter table public.vendas
  add column if not exists aprovacao_motivo text,
  add column if not exists aprovado_por uuid,
  add column if not exists aprovado_em timestamptz,
  add column if not exists validade_orcamento date;

alter table public.pagamentos_titulos
  add column if not exists forma_pagamento text;

-- Protecao contra duplicidade
create unique index if not exists clientes_documento_unq
  on public.clientes ((regexp_replace(documento,'\D','','g')))
  where nullif(regexp_replace(documento,'\D','','g'),'') is not null;

create unique index if not exists fornecedores_documento_unq
  on public.fornecedores ((regexp_replace(documento,'\D','','g')))
  where nullif(regexp_replace(documento,'\D','','g'),'') is not null;

create unique index if not exists produtos_codigo_unq
  on public.produtos (lower(trim(codigo)));

-- Catalogos padronizados
create table if not exists public.categorias_financeiras(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('receber','pagar','ambos')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists categorias_financeiras_nome_tipo_unq
  on public.categorias_financeiras(lower(trim(nome)),tipo);

create table if not exists public.centros_custo(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists centros_custo_nome_unq
  on public.centros_custo(lower(trim(nome)));

-- Aprovacoes de operacoes sensiveis
create table if not exists public.aprovacoes_operacoes(
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('estoque_negativo','limite_credito','inadimplencia','desconto','margem','alteracao_retroativa')),
  entidade_tipo text not null,
  entidade_id uuid,
  solicitado_por uuid default auth.uid(),
  solicitado_em timestamptz not null default now(),
  aprovado_por uuid,
  aprovado_em timestamptz,
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado','cancelado')),
  motivo text,
  detalhes jsonb not null default '{}'::jsonb
);

-- Fechamento de comissoes
create table if not exists public.fechamentos_comissao(
  id uuid primary key default gen_random_uuid(),
  inicio date not null,
  fim date not null,
  fechado_por uuid default auth.uid(),
  fechado_em timestamptz not null default now(),
  observacao text,
  unique(inicio,fim)
);

-- Auditoria
create table if not exists public.auditoria_log(
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('INSERT','UPDATE','DELETE')),
  usuario_id uuid,
  ocorrido_em timestamptz not null default now(),
  dados_antes jsonb,
  dados_depois jsonb
);

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.auditoria_log(tabela,registro_id,acao,usuario_id,dados_antes,dados_depois)
  values (
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'),(to_jsonb(old)->>'id')),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new,old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['clientes','fornecedores','produtos','vendas','compras','titulos_financeiros','pagamentos_titulos','vendedores','empresa_config']
  loop
    execute format('drop trigger if exists trg_auditoria_%I on public.%I',t,t);
    execute format('create trigger trg_auditoria_%I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()',t,t);
  end loop;
end $$;

-- RLS para novas tabelas
alter table public.categorias_financeiras enable row level security;
alter table public.centros_custo enable row level security;
alter table public.aprovacoes_operacoes enable row level security;
alter table public.fechamentos_comissao enable row level security;
alter table public.auditoria_log enable row level security;

drop policy if exists categorias_financeiras_select on public.categorias_financeiras;
create policy categorias_financeiras_select on public.categorias_financeiras
for select to authenticated using (true);

drop policy if exists categorias_financeiras_manage on public.categorias_financeiras;
create policy categorias_financeiras_manage on public.categorias_financeiras
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil in ('administrador','financeiro')));

drop policy if exists centros_custo_select on public.centros_custo;
create policy centros_custo_select on public.centros_custo
for select to authenticated using (true);

drop policy if exists centros_custo_manage on public.centros_custo;
create policy centros_custo_manage on public.centros_custo
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil in ('administrador','financeiro')));

drop policy if exists aprovacoes_select on public.aprovacoes_operacoes;
create policy aprovacoes_select on public.aprovacoes_operacoes
for select to authenticated
using (solicitado_por=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil='administrador'));

drop policy if exists aprovacoes_insert on public.aprovacoes_operacoes;
create policy aprovacoes_insert on public.aprovacoes_operacoes
for insert to authenticated with check (solicitado_por=auth.uid());

drop policy if exists aprovacoes_admin_update on public.aprovacoes_operacoes;
create policy aprovacoes_admin_update on public.aprovacoes_operacoes
for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil='administrador'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil='administrador'));

drop policy if exists fechamentos_comissao_select on public.fechamentos_comissao;
create policy fechamentos_comissao_select on public.fechamentos_comissao
for select to authenticated using (true);

drop policy if exists fechamentos_comissao_manage on public.fechamentos_comissao;
create policy fechamentos_comissao_manage on public.fechamentos_comissao
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil in ('administrador','financeiro')));

drop policy if exists auditoria_admin_select on public.auditoria_log;
create policy auditoria_admin_select on public.auditoria_log
for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.ativo and p.perfil='administrador'));

grant select on public.categorias_financeiras, public.centros_custo, public.fechamentos_comissao to authenticated;
grant select,insert,update on public.aprovacoes_operacoes to authenticated;
grant select on public.auditoria_log to authenticated;
grant usage,select on sequence public.auditoria_log_id_seq to authenticated;
