alter table public.vendas
  add column if not exists percentual_comissao numeric null;

alter table public.vendas
  drop constraint if exists vendas_percentual_comissao_check;

alter table public.vendas
  add constraint vendas_percentual_comissao_check
  check (percentual_comissao is null or (percentual_comissao >= 0 and percentual_comissao <= 100));

comment on column public.vendas.percentual_comissao
  is 'Percentual de comissão específico desta venda. Null usa o percentual padrão do vendedor.';

create or replace function private.aplicar_comissao_especifica_venda_pagamento()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_sale_percent numeric;
  v_default_percent numeric;
  v_seller uuid;
begin
  select v.vendedor_cadastro_id, v.percentual_comissao, vd.percentual_comissao
    into v_seller, v_sale_percent, v_default_percent
  from public.titulos_financeiros t
  join public.vendas v on v.id=t.venda_id
  left join public.vendedores vd on vd.id=v.vendedor_cadastro_id
  where t.id=new.titulo_id
    and t.tipo='receber'
    and t.venda_id is not null;

  if found then
    new.vendedor_id:=v_seller;
    new.percentual_comissao:=coalesce(v_sale_percent,v_default_percent);
  end if;

  return new;
end;
$function$;

drop trigger if exists pagamentos_aplicar_comissao_venda on public.pagamentos_titulos;
create trigger pagamentos_aplicar_comissao_venda
before insert on public.pagamentos_titulos
for each row
execute function private.aplicar_comissao_especifica_venda_pagamento();


create or replace function private.salvar_venda_erp_impl(p_requisicao uuid, p_payload jsonb, p_autorizar_sem_estoque boolean default false)
returns public.vendas
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public.vendas%rowtype;
  r private.erp_requisicoes%rowtype;
  v_id uuid;
  v_assinatura text;
  v_admin boolean;
  v_status text := coalesce(p_payload->>'p_status','');
  v_rota text := nullif(p_payload->>'p_rota_entrega','');
  v_datas date[];
  v_percentual_comissao numeric := nullif(p_payload->>'p_percentual_comissao','')::numeric;
begin
  if auth.uid() is null or not private.usuario_pode('vendas','editar') then
    raise exception 'Sem permissão para editar vendas';
  end if;

  v_admin:=private.usuario_pode('autorizacoes','editar');

  if p_requisicao is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Requisição inválida';
  end if;

  if v_percentual_comissao is not null and (v_percentual_comissao < 0 or v_percentual_comissao > 100) then
    raise exception 'Percentual de comissão deve estar entre 0 e 100';
  end if;

  if coalesce(p_autorizar_sem_estoque,false) and not v_admin then
    raise exception 'Somente usuário autorizado pode liberar estoque negativo';
  end if;

  if v_rota is not null and v_rota not in ('norte','sul','leste','interestadual','retirada') then
    raise exception 'Informe uma rota de entrega válida';
  end if;

  if v_status<>'orcamento' and v_rota is null then
    raise exception 'Rota de entrega obrigatória para concluir a venda';
  end if;

  if jsonb_typeof(p_payload->'p_vencimentos')='array' then
    select array_agg(value::text::date order by ord)
      into v_datas
    from jsonb_array_elements(p_payload->'p_vencimentos') with ordinality x(value,ord);

    if cardinality(v_datas) <> (p_payload->>'p_parcelas')::integer then
      raise exception 'Informe a data de vencimento de cada parcela';
    end if;
  end if;

  v_assinatura:=md5(p_payload::text||coalesce(p_autorizar_sem_estoque,false)::text);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_requisicao::text,0));

  select * into r
  from private.erp_requisicoes
  where usuario_id=auth.uid() and requisicao_id=p_requisicao;

  if found then
    if r.assinatura<>v_assinatura then
      raise exception 'Esta requisição já foi concluída com outros dados. Reabra a venda antes de alterar.';
    end if;
    select * into strict v from public.vendas where id=r.venda_id;
    return v;
  end if;

  if coalesce(p_autorizar_sem_estoque,false) then
    perform set_config('app.allow_negative_stock','true',true);
  end if;

  set constraints public.erp_venda_final,public.erp_venda_itens_final deferred;
  v_id:=nullif(p_payload->>'p_venda_id','')::uuid;

  if v_id is null then
    v:=public.criar_venda_completa(
      nullif(p_payload->>'p_cliente_id','')::uuid,
      nullif(p_payload->>'p_vendedor_cadastro_id','')::uuid,
      v_status,
      p_payload->>'p_forma_pagamento',
      (p_payload->>'p_parcelas')::integer,
      (p_payload->>'p_primeiro_vencimento')::date,
      p_payload->>'p_observacoes',
      p_payload->'p_itens'
    );
  else
    v:=public.atualizar_venda_completa(
      v_id,
      nullif(p_payload->>'p_cliente_id','')::uuid,
      nullif(p_payload->>'p_vendedor_cadastro_id','')::uuid,
      v_status,
      p_payload->>'p_forma_pagamento',
      (p_payload->>'p_parcelas')::integer,
      (p_payload->>'p_primeiro_vencimento')::date,
      p_payload->>'p_observacoes',
      p_payload->'p_itens'
    );
  end if;

  if v_datas is null then
    v_datas := array(
      select ((p_payload->>'p_primeiro_vencimento')::date + make_interval(months => gs-1))::date
      from generate_series(1,(p_payload->>'p_parcelas')::integer) gs
    );
  end if;

  update public.vendas
     set rota_entrega=v_rota,
         percentual_comissao=v_percentual_comissao,
         vencimentos_parcelas=v_datas,
         primeiro_vencimento=v_datas[1],
         layout_itens=case when jsonb_typeof(p_payload->'p_layout_itens')='array' then p_payload->'p_layout_itens' else '[]'::jsonb end,
         validade_orcamento=case
           when status='orcamento'
             then (now() at time zone 'America/Sao_Paulo')::date+
                  (select validade_orcamento_dias from public.empresa_config where id=1)
           else null
         end,
         estoque_negativo_autorizado_por=case
           when coalesce(p_autorizar_sem_estoque,false) then auth.uid()
           else estoque_negativo_autorizado_por
         end,
         estoque_negativo_autorizado_em=case
           when coalesce(p_autorizar_sem_estoque,false) then now()
           else estoque_negativo_autorizado_em
         end
   where id=v.id
   returning * into v;

  set constraints public.erp_venda_final,public.erp_venda_itens_final immediate;

  insert into private.erp_requisicoes(usuario_id,requisicao_id,assinatura,venda_id)
  values(auth.uid(),p_requisicao,v_assinatura,v.id);

  return v;
end;
$function$;
