-- Last received purchase price for the product; FIFO layers for stock issues.
-- Existing stock is an opening balance. Historical sales are not recalculated.
LOCK TABLE public.produtos, public.compras, public.compra_itens,
  public.vendas, public.venda_itens, public.movimentos_estoque IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.compras ADD COLUMN recebida_estoque_em timestamptz;
UPDATE public.compras SET recebida_estoque_em=created_at WHERE status='pedido_recebido';
COMMENT ON COLUMN public.compras.recebida_estoque_em IS
  'Effective receipt ordering. Pre-PEPS receipts use original creation time because receipt time was not recorded.';

CREATE TABLE private.peps_saldos (
  produto_id uuid PRIMARY KEY REFERENCES public.produtos(id) ON DELETE CASCADE,
  deficit numeric NOT NULL DEFAULT 0 CHECK(deficit>=0),
  custo_abertura numeric NOT NULL,
  iniciado_em timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.peps_lotes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  compra_item_id uuid,
  quantidade_inicial numeric NOT NULL CHECK(quantidade_inicial>0),
  restante numeric NOT NULL CHECK(restante>=0),
  custo_unitario numeric NOT NULL,
  origem text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  estornado boolean NOT NULL DEFAULT false,
  CHECK(restante<=quantidade_inicial)
);
CREATE INDEX peps_lotes_disponiveis ON private.peps_lotes(produto_id,criado_em,id) WHERE restante>0 AND NOT estornado;
CREATE INDEX peps_lotes_compra_item ON private.peps_lotes(compra_item_id) WHERE compra_item_id IS NOT NULL;
CREATE TABLE private.peps_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  item_id uuid,
  origem text NOT NULL,
  delta numeric NOT NULL,
  custo_total numeric NOT NULL DEFAULT 0,
  provisorio boolean NOT NULL DEFAULT false,
  movimento_id uuid REFERENCES public.movimentos_estoque(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX peps_eventos_item ON private.peps_eventos(item_id,id) WHERE item_id IS NOT NULL;
CREATE TABLE private.peps_consumos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evento_id bigint NOT NULL REFERENCES private.peps_eventos(id) ON DELETE CASCADE,
  lote_id bigint REFERENCES private.peps_lotes(id),
  quantidade numeric NOT NULL CHECK(quantidade>0),
  devolvida numeric NOT NULL DEFAULT 0 CHECK(devolvida>=0 AND devolvida<=quantidade),
  custo_unitario numeric NOT NULL
);
CREATE INDEX peps_consumos_evento ON private.peps_consumos(evento_id);
CREATE INDEX peps_consumos_lote ON private.peps_consumos(lote_id) WHERE lote_id IS NOT NULL;
ALTER TABLE private.peps_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.peps_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.peps_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.peps_consumos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.peps_saldos, private.peps_lotes, private.peps_eventos, private.peps_consumos FROM PUBLIC,anon,authenticated;

INSERT INTO private.peps_saldos(produto_id,deficit,custo_abertura)
SELECT id,greatest(-estoque_atual,0),custo FROM public.produtos;
INSERT INTO private.peps_lotes(produto_id,quantidade_inicial,restante,custo_unitario,origem)
SELECT id,estoque_atual,estoque_atual,custo,'saldo_abertura' FROM public.produtos WHERE estoque_atual>0;

CREATE FUNCTION private.peps_inicializar_produto() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO private.peps_saldos(produto_id,deficit,custo_abertura)
 VALUES(new.id,greatest(-new.estoque_atual,0),new.custo);
 IF new.estoque_atual>0 THEN
  INSERT INTO private.peps_lotes(produto_id,quantidade_inicial,restante,custo_unitario,origem)
  VALUES(new.id,new.estoque_atual,new.estoque_atual,new.custo,'saldo_abertura');
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER peps_produto_novo AFTER INSERT ON public.produtos
FOR EACH ROW EXECUTE FUNCTION private.peps_inicializar_produto();

CREATE FUNCTION private.peps_recebimento_compra() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF new.status='pedido_recebido' AND (tg_op='INSERT' OR old.status IS DISTINCT FROM 'pedido_recebido') THEN
  new.recebida_estoque_em:=clock_timestamp();
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER peps_data_recebimento BEFORE INSERT OR UPDATE OF status ON public.compras
FOR EACH ROW EXECUTE FUNCTION private.peps_recebimento_compra();

