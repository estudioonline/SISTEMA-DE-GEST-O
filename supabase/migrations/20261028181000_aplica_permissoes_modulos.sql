begin;

-- CLIENTES
drop policy if exists clientes_read on public.clientes;
drop policy if exists clientes_insert on public.clientes;
drop policy if exists clientes_update on public.clientes;
create policy clientes_read on public.clientes for select to authenticated
using (private.usuario_pode('clientes','visualizar') or private.usuario_pode('vendas','visualizar') or private.usuario_pode('relatorios','visualizar'));
create policy clientes_insert on public.clientes for insert to authenticated with check (private.usuario_pode('clientes','editar'));
create policy clientes_update on public.clientes for update to authenticated
using (private.usuario_pode('clientes','editar')) with check (private.usuario_pode('clientes','editar'));

-- FORNECEDORES
drop policy if exists fornecedores_read on public.fornecedores;
drop policy if exists fornecedores_insert on public.fornecedores;
drop policy if exists fornecedores_update on public.fornecedores;
create policy fornecedores_read on public.fornecedores for select to authenticated
using (private.usuario_pode('fornecedores','visualizar') or private.usuario_pode('compras','visualizar') or private.usuario_pode('relatorios','visualizar'));
create policy fornecedores_insert on public.fornecedores for insert to authenticated with check (private.usuario_pode('fornecedores','editar'));
create policy fornecedores_update on public.fornecedores for update to authenticated
using (private.usuario_pode('fornecedores','editar')) with check (private.usuario_pode('fornecedores','editar'));

-- PRODUTOS / ESTOQUE
drop policy if exists produtos_read on public.produtos;
drop policy if exists produtos_insert on public.produtos;
drop policy if exists produtos_update on public.produtos;
create policy produtos_read on public.produtos for select to authenticated
using (private.usuario_pode('produtos','visualizar') or private.usuario_pode('vendas','visualizar') or private.usuario_pode('compras','visualizar') or private.usuario_pode('relatorios','visualizar'));
create policy produtos_insert on public.produtos for insert to authenticated
with check (private.usuario_pode('produtos','editar') or private.usuario_pode('compras','editar'));
create policy produtos_update on public.produtos for update to authenticated
using (private.usuario_pode('produtos','editar') or private.usuario_pode('compras','editar'))
with check (private.usuario_pode('produtos','editar') or private.usuario_pode('compras','editar'));

drop policy if exists movimentos_read on public.movimentos_estoque;
drop policy if exists movimentos_insert on public.movimentos_estoque;
drop policy if exists movimentos_update on public.movimentos_estoque;
create policy movimentos_read on public.movimentos_estoque for select to authenticated
using (private.usuario_pode('produtos','visualizar') or private.usuario_pode('relatorios','visualizar'));
create policy movimentos_insert on public.movimentos_estoque for insert to authenticated
with check (private.usuario_pode('produtos','editar') or private.usuario_pode('compras','editar') or private.usuario_pode('vendas','editar'));
create policy movimentos_update on public.movimentos_estoque for update to authenticated
using (private.usuario_pode('produtos','editar')) with check (private.usuario_pode('produtos','editar'));

-- VENDAS
drop policy if exists vendas_read on public.vendas;
drop policy if exists vendas_insert on public.vendas;
drop policy if exists vendas_update on public.vendas;
create policy vendas_read on public.vendas for select to authenticated
using (private.usuario_pode('vendas','visualizar') or private.usuario_pode('relatorios','visualizar') or private.usuario_pode('comissoes','visualizar') or private.usuario_pode('autorizacoes','visualizar'));
create policy vendas_insert on public.vendas for insert to authenticated with check (private.usuario_pode('vendas','editar'));
create policy vendas_update on public.vendas for update to authenticated
using (private.usuario_pode('vendas','editar') or private.usuario_pode('autorizacoes','editar'))
with check (private.usuario_pode('vendas','editar') or private.usuario_pode('autorizacoes','editar'));

