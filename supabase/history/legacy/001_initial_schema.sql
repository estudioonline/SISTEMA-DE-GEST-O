create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  perfil text not null default 'vendas' check (perfil in ('administrador','financeiro','vendas','estoque')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  email text,
  telefone text,
  limite_credito numeric(14,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  email text,
  telefone text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  codigo_barras text,
  descricao text not null,
  categoria text,
  unidade text not null default 'UN',
  custo numeric(14,2) not null default 0,
  preco_venda numeric(14,2) not null default 0,
  estoque_atual numeric(14,3) not null default 0,
  estoque_minimo numeric(14,3) not null default 0,
  fornecedor_id uuid references public.fornecedores(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id),
  vendedor_id uuid references public.profiles(id),
  status text not null default 'orcamento' check (status in ('orcamento','pedido','faturado','cancelado')),
  subtotal numeric(14,2) not null default 0,
  desconto numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  quantidade numeric(14,3) not null check (quantidade > 0),
  valor_unitario numeric(14,2) not null default 0,
  desconto numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0
);

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid references public.fornecedores(id),
  status text not null default 'aberta' check (status in ('aberta','recebida','cancelada')),
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.compra_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  quantidade numeric(14,3) not null check (quantidade > 0),
  custo_unitario numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0
);

create table if not exists public.titulos_financeiros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pagar','receber')),
  descricao text not null,
  entidade_nome text,
  vencimento date not null,
  valor numeric(14,2) not null,
  valor_pago numeric(14,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto','parcial','pago','cancelado')),
  categoria text,
  centro_custo text,
  created_at timestamptz not null default now()
);

create table if not exists public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id),
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade numeric(14,3) not null,
  referencia text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.fornecedores enable row level security;
alter table public.produtos enable row level security;
alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.compras enable row level security;
alter table public.compra_itens enable row level security;
alter table public.titulos_financeiros enable row level security;
alter table public.movimentos_estoque enable row level security;

create or replace function public.current_profile_role()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select perfil from public.profiles where id = (select auth.uid())
$$;

create policy "profiles_self_select" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.current_profile_role() = 'administrador');

create policy "erp_read_authenticated" on public.clientes
for select to authenticated using (true);
create policy "erp_read_fornecedores" on public.fornecedores
for select to authenticated using (true);
create policy "erp_read_produtos" on public.produtos
for select to authenticated using (true);
create policy "erp_read_vendas" on public.vendas
for select to authenticated using (true);
create policy "erp_read_venda_itens" on public.venda_itens
for select to authenticated using (true);
create policy "erp_read_compras" on public.compras
for select to authenticated using (true);
create policy "erp_read_compra_itens" on public.compra_itens
for select to authenticated using (true);
create policy "erp_read_titulos" on public.titulos_financeiros
for select to authenticated using (true);
create policy "erp_read_movimentos" on public.movimentos_estoque
for select to authenticated using (true);

create policy "admin_write_clientes" on public.clientes for all to authenticated
using (public.current_profile_role() = 'administrador') with check (public.current_profile_role() = 'administrador');
create policy "admin_write_fornecedores" on public.fornecedores for all to authenticated
using (public.current_profile_role() = 'administrador') with check (public.current_profile_role() = 'administrador');
create policy "write_produtos_admin_estoque" on public.produtos for all to authenticated
using (public.current_profile_role() in ('administrador','estoque')) with check (public.current_profile_role() in ('administrador','estoque'));
create policy "write_vendas_admin_vendas" on public.vendas for all to authenticated
using (public.current_profile_role() in ('administrador','vendas')) with check (public.current_profile_role() in ('administrador','vendas'));
create policy "write_venda_itens_admin_vendas" on public.venda_itens for all to authenticated
using (public.current_profile_role() in ('administrador','vendas')) with check (public.current_profile_role() in ('administrador','vendas'));
create policy "write_compras_admin_estoque" on public.compras for all to authenticated
using (public.current_profile_role() in ('administrador','estoque')) with check (public.current_profile_role() in ('administrador','estoque'));
create policy "write_compra_itens_admin_estoque" on public.compra_itens for all to authenticated
using (public.current_profile_role() in ('administrador','estoque')) with check (public.current_profile_role() in ('administrador','estoque'));
create policy "write_financeiro" on public.titulos_financeiros for all to authenticated
using (public.current_profile_role() in ('administrador','financeiro')) with check (public.current_profile_role() in ('administrador','financeiro'));
create policy "write_movimentos" on public.movimentos_estoque for all to authenticated
using (public.current_profile_role() in ('administrador','estoque')) with check (public.current_profile_role() in ('administrador','estoque'));
