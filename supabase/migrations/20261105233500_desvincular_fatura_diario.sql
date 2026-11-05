create or replace function private.desvincular_fatura_diario_impl(p_vinculo_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 l public.conciliacoes_bancarias%rowtype;
 tx public.transacoes_bancarias%rowtype;
 pg public.pagamentos_titulos%rowtype;
 t public.titulos_financeiros%rowtype;
 v_tx uuid; v_paid numeric; v_total numeric; v_status text;
 v_date date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if auth.uid() is null or not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para desvincular'; end if;
 if length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Informe o motivo com pelo menos 5 caracteres'; end if;
 select transacao_id into v_tx from public.conciliacoes_bancarias where id=p_vinculo_id;
 select * into tx from public.transacoes_bancarias where id=v_tx for update;
 if not found then raise exception 'Linha do diário não encontrada'; end if;
 select * into l from public.conciliacoes_bancarias where id=p_vinculo_id for update;
 if l.desfeito_em is not null then return jsonb_build_object('status',tx.status); end if;
 if l.titulo_id is null or l.pagamento_id is null then raise exception 'Vínculo sem pagamento de fatura'; end if;
 if private.data_financeira_fechada(tx.data_lancamento) or private.data_financeira_fechada(v_date) then raise exception 'Período financeiro encerrado'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('erp.commission_period',0));
 select * into t from public.titulos_financeiros where id=l.titulo_id for update;
 select * into pg from public.pagamentos_titulos where id=l.pagamento_id;
 if not found or pg.titulo_id<>t.id then raise exception 'Pagamento incompatível'; end if;
 if exists(select 1 from public.conciliacoes_bancarias where pagamento_id=pg.id and id<>l.id and desfeito_em is null) then raise exception 'Pagamento compartilhado por outro vínculo; revise a conciliação'; end if;
 if not exists(select 1 from public.estornos_pagamentos where pagamento_id=pg.id) then
  if pg.data_pagamento>v_date then raise exception 'Pagamento com data futura'; end if;
  if t.tipo='receber' and t.venda_id is not null and exists(select 1 from public.fechamentos_comissao where reaberto_em is null and v_date between inicio and fim) then raise exception 'Período de comissão fechado'; end if;
  -- Reverse only the allocation. The bank statement and journal balances stay intact.
  insert into public.estornos_pagamentos(pagamento_id,valor,data_estorno,motivo,criado_por)
  values(pg.id,pg.valor,v_date,btrim(p_motivo),auth.uid());
  select coalesce(sum(p.valor),0) into v_paid from public.pagamentos_titulos p where p.titulo_id=t.id;
  v_paid:=v_paid-coalesce((select sum(e.valor) from public.estornos_pagamentos e join public.pagamentos_titulos p on p.id=e.pagamento_id where p.titulo_id=t.id),0);
  update public.titulos_financeiros set valor_pago=v_paid,status=case when status='cancelado' then 'cancelado' when v_paid>=valor and valor>0 then 'pago' when v_paid>0 then 'parcial' else 'aberto' end where id=t.id;
 end if;
 update public.conciliacoes_bancarias set desfeito_em=now(),desfeito_por=auth.uid(),motivo_desfazer=btrim(p_motivo) where id=l.id;
 if not exists(select 1 from public.conciliacoes_bancarias where transacao_id=tx.id and titulo_id=t.id and desfeito_em is null) then
  update public.titulos_financeiros set conciliacao_fitids=array_remove(conciliacao_fitids,tx.fitid),
   conciliado_em=case when cardinality(array_remove(conciliacao_fitids,tx.fitid))=0 then null else conciliado_em end,
   conciliado_por=case when cardinality(array_remove(conciliacao_fitids,tx.fitid))=0 then null else conciliado_por end where id=t.id;
 end if;
 select coalesce(sum(c.valor+case when coalesce(c.valor_ajuste,0)=0 then 0 when c.tipo_ajuste='desconto_concedido' or (c.tipo_ajuste='tarifa' and tx.trntype='CREDIT') then -abs(c.valor_ajuste) else abs(c.valor_ajuste) end),0)
 into v_total from public.conciliacoes_bancarias c where c.transacao_id=tx.id and c.desfeito_em is null;
 v_status:=case when not exists(select 1 from public.conciliacoes_bancarias where transacao_id=tx.id and desfeito_em is null) then 'pendente' when abs(tx.valor)-v_total<=0.01 then 'conciliado' else 'parcial' end;
 update public.transacoes_bancarias set status=v_status where id=tx.id;
 return jsonb_build_object('status',v_status,'residual',greatest(abs(tx.valor)-v_total,0));
end $$;
revoke all on function private.desvincular_fatura_diario_impl(uuid,text) from public,anon;
grant execute on function private.desvincular_fatura_diario_impl(uuid,text) to authenticated;
create or replace function public.desvincular_fatura_diario(p_vinculo_id uuid,p_motivo text)
returns jsonb language sql security invoker set search_path='' as $$ select private.desvincular_fatura_diario_impl(p_vinculo_id,p_motivo); $$;
revoke all on function public.desvincular_fatura_diario(uuid,text) from public,anon;
grant execute on function public.desvincular_fatura_diario(uuid,text) to authenticated;
