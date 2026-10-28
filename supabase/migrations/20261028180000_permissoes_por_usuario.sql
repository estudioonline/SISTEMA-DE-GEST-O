begin;

create table if not exists public.usuario_permissoes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  modulo text not null,
  nivel text not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,modulo),
  constraint usuario_permissoes_modulo_check check (
    modulo in ('dashboard','vendas','clientes','fornecedores','produtos','compras','comissoes','financeiro','autorizacoes','relatorios','config')
  ),
  constraint usuario_permissoes_nivel_check check (
    nivel in ('nenhum','visualizar','editar')
  )
);

alter table public.usuario_permissoes enable row level security;
revoke all on table public.usuario_permissoes from anon;
revoke insert,update,delete on table public.usuario_permissoes from authenticated;
grant select on table public.usuario_permissoes to authenticated;

drop policy if exists usuario_permissoes_self_read on public.usuario_permissoes;
create policy usuario_permissoes_self_read
on public.usuario_permissoes
for select
to authenticated
using (user_id=(select auth.uid()));

create or replace function private.permissao_padrao_perfil(p_perfil text,p_modulo text)
returns text
language sql
immutable
set search_path=''
as $$
  select case p_perfil
    when 'administrador' then
      case when p_modulo in ('dashboard','relatorios') then 'visualizar' else 'editar' end
    when 'financeiro' then
      case
        when p_modulo in ('dashboard','clientes','fornecedores','relatorios') then 'visualizar'
        when p_modulo='financeiro' then 'editar'
        else 'nenhum'
      end
    when 'vendas' then
      case
        when p_modulo in ('dashboard','produtos','comissoes','autorizacoes','relatorios') then 'visualizar'
        when p_modulo in ('vendas','clientes') then 'editar'
        else 'nenhum'
      end
    when 'estoque' then
      case
        when p_modulo in ('dashboard','relatorios') then 'visualizar'
        when p_modulo in ('fornecedores','produtos','compras') then 'editar'
        else 'nenhum'
      end
    else
      case
        when p_modulo in ('dashboard','vendas','clientes','relatorios') then 'visualizar'
        else 'nenhum'
      end
  end;
$$;

create or replace function private.nivel_permissao_usuario(p_user_id uuid,p_modulo text)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    (select up.nivel
       from public.usuario_permissoes up
      where up.user_id=p_user_id and up.modulo=p_modulo),
    private.permissao_padrao_perfil(
      (select p.perfil from public.profiles p where p.id=p_user_id),
      p_modulo
    ),
    'nenhum'
  );
$$;

create or replace function private.usuario_pode(p_modulo text,p_nivel text default 'visualizar')
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_nivel text;
  v_rank integer;
  v_required integer;
begin
  if v_uid is null then return false; end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.ativo) then return false; end if;
  if p_nivel not in ('visualizar','editar') then return false; end if;
  v_nivel:=private.nivel_permissao_usuario(v_uid,p_modulo);
  v_rank:=case v_nivel when 'editar' then 2 when 'visualizar' then 1 else 0 end;
  v_required:=case p_nivel when 'editar' then 2 else 1 end;
  return v_rank>=v_required;
end;
$$;

