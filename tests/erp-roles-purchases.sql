do $test$
declare u uuid; p uuid; f uuid; c public.compras%rowtype; v public.vendas%rowtype; t uuid; q uuid; payload jsonb; report jsonb:='[]'; n integer;
begin
 begin
  select id into u from public.profiles where ativo and perfil='administrador' limit 1;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.produtos(codigo,descricao,custo,preco_venda,estoque_atual,estoque_minimo,percentual_minimo_custo_venda)
  values('ERP-TEST-'||gen_random_uuid(),'Teste temporário compras',0,100,10,0,0) returning id into p;
  insert into public.fornecedores(nome) values('Teste temporário ERP') returning id into f;
  payload:=jsonb_build_array(jsonb_build_object('produto_id',p,'quantidade',3,'custo_unitario',10));
  c:=public.criar_compra_completa(f,'pedido_aprovado','boleto',2,current_date,jsonb_build_array(current_date,current_date+30),'Teste',payload);
  if (select estoque_atual from public.produtos where id=p)<>10 then raise exception 'TESTE: aprovação da compra alterou estoque'; end if;
  select id into t from public.titulos_financeiros where compra_id=c.id order by parcela_numero limit 1;
  update public.compras set status='pedido_recebido' where id=c.id;
  update public.compras set status='pedido_recebido' where id=c.id;
  if (select estoque_atual from public.produtos where id=p)<>13 or (select count(*) from public.titulos_financeiros where compra_id=c.id)<>2
  or not exists(select 1 from public.titulos_financeiros where id=t) then raise exception 'TESTE: recebimento duplicou estoque ou títulos'; end if;
  update public.compras set status='cancelada' where id=c.id;
  if (select estoque_atual from public.produtos where id=p)<>10 then raise exception 'TESTE: cancelamento compra não estornou estoque'; end if;
  report:=report||jsonb_build_array('Compra: aprovação sem estoque, recebimento único, parcelas preservadas e estorno no cancelamento');
  update public.empresa_config set desconto_max_vendedor=10,margem_minima_percentual=0,campos_obrigatorios='{}' where id=1;
  update public.profiles set perfil='vendas' where id=u;
  set local role authenticated;
  begin
   payload:=jsonb_build_array(jsonb_build_object('produto_id',p,'quantidade',1,'valor_unitario',100,'desconto',20));
   v:=public.criar_venda_completa(null,null,'pedido','pix',1,current_date,'Teste desconto',payload);
   set constraints all immediate;
   raise exception 'TESTE: vendedor burlou limite de desconto';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'Venda exige autorização%' then raise; end if;
  end;
  report:=report||jsonb_build_array('Perfil vendas: limite comercial aplicado no banco sob papel authenticated');
  q:=public.solicitar_autorizacao_venda(jsonb_build_object('p_status','pedido','p_itens',payload),'Solicitação de teste');
  begin
   perform public.decidir_autorizacao_venda(q,true,'Tentativa sem perfil');
   raise exception 'TESTE: vendedor aprovou solicitação';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'Somente administrador%' then raise; end if;
  end;
  begin
   insert into public.aprovacoes_operacoes(tipo,entidade_tipo,status) values('desconto','venda','aprovado');
   raise exception 'TESTE: vendedor forjou aprovação';
  exception when insufficient_privilege then null;
  end;
  if exists(select 1 from public.titulos_financeiros) then raise exception 'TESTE: vendedor leu financeiro'; end if;
  report:=report||jsonb_build_array('Perfil vendas: decisão administrativa, aprovação forjada e leitura financeira negadas');
  reset role;
  raise exception using errcode='P0002',message='ERP_TEST_ROLLBACK';
 exception when no_data_found then
  if sqlerrm<>'ERP_TEST_ROLLBACK' then raise; end if;
 end;
 perform set_config('app.erp_security_report',report::text,true);
end; $test$;
select current_setting('app.erp_security_report')::jsonb as testes_aprovados;
