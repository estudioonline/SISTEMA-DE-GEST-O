alter table public.venda_itens
  add column if not exists observacao_item text null;

comment on column public.venda_itens.observacao_item
  is 'Observação específica do item da venda/orçamento.';

create or replace function public.criar_venda_completa(
  p_cliente_id uuid,
  p_vendedor_cadastro_id uuid,
  p_status text,
  p_forma_pagamento text,
  p_parcelas integer,
  p_primeiro_vencimento date,
  p_observacoes text,
  p_itens jsonb
)
returns public.vendas
language plpgsql
set search_path to ''
as $function$
declare
  v_venda public.vendas%rowtype;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_desconto_item numeric;
  v_total_item numeric;
  v_subtotal numeric := 0;
  v_desconto numeric := 0;
  v_receita jsonb;
  v_observacao_item text;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_vendedor_cadastro_id is not null
     and not exists (
       select 1 from public.vendedores
       where id=p_vendedor_cadastro_id and ativo=true
     ) then
    raise exception 'Vendedor inválido ou inativo';
  end if;

  if p_status not in ('orcamento','pedido','faturado') then
    raise exception 'Status inválido para nova venda';
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

  insert into public.vendas(
    cliente_id,vendedor_id,vendedor_cadastro_id,status,
    subtotal,desconto,total,observacoes,
    forma_pagamento,parcelas,primeiro_vencimento
  )
  values (
    p_cliente_id,(select auth.uid()),p_vendedor_cadastro_id,p_status,
    v_subtotal,v_desconto,greatest(v_subtotal-v_desconto,0),nullif(p_observacoes,''),
    p_forma_pagamento,p_parcelas,p_primeiro_vencimento
  )
  returning * into v_venda;

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
    v_observacao_item := nullif(left(coalesce(v_item->>'observacao_item',''),240),'');

    v_receita := v_item->'receita_producao';
    if v_receita is null then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'componente_id',pc.componente_id,
            'quantidade',pc.quantidade
          )
          order by pc.created_at,pc.id
        ),
        '[]'::jsonb
      )
      into v_receita
      from public.produto_componentes pc
      where pc.produto_final_id=v_produto_id;
    elsif jsonb_typeof(v_receita)<>'array' then
      raise exception 'Receita de produção inválida';
    end if;

    insert into public.venda_itens(
      venda_id,produto_id,quantidade,valor_unitario,desconto,total,observacao_item,receita_producao
    )
    values (
      v_venda.id,v_produto_id,v_quantidade,v_valor_unitario,v_desconto_item,v_total_item,v_observacao_item,v_receita
    );
  end loop;

  return v_venda;
end;
$function$;

create or replace function public.atualizar_venda_completa(
  p_venda_id uuid,
  p_cliente_id uuid,
  p_vendedor_cadastro_id uuid,
  p_status text,
  p_forma_pagamento text,
  p_parcelas integer,
  p_primeiro_vencimento date,
  p_observacoes text,
  p_itens jsonb
)
returns public.vendas
language plpgsql
set search_path to ''
as $function$
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
  v_receita jsonb;
  v_observacao_item text;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_existente
  from public.vendas
  where id=p_venda_id
  for update;

  if not found then raise exception 'Venda não encontrada'; end if;
  if exists(select 1 from public.faturas_vendas where venda_id=p_venda_id and status='ativa') then
    raise exception 'Venda faturada não pode ser alterada. Cancele a fatura ativa antes de editar a venda';
  end if;
  if v_existente.status='faturado' then raise exception 'Venda faturada não pode ser alterada'; end if;
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

    if v_item ? 'receita_producao'
       and jsonb_typeof(v_item->'receita_producao')<>'array' then
      raise exception 'Receita de produção inválida';
    end if;

    v_desconto_item := least(v_desconto_item,v_quantidade*v_valor_unitario);
    v_subtotal := v_subtotal+(v_quantidade*v_valor_unitario);
    v_desconto := v_desconto+v_desconto_item;
  end loop;

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
      (select produto_id,quantidade,valor_unitario,desconto,coalesce(observacao_item,'') from public.venda_itens where venda_id=p_venda_id
       except all
       select (x->>'produto_id')::uuid,(x->>'quantidade')::numeric,(x->>'valor_unitario')::numeric,
       least(greatest(coalesce((x->>'desconto')::numeric,0),0),(x->>'quantidade')::numeric*(x->>'valor_unitario')::numeric),
       coalesce(left(x->>'observacao_item',240),'')
       from jsonb_array_elements(p_itens) x)
      union all
      (select (x->>'produto_id')::uuid,(x->>'quantidade')::numeric,(x->>'valor_unitario')::numeric,
       least(greatest(coalesce((x->>'desconto')::numeric,0),0),(x->>'quantidade')::numeric*(x->>'valor_unitario')::numeric),
       coalesce(left(x->>'observacao_item',240),'')
       from jsonb_array_elements(p_itens) x
       except all
       select produto_id,quantidade,valor_unitario,desconto,coalesce(observacao_item,'') from public.venda_itens where venda_id=p_venda_id)
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
    v_observacao_item := nullif(left(coalesce(v_item->>'observacao_item',''),240),'');

    v_receita := v_item->'receita_producao';
    if v_receita is null then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'componente_id',pc.componente_id,
            'quantidade',pc.quantidade
          )
          order by pc.created_at,pc.id
        ),
        '[]'::jsonb
      )
      into v_receita
      from public.produto_componentes pc
      where pc.produto_final_id=v_produto_id;
    end if;

    insert into public.venda_itens(
      venda_id,produto_id,quantidade,valor_unitario,desconto,total,observacao_item,receita_producao
    )
    values (
      p_venda_id,v_produto_id,v_quantidade,v_valor_unitario,v_desconto_item,v_total_item,v_observacao_item,v_receita
    );
  end loop;

  return v_venda;
end;
$function$;
