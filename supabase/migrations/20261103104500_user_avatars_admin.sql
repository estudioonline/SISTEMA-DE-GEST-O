alter table public.profiles
  add column if not exists avatar_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists user_avatars_admin_insert on storage.objects;
create policy user_avatars_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='user-avatars'
  and private.usuario_pode('config','editar')
);

drop policy if exists user_avatars_admin_delete on storage.objects;
create policy user_avatars_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='user-avatars'
  and private.usuario_pode('config','editar')
);

drop function if exists public.salvar_avatar_usuario_erp(uuid,text);
drop function if exists private.salvar_avatar_usuario_erp_impl(uuid,text);

create function private.salvar_avatar_usuario_erp_impl(p_user_id uuid,p_avatar_path text)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('config','editar') then
    raise exception 'Sem permissão para alterar a imagem do usuário';
  end if;

  if not exists(select 1 from public.profiles p where p.id=p_user_id) then
    raise exception 'Usuário não encontrado';
  end if;

  if p_avatar_path is not null
     and split_part(p_avatar_path,'/',1)<>p_user_id::text then
    raise exception 'Caminho de imagem inválido';
  end if;

  update public.profiles
  set avatar_path=nullif(trim(p_avatar_path),'')
  where id=p_user_id;
end;
$$;

create function public.salvar_avatar_usuario_erp(p_user_id uuid,p_avatar_path text)
returns void
language sql
security invoker
set search_path=''
as $$
  select private.salvar_avatar_usuario_erp_impl(p_user_id,p_avatar_path);
$$;

revoke all on function public.salvar_avatar_usuario_erp(uuid,text) from public,anon;
grant execute on function public.salvar_avatar_usuario_erp(uuid,text) to authenticated;

drop function if exists public.listar_usuarios_erp();
drop function if exists private.listar_usuarios_erp_impl();

create function private.listar_usuarios_erp_impl()
returns table(
  user_id uuid,nome text,email text,perfil text,ativo boolean,
  criado_em timestamptz,ultimo_acesso timestamptz,usuario_atual boolean,
  avatar_path text,permissoes jsonb
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
  select
    p.id,
    p.nome,
    u.email::text,
    p.perfil,
    p.ativo,
    p.created_at,
    u.last_sign_in_at,
    p.id=(select auth.uid()),
    p.avatar_path,
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
  criado_em timestamptz,ultimo_acesso timestamptz,usuario_atual boolean,
  avatar_path text,permissoes jsonb
)
language sql
security invoker
set search_path=''
as $$
  select * from private.listar_usuarios_erp_impl();
$$;

revoke all on function public.listar_usuarios_erp() from public,anon;
grant execute on function public.listar_usuarios_erp() to authenticated;
