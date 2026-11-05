-- Transactional integration test: all fixtures and changes are rolled back.
begin;
do $test$
declare a uuid; j uuid; tx uuid; t1 uuid; t2 uuid; l1 uuid; l2 uuid; result jsonb; denied boolean:=false; n bigint;
begin
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.desvincular_fatura_diario(gen_random_uuid(),'teste sem acesso');
 exception when others then if sqlerrm not like '%Sem permissão%' then raise; end if; denied:=true; end;
 assert denied,'Unauthenticated access must fail';
 select id into a from public.profiles where ativo and perfil='administrador' limit 1;
 perform set_config('request.jwt.claim.sub',a::text,true);
 insert into public.diarios_bancarios(nome) values('TEST-UNLINK-'||gen_random_uuid()) returning id into j;
 insert into public.transacoes_bancarias(diario_id,fitid,trntype,valor,data_lancamento) values(j,gen_random_uuid()::text,'CREDIT',200,current_date) returning id into tx;
 insert into public.titulos_financeiros(tipo,descricao,vencimento,valor,forma_pagamento) values('receber','TEST UNLINK A',current_date,100,'cartao') returning id into t1;
 insert into public.titulos_financeiros(tipo,descricao,vencimento,valor,forma_pagamento) values('receber','TEST UNLINK B',current_date,150,'cartao') returning id into t2;
 perform public.conciliar_transacao_bancaria(tx,jsonb_build_array(jsonb_build_object('titulo_id',t1,'valor',100),jsonb_build_object('titulo_id',t2,'valor',100)));
 select id into l1 from public.conciliacoes_bancarias where transacao_id=tx and titulo_id=t1;
 select id into l2 from public.conciliacoes_bancarias where transacao_id=tx and titulo_id=t2;
 select count(*) into n from public.transacoes_bancarias;
 result:=public.desvincular_fatura_diario(l1,'Teste integração individual');
 assert result->>'status'='parcial' and (result->>'residual')::numeric=100,'Incorrect remaining allocation';
 assert (select valor_pago=0 and status='aberto' from public.titulos_financeiros where id=t1),'Selected invoice not reopened';
 assert (select valor_pago=100 and status='parcial' from public.titulos_financeiros where id=t2),'Other invoice changed';
 assert (select desfeito_em is null from public.conciliacoes_bancarias where id=l2),'Other link changed';
 assert (select count(*) from public.transacoes_bancarias)=n,'Unlink must not create bank movements';
 perform public.desvincular_fatura_diario(l1,'Repetição idempotente');
 assert (select count(*) from public.estornos_pagamentos e join public.conciliacoes_bancarias c on c.pagamento_id=e.pagamento_id where c.id=l1)=1,'Duplicate reversal';
 result:=public.desvincular_fatura_diario(l2,'Desvincular último vínculo');
 assert result->>'status'='pendente' and (result->>'residual')::numeric=200,'Last unlink must reopen transaction';
 assert (select valor=200 from public.transacoes_bancarias where id=tx),'Statement amount changed';
end $test$;
rollback;