CREATE OR REPLACE FUNCTION private.recalcular_custo_medio_produto(p_produto_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_custo numeric;
BEGIN
 -- Keep the legacy function and column names for existing UI/RPC compatibility.
 -- Both cost fields now reflect LAST RECEIVED PURCHASE, not a weighted mean.
 PERFORM 1 FROM public.produtos WHERE id=p_produto_id FOR UPDATE;
 SELECT ci.custo_unitario INTO v_custo
 FROM public.compra_itens ci JOIN public.compras c ON c.id=ci.compra_id
 WHERE ci.produto_id=p_produto_id AND c.status='pedido_recebido'
 ORDER BY c.recebida_estoque_em DESC NULLS LAST,c.created_at DESC,c.fatura_numero DESC,ci.id DESC LIMIT 1;
 IF NOT FOUND THEN
  SELECT custo_abertura INTO v_custo FROM private.peps_saldos WHERE produto_id=p_produto_id;
 END IF;
 IF v_custo IS NOT NULL THEN
  UPDATE public.produtos SET custo=v_custo,custo_medio=v_custo
  WHERE id=p_produto_id AND (custo IS DISTINCT FROM round(v_custo,2) OR custo_medio IS DISTINCT FROM v_custo);
 END IF;
END $$;

CREATE FUNCTION private.movimentar_estoque_contexto(p_produto_id uuid,p_delta numeric,p_tipo text,p_referencia text,p_contexto jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_anterior text:=current_setting('app.peps_contexto',true);
BEGIN
 PERFORM set_config('app.peps_contexto',p_contexto::text,true);
 PERFORM private.movimentar_estoque(p_produto_id,p_delta,p_tipo,p_referencia);
 PERFORM set_config('app.peps_contexto',coalesce(v_anterior,''),true);
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('app.peps_contexto',coalesce(v_anterior,''),true);
 RAISE;
END $$;

CREATE FUNCTION private.peps_alterar_estoque() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 ctx jsonb:=coalesce(nullif(current_setting('app.peps_contexto',true),'')::jsonb,'{}'::jsonb);
 origem text:=coalesce(ctx->>'origem','ajuste');
 item uuid:=nullif(ctx->>'item_id','')::uuid;
 delta numeric:=new.estoque_atual-old.estoque_atual;
 custo numeric:=coalesce((ctx->>'custo_unitario')::numeric,new.custo);
 falta numeric:=abs(delta); qtd numeric; divida numeric;
 v_total numeric:=0; provis boolean:=false;
 ev bigint; lote record; consumo record;
BEGIN
 IF delta=0 THEN RETURN new; END IF;
 PERFORM 1 FROM private.peps_saldos WHERE produto_id=new.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Saldo PEPS não inicializado para %',new.codigo; END IF;
 INSERT INTO private.peps_eventos(produto_id,item_id,origem,delta)
 VALUES(new.id,item,origem,delta) RETURNING id INTO ev;

 IF origem='compra' AND delta<0 THEN
  -- Reverse this receipt, never an unrelated (older) purchase layer.
  SELECT * INTO lote FROM private.peps_lotes
  WHERE produto_id=new.id AND compra_item_id=item AND NOT estornado ORDER BY id DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
   IF lote.restante<falta OR lote.quantidade_inicial<>falta THEN
    RAISE EXCEPTION 'Este lote já teve saídas. Estorne as saídas antes de alterar ou cancelar a compra.';
   END IF;
   v_total:=falta*lote.custo_unitario;
   UPDATE private.peps_lotes SET restante=restante-falta,estornado=true WHERE id=lote.id;
   falta:=0;
  END IF;
 END IF;

 IF origem='venda' AND delta>0 THEN
  -- Return to precisely the original layers, preserving their FIFO order/cost.
  FOR consumo IN
   SELECT c.* FROM private.peps_consumos c JOIN private.peps_eventos e ON e.id=c.evento_id
   WHERE e.produto_id=new.id AND e.item_id=item AND e.origem='venda' AND e.delta<0 AND c.devolvida<c.quantidade
   ORDER BY e.id DESC,c.id DESC FOR UPDATE OF c
  LOOP
   EXIT WHEN falta<=0;
   qtd:=least(falta,consumo.quantidade-consumo.devolvida);
   IF consumo.lote_id IS NOT NULL THEN
    UPDATE private.peps_lotes SET restante=restante+qtd WHERE id=consumo.lote_id AND NOT estornado;
    IF NOT FOUND THEN RAISE EXCEPTION 'O lote original da venda não está disponível para devolução'; END IF;
   ELSE
    SELECT deficit INTO divida FROM private.peps_saldos WHERE produto_id=new.id;
    UPDATE private.peps_saldos SET deficit=deficit-least(divida,qtd) WHERE produto_id=new.id;
    IF qtd>divida THEN
     INSERT INTO private.peps_lotes(produto_id,quantidade_inicial,restante,custo_unitario,origem)
     VALUES(new.id,qtd-divida,qtd-divida,consumo.custo_unitario,'devolucao_provisoria');
    END IF;
    provis:=true;
   END IF;
   UPDATE private.peps_consumos SET devolvida=devolvida+qtd WHERE id=consumo.id;
   v_total:=v_total+qtd*consumo.custo_unitario;
   falta:=falta-qtd;
  END LOOP;
  IF falta>0 THEN provis:=true; END IF; -- pre-cutover sale has no historic lot detail
 END IF;

 IF delta>0 AND falta>0 THEN
  SELECT deficit INTO divida FROM private.peps_saldos WHERE produto_id=new.id;
  qtd:=least(divida,falta);
  UPDATE private.peps_saldos SET deficit=deficit-qtd WHERE produto_id=new.id;
  IF origem='compra' OR falta>qtd THEN
   INSERT INTO private.peps_lotes(produto_id,compra_item_id,quantidade_inicial,restante,custo_unitario,origem,criado_em)
   VALUES(new.id,CASE WHEN origem='compra' THEN item END,falta,falta-qtd,custo,
      CASE WHEN origem='venda' THEN 'devolucao_legada' ELSE origem END,
      coalesce((SELECT min(l.criado_em) FROM private.peps_lotes l WHERE l.compra_item_id=item),clock_timestamp()));
  END IF;
  v_total:=v_total+falta*custo;
  falta:=0;
 ELSIF delta<0 AND falta>0 THEN
  FOR lote IN SELECT * FROM private.peps_lotes
   WHERE produto_id=new.id AND restante>0 AND NOT estornado ORDER BY criado_em,id FOR UPDATE
  LOOP
   EXIT WHEN falta<=0;
   qtd:=least(falta,lote.restante);
   UPDATE private.peps_lotes SET restante=restante-qtd WHERE id=lote.id;
   INSERT INTO private.peps_consumos(evento_id,lote_id,quantidade,custo_unitario)
   VALUES(ev,lote.id,qtd,lote.custo_unitario);
   v_total:=v_total+qtd*lote.custo_unitario;
   falta:=falta-qtd;
  END LOOP;
  IF falta>0 THEN
   -- Existing administrative negative-stock authorization is respected.
   UPDATE private.peps_saldos SET deficit=deficit+falta WHERE produto_id=new.id;
   INSERT INTO private.peps_consumos(evento_id,quantidade,custo_unitario) VALUES(ev,falta,custo);
   v_total:=v_total+falta*custo;
   provis:=true;
  END IF;
 END IF;
 IF (SELECT coalesce(sum(restante),0) FROM private.peps_lotes WHERE produto_id=new.id)
    -(SELECT deficit FROM private.peps_saldos WHERE produto_id=new.id)<>new.estoque_atual THEN
  RAISE EXCEPTION 'Saldo dos lotes PEPS não confere com o estoque de %',new.codigo;
 END IF;
 UPDATE private.peps_eventos SET custo_total=v_total,provisorio=provis WHERE id=ev;
 PERFORM set_config('app.peps_ultimo_evento',ev::text,true);
 RETURN new;
END $$;
CREATE TRIGGER peps_estoque_alterado AFTER UPDATE OF estoque_atual ON public.produtos
FOR EACH ROW WHEN(old.estoque_atual IS DISTINCT FROM new.estoque_atual)
EXECUTE FUNCTION private.peps_alterar_estoque();

ALTER TABLE public.movimentos_estoque ADD COLUMN custo_total_peps numeric,
 ADD COLUMN custo_unitario_peps numeric, ADD COLUMN custo_peps_provisorio boolean;
CREATE FUNCTION private.peps_identificar_movimento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ev private.peps_eventos%rowtype;
BEGIN
 SELECT * INTO ev FROM private.peps_eventos
 WHERE id=nullif(current_setting('app.peps_ultimo_evento',true),'')::bigint AND produto_id=new.produto_id AND movimento_id IS NULL;
 IF FOUND AND abs(ev.delta)=abs(new.quantidade) THEN
  new.custo_total_peps:=ev.custo_total;
  new.custo_unitario_peps:=ev.custo_total/abs(ev.delta);
  new.custo_peps_provisorio:=ev.provisorio;
 END IF;
 RETURN new;
END $$;
CREATE FUNCTION private.peps_vincular_movimento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF new.custo_total_peps IS NOT NULL THEN
  UPDATE private.peps_eventos SET movimento_id=new.id
  WHERE id=nullif(current_setting('app.peps_ultimo_evento',true),'')::bigint AND produto_id=new.produto_id AND movimento_id IS NULL;
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER peps_custo_movimento BEFORE INSERT ON public.movimentos_estoque
FOR EACH ROW EXECUTE FUNCTION private.peps_identificar_movimento();
CREATE TRIGGER peps_vinculo_movimento AFTER INSERT ON public.movimentos_estoque
FOR EACH ROW EXECUTE FUNCTION private.peps_vincular_movimento();

-- New helper functions are private implementation details, not public RPCs.
REVOKE ALL ON FUNCTION private.peps_inicializar_produto(),private.peps_recebimento_compra(),
 private.movimentar_estoque_contexto(uuid,numeric,text,text,jsonb),private.peps_alterar_estoque(),
 private.peps_identificar_movimento(),private.peps_vincular_movimento() FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION private.estoque_compra_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  perform set_config('app.purchase_delete_id',old.id::text,true);

  if private.compra_consumindo_estoque(old.status) then
    for r in
      select id,produto_id,quantidade,custo_unitario
      from public.compra_itens
      where compra_id=old.id
    loop
      perform private.movimentar_estoque_contexto(
        r.produto_id,-r.quantidade,'saida',
        'Exclusão de compra #' || lpad(coalesce(old.fatura_numero,0)::text,7,'0'),
        jsonb_build_object('origem','compra','item_id',r.id,'custo_unitario',r.custo_unitario)
      );
    end loop;
  end if;

  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION private.estoque_compra_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status text;
  v_numero bigint;
begin
  if tg_op='INSERT' then
    select status,fatura_numero into v_status,v_numero
    from public.compras where id=new.compra_id;

    if private.compra_consumindo_estoque(v_status) then
      perform private.movimentar_estoque_contexto(
        new.produto_id,new.quantidade,'entrada',
        'Compra #' || lpad(coalesce(v_numero,0)::text,7,'0'),
        jsonb_build_object('origem','compra','item_id',new.id,'custo_unitario',new.custo_unitario)
      );
    end if;
    return new;
  end if;

  if tg_op='UPDATE' then
    if new.compra_id is distinct from old.compra_id then
      raise exception 'Não é permitido mover item entre compras';
    end if;

    select status,fatura_numero into v_status,v_numero
    from public.compras where id=new.compra_id;

    if private.compra_consumindo_estoque(v_status)
       and (
         new.produto_id is distinct from old.produto_id
         or new.quantidade is distinct from old.quantidade
         or new.custo_unitario is distinct from old.custo_unitario
       ) then
      perform private.movimentar_estoque_contexto(
        old.produto_id,-old.quantidade,'saida',
        'Ajuste da compra #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - retirada',
        jsonb_build_object('origem','compra','item_id',old.id,'custo_unitario',old.custo_unitario)
      );
      perform private.movimentar_estoque_contexto(
        new.produto_id,new.quantidade,'entrada',
        'Ajuste da compra #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - nova entrada',
        jsonb_build_object('origem','compra','item_id',new.id,'custo_unitario',new.custo_unitario)
      );
    end if;
    return new;
  end if;

  if tg_op='DELETE' then
    if current_setting('app.purchase_delete_id',true)=old.compra_id::text then
      return old;
    end if;

    select status,fatura_numero into v_status,v_numero
    from public.compras where id=old.compra_id;

    if private.compra_consumindo_estoque(v_status) then
      perform private.movimentar_estoque_contexto(
        old.produto_id,-old.quantidade,'saida',
        'Ajuste da compra #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - item retirado',
        jsonb_build_object('origem','compra','item_id',old.id,'custo_unitario',old.custo_unitario)
      );
    end if;
    return old;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.estoque_compra_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  if old.status='cancelada' and new.status<>'cancelada' then
    raise exception 'Compra cancelada não pode ser reativada';
  end if;

  if private.compra_consumindo_estoque(old.status)
     and not private.compra_consumindo_estoque(new.status) then
    for r in
      select id,produto_id,quantidade,custo_unitario
      from public.compra_itens
      where compra_id=new.id
    loop
      perform private.movimentar_estoque_contexto(
        r.produto_id,-r.quantidade,'saida',
        'Cancelamento de compra #' || lpad(coalesce(new.fatura_numero,0)::text,7,'0'),
        jsonb_build_object('origem','compra','item_id',r.id,'custo_unitario',r.custo_unitario)
      );
    end loop;
  elsif not private.compra_consumindo_estoque(old.status)
        and private.compra_consumindo_estoque(new.status) then
    for r in
      select id,produto_id,quantidade,custo_unitario
      from public.compra_itens
      where compra_id=new.id
    loop
      perform private.movimentar_estoque_contexto(
        r.produto_id,r.quantidade,'entrada',
        'Compra #' || lpad(coalesce(new.fatura_numero,0)::text,7,'0'),
        jsonb_build_object('origem','compra','item_id',r.id,'custo_unitario',r.custo_unitario)
      );
    end loop;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.estoque_venda_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  perform set_config('app.sale_delete_id',old.id::text,true);

  if private.venda_consumindo_estoque(old.status) then
    for r in
      select id,produto_id,quantidade
      from public.venda_itens
      where venda_id=old.id
    loop
      perform private.movimentar_estoque_contexto(
        r.produto_id,r.quantidade,'entrada',
        'Devolução de venda excluída #' || lpad(coalesce(old.venda_numero,0)::text,7,'0'),
        jsonb_build_object('origem','venda','item_id',r.id)
      );
    end loop;
  end if;

  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION private.estoque_venda_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status text;
  v_numero bigint;
begin
  if tg_op='INSERT' then
    select status,venda_numero into v_status,v_numero
    from public.vendas where id=new.venda_id;

    if private.venda_consumindo_estoque(v_status) then
      perform private.movimentar_estoque_contexto(
        new.produto_id,-new.quantidade,'saida',
        'Venda #' || lpad(coalesce(v_numero,0)::text,7,'0'),
        jsonb_build_object('origem','venda','item_id',new.id)
      );
    end if;
    return new;
  end if;

  if tg_op='UPDATE' then
    if new.venda_id is distinct from old.venda_id then
      raise exception 'Não é permitido mover item entre vendas';
    end if;

    select status,venda_numero into v_status,v_numero
    from public.vendas where id=new.venda_id;

    if private.venda_consumindo_estoque(v_status)
       and (new.produto_id is distinct from old.produto_id or new.quantidade is distinct from old.quantidade) then
      perform private.movimentar_estoque_contexto(
        old.produto_id,old.quantidade,'entrada',
        'Ajuste da venda #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - retorno',
        jsonb_build_object('origem','venda','item_id',old.id)
      );
      perform private.movimentar_estoque_contexto(
        new.produto_id,-new.quantidade,'saida',
        'Ajuste da venda #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - nova saída',
        jsonb_build_object('origem','venda','item_id',new.id)
      );
    end if;
    return new;
  end if;

  if tg_op='DELETE' then
    if current_setting('app.sale_delete_id',true)=old.venda_id::text then
      return old;
    end if;

    select status,venda_numero into v_status,v_numero
    from public.vendas where id=old.venda_id;

    if private.venda_consumindo_estoque(v_status) then
      perform private.movimentar_estoque_contexto(
        old.produto_id,old.quantidade,'entrada',
        'Ajuste da venda #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - item devolvido',
        jsonb_build_object('origem','venda','item_id',old.id)
      );
    end if;
    return old;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.estoque_venda_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  if old.status='cancelado' and new.status<>'cancelado' then
    raise exception 'Venda cancelada não pode ser reativada';
  end if;

  if private.venda_consumindo_estoque(old.status)
     and not private.venda_consumindo_estoque(new.status) then
    for r in
      select id,produto_id,quantidade
      from public.venda_itens
      where venda_id=new.id
    loop
      perform private.movimentar_estoque_contexto(
        r.produto_id,
        r.quantidade,
        'entrada',
        'Devolução de venda cancelada #' || lpad(coalesce(new.venda_numero,0)::text,7,'0'),
        jsonb_build_object('origem','venda','item_id',r.id)
      );
    end loop;
  elsif not private.venda_consumindo_estoque(old.status)
        and private.venda_consumindo_estoque(new.status) then
    for r in
      select id,produto_id,quantidade
      from public.venda_itens
      where venda_id=new.id
    loop
      perform private.movimentar_estoque_contexto(
        r.produto_id,
        -r.quantidade,
        'saida',
        'Venda #' || lpad(coalesce(new.venda_numero,0)::text,7,'0'),
        jsonb_build_object('origem','venda','item_id',r.id)
      );
    end loop;
  end if;

  return new;
end;
$function$;


DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT id FROM public.produtos ORDER BY id LOOP
  PERFORM private.recalcular_custo_medio_produto(p.id);
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

