create table if not exists public.documentos_pastas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  parent_id uuid null references public.documentos_pastas(id) on delete restrict,
  created_by uuid null references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documentos_pastas_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint documentos_pastas_parent_self_check check (parent_id is null or parent_id <> id)
);

create unique index if not exists documentos_pastas_nome_parent_unique
on public.documentos_pastas (coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nome)));

alter table public.documentos_pastas enable row level security;

revoke all on table public.documentos_pastas from anon;
revoke insert, update, delete on table public.documentos_pastas from authenticated;
grant select on table public.documentos_pastas to authenticated;

drop policy if exists documentos_pastas_read on public.documentos_pastas;
create policy documentos_pastas_read
on public.documentos_pastas
for select
to authenticated
using (private.usuario_pode('financeiro','visualizar'));

alter table public.comprovantes_pagamento
  add column if not exists folder_id uuid null references public.documentos_pastas(id) on delete restrict;

create index if not exists comprovantes_pagamento_folder_id_idx
on public.comprovantes_pagamento(folder_id);

create or replace function private.documentos_criar_pasta_impl(p_nome text,p_parent_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null or not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para criar pastas'; end if;
  if coalesce(btrim(p_nome),'')='' then raise exception 'Informe o nome da pasta'; end if;
  if char_length(btrim(p_nome))>120 then raise exception 'O nome da pasta deve ter até 120 caracteres'; end if;
  if p_parent_id is not null and not exists(select 1 from public.documentos_pastas where id=p_parent_id) then raise exception 'Pasta superior não encontrada'; end if;
  insert into public.documentos_pastas(nome,parent_id,created_by)
  values(btrim(p_nome),p_parent_id,(select auth.uid()))
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'Já existe uma pasta com este nome neste local';
end;
$$;

create or replace function private.documentos_renomear_pasta_impl(p_id uuid,p_nome text)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para renomear pastas'; end if;
  if coalesce(btrim(p_nome),'')='' then raise exception 'Informe o nome da pasta'; end if;
  if char_length(btrim(p_nome))>120 then raise exception 'O nome da pasta deve ter até 120 caracteres'; end if;
  update public.documentos_pastas set nome=btrim(p_nome),updated_at=now() where id=p_id;
  if not found then raise exception 'Pasta não encontrada'; end if;
exception when unique_violation then raise exception 'Já existe uma pasta com este nome neste local';
end;
$$;

create or replace function private.documentos_mover_pasta_impl(p_id uuid,p_parent_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para mover pastas'; end if;
  if not exists(select 1 from public.documentos_pastas where id=p_id) then raise exception 'Pasta não encontrada'; end if;
  if p_parent_id=p_id then raise exception 'Uma pasta não pode ficar dentro dela mesma'; end if;
  if p_parent_id is not null and not exists(select 1 from public.documentos_pastas where id=p_parent_id) then raise exception 'Pasta de destino não encontrada'; end if;
  if p_parent_id is not null and exists(
    with recursive filhos as (
      select id from public.documentos_pastas where parent_id=p_id
      union all
      select p.id from public.documentos_pastas p join filhos f on p.parent_id=f.id
    )
    select 1 from filhos where id=p_parent_id
  ) then raise exception 'Não é possível mover uma pasta para dentro de uma subpasta dela'; end if;
  update public.documentos_pastas set parent_id=p_parent_id,updated_at=now() where id=p_id;
exception when unique_violation then raise exception 'Já existe uma pasta com este nome no destino';
end;
$$;

create or replace function private.documentos_excluir_pasta_impl(p_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para excluir pastas'; end if;
  if exists(select 1 from public.documentos_pastas where parent_id=p_id) then raise exception 'A pasta possui subpastas. Mova ou exclua as subpastas primeiro'; end if;
  if exists(select 1 from public.comprovantes_pagamento where folder_id=p_id) then raise exception 'A pasta possui documentos. Mova os documentos antes de excluí-la'; end if;
  delete from public.documentos_pastas where id=p_id;
  if not found then raise exception 'Pasta não encontrada'; end if;
end;
$$;

create or replace function private.documentos_mover_arquivo_impl(p_documento_id uuid,p_folder_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para organizar documentos'; end if;
  if p_folder_id is not null and not exists(select 1 from public.documentos_pastas where id=p_folder_id) then raise exception 'Pasta de destino não encontrada'; end if;
  update public.comprovantes_pagamento set folder_id=p_folder_id where id=p_documento_id;
  if not found then raise exception 'Documento não encontrado'; end if;
end;
$$;

create or replace function public.documentos_criar_pasta(p_nome text,p_parent_id uuid default null)
returns uuid language sql security invoker set search_path=''
as $$ select private.documentos_criar_pasta_impl(p_nome,p_parent_id); $$;
create or replace function public.documentos_renomear_pasta(p_id uuid,p_nome text)
returns void language sql security invoker set search_path=''
as $$ select private.documentos_renomear_pasta_impl(p_id,p_nome); $$;
create or replace function public.documentos_mover_pasta(p_id uuid,p_parent_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.documentos_mover_pasta_impl(p_id,p_parent_id); $$;
create or replace function public.documentos_excluir_pasta(p_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.documentos_excluir_pasta_impl(p_id); $$;
create or replace function public.documentos_mover_arquivo(p_documento_id uuid,p_folder_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.documentos_mover_arquivo_impl(p_documento_id,p_folder_id); $$;

revoke all on function public.documentos_criar_pasta(text,uuid) from public,anon;
revoke all on function public.documentos_renomear_pasta(uuid,text) from public,anon;
revoke all on function public.documentos_mover_pasta(uuid,uuid) from public,anon;
revoke all on function public.documentos_excluir_pasta(uuid) from public,anon;
revoke all on function public.documentos_mover_arquivo(uuid,uuid) from public,anon;
grant execute on function public.documentos_criar_pasta(text,uuid) to authenticated;
grant execute on function public.documentos_renomear_pasta(uuid,text) to authenticated;
grant execute on function public.documentos_mover_pasta(uuid,uuid) to authenticated;
grant execute on function public.documentos_excluir_pasta(uuid) to authenticated;
grant execute on function public.documentos_mover_arquivo(uuid,uuid) to authenticated;
