-- Custo medio baseado nas compras recebidas
create or replace function private.recalcular_custo_medio_produto(p_produto_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_custo numeric;
begin
  select case when coalesce(sum(ci.quantidade),0)>0
    then sum(ci.quantidade*ci.custo_unitario)/sum(ci.quantidade)
    else null end
  into v_custo
  from public.compra_itens ci
  join public.compras c on c.id=ci.compra_id
  where ci.produto_id=p_produto_id and c.status='recebida';

  if v_custo is not null then
    update public.produtos
       set custo_medio=v_custo,
           custo=v_custo
     where id=p_produto_id;
  end if;
end;
$$;

create or replace function private.atualizar_custo_medio_compra_item()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_old uuid; v_new uuid;
begin
  v_old:=case when tg_op in ('UPDATE','DELETE') then old.produto_id else null end;
  v_new:=case when tg_op in ('INSERT','UPDATE') then new.produto_id else null end;
  if v_old is not null then perform private.recalcular_custo_medio_produto(v_old); end if;
  if v_new is not null and v_new is distinct from v_old then perform private.recalcular_custo_medio_produto(v_new); end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_custo_medio_compra_item on public.compra_itens;
create trigger trg_custo_medio_compra_item
after insert or update or delete on public.compra_itens
for each row execute function private.atualizar_custo_medio_compra_item();

create or replace function private.atualizar_custo_medio_compra_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare r record;
begin
  if new.status is distinct from old.status then
    for r in select distinct produto_id from public.compra_itens where compra_id=new.id loop
      perform private.recalcular_custo_medio_produto(r.produto_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_custo_medio_compra_status on public.compras;
create trigger trg_custo_medio_compra_status
after update of status on public.compras
for each row execute function private.atualizar_custo_medio_compra_status();

-- Visao segura de reposicao
create or replace view public.produtos_para_reposicao
with (security_invoker=true)
as
select id,codigo,descricao,unidade,estoque_atual,estoque_minimo,
       coalesce(estoque_reposicao,estoque_minimo) as ponto_reposicao,
       greatest(coalesce(estoque_reposicao,estoque_minimo)-estoque_atual,0) as quantidade_sugerida
from public.produtos
where ativo=true
  and estoque_atual<=coalesce(estoque_reposicao,estoque_minimo);

grant select on public.produtos_para_reposicao to authenticated;

-- Guardar forma de pagamento no historico sem mudar a assinatura atual
create or replace function public.registrar_pagamento_titulo(
  p_titulo_id uuid,
  p_valor numeric,
  p_data_pagamento date,
  p_observacao text default null
)
returns public.titulos_financeiros
language plpgsql
set search_path=''
as $$
declare
  v_titulo public.titulos_financeiros%rowtype;
  v_total_pago numeric;
  v_vendedor_id uuid;
  v_percentual numeric;
begin
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
$$;
