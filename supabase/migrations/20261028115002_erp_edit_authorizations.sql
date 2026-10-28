create or replace function private.hash_venda(p_id uuid)
returns text language sql security invoker set search_path='' as $$
 select md5((to_jsonb(v)-'fatura_gerada_em')::text||coalesce(
 (select jsonb_agg(to_jsonb(i) order by i.id)::text from public.venda_itens i where i.venda_id=v.id),'[]'))
 from public.vendas v where v.id=p_id;
$$;
revoke all on function private.hash_venda(uuid) from public,anon,authenticated;
create or replace function private.solicitar_venda_impl(p_payload jsonb,p_motivo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_sale uuid; v_base text;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('vendas','administrador')) then raise exception 'Acesso não permitido'; end if;
 if length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Informe uma justificativa com pelo menos 5 caracteres'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'p_itens') is distinct from 'array'
 or jsonb_array_length(p_payload->'p_itens')=0 or jsonb_array_length(p_payload->'p_itens')>200 then raise exception 'Rascunho inválido'; end if;
 v_sale:=nullif(p_payload->>'p_venda_id','')::uuid;
 if v_sale is not null then
   perform 1 from public.vendas where id=v_sale and status<>'cancelado' for update;
   if not found then raise exception 'Venda não encontrada ou cancelada'; end if;
   v_base:=private.hash_venda(v_sale);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_payload::text,0));
 select id into v_id from public.aprovacoes_operacoes where solicitado_por=auth.uid() and status='pendente' and payload=p_payload limit 1;
 if found then return v_id; end if;
 insert into public.aprovacoes_operacoes(tipo,entidade_tipo,entidade_id,solicitado_por,status,motivo,payload,detalhes)
 values('alteracao_retroativa','venda',v_sale,auth.uid(),'pendente',btrim(p_motivo),p_payload,jsonb_build_object('origem','central_vendas','base_hash',v_base))
 returning id into v_id;
 return v_id;
end; $$;
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
   set constraints public.erp_venda_final,public.erp_venda_itens_final deferred;
   perform set_config('app.allow_negative_stock','true',true);
   if a.entidade_id is not null then
     perform 1 from public.vendas where id=a.entidade_id for update;
     if private.hash_venda(a.entidade_id) is distinct from a.detalhes->>'base_hash' then
       raise exception 'A venda mudou após a solicitação. Recarregue e envie uma nova solicitação.';
     end if;
     v:=public.atualizar_venda_completa(a.entidade_id,
       nullif(p->>'p_cliente_id','')::uuid,nullif(p->>'p_vendedor_cadastro_id','')::uuid,p->>'p_status',
       p->>'p_forma_pagamento',(p->>'p_parcelas')::integer,(p->>'p_primeiro_vencimento')::date,p->>'p_observacoes',p->'p_itens');
   else
   v:=public.criar_venda_completa(
     nullif(p->>'p_cliente_id','')::uuid,nullif(p->>'p_vendedor_cadastro_id','')::uuid,p->>'p_status',
     p->>'p_forma_pagamento',(p->>'p_parcelas')::integer,(p->>'p_primeiro_vencimento')::date,p->>'p_observacoes',p->'p_itens');
   end if;
   update public.vendas set vendedor_id=case when a.entidade_id is null then a.solicitado_por else vendedor_id end,rota_entrega=p->>'p_rota_entrega',
     aprovado_por=auth.uid(),aprovado_em=now(),aprovacao_motivo=btrim(p_motivo),
     validade_orcamento=case when status='orcamento' then current_date+(select validade_orcamento_dias from public.empresa_config where id=1) else null end
   where id=v.id;
   if exists(select 1 from public.venda_itens i join public.produtos pr on pr.id=i.produto_id where i.venda_id=v.id and pr.estoque_atual<0) then
     update public.vendas set estoque_negativo_autorizado_por=auth.uid(),estoque_negativo_autorizado_em=now() where id=v.id;
   end if;
   -- Force deferred commercial checks before marking the request approved.
   set constraints public.erp_venda_final,public.erp_venda_itens_final immediate;
 end if;
 update public.aprovacoes_operacoes set status=case when p_aprovar then 'aprovado' else 'rejeitado' end,
 aprovado_por=auth.uid(),aprovado_em=now(),decisao_motivo=btrim(p_motivo),resultado_id=case when p_aprovar then v.id else null end
 where id=a.id;
 return case when p_aprovar then v.id else null end;
end; $$;
