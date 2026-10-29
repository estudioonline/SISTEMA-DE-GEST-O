begin;

-- Bucket privado para documentos gerais da empresa, separado dos comprovantes vinculados a vendas/compras.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-empresa',
  'documentos-empresa',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/xml',
    'text/xml',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.documentos_empresa (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null check (length(trim(nome_arquivo)) between 1 and 255),
  categoria text not null check (categoria in (
    'fiscal','financeiro','contratos','clientes','fornecedores','rh','vendas','compras','geral'
  )),
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/xml',
    'text/xml',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  )),
  tamanho bigint not null check (tamanho between 1 and 26214400),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint documentos_empresa_path_category_check check (
    split_part(storage_path, '/', 1) = categoria
    and storage_path ~ '^[a-z]+/[0-9]{4}/[0-9]{2}/[A-Za-z0-9_-]+[.][A-Za-z0-9]+$'
    and lower(storage_path) ~ '[.](pdf|doc|docx|xls|xlsx|csv|xml|jpg|jpeg|png|webp|txt|zip)$'
  )
);

create index if not exists documentos_empresa_created_at_idx
  on public.documentos_empresa (created_at desc, id);
create index if not exists documentos_empresa_categoria_idx
  on public.documentos_empresa (categoria, created_at desc);

alter table public.documentos_empresa enable row level security;
revoke all on table public.documentos_empresa from public, anon;
grant select, insert, delete on table public.documentos_empresa to authenticated;
revoke update, truncate, references, trigger on table public.documentos_empresa from authenticated;

drop policy if exists documentos_empresa_read on public.documentos_empresa;
create policy documentos_empresa_read
on public.documentos_empresa for select to authenticated
using (private.usuario_pode('financeiro', 'visualizar'));

drop policy if exists documentos_empresa_insert on public.documentos_empresa;
create policy documentos_empresa_insert
on public.documentos_empresa for insert to authenticated
with check (
  private.usuario_pode('financeiro', 'editar')
  and uploaded_by = (select auth.uid())
  and split_part(storage_path, '/', 1) = categoria
);

drop policy if exists documentos_empresa_delete on public.documentos_empresa;
create policy documentos_empresa_delete
on public.documentos_empresa for delete to authenticated
using (private.usuario_pode('financeiro', 'editar'));

drop policy if exists documentos_empresa_storage_read on storage.objects;
create policy documentos_empresa_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos-empresa'
  and private.usuario_pode('financeiro', 'visualizar')
);

drop policy if exists documentos_empresa_storage_insert on storage.objects;
create policy documentos_empresa_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos-empresa'
  and private.usuario_pode('financeiro', 'editar')
  and (storage.foldername(name))[1] in (
    'fiscal','financeiro','contratos','clientes','fornecedores','rh','vendas','compras','geral'
  )
  and lower(storage.filename(name)) ~ '[.](pdf|doc|docx|xls|xlsx|csv|xml|jpg|jpeg|png|webp|txt|zip)$'
);

drop policy if exists documentos_empresa_storage_delete on storage.objects;
create policy documentos_empresa_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'documentos-empresa'
  and private.usuario_pode('financeiro', 'editar')
);

commit;
