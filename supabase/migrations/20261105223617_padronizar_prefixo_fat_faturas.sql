-- Standard invoice display prefix for payable titles, matching receivables.
-- The stored invoice numbers, installments, payments and balances are preserved.
DO $migration$
DECLARE
  definition text;
  old_expression constant text := $old$'Fatura compra '||lpad(new.fatura_numero::text,7,'0')||$old$;
  new_expression constant text := $new$'FAT'||lpad(new.fatura_numero::text,greatest(5,length(new.fatura_numero::text)),'0')||$new$;
  before_rows jsonb;
  after_rows jsonb;
BEGIN
  SELECT pg_get_functiondef('private.sincronizar_titulos_compra()'::regprocedure) INTO definition;
  IF position(old_expression IN definition)>0 THEN
    EXECUTE replace(definition,old_expression,new_expression);
  ELSIF position(new_expression IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected purchase title generator; invoice prefix not updated';
  END IF;

  SELECT jsonb_agg(to_jsonb(t)-'descricao' ORDER BY t.id) INTO before_rows
    FROM public.titulos_financeiros t;
  UPDATE public.titulos_financeiros t
    SET descricao='FAT'||lpad(c.fatura_numero::text,greatest(5,length(c.fatura_numero::text)),'0')||
      regexp_replace(t.descricao,'^Fatura compra [0-9]+','')
    FROM public.compras c
    WHERE t.compra_id=c.id AND c.fatura_numero IS NOT NULL
      AND t.descricao ~ '^Fatura compra [0-9]+';
  UPDATE public.titulos_financeiros t
    SET descricao='FAT'||lpad(f.numero::text,greatest(5,length(f.numero::text)),'0')||
      regexp_replace(t.descricao,'^Fatura venda [0-9]+','')
    FROM public.faturas_vendas f
    WHERE t.fatura_venda_id=f.id
      AND t.descricao ~ '^Fatura venda [0-9]+';
  SELECT jsonb_agg(to_jsonb(t)-'descricao' ORDER BY t.id) INTO after_rows
    FROM public.titulos_financeiros t;
  IF before_rows IS DISTINCT FROM after_rows THEN
    RAISE EXCEPTION 'Prefix migration must only change invoice descriptions';
  END IF;
END;
$migration$;
