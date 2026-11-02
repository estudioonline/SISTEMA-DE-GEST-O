-- Saldo diário informado pelo extrato bancário.
alter table public.importacoes_bancarias
  add column if not exists saldo_extrato numeric,
  add column if not exists data_saldo date;

create or replace function public.registrar_saldo_extrato_bancario(
  p_importacao_id uuid,
  p_saldo numeric,
  p_data_saldo date
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_imp public.importacoes_bancarias%rowtype;
begin
  if auth.uid() is null or not private.usuario_pode('financeiro','editar') then
    raise exception 'Sem permissão para registrar saldo do extrato';
  end if;

  select * into v_imp
  from public.importacoes_bancarias
  where id=p_importacao_id;

  if v_imp.id is null then
    raise exception 'Importação bancária não encontrada';
  end if;

  update public.importacoes_bancarias
  set saldo_extrato=p_saldo,
      data_saldo=p_data_saldo
  where id=v_imp.id;

  update public.diarios_bancarios
  set saldo_atual=p_saldo,
      updated_at=now()
  where id=v_imp.diario_id;
end;
$$;

revoke execute on function public.registrar_saldo_extrato_bancario(uuid,numeric,date) from public,anon;
grant execute on function public.registrar_saldo_extrato_bancario(uuid,numeric,date) to authenticated;
