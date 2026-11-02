-- Arquiva e exibe o documento original usado na importação do extrato bancário.
alter table public.importacoes_bancarias
  add column if not exists arquivo_path text,
  add column if not exists arquivo_tipo text,
  add column if not exists arquivo_tamanho bigint;

grant select,update on public.importacoes_bancarias to authenticated;

drop policy if exists importacoes_bancarias_update on public.importacoes_bancarias;
create policy importacoes_bancarias_update
on public.importacoes_bancarias
for update
to authenticated
using (private.usuario_pode('financeiro','editar'))
with check (private.usuario_pode('financeiro','editar'));

insert into storage.buckets(id,name,public)
values('extratos-bancarios','extratos-bancarios',false)
on conflict(id) do update set public=false;

drop policy if exists extratos_bancarios_select on storage.objects;
create policy extratos_bancarios_select
on storage.objects
for select
to authenticated
using (
  bucket_id='extratos-bancarios'
  and private.usuario_pode('financeiro','visualizar')
);

drop policy if exists extratos_bancarios_insert on storage.objects;
create policy extratos_bancarios_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='extratos-bancarios'
  and private.usuario_pode('financeiro','editar')
);

drop policy if exists extratos_bancarios_delete on storage.objects;
create policy extratos_bancarios_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='extratos-bancarios'
  and private.usuario_pode('financeiro','editar')
);