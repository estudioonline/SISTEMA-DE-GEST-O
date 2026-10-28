-- Rules are checked against the final transaction state, after all items exist.
create or replace function private.validar_venda_final()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_id uuid; v public.vendas%rowtype; cfg public.empresa_config%rowtype;
 v_admin boolean; v_sub numeric; v_desc numeric; v_cost numeric; v_count integer;
 v_open numeric; v_overdue numeric; v_limit numeric; r record; v_reasons jsonb:='[]';
begin
 if tg_table_name='vendas' then
   v_id:=coalesce(new.id,old.id);
 else
   v_id:=coalesce(new.venda_id,old.venda_id);
 end if;
 select * into v from public.vendas where id=v_id;
 if not found or v.status='cancelado' then return null; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('administrador','vendas')) then
 raise exception 'Usuário sem permissão para alterar vendas'; end if;
 select perfil='administrador' into v_admin from public.profiles where id=auth.uid() and ativo;
 select * into strict cfg from public.empresa_config where id=1;
 if cfg.campos_obrigatorios->>'venda_cliente'='true' and v.cliente_id is null then raise exception 'Cliente obrigatório na venda'; end if;
 if cfg.campos_obrigatorios->>'venda_vendedor'='true' and v.vendedor_cadastro_id is null then raise exception 'Vendedor obrigatório na venda'; end if;
 select count(*),coalesce(sum(i.quantidade*i.valor_unitario),0),coalesce(sum(i.desconto),0),
 coalesce(sum(i.quantidade*coalesce(p.custo_medio,p.custo,0)),0)
 into v_count,v_sub,v_desc,v_cost from public.venda_itens i join public.produtos p on p.id=i.produto_id where i.venda_id=v.id;
 if v_count=0 or abs(v.subtotal-v_sub)>0.01 or abs(v.desconto-v_desc)>0.01 or abs(v.total-(v_sub-v_desc))>0.01 then
 raise exception 'Totais da venda não conferem com os itens'; end if;
 if exists(select 1 from public.venda_itens i join public.produtos p on p.id=i.produto_id
 where i.venda_id=v.id and (not p.ativo or i.quantidade<=0 or i.valor_unitario<0 or i.desconto<0 or i.desconto>i.quantidade*i.valor_unitario
 or abs(i.total-(i.quantidade*i.valor_unitario-i.desconto))>0.01
 or i.valor_unitario-i.desconto/i.quantidade+0.000001<coalesce(p.custo_medio,p.custo,0)*(1+coalesce(p.percentual_minimo_custo_venda,100)/100))) then
 raise exception 'Produto inativo, item inválido ou preço abaixo do mínimo sobre custo'; end if;
 if v_sub>0 and v_desc/v_sub*100>cfg.desconto_max_vendedor then
 v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('tipo','desconto','motivo','Desconto acima do limite')); end if;
 if (case when v.total>0 then (v.total-v_cost)/v.total*100 else 0 end)<cfg.margem_minima_percentual then
 v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('tipo','margem','motivo','Margem abaixo do mínimo')); end if;
 if v.cliente_id is not null and v.status<>'orcamento' then
   -- Serialize credit decisions for the same customer.
   select limite_credito into v_limit from public.clientes where id=v.cliente_id and ativo for update;
   if not found then raise exception 'Cliente inativo ou inexistente'; end if;
   select coalesce(sum(greatest(valor-valor_pago,0)),0),
   coalesce(sum(greatest(valor-valor_pago,0)) filter(where vencimento<current_date),0)
   into v_open,v_overdue from public.titulos_financeiros
   where tipo='receber' and status in ('aberto','parcial') and venda_id is distinct from v.id
   and venda_id in(select id from public.vendas where cliente_id=v.cliente_id);
   if cfg.bloquear_cliente_inadimplente and v_overdue>0 then
   v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('tipo','inadimplencia','motivo','Cliente com títulos vencidos')); end if;
   if cfg.exigir_aprovacao_limite_credito and v_limit>0 and v_open+v.total>v_limit then
   v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('tipo','limite_credito','motivo','Limite de crédito excedido')); end if;
 end if;
 if jsonb_array_length(v_reasons)>0 and not v_admin then
 raise exception 'Venda exige autorização administrativa: %',v_reasons; end if;
 if v.estoque_negativo_autorizado_em>=transaction_timestamp() then
 v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('tipo','estoque_negativo','motivo','Estoque negativo autorizado')); end if;
 if coalesce(current_setting('app.erp_audit_'||replace(v.id::text,'-',''),true),'')<>'done' then
   for r in select value from jsonb_array_elements(v_reasons) loop
     insert into public.aprovacoes_operacoes(tipo,entidade_tipo,entidade_id,solicitado_por,aprovado_por,aprovado_em,status,motivo,detalhes)
     values(r.value->>'tipo','venda',v.id,auth.uid(),auth.uid(),now(),'aprovado',r.value->>'motivo',
       jsonb_build_object('origem','validacao_banco','total',v.total));
   end loop;
   perform set_config('app.erp_audit_'||replace(v.id::text,'-',''),'done',true);
 end if;
 return null;
