-- Preserve all historical rows at deployment; changes govern future operations.
CREATE OR REPLACE FUNCTION private.sincronizar_titulos_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cliente text;
  v_parcela numeric;
  v_valor numeric;
  v_vencimento date;
  i integer;
begin
  if tg_op = 'UPDATE'
     and old.status = 'cancelado'
     and new.status <> 'cancelado' then
    raise exception 'Venda cancelada não pode ser reativada';
  end if;

  if new.status = 'cancelado' then
    update public.titulos_financeiros
       set status = 'cancelado'
     where venda_id = new.id
       and status <> 'pago';
    return new;
  end if;

  if tg_op = 'UPDATE'
     and exists (
       select 1
       from public.titulos_financeiros
       where venda_id = new.id
         and valor_pago > 0
     )
     and (
       old.total is distinct from new.total
       or old.forma_pagamento is distinct from new.forma_pagamento
       or old.parcelas is distinct from new.parcelas
       or old.primeiro_vencimento is distinct from new.primeiro_vencimento
       or old.cliente_id is distinct from new.cliente_id
     ) then
    raise exception 'Venda possui pagamento registrado e não pode ter cobrança alterada';
  end if;

  -- Quotations do not generate receivables. Paid documents cannot regress.
  if new.status='orcamento' then
    if exists(select 1 from public.titulos_financeiros where venda_id=new.id and valor_pago>0) then
      raise exception 'Venda com recebimento não pode voltar para orçamento';
    end if;
    delete from public.titulos_financeiros where venda_id=new.id and valor_pago=0;
    return new;
  end if;

  if tg_op='UPDATE' then
    if old.total is not distinct from new.total
       and old.forma_pagamento is not distinct from new.forma_pagamento
       and old.parcelas is not distinct from new.parcelas
       and old.primeiro_vencimento is not distinct from new.primeiro_vencimento
       and old.cliente_id is not distinct from new.cliente_id
       and old.status in ('pedido','faturado')
       and exists(select 1 from public.titulos_financeiros where venda_id=new.id) then
      return new;
    end if;
  end if;

  delete from public.titulos_financeiros
   where venda_id = new.id
     and valor_pago = 0;

  select nome into v_cliente
  from public.clientes
  where id = new.cliente_id;

  v_parcela := trunc((new.total / new.parcelas)::numeric, 2);

  for i in 1..new.parcelas loop
    if i = new.parcelas then
      v_valor := new.total - (v_parcela * (new.parcelas - 1));
    else
      v_valor := v_parcela;
    end if;

    v_vencimento := (new.primeiro_vencimento + make_interval(months => i - 1))::date;

    insert into public.titulos_financeiros(
      tipo,
      descricao,
      entidade_nome,
      vencimento,
      valor,
      valor_pago,
      status,
      categoria,
      centro_custo,
      venda_id,
      parcela_numero,
      forma_pagamento
    )
    values (
      'receber',
      'Fatura ' || lpad(new.fatura_numero::text,7,'0') ||
        ' - Parcela ' || i::text || '/' || new.parcelas::text,
      coalesce(v_cliente,'Consumidor'),
      v_vencimento,
      v_valor,
      0,
      'aberto',
      'Vendas',
      'Comercial',
      new.id,
      i,
      new.forma_pagamento
    );
  end loop;

  return new;
end;
$function$;

create or replace function private.proteger_documento_pago()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_pago boolean;
begin
 if tg_table_name='vendas' then
   select exists(select 1 from public.titulos_financeiros where venda_id=old.id and valor_pago>0) into v_pago;
 else
   select exists(select 1 from public.titulos_financeiros where compra_id=old.id and valor_pago>0) into v_pago;
 end if;
 if v_pago and (tg_op='DELETE' or new.status in ('cancelado','cancelada')) then
   raise exception 'Documento possui pagamento. Regularize o financeiro antes de cancelar ou excluir.';
 end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger erp_proteger_venda_paga before delete or update of status on public.vendas for each row execute function private.proteger_documento_pago();
create trigger erp_proteger_compra_paga before delete or update of status on public.compras for each row execute function private.proteger_documento_pago();

create or replace function private.validar_campos_compra()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status<>'cancelada' and new.fornecedor_id is null
 and exists(select 1 from public.empresa_config where id=1 and campos_obrigatorios->>'compra_fornecedor'='true') then
 raise exception 'Fornecedor obrigatório na compra'; end if;
 return new;
end; $$;
create trigger erp_campos_compra before insert or update of fornecedor_id,status on public.compras
for each row execute function private.validar_campos_compra();
revoke all on function private.proteger_documento_pago() from public,anon,authenticated;
revoke all on function private.validar_campos_compra() from public,anon,authenticated;

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
  delete from public.venda_itens where venda_id=p_venda_id;

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

create or replace function private.proteger_itens_pagos()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_paid boolean;
begin
 if tg_table_name='venda_itens' then
  select exists(select 1 from public.titulos_financeiros where venda_id=coalesce(new.venda_id,old.venda_id) and valor_pago>0) into v_paid;
 else
  select exists(select 1 from public.titulos_financeiros where compra_id=coalesce(new.compra_id,old.compra_id) and valor_pago>0) into v_paid;
 end if;
 if v_paid then raise exception 'Documento com pagamento não permite alterar itens'; end if;
 return coalesce(new,old);
end; $$;
create trigger erp_itens_venda_paga before insert or update or delete on public.venda_itens for each row execute function private.proteger_itens_pagos();
create trigger erp_itens_compra_paga before insert or update or delete on public.compra_itens for each row execute function private.proteger_itens_pagos();
revoke all on function private.proteger_itens_pagos() from public,anon,authenticated;
