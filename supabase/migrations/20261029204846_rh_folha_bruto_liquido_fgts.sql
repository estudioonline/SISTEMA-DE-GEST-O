begin;

-- Additive payroll references. Existing titles, balances and payments stay intact.
-- The financial amount is the net payable, never gross plus net.
alter table public.titulos_financeiros
 add column salario_bruto numeric(14,2),
 add column descontos_folha numeric(14,2),
 add column vales_folha numeric(14,2),
 add constraint titulo_rh_folha_valida check (
  (salario_bruto is null and descontos_folha is null and vales_folha is null)
  or
  (salario_bruto is not null and descontos_folha is not null and vales_folha is not null
   and funcionario_id is not null and tipo_funcionario='gasto' and tipo='pagar'
   and categoria is not null and categoria in ('Salário','13º salário')
   and salario_bruto>0 and salario_bruto<=999999999
   and descontos_folha between 0 and 999999999
   and vales_folha between 0 and 999999999
   and salario_bruto>descontos_folha+vales_folha
   and valor=salario_bruto-descontos_folha-vales_folha)
 );

comment on column public.titulos_financeiros.salario_bruto is
 'Referência informada da folha. O valor financeiro é o líquido; null conserva lançamentos anteriores sem bruto conhecido.';
comment on column public.titulos_financeiros.descontos_folha is
 'Outros descontos informados na folha, excluindo os vales registrados em vales_folha. Não calcula alíquotas.';
comment on column public.titulos_financeiros.vales_folha is
 'Valor dos vales efetivamente abatidos, informado e conferido na folha. Marcação dos vales permanece manual e não gera pagamentos.';

create function private.proteger_referencias_folha_paga()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.valor_pago>0 and
  row(new.salario_bruto,new.descontos_folha,new.vales_folha)
  is distinct from row(old.salario_bruto,old.descontos_folha,old.vales_folha) then
  raise exception 'A folha já possui pagamento. Preserve o histórico e faça o ajuste financeiro pelo procedimento de estorno.' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function private.proteger_referencias_folha_paga() from public,anon,authenticated;
create trigger rh_proteger_referencias_folha_paga
 before update on public.titulos_financeiros
 for each row execute function private.proteger_referencias_folha_paga();

-- No new grants or policies: RH inherits existing Financeiro read/edit permissions.
commit;
