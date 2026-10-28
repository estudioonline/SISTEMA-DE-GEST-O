-- Run as postgres in a single transaction. Every test write is rolled back.
begin;
set local role service_role;
do $$
declare actor uuid; sid uuid; source jsonb; first_claim jsonb; second_claim jsonb; result jsonb;
begin
 select id into actor from public.profiles where perfil='administrador' and ativo limit 1;
 select v.id into sid from public.vendas v where status in ('pedido','faturado')
 and not exists(select 1 from public.aprovacoes_operacoes a where a.status='pendente' and (a.entidade_id=v.id or a.payload->>'p_venda_id'=v.id::text))
 and not exists(select 1 from public.notas_fiscais_teste n where n.venda_id=v.id) limit 1;
 if actor is null or sid is null then raise exception 'Test requires an active admin and a confirmed sale without a fiscal record.'; end if;
 source:=public.focus_backend_erp('sale',actor,jsonb_build_object('venda_id',sid));
 first_claim:=public.focus_backend_erp('claim',actor,jsonb_build_object('venda_id',sid,'source_hash',source->>'source_hash','dados_fiscais','{}'::jsonb,'payload',jsonb_build_object('test_transaction',true)));
 second_claim:=public.focus_backend_erp('claim',actor,jsonb_build_object('venda_id',sid,'source_hash',source->>'source_hash','dados_fiscais','{}'::jsonb,'payload','{}'::jsonb));
 if not (first_claim->>'claimed')::boolean or (second_claim->>'claimed')::boolean then raise exception 'Duplicate emission was not blocked.'; end if;
 if first_claim->'nota'->>'referencia' is distinct from second_claim->'nota'->>'referencia' then raise exception 'Reference changed.'; end if;
 perform public.focus_backend_erp('result',actor,jsonb_build_object('venda_id',sid,'status','autorizado','retorno',jsonb_build_object('status','autorizado')));
 result:=public.focus_backend_erp('result',actor,jsonb_build_object('venda_id',sid,'status','processando_autorizacao','retorno','{}'::jsonb));
 if result->>'status'<>'autorizado' then raise exception 'An older consultation downgraded authorization.'; end if;
 begin
  perform public.focus_backend_erp('config',gen_random_uuid(),'{}'::jsonb);
  raise exception 'Invalid actor accepted.';
 exception when insufficient_privilege then null;
 end;
end; $$;
reset role;
set local role authenticated;
do $$ begin
 begin
  perform public.focus_backend_erp('config',gen_random_uuid(),'{}'::jsonb);
  raise exception 'Client obtained internal RPC access.';
 exception when insufficient_privilege then null;
 end;
end; $$;
rollback;
