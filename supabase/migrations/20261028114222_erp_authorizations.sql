-- Rules are checked against the final transaction state, after all items exist.
create or replace function private.validar_venda_final()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_id uuid; v public.vendas%rowtype; cfg public.empresa_config%rowtype;
 v_admin boolean; v_sub numeric; v_desc numeric; v_cost numeric; v_count integer;
 v_open numeric; v_overdue numeric; v_limit numeric; r record; v_reasons jsonb:='[]';
begin
 v_id:=case when tg_table_name='vendas' then coalesce(new.id,old.id) else coalesce(new.venda_id,old.venda_id) end;
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
create constraint trigger erp_venda_final after insert or update of cliente_id,vendedor_cadastro_id,status,subtotal,desconto,total on public.vendas
deferrable initially deferred for each row execute function private.validar_venda_final();
create constraint trigger erp_venda_itens_final after insert or update or delete on public.venda_itens
deferrable initially deferred for each row execute function private.validar_venda_final();

alter table public.aprovacoes_operacoes add column if not exists payload jsonb;
alter table public.aprovacoes_operacoes add column if not exists resultado_id uuid;
alter table public.aprovacoes_operacoes add column if not exists decisao_motivo text;
create index if not exists erp_aprovacoes_status_data on public.aprovacoes_operacoes(status,solicitado_em desc);
-- Only controlled RPCs may write decisions. Existing records remain untouched.
revoke insert,update,delete on public.aprovacoes_operacoes from authenticated,anon;
grant select on public.aprovacoes_operacoes to authenticated;

create or replace function private.solicitar_venda_impl(p_payload jsonb,p_motivo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('vendas','administrador')) then raise exception 'Acesso não permitido'; end if;
 if length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Informe uma justificativa com pelo menos 5 caracteres'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'p_itens') is distinct from 'array'
 or jsonb_array_length(p_payload->'p_itens')=0 or jsonb_array_length(p_payload->'p_itens')>200 then raise exception 'Rascunho inválido'; end if;
 if nullif(p_payload->>'p_venda_id','') is not null then raise exception 'Solicitação disponível para novas vendas; edições exigem revisão direta do administrador'; end if;
 select id into v_id from public.aprovacoes_operacoes where solicitado_por=auth.uid() and status='pendente' and payload=p_payload limit 1;
 if found then return v_id; end if;
 insert into public.aprovacoes_operacoes(tipo,entidade_tipo,solicitado_por,status,motivo,payload,detalhes)
 values('alteracao_retroativa','venda',auth.uid(),'pendente',btrim(p_motivo),p_payload,jsonb_build_object('origem','central_vendas'))
 returning id into v_id;
 return v_id;
end; $$;
create or replace function public.solicitar_autorizacao_venda(p_payload jsonb,p_motivo text)
returns uuid language sql security invoker set search_path='' as $$
 select private.solicitar_venda_impl(p_payload,p_motivo);
$$;

create or replace function private.decidir_venda_impl(p_id uuid,p_aprovar boolean,p_motivo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.aprovacoes_operacoes%rowtype; v public.vendas%rowtype; p jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil='administrador') then raise exception 'Somente administrador pode decidir'; end if;
 if p_aprovar is null or length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Informe a justificativa da decisão'; end if;
 select * into a from public.aprovacoes_operacoes where id=p_id for update;
 if not found or a.status<>'pendente' or a.payload is null then raise exception 'Solicitação não está pendente ou não tem rascunho executável'; end if;
 if p_aprovar then
   if not exists(select 1 from public.profiles where id=a.solicitado_por and ativo) then raise exception 'Solicitante desativado'; end if;
   p:=a.payload;
   if p->>'p_status' not in ('orcamento','pedido','faturado') then raise exception 'Status inválido'; end if;
   if coalesce(p->>'p_rota_entrega','') not in ('norte','sul','leste','interestadual','retirada') then raise exception 'Rota obrigatória'; end if;
   perform set_config('app.allow_negative_stock','true',true);
   v:=public.criar_venda_completa(
     nullif(p->>'p_cliente_id','')::uuid,nullif(p->>'p_vendedor_cadastro_id','')::uuid,p->>'p_status',
     p->>'p_forma_pagamento',(p->>'p_parcelas')::integer,(p->>'p_primeiro_vencimento')::date,p->>'p_observacoes',p->'p_itens');
   update public.vendas set vendedor_id=a.solicitado_por,rota_entrega=p->>'p_rota_entrega',
     aprovado_por=auth.uid(),aprovado_em=now(),aprovacao_motivo=btrim(p_motivo),
     validade_orcamento=case when status='orcamento' then current_date+(select validade_orcamento_dias from public.empresa_config where id=1) else null end
   where id=v.id;
   -- Force deferred commercial checks before marking the request approved.
   set constraints public.erp_venda_final,public.erp_venda_itens_final immediate;
 end if;
 update public.aprovacoes_operacoes set status=case when p_aprovar then 'aprovado' else 'rejeitado' end,
 aprovado_por=auth.uid(),aprovado_em=now(),decisao_motivo=btrim(p_motivo),resultado_id=case when p_aprovar then v.id else null end
 where id=a.id;
 return case when p_aprovar then v.id else null end;
end; $$;
create or replace function public.decidir_autorizacao_venda(p_id uuid,p_aprovar boolean,p_motivo text)
returns uuid language sql security invoker set search_path='' as $$
 select private.decidir_venda_impl(p_id,p_aprovar,p_motivo);
$$;
revoke all on function private.validar_venda_final() from public,anon,authenticated;
revoke all on function private.solicitar_venda_impl(jsonb,text),private.decidir_venda_impl(uuid,boolean,text) from public,anon;
grant execute on function private.solicitar_venda_impl(jsonb,text),private.decidir_venda_impl(uuid,boolean,text) to authenticated;
revoke all on function public.solicitar_autorizacao_venda(jsonb,text),public.decidir_autorizacao_venda(uuid,boolean,text) from public,anon;
grant execute on function public.solicitar_autorizacao_venda(jsonb,text),public.decidir_autorizacao_venda(uuid,boolean,text) to authenticated;