end; $$;

CREATE OR REPLACE FUNCTION public.atualizar_venda_completa(p_venda_id uuid, p_cliente_id uuid, p_vendedor_cadastro_id uuid, p_status text, p_forma_pagamento text, p_parcelas integer, p_primeiro_vencimento date, p_observacoes text, p_itens jsonb)
 RETURNS vendas
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_existente public.vendas%rowtype;
  v_venda public.vendas%rowtype;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_desconto_item numeric;
  v_total_item numeric;
  v_subtotal numeric := 0;
  v_desconto numeric := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_existente
  from public.vendas
  where id=p_venda_id
  for update;

  if not found then raise exception 'Venda não encontrada'; end if;
  if v_existente.status='cancelado' then raise exception 'Venda cancelada não pode ser editada'; end if;

  if p_vendedor_cadastro_id is not null
     and not exists (
       select 1 from public.vendedores
       where id=p_vendedor_cadastro_id and ativo=true
     ) then
    raise exception 'Vendedor inválido ou inativo';
  end if;

  if p_status not in ('orcamento','pedido','faturado') then
    raise exception 'Status inválido para edição';
  end if;

  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then
    raise exception 'A venda precisa ter pelo menos um item';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := nullif(v_item->>'produto_id','')::uuid;
    v_quantidade := coalesce((v_item->>'quantidade')::numeric,0);
    v_valor_unitario := coalesce((v_item->>'valor_unitario')::numeric,0);
    v_desconto_item := greatest(coalesce((v_item->>'desconto')::numeric,0),0);

    if v_produto_id is null or v_quantidade<=0 or v_valor_unitario<0 then
      raise exception 'Item de venda inválido';
    end if;

    v_desconto_item := least(v_desconto_item,v_quantidade*v_valor_unitario);
    v_subtotal := v_subtotal+(v_quantidade*v_valor_unitario);
    v_desconto := v_desconto+v_desconto_item;
  end loop;

  -- Return the old stock before applying a status transition or replacement.
  -- Paid documents keep their original items and their inventory history.
  if not exists(select 1 from public.titulos_financeiros where venda_id=p_venda_id and valor_pago>0) then
    delete from public.venda_itens where venda_id=p_venda_id;
  end if;

  update public.vendas
  set cliente_id=p_cliente_id,
      vendedor_cadastro_id=p_vendedor_cadastro_id,
      status=p_status,
      subtotal=v_subtotal,
      desconto=v_desconto,
      total=greatest(v_subtotal-v_desconto,0),
      observacoes=nullif(p_observacoes,''),
      forma_pagamento=p_forma_pagamento,
      parcelas=p_parcelas,
      primeiro_vencimento=p_primeiro_vencimento
  where id=p_venda_id
  returning * into v_venda;

  if exists(select 1 from public.titulos_financeiros where venda_id=p_venda_id and valor_pago>0) then
    if exists(
      (select produto_id,quantidade,valor_unitario,desconto from public.venda_itens where venda_id=p_venda_id
       except all
       select (x->>'produto_id')::uuid,(x->>'quantidade')::numeric,(x->>'valor_unitario')::numeric,
       least(greatest(coalesce((x->>'desconto')::numeric,0),0),(x->>'quantidade')::numeric*(x->>'valor_unitario')::numeric)
       from jsonb_array_elements(p_itens) x)
      union all
      (select (x->>'produto_id')::uuid,(x->>'quantidade')::numeric,(x->>'valor_unitario')::numeric,
       least(greatest(coalesce((x->>'desconto')::numeric,0),0),(x->>'quantidade')::numeric*(x->>'valor_unitario')::numeric)
       from jsonb_array_elements(p_itens) x
       except all
       select produto_id,quantidade,valor_unitario,desconto from public.venda_itens where venda_id=p_venda_id)
    ) then raise exception 'Venda com recebimento não permite alterar os itens'; end if;
    return v_venda;
  end if;
  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := (v_item->>'produto_id')::uuid;
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_valor_unitario := (v_item->>'valor_unitario')::numeric;
    v_desconto_item := least(
      greatest(coalesce((v_item->>'desconto')::numeric,0),0),
      v_quantidade*v_valor_unitario
    );
    v_total_item := greatest((v_quantidade*v_valor_unitario)-v_desconto_item,0);

    insert into public.venda_itens(
      venda_id,produto_id,quantidade,valor_unitario,desconto,total
    )
    values (
      p_venda_id,v_produto_id,v_quantidade,v_valor_unitario,v_desconto_item,v_total_item
    );
  end loop;

  return v_venda;
end;
$function$;
