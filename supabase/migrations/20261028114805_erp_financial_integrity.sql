-- Keep the payment ledger immutable through the public API.
CREATE OR REPLACE FUNCTION private.registrar_pagamento_impl(p_titulo_id uuid, p_valor numeric, p_data_pagamento date, p_observacao text DEFAULT NULL::text)
 RETURNS titulos_financeiros
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_titulo public.titulos_financeiros%rowtype;
  v_total_pago numeric;
  v_vendedor_id uuid;
  v_percentual numeric;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('administrador','financeiro')) then raise exception 'Sem permissão para registrar pagamentos'; end if;
  if p_valor is null or p_data_pagamento is null then raise exception 'Informe valor e data do pagamento'; end if;
  select * into v_titulo
  from public.titulos_financeiros
  where id=p_titulo_id
  for update;

  if not found then raise exception 'Título não encontrado'; end if;
  if v_titulo.status='cancelado' then raise exception 'Título cancelado não pode receber pagamento'; end if;
  if p_valor<=0 then raise exception 'Valor do pagamento deve ser maior que zero'; end if;
  if p_valor>greatest(v_titulo.valor-v_titulo.valor_pago,0) then
    raise exception 'Pagamento maior que o saldo em aberto';
  end if;

  if exists(
    select 1 from public.fechamentos_comissao f
    where p_data_pagamento between f.inicio and f.fim
  ) and v_titulo.tipo='receber' and v_titulo.venda_id is not null then
    raise exception 'Período de comissão já fechado; recebimento retroativo bloqueado';
  end if;

  if v_titulo.tipo='receber' and v_titulo.venda_id is not null then
    select v.vendedor_cadastro_id, vd.percentual_comissao
      into v_vendedor_id, v_percentual
    from public.vendas v
    left join public.vendedores vd on vd.id=v.vendedor_cadastro_id
    where v.id=v_titulo.venda_id;
  end if;

  insert into public.pagamentos_titulos(
    titulo_id,data_pagamento,valor,observacao,vendedor_id,percentual_comissao,forma_pagamento
  )
  values (
    p_titulo_id,p_data_pagamento,p_valor,nullif(p_observacao,''),
    v_vendedor_id,v_percentual,v_titulo.forma_pagamento
  );

  select coalesce(sum(valor),0) into v_total_pago
  from public.pagamentos_titulos where titulo_id=p_titulo_id;

  update public.titulos_financeiros
  set valor_pago=v_total_pago,
      status=case when v_total_pago>=valor then 'pago'
                  when v_total_pago>0 then 'parcial'
                  else 'aberto' end
  where id=p_titulo_id
  returning * into v_titulo;

  return v_titulo;
end;
$function$;

create or replace function public.registrar_pagamento_titulo(p_titulo_id uuid,p_valor numeric,p_data_pagamento date,p_observacao text default null)
returns public.titulos_financeiros language sql security invoker set search_path='' as $$
 select private.registrar_pagamento_impl(p_titulo_id,p_valor,p_data_pagamento,p_observacao);
$$;
revoke insert,update,delete on public.pagamentos_titulos from authenticated,anon;
revoke all on function private.registrar_pagamento_impl(uuid,numeric,date,text) from public,anon;
grant execute on function private.registrar_pagamento_impl(uuid,numeric,date,text) to authenticated;
revoke all on function public.registrar_pagamento_titulo(uuid,numeric,date,text) from public,anon;
grant execute on function public.registrar_pagamento_titulo(uuid,numeric,date,text) to authenticated;

create or replace function private.proteger_titulo_integrado()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_ledger numeric;
begin
 if tg_op='DELETE' then
   if old.valor_pago>0 or exists(select 1 from public.pagamentos_titulos where titulo_id=old.id) then
     raise exception 'Título possui pagamento e não pode ser excluído';
   end if;
   if pg_trigger_depth()=1 and (old.venda_id is not null or old.compra_id is not null) then
     raise exception 'Título vinculado: cancele ou altere o documento de origem';
   end if;
   return old;
 end if;
 if new.valor<0 or new.valor_pago<0 or new.valor_pago>new.valor
 or (new.venda_id is not null and new.compra_id is not null) then raise exception 'Valores ou vínculos do título inválidos'; end if;
 if tg_op='INSERT' then
   if pg_trigger_depth()=1 and (new.venda_id is not null or new.compra_id is not null) then raise exception 'Títulos vinculados devem ser gerados pelo documento de origem'; end if;
 else
   if (old.valor_pago>0 or exists(select 1 from public.pagamentos_titulos where titulo_id=old.id)) and new.status='cancelado' then
     raise exception 'Título com pagamento não pode ser cancelado';
   end if;
   if pg_trigger_depth()=1 and (old.venda_id is not null or old.compra_id is not null) and
    (new.venda_id is distinct from old.venda_id or new.compra_id is distinct from old.compra_id
     or new.tipo is distinct from old.tipo or new.valor is distinct from old.valor
     or new.parcela_numero is distinct from old.parcela_numero or new.forma_pagamento is distinct from old.forma_pagamento
     or new.status='cancelado') then raise exception 'Altere o documento de origem para manter os vínculos financeiros'; end if;
 end if;
 select coalesce(sum(valor),0) into v_ledger from public.pagamentos_titulos where titulo_id=new.id;
 if new.valor_pago is distinct from v_ledger then raise exception 'Saldo pago deve corresponder ao histórico de pagamentos'; end if;
 if new.status<>'cancelado' and new.status is distinct from
   (case when v_ledger>=new.valor and new.valor>0 then 'pago' when v_ledger>0 then 'parcial' else 'aberto' end) then
   raise exception 'Status do título não corresponde ao saldo pago'; end if;
 return new;
end; $$;
create trigger erp_proteger_titulo before insert or update or delete on public.titulos_financeiros
for each row execute function private.proteger_titulo_integrado();
revoke all on function private.proteger_titulo_integrado() from public,anon,authenticated;
