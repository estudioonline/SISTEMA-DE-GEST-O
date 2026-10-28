-- Vendedores podem criar e editar vendas; Financeiro fica isolado.

drop policy if exists vendas_update on public.vendas;
create policy vendas_update on public.vendas
for update to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','vendas')
  )
)
with check (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','vendas')
  )
);

drop policy if exists venda_itens_insert on public.venda_itens;
create policy venda_itens_insert on public.venda_itens
for insert to authenticated
with check (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','vendas')
  )
);

drop policy if exists venda_itens_update on public.venda_itens;
create policy venda_itens_update on public.venda_itens
for update to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','vendas')
  )
)
with check (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','vendas')
  )
);

drop policy if exists venda_itens_delete on public.venda_itens;
create policy venda_itens_delete on public.venda_itens
for delete to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','vendas')
  )
);

-- Financeiro só pode ser lido por Administrador ou Financeiro.
drop policy if exists titulos_read on public.titulos_financeiros;
create policy titulos_read on public.titulos_financeiros
for select to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','financeiro')
  )
);

drop policy if exists pagamentos_titulos_read on public.pagamentos_titulos;
create policy pagamentos_titulos_read on public.pagamentos_titulos
for select to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','financeiro')
  )
);

-- Resumo de credito para venda sem expor lancamentos financeiros.
create or replace function private.situacao_credito_cliente_impl(p_cliente_id uuid, p_excluir_venda_id uuid default null)
returns table(limite_credito numeric, em_aberto numeric, vencido numeric)
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','vendas')
  ) then
    raise exception 'Perfil sem permissão para consultar situação de crédito';
  end if;

  return query
  select
    coalesce(c.limite_credito,0),
    coalesce(sum(
      case when t.status not in ('pago','cancelado')
        then greatest(t.valor-t.valor_pago,0) else 0 end
    ),0),
    coalesce(sum(
      case when t.status not in ('pago','cancelado')
                 and t.vencimento < current_date
        then greatest(t.valor-t.valor_pago,0) else 0 end
    ),0)
  from public.clientes c
  left join public.vendas v
    on v.cliente_id=c.id
   and v.status<>'cancelado'
   and (p_excluir_venda_id is null or v.id<>p_excluir_venda_id)
  left join public.titulos_financeiros t
    on t.venda_id=v.id
   and t.tipo='receber'
  where c.id=p_cliente_id
  group by c.limite_credito;
end;
$$;

create or replace function public.situacao_credito_cliente(p_cliente_id uuid, p_excluir_venda_id uuid default null)
returns table(limite_credito numeric, em_aberto numeric, vencido numeric)
language sql
security invoker
set search_path=''
as $$
  select * from private.situacao_credito_cliente_impl(p_cliente_id,p_excluir_venda_id);
$$;

revoke all on function private.situacao_credito_cliente_impl(uuid,uuid) from public,anon,authenticated;
revoke all on function public.situacao_credito_cliente(uuid,uuid) from public,anon;
grant execute on function public.situacao_credito_cliente(uuid,uuid) to authenticated;
