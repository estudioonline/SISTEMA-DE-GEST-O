create schema if not exists private;

create or replace function private.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auditoria_log(
    tabela,registro_id,acao,usuario_id,dados_antes,dados_depois
  )
  values (
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'),(to_jsonb(old)->>'id')),
    tg_op,
    (select auth.uid()),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new,old);
end;
$$;

revoke all on function private.registrar_auditoria() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'clientes','fornecedores','produtos','vendas','compras',
    'titulos_financeiros','pagamentos_titulos','vendedores','empresa_config'
  ]
  loop
    execute format('drop trigger if exists trg_auditoria_%I on public.%I',t,t);
    execute format(
      'create trigger trg_auditoria_%I after insert or update or delete on public.%I for each row execute function private.registrar_auditoria()',
      t,t
    );
  end loop;
end $$;

drop function if exists public.registrar_auditoria();
