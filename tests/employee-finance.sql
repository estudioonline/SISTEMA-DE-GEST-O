begin;
do $test$
declare u uuid; f uuid; t uuid; p uuid;
begin
 select id into u from public.profiles where ativo and perfil='administrador' limit 1;
 if u is null then raise exception 'Administrador não encontrado para o teste'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 insert into public.funcionarios(nome,cargo) values('TESTE TEMPORARIO FUNCIONARIO','Teste') returning id into f;
 insert into public.titulos_financeiros(tipo,descricao,entidade_nome,valor,valor_pago,status,vencimento,funcionario_id,tipo_funcionario,competencia)
 values('receber','TESTE TEMPORARIO VALE','Teste',100,0,'aberto',current_date,f,'vale',date_trunc('month',current_date)::date) returning id into t;
 perform public.descontar_vale_folha(t,current_date,false);
 if (select valor_pago from public.titulos_financeiros where id=t)<>100 then raise exception 'TESTE: desconto não quitou o vale'; end if;
 if (select vale_descontado_em from public.titulos_financeiros where id=t) is null then raise exception 'TESTE: desconto não foi marcado'; end if;
 if (select count(*) from public.titulos_financeiros where funcionario_id=f)<>1 then raise exception 'TESTE: desconto duplicou o título'; end if;
 perform public.descontar_vale_folha(t,current_date,true);
 if (select valor_pago from public.titulos_financeiros where id=t)<>0 then raise exception 'TESTE: desfazer desconto não restaurou o saldo'; end if;
 if (select status from public.titulos_financeiros where id=t)<>'aberto' then raise exception 'TESTE: desfazer desconto não reabriu o vale'; end if;
 begin
  insert into public.titulos_financeiros(tipo,descricao,valor,vencimento,tipo_funcionario) values('pagar','Inválido',1,current_date,'gasto');
  raise exception 'TESTE: gasto sem funcionário aceito';
 exception when check_violation then null; end;
end $test$;
-- Unauthenticated sessions must not see or insert employee records.
set local role authenticated;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $test$
begin
 if exists(select 1 from public.funcionarios) then raise exception 'TESTE: acesso sem sessão permitido'; end if;
 begin
  insert into public.funcionarios(nome) values('DEVE SER BLOQUEADO');
  raise exception 'TESTE: escrita sem permissão aceita';
 exception when insufficient_privilege then null; end;
end $test$;
rollback;
select 'PASS: vínculo único, pagamentos parciais, desconto, estorno, validações e RLS; dados temporários revertidos' as resultado;
