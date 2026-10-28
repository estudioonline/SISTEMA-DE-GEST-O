alter table public.compras
  add column if not exists chave_nfe text,
  add column if not exists numero_nfe text,
  add column if not exists cnpj_fornecedor text,
  add column if not exists nome_fornecedor text,
  add column if not exists data_emissao timestamptz,
  add column if not exists valor_total_nfe numeric;

create unique index if not exists compras_chave_nfe_unique
  on public.compras(chave_nfe)
  where chave_nfe is not null;

create table if not exists public.de_para_produtos (
  id uuid primary key default gen_random_uuid(),
  cnpj_fornecedor text not null,
  codigo_produto_fornecedor text not null,
  descricao_produto_fornecedor text,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint de_para_produtos_cnpj_check check (cnpj_fornecedor ~ '^[0-9]{14}$'),
  constraint de_para_produtos_codigo_check check (length(btrim(codigo_produto_fornecedor)) between 1 and 120),
  constraint de_para_produtos_unique unique (cnpj_fornecedor,codigo_produto_fornecedor)
);

alter table public.de_para_produtos enable row level security;

revoke all on table public.de_para_produtos from anon;
grant select,insert,update,delete on table public.de_para_produtos to authenticated;

drop policy if exists de_para_produtos_read on public.de_para_produtos;
create policy de_para_produtos_read on public.de_para_produtos
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.ativo
));

drop policy if exists de_para_produtos_insert on public.de_para_produtos;
create policy de_para_produtos_insert on public.de_para_produtos
for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')
));

drop policy if exists de_para_produtos_update on public.de_para_produtos;
create policy de_para_produtos_update on public.de_para_produtos
for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')
))
with check (exists (
  select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')
));

drop policy if exists de_para_produtos_delete on public.de_para_produtos;
create policy de_para_produtos_delete on public.de_para_produtos
for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'
));

