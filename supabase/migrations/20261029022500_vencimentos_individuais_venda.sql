alter table public.vendas
  add column if not exists vencimentos_parcelas date[];

update public.vendas
set vencimentos_parcelas = array(
  select (primeiro_vencimento + make_interval(months => gs-1))::date
  from generate_series(1, greatest(parcelas::int,1)) gs
)
where vencimentos_parcelas is null
   or cardinality(vencimentos_parcelas) <> parcelas;

create or replace function private.sincronizar_titulos_venda()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cliente text;
  v_parcela numeric;
  v_valor numeric;
  v_vencimento date;
  v_datas date[];
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
       or old.vencimentos_parcelas is distinct from new.vencimentos_parcelas
       or old.cliente_id is distinct from new.cliente_id
     ) then
    raise exception 'Venda possui pagamento registrado e não pode ter cobrança alterada';
  end if;

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
       and old.vencimentos_parcelas is not distinct from new.vencimentos_parcelas
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

  v_datas := new.vencimentos_parcelas;
  if v_datas is null or cardinality(v_datas) <> new.parcelas then
    v_datas := array(
      select (new.primeiro_vencimento + make_interval(months => gs-1))::date
      from generate_series(1,new.parcelas) gs
    );
  end if;

  for i in 1..new.parcelas loop
    if i = new.parcelas then
      v_valor := new.total - (v_parcela * (new.parcelas - 1));
    else
      v_valor := v_parcela;
    end if;

    v_vencimento := v_datas[i];

    insert into public.titulos_financeiros(
      tipo,descricao,entidade_nome,vencimento,valor,valor_pago,status,categoria,centro_custo,venda_id,parcela_numero,forma_pagamento
    )
    values (
      'receber',
      'Fatura ' || lpad(new.fatura_numero::text,7,'0') || ' - Parcela ' || i::text || '/' || new.parcelas::text,
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