drop policy if exists venda_itens_read on public.venda_itens;
drop policy if exists venda_itens_insert on public.venda_itens;
drop policy if exists venda_itens_update on public.venda_itens;
drop policy if exists venda_itens_delete on public.venda_itens;
create policy venda_itens_read on public.venda_itens for select to authenticated
using (private.usuario_pode('vendas','visualizar') or private.usuario_pode('relatorios','visualizar') or private.usuario_pode('comissoes','visualizar') or private.usuario_pode('autorizacoes','visualizar'));
create policy venda_itens_insert on public.venda_itens for insert to authenticated
with check (private.usuario_pode('vendas','editar') or private.usuario_pode('autorizacoes','editar'));
create policy venda_itens_update on public.venda_itens for update to authenticated
using (private.usuario_pode('vendas','editar') or private.usuario_pode('autorizacoes','editar'))
with check (private.usuario_pode('vendas','editar') or private.usuario_pode('autorizacoes','editar'));
create policy venda_itens_delete on public.venda_itens for delete to authenticated
using (private.usuario_pode('vendas','editar') or private.usuario_pode('autorizacoes','editar'));

-- COMPRAS
drop policy if exists compras_read on public.compras;
drop policy if exists compras_insert on public.compras;
drop policy if exists compras_update on public.compras;
create policy compras_read on public.compras for select to authenticated
using (private.usuario_pode('compras','visualizar') or private.usuario_pode('relatorios','visualizar'));
create policy compras_insert on public.compras for insert to authenticated with check (private.usuario_pode('compras','editar'));
create policy compras_update on public.compras for update to authenticated
using (private.usuario_pode('compras','editar')) with check (private.usuario_pode('compras','editar'));

drop policy if exists compra_itens_read on public.compra_itens;
drop policy if exists compra_itens_insert on public.compra_itens;
drop policy if exists compra_itens_update on public.compra_itens;
drop policy if exists compra_itens_delete on public.compra_itens;
create policy compra_itens_read on public.compra_itens for select to authenticated
using (private.usuario_pode('compras','visualizar') or private.usuario_pode('relatorios','visualizar'));
create policy compra_itens_insert on public.compra_itens for insert to authenticated with check (private.usuario_pode('compras','editar'));
create policy compra_itens_update on public.compra_itens for update to authenticated
using (private.usuario_pode('compras','editar')) with check (private.usuario_pode('compras','editar'));
create policy compra_itens_delete on public.compra_itens for delete to authenticated using (private.usuario_pode('compras','editar'));

-- FINANCEIRO
drop policy if exists titulos_read on public.titulos_financeiros;
drop policy if exists titulos_insert on public.titulos_financeiros;
drop policy if exists titulos_update on public.titulos_financeiros;
create policy titulos_read on public.titulos_financeiros for select to authenticated
using (private.usuario_pode('financeiro','visualizar') or private.usuario_pode('relatorios','visualizar'));
create policy titulos_insert on public.titulos_financeiros for insert to authenticated with check (private.usuario_pode('financeiro','editar'));
create policy titulos_update on public.titulos_financeiros for update to authenticated
using (private.usuario_pode('financeiro','editar')) with check (private.usuario_pode('financeiro','editar'));

drop policy if exists pagamentos_titulos_read on public.pagamentos_titulos;
drop policy if exists pagamentos_titulos_insert on public.pagamentos_titulos;
drop policy if exists pagamentos_titulos_update on public.pagamentos_titulos;
drop policy if exists pagamentos_titulos_delete on public.pagamentos_titulos;
create policy pagamentos_titulos_read on public.pagamentos_titulos for select to authenticated
using (private.usuario_pode('financeiro','visualizar') or private.usuario_pode('comissoes','visualizar'));
create policy pagamentos_titulos_insert on public.pagamentos_titulos for insert to authenticated with check (private.usuario_pode('financeiro','editar'));
create policy pagamentos_titulos_update on public.pagamentos_titulos for update to authenticated
using (private.usuario_pode('financeiro','editar')) with check (private.usuario_pode('financeiro','editar'));
create policy pagamentos_titulos_delete on public.pagamentos_titulos for delete to authenticated using (private.usuario_pode('financeiro','editar'));

