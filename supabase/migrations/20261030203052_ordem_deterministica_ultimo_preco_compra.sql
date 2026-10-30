-- Deterministic last line when a receipt maps multiple supplier lines to one product.
ALTER TABLE public.compra_itens ADD COLUMN ordem_entrada bigint GENERATED ALWAYS AS IDENTITY;
CREATE OR REPLACE FUNCTION private.recalcular_custo_medio_produto(p_produto_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_custo numeric;
BEGIN
 PERFORM 1 FROM public.produtos WHERE id=p_produto_id FOR UPDATE;
 SELECT ci.custo_unitario INTO v_custo
 FROM public.compra_itens ci JOIN public.compras c ON c.id=ci.compra_id
 WHERE ci.produto_id=p_produto_id AND c.status='pedido_recebido'
 ORDER BY c.recebida_estoque_em DESC NULLS LAST,c.created_at DESC,c.fatura_numero DESC,ci.ordem_entrada DESC LIMIT 1;
 IF NOT FOUND THEN
  SELECT custo_abertura INTO v_custo FROM private.peps_saldos WHERE produto_id=p_produto_id;
 END IF;
 IF v_custo IS NOT NULL THEN
  UPDATE public.produtos SET custo=v_custo,custo_medio=v_custo
  WHERE id=p_produto_id AND (custo IS DISTINCT FROM round(v_custo,2) OR custo_medio IS DISTINCT FROM v_custo);
 END IF;
END $$;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT DISTINCT produto_id FROM public.compra_itens LOOP
  PERFORM private.recalcular_custo_medio_produto(p.produto_id);
 END LOOP;
END $$;


-- Runs inside the migration transaction. Every fixture is rolled back by the
-- dedicated sentinel exception; any real error aborts the whole migration.
DO $tests$
DECLARE
 p uuid; p2 uuid; f uuid; c1 uuid; c2 uuid; c3 uuid;
 i1 uuid:=gen_random_uuid(); i2 uuid:=gen_random_uuid();
 sale uuid:=gen_random_uuid(); sale2 uuid:=gen_random_uuid();
 n bigint; actual numeric; blocked boolean;
BEGIN
 BEGIN
  INSERT INTO public.produtos(codigo,descricao,custo,custo_medio,estoque_atual)
  VALUES('__PEPS_TEST_1__','Validação temporária PEPS',100,100,10) RETURNING id INTO p;
  PERFORM private.movimentar_estoque_contexto(p,5,'entrada','TESTE PEPS lote 120',jsonb_build_object('origem','compra','item_id',i1,'custo_unitario',120));
  PERFORM private.movimentar_estoque_contexto(p,5,'entrada','TESTE PEPS lote 150',jsonb_build_object('origem','compra','item_id',i2,'custo_unitario',150));
  PERFORM private.movimentar_estoque_contexto(p,-12,'saida','TESTE PEPS saída',jsonb_build_object('origem','venda','item_id',sale));
  SELECT custo_total_peps INTO actual FROM public.movimentos_estoque WHERE produto_id=p ORDER BY created_at DESC,id DESC LIMIT 1;
  SELECT custo_total INTO actual FROM private.peps_eventos WHERE produto_id=p ORDER BY id DESC LIMIT 1;
  IF actual<>1240 THEN RAISE EXCEPTION 'PEPS: esperado 1240, encontrado %',actual; END IF;
  SELECT sum(restante*custo_unitario) INTO actual FROM private.peps_lotes WHERE produto_id=p;
  IF actual<>1110 THEN RAISE EXCEPTION 'Valor remanescente esperado 1110, encontrado %',actual; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.movimentos_estoque WHERE produto_id=p AND referencia='TESTE PEPS saída' AND custo_total_peps=1240 AND custo_peps_provisorio=false) THEN
   RAISE EXCEPTION 'Custo PEPS não vinculado à movimentação';
  END IF;
  blocked:=false;
  BEGIN
   PERFORM private.movimentar_estoque_contexto(p,-5,'saida','TESTE PEPS cancelar lote consumido',jsonb_build_object('origem','compra','item_id',i1,'custo_unitario',120));
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'Este lote já teve saídas.%' THEN RAISE; END IF;
   blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Compra consumida não foi protegida'; END IF;
  PERFORM private.movimentar_estoque_contexto(p,12,'entrada','TESTE PEPS devolução',jsonb_build_object('origem','venda','item_id',sale));
  IF EXISTS(SELECT 1 FROM private.peps_lotes WHERE produto_id=p AND restante<>quantidade_inicial) THEN
   RAISE EXCEPTION 'Devolução não restaurou os lotes originais';
  END IF;
  PERFORM private.movimentar_estoque_contexto(p,-5,'saida','TESTE PEPS cancelar lote livre',jsonb_build_object('origem','compra','item_id',i1,'custo_unitario',120));
  IF (SELECT estoque_atual FROM public.produtos WHERE id=p)<>15 THEN RAISE EXCEPTION 'Saldo após estorno incorreto'; END IF;
  UPDATE public.produtos SET estoque_atual=estoque_atual-2 WHERE id=p;
  SELECT custo_total INTO actual FROM private.peps_eventos WHERE produto_id=p ORDER BY id DESC LIMIT 1;
  IF actual<>200 THEN RAISE EXCEPTION 'Ajuste manual não consumiu o lote antigo'; END IF;

  INSERT INTO public.produtos(codigo,descricao,custo,custo_medio,estoque_atual)
  VALUES('__PEPS_TEST_2__','Validação temporária PEPS negativo',80,80,0) RETURNING id INTO p2;
  PERFORM set_config('app.allow_negative_stock','true',true);
  PERFORM private.movimentar_estoque_contexto(p2,-3,'saida','TESTE PEPS negativo',jsonb_build_object('origem','venda','item_id',sale2));
  IF NOT EXISTS(SELECT 1 FROM private.peps_eventos WHERE produto_id=p2 AND provisorio AND custo_total=240) THEN RAISE EXCEPTION 'Negativo sem custo provisório'; END IF;
  PERFORM private.movimentar_estoque_contexto(p2,5,'entrada','TESTE PEPS cobrir negativo',jsonb_build_object('origem','compra','item_id',gen_random_uuid(),'custo_unitario',90));
  IF (SELECT deficit FROM private.peps_saldos WHERE produto_id=p2)<>0 OR (SELECT sum(restante) FROM private.peps_lotes WHERE produto_id=p2)<>2 THEN
   RAISE EXCEPTION 'Recebimento não compensou o deficit';
  END IF;
  PERFORM private.movimentar_estoque_contexto(p2,3,'entrada','TESTE PEPS devolução provisória',jsonb_build_object('origem','venda','item_id',sale2));
  IF (SELECT estoque_atual FROM public.produtos WHERE id=p2)<>5 THEN RAISE EXCEPTION 'Devolução provisória incorreta'; END IF;

  -- Actual purchase-item/status triggers, latest price and old-receipt editing.
  INSERT INTO public.fornecedores(nome) VALUES('Fornecedor temporário de validação PEPS') RETURNING id INTO f;
  SELECT coalesce(max(fatura_numero),0)+10000 INTO n FROM public.compras;
  INSERT INTO public.compras(fornecedor_id,status,total,fatura_numero,vencimentos_parcelas,valores_parcelas) VALUES(f,'cotacao',200,n,jsonb_build_array(current_date::text),jsonb_build_array(200)) RETURNING id INTO c1;
  INSERT INTO public.compra_itens(compra_id,produto_id,quantidade,custo_unitario,total) VALUES(c1,p2,2,100,200);
  UPDATE public.compras SET status='pedido_recebido' WHERE id=c1;
  IF (SELECT custo FROM public.produtos WHERE id=p2)<>100 THEN RAISE EXCEPTION 'Último custo não atualizado no recebimento'; END IF;
  INSERT INTO public.compras(fornecedor_id,status,total,fatura_numero,vencimentos_parcelas,valores_parcelas) VALUES(f,'pedido_recebido',360,n+1,jsonb_build_array(current_date::text),jsonb_build_array(360)) RETURNING id INTO c2;
  INSERT INTO public.compra_itens(compra_id,produto_id,quantidade,custo_unitario,total) VALUES(c2,p2,3,120,360);
  IF (SELECT custo FROM public.produtos WHERE id=p2)<>120 OR (SELECT custo_medio FROM public.produtos WHERE id=p2)<>120 THEN RAISE EXCEPTION 'Foi usada média no lugar do último custo'; END IF;
  UPDATE public.compra_itens SET custo_unitario=90,total=180 WHERE compra_id=c1;
  IF (SELECT custo FROM public.produtos WHERE id=p2)<>120 THEN RAISE EXCEPTION 'Edição de compra antiga substituiu o último custo'; END IF;
  UPDATE public.compras SET status='cancelada' WHERE id=c2;
  IF (SELECT custo FROM public.produtos WHERE id=p2)<>90 THEN RAISE EXCEPTION 'Cancelamento não restaurou o custo da compra anterior'; END IF;

  INSERT INTO public.compras(fornecedor_id,status,total,fatura_numero,vencimentos_parcelas,valores_parcelas) VALUES(f,'pedido_recebido',800,n+2,jsonb_build_array(current_date::text),jsonb_build_array(800)) RETURNING id INTO c3;
  INSERT INTO public.compra_itens(compra_id,produto_id,quantidade,custo_unitario,total) VALUES(c3,p2,1,500,500);
  INSERT INTO public.compra_itens(compra_id,produto_id,quantidade,custo_unitario,total) VALUES(c3,p2,1,300,300);
  IF (SELECT custo FROM public.produtos WHERE id=p2)<>300 THEN RAISE EXCEPTION 'Última linha da mesma compra não definiu o último custo'; END IF;

  IF EXISTS(SELECT 1 FROM public.produtos pr JOIN private.peps_saldos s ON s.produto_id=pr.id
    WHERE pr.id IN (p,p2) AND pr.estoque_atual<>(SELECT coalesce(sum(restante),0) FROM private.peps_lotes WHERE produto_id=pr.id)-s.deficit) THEN
   RAISE EXCEPTION 'Divergência entre lotes e estoque';
  END IF;
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='PEPS tests passed; discard all fixtures';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
END $tests$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.produtos WHERE codigo LIKE '__PEPS_TEST_%') THEN
  RAISE EXCEPTION 'Uma validação temporária permaneceu no cadastro';
 END IF;
END $$;