create or replace function private.importar_compra_nfe_impl(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_chave text := regexp_replace(coalesce(p_payload->>'chave_nfe',''),'[^0-9]','','g');
  v_numero text := nullif(btrim(coalesce(p_payload->>'numero_nfe','')),'');
  v_cnpj text := regexp_replace(coalesce(p_payload->>'cnpj_fornecedor',''),'[^0-9]','','g');
  v_nome text := nullif(btrim(coalesce(p_payload->>'nome_fornecedor','')),'');
  v_data_emissao timestamptz;
  v_total_nfe numeric := coalesce((p_payload->>'valor_total')::numeric,0);
  v_forma text := lower(coalesce(p_payload->>'forma_pagamento','pix'));
  v_vencimentos jsonb := coalesce(p_payload->'vencimentos','[]'::jsonb);
  v_parcelas integer;
  v_primeiro_vencimento date;
  v_fornecedor_id uuid;
  v_compra public.compras%rowtype;
  v_item jsonb;
  v_items_normalizados jsonb := '[]'::jsonb;
  v_produto_id uuid;
  v_map_produto uuid;
  v_codigo_fornecedor text;
  v_descricao_fornecedor text;
  v_unidade text;
  v_quantidade numeric;
  v_custo numeric;
  v_novo jsonb;
  v_codigo_interno text;
  v_descricao_interna text;
  v_preco_venda numeric;
  v_created_products integer := 0;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.ativo and p.perfil in ('administrador','estoque')
  ) then
    raise exception 'Sem permissão para importar NF-e';
  end if;

  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Payload da NF-e inválido'; end if;
  if length(v_chave)<>44 then raise exception 'Chave da NF-e inválida. Informe os 44 dígitos'; end if;
  if length(v_cnpj)<>14 then raise exception 'CNPJ do fornecedor inválido'; end if;
  if v_numero is null then raise exception 'Número da NF-e não informado'; end if;
  if v_nome is null then raise exception 'Nome do fornecedor não informado'; end if;

  begin
    v_data_emissao := (p_payload->>'data_emissao')::timestamptz;
  exception when others then
    raise exception 'Data de emissão da NF-e inválida';
  end;

  if v_total_nfe<0 then raise exception 'Valor total da NF-e inválido'; end if;
  if jsonb_typeof(p_payload->'itens') is distinct from 'array' or jsonb_array_length(p_payload->'itens')=0 then
    raise exception 'A NF-e precisa ter pelo menos um item';
  end if;
  if exists(select 1 from public.compras where chave_nfe=v_chave) then
    raise exception 'Esta NF-e já foi importada anteriormente';
  end if;

  if jsonb_typeof(v_vencimentos) is distinct from 'array' or jsonb_array_length(v_vencimentos)=0 then
    v_vencimentos:=jsonb_build_array((v_data_emissao at time zone 'America/Sao_Paulo')::date::text);
  end if;

  v_parcelas:=jsonb_array_length(v_vencimentos);
  if v_forma not in ('pix','cartao','boleto') then raise exception 'Forma de pagamento inválida'; end if;
  if v_forma='pix' and v_parcelas<>1 then raise exception 'PIX deve possuir uma única parcela'; end if;
  if v_forma='cartao' and (v_parcelas<1 or v_parcelas>12) then raise exception 'Cartão aceita entre 1 e 12 parcelas'; end if;
  if v_forma='boleto' and (v_parcelas<1 or v_parcelas>24) then raise exception 'Boleto aceita entre 1 e 24 parcelas'; end if;

  begin
    v_primeiro_vencimento:=(v_vencimentos->>0)::date;
  exception when others then
    raise exception 'Data de vencimento inválida';
  end;

  select f.id into v_fornecedor_id
  from public.fornecedores f
  where regexp_replace(coalesce(f.documento,''),'[^0-9]','','g')=v_cnpj
  order by f.ativo desc,f.created_at
  limit 1;

  if v_fornecedor_id is null then
    insert into public.fornecedores(nome,documento,ativo)
    values(v_nome,v_cnpj,true)
    returning id into v_fornecedor_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'itens')
  loop
    v_codigo_fornecedor:=nullif(btrim(coalesce(v_item->>'codigo_fornecedor','')),'');
    v_descricao_fornecedor:=nullif(btrim(coalesce(v_item->>'descricao','')),'');
    v_unidade:=upper(coalesce(nullif(btrim(v_item->>'unidade'),''),'UN'));
    v_quantidade:=coalesce((v_item->>'quantidade')::numeric,0);
    v_custo:=coalesce((v_item->>'valor_unitario')::numeric,0);
    v_produto_id:=nullif(v_item->>'produto_id','')::uuid;
    v_novo:=v_item->'novo_produto';

    if v_codigo_fornecedor is null or length(v_codigo_fornecedor)>120 then raise exception 'Código do produto do fornecedor inválido'; end if;
    if v_descricao_fornecedor is null then raise exception 'Descrição de produto da NF-e não informada'; end if;
    if v_quantidade<=0 or v_custo<0 then raise exception 'Quantidade ou valor unitário inválido no item %',v_codigo_fornecedor; end if;

    if v_produto_id is null then
      select d.produto_id into v_map_produto
      from public.de_para_produtos d
      join public.produtos p on p.id=d.produto_id
      where d.cnpj_fornecedor=v_cnpj
        and d.codigo_produto_fornecedor=v_codigo_fornecedor
        and p.ativo
      limit 1;
      v_produto_id:=v_map_produto;
    end if;

    if v_produto_id is null and jsonb_typeof(v_novo)='object' then
      v_codigo_interno:=nullif(btrim(coalesce(v_novo->>'codigo','')),'');
      if v_codigo_interno is null then
        v_codigo_interno:='NFE-'||right(v_cnpj,6)||'-'||left(regexp_replace(upper(v_codigo_fornecedor),'[^A-Z0-9]','','g'),20);
      end if;
      if exists(select 1 from public.produtos where codigo=v_codigo_interno) then
        raise exception 'Código interno % já existe. Escolha outro código',v_codigo_interno;
      end if;

      v_descricao_interna:=coalesce(nullif(btrim(v_novo->>'descricao'),''),v_descricao_fornecedor);
      v_preco_venda:=coalesce(nullif(v_novo->>'preco_venda','')::numeric,round(v_custo*2,2));

      insert into public.produtos(
        codigo,descricao,unidade,custo,custo_medio,preco_venda,
        estoque_atual,estoque_minimo,fornecedor_id,ativo,percentual_minimo_custo_venda
      )
      values(
        v_codigo_interno,v_descricao_interna,
        coalesce(nullif(btrim(v_novo->>'unidade'),''),v_unidade),
        v_custo,v_custo,v_preco_venda,0,0,v_fornecedor_id,true,100
      )
      returning id into v_produto_id;

      v_created_products:=v_created_products+1;
    end if;

    if v_produto_id is null then raise exception 'Produto % ainda não foi vinculado ao estoque',v_codigo_fornecedor; end if;
    if not exists(select 1 from public.produtos where id=v_produto_id and ativo) then
      raise exception 'Produto interno vinculado está inativo ou não existe';
    end if;

    insert into public.de_para_produtos(
      cnpj_fornecedor,codigo_produto_fornecedor,descricao_produto_fornecedor,produto_id,updated_at
    )
    values(v_cnpj,v_codigo_fornecedor,v_descricao_fornecedor,v_produto_id,now())
    on conflict(cnpj_fornecedor,codigo_produto_fornecedor)
    do update set produto_id=excluded.produto_id,
                  descricao_produto_fornecedor=excluded.descricao_produto_fornecedor,
                  updated_at=now();

    v_items_normalizados:=v_items_normalizados||jsonb_build_array(
      jsonb_build_object('produto_id',v_produto_id,'quantidade',v_quantidade,'custo_unitario',v_custo)
    );
  end loop;

  v_compra:=public.criar_compra_completa(
    v_fornecedor_id,'pedido_recebido',v_forma,v_parcelas,
    v_primeiro_vencimento,v_vencimentos,
    'NF-e '||v_numero||' importada via XML',
    v_items_normalizados
  );

  update public.compras
     set chave_nfe=v_chave,
         numero_nfe=v_numero,
         cnpj_fornecedor=v_cnpj,
         nome_fornecedor=v_nome,
         data_emissao=v_data_emissao,
         valor_total_nfe=v_total_nfe,
         total=v_total_nfe
   where id=v_compra.id
   returning * into v_compra;

  return jsonb_build_object(
    'compra_id',v_compra.id,
    'fatura_numero',v_compra.fatura_numero,
    'fornecedor_id',v_fornecedor_id,
    'total',v_compra.total,
    'produtos_criados',v_created_products
  );
end;
$$;

create or replace function public.importar_compra_nfe(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.importar_compra_nfe_impl(p_payload);
$$;

revoke all on function public.importar_compra_nfe(jsonb) from public,anon;
grant execute on function public.importar_compra_nfe(jsonb) to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.importar_compra_nfe_impl(jsonb) to authenticated;