drop policy if exists estornos_financeiro_select on public.estornos_pagamentos;
create policy estornos_financeiro_select on public.estornos_pagamentos for select to authenticated
using (private.usuario_pode('financeiro','visualizar') or private.usuario_pode('comissoes','visualizar'));

-- COMISSOES
drop policy if exists vendedores_read on public.vendedores;
drop policy if exists vendedores_insert on public.vendedores;
drop policy if exists vendedores_update on public.vendedores;
create policy vendedores_read on public.vendedores for select to authenticated
using (private.usuario_pode('vendas','visualizar') or private.usuario_pode('comissoes','visualizar'));
create policy vendedores_insert on public.vendedores for insert to authenticated with check (private.usuario_pode('comissoes','editar'));
create policy vendedores_update on public.vendedores for update to authenticated
using (private.usuario_pode('comissoes','editar')) with check (private.usuario_pode('comissoes','editar'));

drop policy if exists fechamentos_comissao_select on public.fechamentos_comissao;
drop policy if exists fechamentos_comissao_insert on public.fechamentos_comissao;
drop policy if exists fechamentos_comissao_update on public.fechamentos_comissao;
drop policy if exists fechamentos_comissao_delete on public.fechamentos_comissao;
create policy fechamentos_comissao_select on public.fechamentos_comissao for select to authenticated using (private.usuario_pode('comissoes','visualizar'));
create policy fechamentos_comissao_insert on public.fechamentos_comissao for insert to authenticated with check (private.usuario_pode('comissoes','editar'));
create policy fechamentos_comissao_update on public.fechamentos_comissao for update to authenticated
using (private.usuario_pode('comissoes','editar')) with check (private.usuario_pode('comissoes','editar'));
create policy fechamentos_comissao_delete on public.fechamentos_comissao for delete to authenticated using (private.usuario_pode('comissoes','editar'));

-- AUTORIZACOES
drop policy if exists aprovacoes_select on public.aprovacoes_operacoes;
drop policy if exists aprovacoes_insert on public.aprovacoes_operacoes;
drop policy if exists aprovacoes_admin_update on public.aprovacoes_operacoes;
create policy aprovacoes_select on public.aprovacoes_operacoes for select to authenticated
using (private.usuario_pode('autorizacoes','visualizar') or solicitado_por=(select auth.uid()));
create policy aprovacoes_insert on public.aprovacoes_operacoes for insert to authenticated
with check (
  solicitado_por=(select auth.uid()) and status='pendente' and aprovado_por is null and aprovado_em is null
  and (private.usuario_pode('vendas','editar') or private.usuario_pode('compras','editar') or private.usuario_pode('financeiro','editar'))
);
create policy aprovacoes_admin_update on public.aprovacoes_operacoes for update to authenticated
using (private.usuario_pode('autorizacoes','editar')) with check (private.usuario_pode('autorizacoes','editar'));

-- COMPROVANTES E DE/PARA
drop policy if exists comprovantes_read on public.comprovantes_pagamento;
drop policy if exists comprovantes_insert on public.comprovantes_pagamento;
drop policy if exists comprovantes_delete on public.comprovantes_pagamento;
create policy comprovantes_read on public.comprovantes_pagamento for select to authenticated
using (private.usuario_pode('vendas','visualizar') or private.usuario_pode('compras','visualizar') or private.usuario_pode('financeiro','visualizar'));
create policy comprovantes_insert on public.comprovantes_pagamento for insert to authenticated
with check (private.usuario_pode('vendas','editar') or private.usuario_pode('compras','editar') or private.usuario_pode('financeiro','editar'));
create policy comprovantes_delete on public.comprovantes_pagamento for delete to authenticated using (private.usuario_pode('financeiro','editar'));

