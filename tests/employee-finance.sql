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
 values('pagar','TESTE TEMPORARIO VALE','Teste',100,0,'aberto',current_date,f,'vale',date_trunc('month',current_date)::date) returning id into t;
 begin
  update public.titulos_financeiros set vale_descontado_em=current_date where id=t;
  raise exception 'TESTE: vale não pago foi descontado';
 exception when check_violation then null; end;
 perform public.registrar_pagamento_titulo(t,40,current_date,'Pagamento parcial temporário');
 if (select valor_pago from public.titulos_financeiros where id=t)<>40 then raise exception 'TESTE: pagamento parcial inválido'; end if;
 perform public.registrar_pagamento_titulo(t,60,current_date,'Pagamento final temporário');
 update public.titulos_financeiros set vale_descontado_em=current_date where id=t;
 if (select count(*) from public.titulos_financeiros where funcionario_id=f)<>1 then raise exception 'TESTE: desconto duplicou o título'; end if;
 if (select valor_pago from public.titulos_financeiros where id=t)<>100 then raise exception 'TESTE: desconto alterou o pagamento'; end if;
 select id into p from public.pagamentos_titulos where titulo_id=t order by created_at,id limit 1;
 begin
  perform public.estornar_pagamento_erp(p,current_date,'Teste com desconto ativo');
  raise exception 'TESTE: estorno deixou vale descontado e não pago';
 exception when check_violation then null; end;
 update public.titulos_financeiros set vale_descontado_em=null where id=t;
 perform public.estornar_pagamento_erp(p,current_date,'Estorno temporário após desfazer desconto');
 if (select status from public.titulos_financeiros where id=t)<>'parcial' then raise exception 'TESTE: estorno não atualizou saldo'; end if;
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
