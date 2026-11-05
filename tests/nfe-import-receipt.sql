-- Integration regression: fixtures and all their changes are rolled back.
BEGIN;
DO $test$
DECLARE
  admin_id uuid;
  product_id uuid;
  new_product_id uuid;
  purchase_id uuid;
  result jsonb;
  payload jsonb;
  suffix text := replace(gen_random_uuid()::text,'-','');
  blocked boolean := false;
BEGIN
  SELECT id INTO admin_id FROM public.profiles WHERE ativo AND perfil='administrador' LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'An active administrator is required for this test'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.importar_compra_nfe('{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Sem permissão%' THEN RAISE; END IF;
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Unauthenticated import must be denied'; END IF;
  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
  INSERT INTO public.produtos(codigo,descricao,unidade,custo,custo_medio,preco_venda,estoque_atual,ativo)
    VALUES ('TEST-NFE-'||suffix,'Temporary NF-e regression product','UN',10,10,60,7,true)
    RETURNING id INTO product_id;
  payload := jsonb_build_object(
    'chave_nfe',lpad((extract(epoch from clock_timestamp())*1000000)::bigint::text,44,'0'),
    'numero_nfe','TEST-'||suffix,
    'cnpj_fornecedor','00000000000000','nome_fornecedor','Temporary NF-e regression supplier',
    'data_emissao',current_date::text,'valor_total',100,'forma_pagamento','boleto',
    'vencimentos',jsonb_build_array((current_date+30)::text,(current_date+60)::text),
    'valores_parcelas',jsonb_build_array(35,65),
    'itens',jsonb_build_array(
      jsonb_build_object('codigo_fornecedor','EXIST-'||suffix,'descricao','Existing product','unidade','UN','quantidade',2,'valor_unitario',30,'produto_id',product_id),
      jsonb_build_object('codigo_fornecedor','NEW-'||suffix,'descricao','New product','unidade','UN','quantidade',1,'valor_unitario',40,
        'novo_produto',jsonb_build_object('codigo','TEST-NEW-'||suffix,'descricao','Temporary new NF-e product','unidade','UN','preco_venda',80))
    )
  );
  result := public.importar_compra_nfe(payload);
  purchase_id := (result->>'compra_id')::uuid;
  SELECT id INTO STRICT new_product_id FROM public.produtos WHERE codigo='TEST-NEW-'||suffix;
  IF NOT EXISTS(SELECT 1 FROM public.compras WHERE id=purchase_id AND status='pedido_aprovado' AND recebida_estoque_em IS NULL)
    THEN RAISE EXCEPTION 'Import must create an approved order awaiting receipt'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.produtos WHERE id=product_id AND estoque_atual=7 AND custo=10)
    THEN RAISE EXCEPTION 'Import changed existing stock or cost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.produtos WHERE id=new_product_id AND estoque_atual=0)
    THEN RAISE EXCEPTION 'New product must have no received stock'; END IF;
  IF EXISTS(SELECT 1 FROM public.movimentos_estoque WHERE produto_id IN (product_id,new_product_id))
    THEN RAISE EXCEPTION 'Import must not create stock movements'; END IF;
  IF (SELECT count(*) FROM public.compra_itens WHERE compra_id=purchase_id)<>2
    THEN RAISE EXCEPTION 'Imported items were not preserved'; END IF;
  IF (SELECT count(*) FROM public.titulos_financeiros WHERE compra_id=purchase_id AND status='aberto')<>2
    OR (SELECT sum(valor) FROM public.titulos_financeiros WHERE compra_id=purchase_id)<>100
    OR NOT EXISTS(SELECT 1 FROM public.titulos_financeiros WHERE compra_id=purchase_id AND parcela_numero=1 AND valor=35 AND vencimento=current_date+30)
    OR NOT EXISTS(SELECT 1 FROM public.titulos_financeiros WHERE compra_id=purchase_id AND parcela_numero=2 AND valor=65 AND vencimento=current_date+60)
    THEN RAISE EXCEPTION 'Invoice installments were not preserved'; END IF;
  UPDATE public.compras SET status='pedido_recebido' WHERE id=purchase_id;
  IF NOT EXISTS(SELECT 1 FROM public.produtos WHERE id=product_id AND estoque_atual=9 AND custo=30)
    OR NOT EXISTS(SELECT 1 FROM public.produtos WHERE id=new_product_id AND estoque_atual=1 AND custo=40)
    THEN RAISE EXCEPTION 'Explicit receipt must update stock and cost'; END IF;
  UPDATE public.compras SET status='pedido_recebido' WHERE id=purchase_id;
  IF (SELECT estoque_atual FROM public.produtos WHERE id=product_id)<>9
    OR (SELECT count(*) FROM public.movimentos_estoque WHERE produto_id IN (product_id,new_product_id))<>2
    THEN RAISE EXCEPTION 'Receipt must not duplicate stock'; END IF;
END;
$test$;
ROLLBACK;