drop policy if exists de_para_produtos_read on public.de_para_produtos;
drop policy if exists de_para_produtos_insert on public.de_para_produtos;
drop policy if exists de_para_produtos_update on public.de_para_produtos;
create policy de_para_produtos_read on public.de_para_produtos for select to authenticated
using (private.usuario_pode('compras','visualizar') or private.usuario_pode('produtos','visualizar'));
create policy de_para_produtos_insert on public.de_para_produtos for insert to authenticated
with check (private.usuario_pode('compras','editar') or private.usuario_pode('produtos','editar'));
create policy de_para_produtos_update on public.de_para_produtos for update to authenticated
using (private.usuario_pode('compras','editar') or private.usuario_pode('produtos','editar'))
with check (private.usuario_pode('compras','editar') or private.usuario_pode('produtos','editar'));

-- CONFIG
drop policy if exists empresa_config_read on public.empresa_config;
drop policy if exists empresa_config_insert on public.empresa_config;
drop policy if exists empresa_config_update on public.empresa_config;
create policy empresa_config_read on public.empresa_config for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo));
create policy empresa_config_insert on public.empresa_config for insert to authenticated with check (private.usuario_pode('config','editar'));
create policy empresa_config_update on public.empresa_config for update to authenticated
using (private.usuario_pode('config','editar')) with check (private.usuario_pode('config','editar'));

-- STORAGE DOS COMPROVANTES
drop policy if exists comprovantes_storage_read on storage.objects;
drop policy if exists comprovantes_storage_insert on storage.objects;
drop policy if exists comprovantes_storage_delete on storage.objects;
create policy comprovantes_storage_read on storage.objects for select to authenticated
using (
  bucket_id='comprovantes-pagamento'
  and (private.usuario_pode('vendas','visualizar') or private.usuario_pode('compras','visualizar') or private.usuario_pode('financeiro','visualizar'))
);
create policy comprovantes_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='comprovantes-pagamento'
  and (private.usuario_pode('vendas','editar') or private.usuario_pode('compras','editar') or private.usuario_pode('financeiro','editar'))
);
create policy comprovantes_storage_delete on storage.objects for delete to authenticated
using (bucket_id='comprovantes-pagamento' and private.usuario_pode('financeiro','editar'));

-- Atualiza validacoes legadas baseadas em perfil.
create or replace function private.situacao_credito_cliente_impl(p_cliente_id uuid,p_excluir_venda_id uuid default null)
returns table(limite_credito numeric,em_aberto numeric,vencido numeric)
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('vendas','editar') then
    raise exception 'Sem permissão para consultar situação de crédito na venda';
  end if;
  return query
  select coalesce(c.limite_credito,0),
         coalesce(sum(case when t.status not in ('pago','cancelado') then greatest(t.valor-t.valor_pago,0) else 0 end),0),
         coalesce(sum(case when t.status not in ('pago','cancelado') and t.vencimento<current_date then greatest(t.valor-t.valor_pago,0) else 0 end),0)
  from public.clientes c
  left join public.vendas v on v.cliente_id=c.id and v.status<>'cancelado' and (p_excluir_venda_id is null or v.id<>p_excluir_venda_id)
  left join public.titulos_financeiros t on t.venda_id=v.id and t.tipo='receber'
  where c.id=p_cliente_id
  group by c.limite_credito;
end;
$$;

