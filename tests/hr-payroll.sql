begin;
do $test$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='titulos_financeiros' and policyname='rh_restringe_leitura_folha' and permissive='RESTRICTIVE') then
  raise exception 'TESTE: folha não está protegida por política restritiva';
 end if;
end;
$test$;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where ativo and perfil='administrador' limit 1),true);
set local role authenticated;
do $test$
declare f uuid; t uuid;
begin
 insert into public.funcionarios(nome,cargo) values('QA RH TEMPORARIO','Teste revertido') returning id into f;
 insert into public.titulos_financeiros(tipo,descricao,entidade_nome,valor,valor_pago,status,vencimento,funcionario_id,tipo_funcionario,competencia,categoria,salario_bruto,descontos_folha,vales_folha)
 values('pagar','QA folha temporaria','QA RH TEMPORARIO',1700,0,'aberto',current_date,f,'gasto',date_trunc('month',current_date)::date,'Salário',2000,200,100) returning id into t;
 if (select valor from public.titulos_financeiros where id=t)<>1700 then raise exception 'TESTE: líquido incorreto'; end if;
 begin
  update public.titulos_financeiros set valor=2000 where id=t;
  raise exception 'TESTE: bruto foi aceito como valor financeiro';
 exception when check_violation then null; end;
 begin
  update public.titulos_financeiros set descontos_folha=-1 where id=t;
  raise exception 'TESTE: desconto negativo aceito';
 exception when check_violation then null; end;
 begin
  update public.titulos_financeiros set vales_folha=null where id=t;
  raise exception 'TESTE: folha parcial aceita';
 exception when check_violation then null; end;
 perform public.registrar_pagamento_titulo(t,100,current_date,'QA pagamento temporario');
 begin
  update public.titulos_financeiros set salario_bruto=2100,descontos_folha=300 where id=t;
  raise exception 'TESTE: referências de folha paga foram alteradas';
 exception when check_violation then null; end;
 -- FGTS is a separate obligation with no payroll gross/deductions.
 insert into public.titulos_financeiros(tipo,descricao,valor,vencimento,funcionario_id,tipo_funcionario,competencia,categoria)
 values('pagar','QA FGTS temporario',160,current_date,f,'gasto',date_trunc('month',current_date)::date,'FGTS');
 if (select sum(valor) from public.titulos_financeiros where funcionario_id=f)<>1860 then raise exception 'TESTE: totais duplicados'; end if;
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $test$
begin
 if exists(select 1 from public.funcionarios) then raise exception 'TESTE: funcionários acessíveis sem sessão'; end if;
 begin
  insert into public.funcionarios(nome) values('QA DEVE SER BLOQUEADO');
  raise exception 'TESTE: escrita sem acesso permitida';
 exception when insufficient_privilege then null; end;
end;
$test$;
rollback;
select 'PASS: líquido, descontos, FGTS, referências pagas e RLS; todos os registros temporários revertidos' as resultado;
