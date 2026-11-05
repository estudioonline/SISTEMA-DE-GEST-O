create or replace function public.excluir_titulo_manual_cancelado(p_titulo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo public.titulos_financeiros%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Autenticação obrigatória';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.ativo
      and p.perfil = 'administrador'
  ) then
    raise exception 'Somente administradores podem excluir lançamentos financeiros';
  end if;

  if not private.usuario_pode('financeiro','editar') then
    raise exception 'Sem permissão para editar o Financeiro';
  end if;

  select *
  into v_titulo
  from public.titulos_financeiros
  where id = p_titulo_id
  for update;

  if not found then
    return false;
  end if;

  if v_titulo.venda_id is not null
     or v_titulo.compra_id is not null
     or v_titulo.funcionario_id is not null
     or v_titulo.fatura_venda_id is not null then
    raise exception 'Somente lançamentos manuais sem documento de origem podem ser excluídos por este fluxo';
  end if;

  if v_titulo.status <> 'cancelado' then
    raise exception 'Cancele o lançamento antes de excluí-lo';
  end if;

  if coalesce(v_titulo.valor_pago,0) <> 0 then
    raise exception 'O lançamento ainda possui saldo pago';
  end if;

  if exists (
    select 1
    from public.conciliacoes_bancarias cb
    left join public.pagamentos_titulos pt on pt.id = cb.pagamento_id
    where cb.desfeito_em is null
      and (cb.titulo_id = p_titulo_id or pt.titulo_id = p_titulo_id)
  ) then
    raise exception 'Desfaça a conciliação bancária antes de excluir o lançamento';
  end if;

  if exists (
    select 1
    from public.pagamentos_titulos pt
    left join public.estornos_pagamentos e on e.pagamento_id = pt.id
    where pt.titulo_id = p_titulo_id
    group by pt.id, pt.valor
    having coalesce(sum(e.valor),0) < pt.valor
  ) then
    raise exception 'Existe pagamento não totalmente estornado neste lançamento';
  end if;

  delete from public.estornos_pagamentos e
  using public.pagamentos_titulos pt
  where e.pagamento_id = pt.id
    and pt.titulo_id = p_titulo_id;

  delete from public.pagamentos_titulos
  where titulo_id = p_titulo_id;

  delete from public.titulos_financeiros
  where id = p_titulo_id;

  return true;
end;
$$;

revoke all on function public.excluir_titulo_manual_cancelado(uuid) from public;
revoke all on function public.excluir_titulo_manual_cancelado(uuid) from anon;
grant execute on function public.excluir_titulo_manual_cancelado(uuid) to authenticated;