create or replace function private.aplicar_permissoes_padrao(p_user_id uuid,p_perfil text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_modulo text;
begin
  delete from public.usuario_permissoes where user_id=p_user_id;
  foreach v_modulo in array array[
    'dashboard','vendas','clientes','fornecedores','produtos','compras',
    'comissoes','financeiro','autorizacoes','relatorios','config'
  ]
  loop
    insert into public.usuario_permissoes(user_id,modulo,nivel)
    values(p_user_id,v_modulo,private.permissao_padrao_perfil(p_perfil,v_modulo));
  end loop;
end;
$$;

do $$
declare r record;
begin
  for r in select id,perfil from public.profiles loop
    if not exists(select 1 from public.usuario_permissoes up where up.user_id=r.id) then
      perform private.aplicar_permissoes_padrao(r.id,r.perfil);
    end if;
  end loop;
end $$;

create or replace function public.minhas_permissoes_erp()
returns table(modulo text,nivel text)
language sql
security invoker
set search_path=''
as $$
  select m.modulo,private.nivel_permissao_usuario((select auth.uid()),m.modulo)
  from (values
    ('dashboard'::text),('vendas'),('clientes'),('fornecedores'),('produtos'),
    ('compras'),('comissoes'),('financeiro'),('autorizacoes'),('relatorios'),('config')
  ) m(modulo);
$$;

create or replace function private.salvar_permissoes_usuario_erp_impl(p_user_id uuid,p_permissoes jsonb)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item record;
  v_modulo text;
  v_nivel text;
  v_target_perfil text;
  v_target_ativo boolean;
  v_config_nivel text;
  v_outros_config integer;
begin
  if v_uid is null or not private.usuario_pode('config','editar') then
    raise exception 'Sem permissão para gerenciar acessos';
  end if;

  select perfil,ativo into v_target_perfil,v_target_ativo
  from public.profiles
  where id=p_user_id
  for update;

  if not found then raise exception 'Usuário não encontrado'; end if;
  if jsonb_typeof(p_permissoes)<>'object' then raise exception 'Permissões inválidas'; end if;

  v_config_nivel:=coalesce(p_permissoes->>'config',private.nivel_permissao_usuario(p_user_id,'config'));

  if p_user_id=v_uid and v_config_nivel<>'editar' then
    raise exception 'Você não pode remover sua própria permissão de editar Configurações';
  end if;

  if v_config_nivel='editar' and v_target_perfil<>'administrador' then
    raise exception 'Somente usuários com perfil Administrador podem editar Configurações';
  end if;

  if v_target_ativo and private.nivel_permissao_usuario(p_user_id,'config')='editar' and v_config_nivel<>'editar' then
    select count(*) into v_outros_config
    from public.profiles p
    where p.id<>p_user_id and p.ativo and private.nivel_permissao_usuario(p.id,'config')='editar';
    if v_outros_config=0 then
      raise exception 'O sistema precisa manter pelo menos um administrador com edição de Configurações';
    end if;
  end if;

  for v_item in select key,value from jsonb_each_text(p_permissoes)
  loop
    v_modulo:=v_item.key;
    v_nivel:=v_item.value;
    if v_modulo not in ('dashboard','vendas','clientes','fornecedores','produtos','compras','comissoes','financeiro','autorizacoes','relatorios','config') then
      raise exception 'Módulo inválido: %',v_modulo;
    end if;
    if v_nivel not in ('nenhum','visualizar','editar') then raise exception 'Nível de acesso inválido'; end if;
    if v_modulo in ('dashboard','relatorios') and v_nivel='editar' then v_nivel:='visualizar'; end if;

    insert into public.usuario_permissoes(user_id,modulo,nivel,updated_at)
    values(p_user_id,v_modulo,v_nivel,now())
    on conflict(user_id,modulo)
    do update set nivel=excluded.nivel,updated_at=now();
  end loop;
end;
$$;

create or replace function public.salvar_permissoes_usuario_erp(p_user_id uuid,p_permissoes jsonb)
returns void
language sql
security invoker
set search_path=''
as $$
  select private.salvar_permissoes_usuario_erp_impl(p_user_id,p_permissoes);
$$;

drop function if exists public.listar_usuarios_erp();
drop function if exists private.listar_usuarios_erp_impl();

create function private.listar_usuarios_erp_impl()
returns table(
  user_id uuid,nome text,email text,perfil text,ativo boolean,
  criado_em timestamptz,ultimo_acesso timestamptz,usuario_atual boolean,permissoes jsonb
)
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('config','editar') then
    raise exception 'Sem permissão para gerenciar usuários';
  end if;

  return query
  select p.id,p.nome,u.email::text,p.perfil,p.ativo,p.created_at,u.last_sign_in_at,
         p.id=(select auth.uid()),
         (
           select jsonb_object_agg(m.modulo,private.nivel_permissao_usuario(p.id,m.modulo))
           from (values
             ('dashboard'::text),('vendas'),('clientes'),('fornecedores'),('produtos'),
             ('compras'),('comissoes'),('financeiro'),('autorizacoes'),('relatorios'),('config')
           ) m(modulo)
         )
  from public.profiles p
  join auth.users u on u.id=p.id
  order by p.ativo desc,p.nome asc;
end;
$$;

create function public.listar_usuarios_erp()
returns table(
  user_id uuid,nome text,email text,perfil text,ativo boolean,
  criado_em timestamptz,ultimo_acesso timestamptz,usuario_atual boolean,permissoes jsonb
)
language sql
security invoker
set search_path=''
as $$
  select * from private.listar_usuarios_erp_impl();
$$;

create or replace function private.atualizar_usuario_erp_impl(
  p_user_id uuid,p_nome text,p_perfil text,p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_perfil_atual text;
  v_config_atual text;
  v_outros_config integer;
begin
  if v_uid is null or not private.usuario_pode('config','editar') then
    raise exception 'Sem permissão para gerenciar usuários';
  end if;
  if coalesce(trim(p_nome),'')='' then raise exception 'Informe o nome do usuário'; end if;
  if p_perfil not in ('administrador','financeiro','vendas','estoque','visualizador') then raise exception 'Perfil de acesso inválido'; end if;

  select perfil into v_perfil_atual from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Usuário não encontrado'; end if;

  v_config_atual:=private.nivel_permissao_usuario(p_user_id,'config');

  if p_user_id=v_uid and (not p_ativo or p_perfil<>'administrador') then
    raise exception 'Você não pode desativar ou remover seu próprio perfil de administrador';
  end if;

  if v_config_atual='editar' and (not p_ativo or p_perfil<>'administrador') then
    select count(*) into v_outros_config
    from public.profiles p
    where p.id<>p_user_id and p.ativo and private.nivel_permissao_usuario(p.id,'config')='editar';
    if v_outros_config=0 then
      raise exception 'O sistema precisa manter pelo menos um administrador com edição de Configurações';
    end if;
  end if;

  update public.profiles
  set nome=trim(p_nome),perfil=p_perfil,ativo=p_ativo
  where id=p_user_id;

  if p_perfil is distinct from v_perfil_atual then
    perform private.aplicar_permissoes_padrao(p_user_id,p_perfil);
  end if;
end;
$$;

create or replace function public.atualizar_usuario_erp(p_user_id uuid,p_nome text,p_perfil text,p_ativo boolean)
returns void
language sql
security invoker
set search_path=''
as $$
  select private.atualizar_usuario_erp_impl(p_user_id,p_nome,p_perfil,p_ativo);
$$;

revoke all on function public.minhas_permissoes_erp() from public,anon;
revoke all on function public.salvar_permissoes_usuario_erp(uuid,jsonb) from public,anon;
revoke all on function public.listar_usuarios_erp() from public,anon;
revoke all on function public.atualizar_usuario_erp(uuid,text,text,boolean) from public,anon;

grant usage on schema private to authenticated;
grant execute on function private.usuario_pode(text,text) to authenticated;
grant execute on function private.nivel_permissao_usuario(uuid,text) to authenticated;
grant execute on function public.minhas_permissoes_erp() to authenticated;
grant execute on function public.salvar_permissoes_usuario_erp(uuid,jsonb) to authenticated;
grant execute on function public.listar_usuarios_erp() to authenticated;
grant execute on function public.atualizar_usuario_erp(uuid,text,text,boolean) to authenticated;

commit;
