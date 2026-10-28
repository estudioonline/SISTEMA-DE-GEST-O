do $test$
declare
 u uuid; p uuid; v public.vendas%rowtype; t uuid; q uuid; n integer; before_stock numeric; payload jsonb; report jsonb:='[]';
begin
 begin
  select id into u from public.profiles where ativo and perfil='administrador' limit 1;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  insert into public.produtos(codigo,descricao,custo,preco_venda,estoque_atual,estoque_minimo,percentual_minimo_custo_venda)
  values('ERP-TEST-'||gen_random_uuid(),'Teste temporário ERP',0,100,10,0,0) returning id into p;
  payload:=jsonb_build_array(jsonb_build_object('produto_id',p,'quantidade',2,'valor_unitario',100,'desconto',0));
  v:=public.criar_venda_completa(null,null,'orcamento','pix',1,current_date,'Teste',payload);
  set constraints all immediate;
  if exists(select 1 from public.titulos_financeiros where venda_id=v.id) then raise exception 'TESTE: orçamento gerou cobrança'; end if;
  if (select estoque_atual from public.produtos where id=p)<>10 then raise exception 'TESTE: orçamento alterou estoque'; end if;
  report:=report||jsonb_build_array('Orçamento não gera títulos nem baixa estoque');
  set constraints all deferred;
  v:=public.atualizar_venda_completa(v.id,null,null,'pedido','pix',1,current_date,'Teste',payload);
  set constraints all immediate;
  if (select estoque_atual from public.produtos where id=p)<>8 then raise exception 'TESTE: baixa incorreta'; end if;
  select id into t from public.titulos_financeiros where venda_id=v.id;
  perform public.registrar_pagamento_titulo(t,50,current_date,'Teste temporário');
  set constraints all deferred;
  v:=public.atualizar_venda_completa(v.id,null,null,'faturado','pix',1,current_date,'Teste',payload);
  set constraints all immediate;
  if (select count(*) from public.titulos_financeiros where venda_id=v.id)<>1
   or (select valor_pago from public.titulos_financeiros where id=t)<>50
   or (select estoque_atual from public.produtos where id=p)<>8 then raise exception 'TESTE: parcelas ou estoque duplicados'; end if;
  report:=report||jsonb_build_array('Faturamento repetido preserva título, pagamento e estoque');
  begin
    update public.vendas set status='cancelado' where id=v.id;
    raise exception 'TESTE: cancelamento pago foi aceito';
  exception when others then
    if sqlerrm like 'TESTE:%' then raise; end if;
    report:=report||jsonb_build_array('Cancelamento de venda com pagamento bloqueado');
  end;
  payload:=jsonb_build_object('p_cliente_id',null,'p_vendedor_cadastro_id',null,'p_status','pedido','p_forma_pagamento','pix','p_parcelas',1,'p_primeiro_vencimento',current_date,'p_observacoes','Teste','p_rota_entrega','retirada','p_itens',payload);
  q:=public.solicitar_autorizacao_venda(payload,'Teste temporário');
  if q is distinct from public.solicitar_autorizacao_venda(payload,'Teste repetido') then raise exception 'TESTE: solicitação duplicada'; end if;
  p:=public.decidir_autorizacao_venda(q,true,'Aprovação de teste');
  if not exists(select 1 from public.vendas where id=p) then raise exception 'TESTE: aprovação não criou venda'; end if;
  begin
   perform public.decidir_autorizacao_venda(q,true,'Teste repetido');
   raise exception 'TESTE: aprovação repetida foi aceita';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
  end;
  report:=report||jsonb_build_array('Solicitação e aprovação protegidas contra repetição');
  set constraints all deferred;
  payload:=jsonb_set(payload,'{p_venda_id}',to_jsonb(p));
  q:=public.solicitar_autorizacao_venda(payload,'Editar venda temporária');
  perform public.decidir_autorizacao_venda(q,true,'Aprovar edição de teste');
  set constraints all deferred;
  q:=public.solicitar_autorizacao_venda(payload,'Teste de concorrência');
  update public.vendas set observacoes='Mudança posterior à solicitação' where id=p;
  begin
   perform public.decidir_autorizacao_venda(q,true,'Tentativa sobre versão antiga');
   raise exception 'TESTE: edição concorrente não foi detectada';
  exception when others then
   if sqlerrm like 'TESTE:%' then raise; end if;
   if sqlerrm not like 'A venda mudou após a solicitação%' then raise; end if;
  end;
  report:=report||jsonb_build_array('Edição autorizada funciona e detecta alteração concorrente');

  -- Restore all fixtures and business changes made in this block.
  raise exception using errcode='P0002',message='ERP_TEST_ROLLBACK';
 exception when no_data_found then
  if sqlerrm<>'ERP_TEST_ROLLBACK' then raise; end if;
 end;
 perform set_config('app.erp_test_report',report::text,true);
end; $test$;
select current_setting('app.erp_test_report')::jsonb as testes_aprovados;