do $do$
declare v_def text;
begin
  select pg_get_functiondef('public.importar_produtos_estoque(jsonb)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if not exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo
      and p.perfil in ('administrador','estoque')
  ) then
    raise exception 'Usuário sem permissão para importar produtos/estoque';
  end if;$old$,
    $new$if not private.usuario_pode('produtos','editar') then
    raise exception 'Sem permissão para importar produtos/estoque';
  end if;$new$
  );
  execute v_def;

  select pg_get_functiondef('private.validar_venda_final()'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if not exists(
        select 1 from public.profiles
        where id=auth.uid() and ativo and perfil in ('administrador','vendas')
      ) then
        raise exception 'Usuário sem permissão para alterar vendas';
      end if;

      select perfil='administrador'
        into v_admin
      from public.profiles
      where id=auth.uid() and ativo;$old$,
    $new$if not (
        private.usuario_pode('vendas','editar')
        or private.usuario_pode('autorizacoes','editar')
      ) then
        raise exception 'Usuário sem permissão para alterar vendas';
      end if;

      v_admin:=private.usuario_pode('autorizacoes','editar');$new$
  );
  execute v_def;

  select pg_get_functiondef('private.salvar_venda_erp_impl(uuid,jsonb,boolean)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('administrador','vendas')) then
 raise exception 'Sem permissão para salvar vendas'; end if;$old$,
    $new$if auth.uid() is null or not private.usuario_pode('vendas','editar') then
 raise exception 'Sem permissão para editar vendas'; end if;$new$
  );
  execute v_def;

  select pg_get_functiondef('private.solicitar_venda_impl(jsonb,text)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if auth.uid() is null
     or not exists(
       select 1 from public.profiles
       where id=auth.uid() and ativo and perfil in ('vendas','administrador')
     ) then
    raise exception 'Acesso não permitido';
  end if;$old$,
    $new$if auth.uid() is null or not private.usuario_pode('vendas','editar') then
    raise exception 'Sem permissão para solicitar autorização de venda';
  end if;$new$
  );
  execute v_def;

  select pg_get_functiondef('private.decidir_venda_impl(uuid,boolean,text)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if auth.uid() is null
         or not exists(
           select 1 from public.profiles
           where id=auth.uid() and ativo and perfil='administrador'
         ) then
        raise exception 'Somente administrador pode decidir';
      end if;$old$,
    $new$if auth.uid() is null or not private.usuario_pode('autorizacoes','editar') then
        raise exception 'Sem permissão para decidir autorizações';
      end if;$new$
  );
  execute v_def;

  select pg_get_functiondef('private.registrar_pagamento_impl(uuid,numeric,date,text)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('administrador','financeiro')) then raise exception 'Sem permissão para registrar pagamentos'; end if;$old$,
    $new$if auth.uid() is null or not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para registrar pagamentos'; end if;$new$
  );
  execute v_def;

  select pg_get_functiondef('private.estornar_pagamento_impl(uuid,date,text)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('administrador','financeiro')) then raise exception 'Sem permissão para estornar pagamentos'; end if;$old$,
    $new$if auth.uid() is null or not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para estornar pagamentos'; end if;$new$
  );
  execute v_def;

  select pg_get_functiondef('private.importar_compra_nfe_impl(jsonb)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if auth.uid() is null
     or not exists (
       select 1 from public.profiles p
       where p.id=auth.uid()
         and p.ativo
         and p.perfil in ('administrador','estoque')
     ) then
    raise exception 'Sem permissão para importar NF-e';
  end if;$old$,
    $new$if auth.uid() is null or not private.usuario_pode('compras','editar') then
    raise exception 'Sem permissão para importar NF-e';
  end if;$new$
  );
  execute v_def;

  select pg_get_functiondef('private.fechar_comissoes_impl(date,date,text)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil='administrador') then raise exception 'Somente administrador pode fechar comissões'; end if;$old$,
    $new$if auth.uid() is null or not private.usuario_pode('comissoes','editar') then raise exception 'Sem permissão para fechar comissões'; end if;$new$
  );
  execute v_def;

  select pg_get_functiondef('private.reabrir_comissoes_impl(uuid,text)'::regprocedure) into v_def;
  v_def:=replace(v_def,
    $old$if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil='administrador') then raise exception 'Somente administrador pode reabrir comissões'; end if;$old$,
    $new$if auth.uid() is null or not private.usuario_pode('comissoes','editar') then raise exception 'Sem permissão para reabrir comissões'; end if;$new$
  );
  execute v_def;
end
$do$;

commit;
