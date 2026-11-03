-- Endurecimento de seguranca do SG
-- Move RPCs SECURITY DEFINER publicas para implementacoes privadas,
-- remove superficie anonima e adiciona monitoramento interno.

do $$
declare
  r record;
  original_def text;
  private_name text;
  call_args text;
  wrapper_sql text;
  private_sig text;
begin
  grant usage on schema private to authenticated;

  for r in
    select
      p.oid,
      p.proname,
      pg_get_function_arguments(p.oid) as args,
      pg_get_function_identity_arguments(p.oid) as identity_args,
      pg_get_function_result(p.oid) as result_type,
      p.proretset,
      p.pronargs,
      p.proargnames
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef=true
  loop
    private_name := r.proname || '_impl';
    original_def := pg_get_functiondef(r.oid);

    original_def := regexp_replace(
      original_def,
      'CREATE OR REPLACE FUNCTION public\.' || r.proname || '\(',
      'CREATE OR REPLACE FUNCTION private.' || private_name || '('
    );

    execute original_def;

    call_args := '';
    if r.pronargs > 0 then
      select string_agg(format('%I', x.name), ', ')
        into call_args
      from (
        select r.proargnames[i] as name
        from generate_series(1, r.pronargs) as g(i)
        order by i
      ) x;
    end if;

    wrapper_sql := format(
      'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $f$ SELECT %s private.%I(%s); $f$;',
      r.proname,
      r.args,
      r.result_type,
      case when r.proretset then '* FROM' else '' end,
      private_name,
      coalesce(call_args,'')
    );

    execute wrapper_sql;

    private_sig := format('private.%I(%s)', private_name, r.identity_args);
    execute format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', private_sig);
    execute format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', private_sig);

    execute format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.identity_args);
    execute format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated;', r.proname, r.identity_args);
  end loop;
end
$$;

do $$
declare r record;
begin
  for r in
    select format('%I.%I', n.nspname, c.relname) as obj
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p','v','m','S')
  loop
    begin
      execute format('REVOKE ALL PRIVILEGES ON %s FROM anon', r.obj);
    exception when others then
      null;
    end;
  end loop;

  for r in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
  loop
    execute format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.fn);
    execute format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.fn);
  end loop;
end
$$;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

create or replace function private.monitoramento_seguranca_erp_impl()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_public_rls_off integer;
  v_public_definer integer;
  v_anon_functions integer;
  v_anon_tables integer;
begin
  if (select auth.uid()) is null or not private.usuario_pode('config','visualizar') then
    raise exception 'Sem permissão para visualizar o monitoramento de segurança';
  end if;

  select count(*) into v_public_rls_off
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relkind in ('r','p')
    and not c.relrowsecurity;

  select count(*) into v_public_definer
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prosecdef;

  select count(*) into v_anon_functions
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and pg_catalog.has_function_privilege('anon',p.oid,'execute');

  select count(*) into v_anon_tables
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relkind in ('r','p','v','m')
    and (
      pg_catalog.has_table_privilege('anon',c.oid,'select')
      or pg_catalog.has_table_privilege('anon',c.oid,'insert')
      or pg_catalog.has_table_privilege('anon',c.oid,'update')
      or pg_catalog.has_table_privilege('anon',c.oid,'delete')
    );

  return jsonb_build_object(
    'public_tables_without_rls',v_public_rls_off,
    'public_security_definer_functions',v_public_definer,
    'anon_executable_public_functions',v_anon_functions,
    'anon_accessible_public_tables',v_anon_tables,
    'score',case when v_public_rls_off+v_public_definer+v_anon_functions+v_anon_tables=0 then 100 else 80 end,
    'checked_at',now()
  );
end;
$$;

create or replace function public.monitoramento_seguranca_erp()
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.monitoramento_seguranca_erp_impl();
$$;

revoke all on function private.monitoramento_seguranca_erp_impl() from public,anon;
grant execute on function private.monitoramento_seguranca_erp_impl() to authenticated;
revoke all on function public.monitoramento_seguranca_erp() from public,anon;
grant execute on function public.monitoramento_seguranca_erp() to authenticated;
