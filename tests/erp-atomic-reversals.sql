do $test$
declare u uuid; p uuid; seller uuid; v public.vendas%rowtype; again public.vendas%rowtype; req uuid:=gen_random_uuid(); payload jsonb;
 t uuid; payment uuid; closure public.fechamentos_comissao%rowtype; r public.estornos_pagamentos%rowtype; report jsonb:='[]';
begin
 begin
  select id into u from public.profiles where ativo and perfil='administrador' limit 1;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.vendedores(nome,percentual_comissao) values('Teste temporário estornos',10) returning id into seller;
  insert into public.produtos(codigo,descricao,custo,preco_venda,estoque_atual,estoque_minimo,percentual_minimo_custo_venda)
  values('ERP-TEST-'||gen_random_uuid(),'Teste temporário atômico',0,100,10,0,0) returning id into p;
  payload:=jsonb_build_object('p_cliente_id',null,'p_vendedor_cadastro_id',seller,'p_status','pedido','p_forma_pagamento','pix','p_parcelas',1,
   'p_primeiro_vencimento',current_date,'p_observacoes','Teste','p_rota_entrega','retirada',
   'p_itens',jsonb_build_array(jsonb_build_object('produto_id',p,'quantidade',1,'valor_unitario',100,'desconto',0)));
  set local role authenticated;
  v:=public.salvar_venda_erp(req,payload,false);
  again:=public.salvar_venda_erp(req,payload,false);
  if v.id<>again.id or (select estoque_atual from public.produtos where id=p)<>9 or v.rota_entrega<>'retirada' then raise exception 'TESTE: venda ou estoque duplicado'; end if;
  begin
   perform public.salvar_venda_erp(req,jsonb_set(payload,'{p_observacoes}','"Outro rascunho"'),false);
   raise exception 'TESTE: chave repetida aceitou outros dados';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'Esta requisição já foi concluída%' then raise; end if;
  end;
  begin
   perform public.salvar_venda_erp(gen_random_uuid(),jsonb_set(payload,'{p_rota_entrega}','"invalida"'),false);
   raise exception 'TESTE: rota inválida foi aceita';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'Informe uma rota%' then raise; end if;
  end;
  report:=report||jsonb_build_array('Venda completa, rota, idempotência e rejeição de requisição alterada');
  select id into t from public.titulos_financeiros where venda_id=v.id;
  perform public.registrar_pagamento_titulo(t,100,current_date,'Pagamento de teste');
  select id into payment from public.pagamentos_titulos where titulo_id=t;
  if (select comissao_apurada from public.comissoes_por_periodo(current_date,current_date) where vendedor_id=seller)<>10 then raise exception 'TESTE: comissão original incorreta'; end if;
  closure:=public.fechar_comissoes_erp(current_date,current_date,'Fechamento de teste');
  begin
   perform public.estornar_pagamento_erp(payment,current_date,'Teste em período fechado');
   raise exception 'TESTE: estorno em período fechado aceito';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'Período de comissão fechado%' then raise; end if;
  end;
  perform public.reabrir_comissoes_erp(closure.id,'Reabertura de teste');
  r:=public.estornar_pagamento_erp(payment,current_date,'Compensação de teste');
  if (select valor_pago from public.titulos_financeiros where id=t)<>0 or not exists(select 1 from public.pagamentos_titulos where id=payment) then raise exception 'TESTE: estorno apagou pagamento ou saldo incorreto'; end if;
  if (select comissao_apurada from public.comissoes_por_periodo(current_date,current_date) where vendedor_id=seller)<>0 then raise exception 'TESTE: comissão não foi compensada'; end if;
  begin
   perform public.estornar_pagamento_erp(payment,current_date,'Tentativa repetida');
   raise exception 'TESTE: estorno duplicado aceito';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'Este pagamento já foi estornado%' then raise; end if;
  end;
  update public.vendas set status='cancelado' where id=v.id;
  if (select estoque_atual from public.produtos where id=p)<>10 then raise exception 'TESTE: cancelamento após estorno não devolveu estoque'; end if;
  report:=report||jsonb_build_array('Estorno compensa saldo e comissão, mantém original, bloqueia repetição e permite cancelamento após saldo zero',
  'Fechamento bloqueia retroativos; reabertura justificada preserva histórico');
  insert into public.categorias_financeiras(nome,tipo) values('ERP teste categoria '||req,'ambos');
  begin
   insert into public.categorias_financeiras(nome,tipo) values('ERP teste categoria '||req,'ambos');
   raise exception 'TESTE: categoria duplicada aceita';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'Categoria já cadastrada%' then raise; end if;
  end;
  report:=report||jsonb_build_array('Cadastros financeiros recusam nomes duplicados');
  reset role;
  update public.profiles set perfil='vendas' where id=u;
  set local role authenticated;
  begin
   perform public.estornar_pagamento_erp(payment,current_date,'Tentativa de vendedor');
   raise exception 'TESTE: vendedor conseguiu estornar';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'Sem permissão%' then raise; end if;
  end;
  if exists(select 1 from public.fechamentos_comissao) then raise exception 'TESTE: vendedor leu resumo do fechamento'; end if;
  if exists(select 1 from public.estornos_pagamentos) then raise exception 'TESTE: vendedor leu estornos financeiros'; end if;
  report:=report||jsonb_build_array('Perfil vendas não estorna nem lê os estornos financeiros');
  reset role;
  raise exception using errcode='P0002',message='ERP_TEST_ROLLBACK';
 exception when no_data_found then
  if sqlerrm<>'ERP_TEST_ROLLBACK' then raise; end if;
 end;
 perform set_config('app.erp_next_test_report',report::text,true);
end; $test$;
select current_setting('app.erp_next_test_report')::jsonb as testes_aprovados;
