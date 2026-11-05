-- Imported invoices create approved orders; receipt remains an explicit action.
-- Preserve the current function's validation, permissions and supplier mappings.
DO $migration$
DECLARE
  definition text;
  previous_call constant text := $old$v_fornecedor_id,'pedido_recebido',v_forma,v_parcelas$old$;
  next_call constant text := $new$v_fornecedor_id,'pedido_aprovado',v_forma,v_parcelas$new$;
BEGIN
  SELECT pg_get_functiondef('private.importar_compra_nfe_impl(jsonb)'::regprocedure) INTO definition;
  IF position(previous_call IN definition)>0 THEN
    EXECUTE replace(definition, previous_call, next_call);
  ELSIF position(next_call IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected NF-e import implementation; status change was not applied';
  END IF;
END;
$migration$;
