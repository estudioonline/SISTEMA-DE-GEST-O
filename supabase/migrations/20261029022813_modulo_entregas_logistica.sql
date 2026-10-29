-- Modulo de Entregas: dados operacionais independentes do estoque.

alter table public.usuario_permissoes
  drop constraint if exists usuario_permissoes_modulo_check;

alter table public.usuario_permissoes
  add constraint usuario_permissoes_modulo_check
  check (modulo = any (array[
    'dashboard'::text,'vendas'::text,'clientes'::text,'fornecedores'::text,
    'produtos'::text,'compras'::text,'comissoes'::text,'financeiro'::text,
    'entregas'::text,'autorizacoes'::text,'relatorios'::text,'config'::text
  ]));

create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null unique references public.vendas(id) on delete cascade,
  status text not null default 'a_entregar'
    check (status = any (array[
      'a_entregar'::text,'em_transito'::text,'entregue'::text,
      'reagendamento'::text,'cancelado'::text
    ])),
  rota text null,
  rota_manual boolean not null default false,
  data_prevista date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  entregador_nome text null,
  cobrar_na_entrega boolean not null default false,
  valor_cobrar numeric(14,2) not null default 0 check (valor_cobrar >= 0),
  observacoes_entrega text null,
  recebedor_nome text null,
  recebedor_documento text null,
  comprovante_path text null,
  assinatura_path text null,
  falha_motivo text null
    check (falha_motivo is null or falha_motivo = any (array[
      'cliente_ausente'::text,'endereco_nao_localizado'::text,
      'recusado_cliente'::text,'avaria_mercadoria'::text,'outro'::text
    ])),
  falha_detalhes text null,
  em_transito_em timestamptz null,
  entregue_em timestamptz null,
  falha_em timestamptz null,
  criado_por uuid null references auth.users(id) on delete set null,
  atualizado_por uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.entregas is
  'Controle estritamente logistico. Nao movimenta nem altera estoque.';

create table if not exists public.entrega_eventos (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.entregas(id) on delete cascade,
  tipo text not null check (tipo = any (array[
    'criado'::text,'organizacao'::text,'em_transito'::text,
    'entregue'::text,'nao_entregue'::text,'reagendado'::text
  ])),
  status_anterior text null,
  status_novo text null,
  motivo text null,
  detalhes text null,
  usuario_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists entregas_status_data_idx
  on public.entregas(status,data_prevista);
create index if not exists entregas_rota_idx
  on public.entregas(rota);
create index if not exists entregas_entregador_idx
  on public.entregas(entregador_nome);
create index if not exists entrega_eventos_entrega_created_idx
  on public.entrega_eventos(entrega_id,created_at desc);

alter table public.entregas enable row level security;
alter table public.entrega_eventos enable row level security;

drop policy if exists entregas_read on public.entregas;
create policy entregas_read on public.entregas
for select to authenticated
using (private.usuario_pode('entregas','visualizar'));

drop policy if exists entregas_insert on public.entregas;
create policy entregas_insert on public.entregas
for insert to authenticated
with check (private.usuario_pode('entregas','editar'));

drop policy if exists entregas_update on public.entregas;
create policy entregas_update on public.entregas
for update to authenticated
using (private.usuario_pode('entregas','editar'))
with check (private.usuario_pode('entregas','editar'));

drop policy if exists entregas_delete on public.entregas;
create policy entregas_delete on public.entregas
for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'
  )
);

drop policy if exists entrega_eventos_read on public.entrega_eventos;
create policy entrega_eventos_read on public.entrega_eventos
for select to authenticated
using (private.usuario_pode('entregas','visualizar'));

drop policy if exists entrega_eventos_insert on public.entrega_eventos;
create policy entrega_eventos_insert on public.entrega_eventos
for insert to authenticated
with check (private.usuario_pode('entregas','editar'));

grant select,insert,update,delete on public.entregas to authenticated;
grant select,insert on public.entrega_eventos to authenticated;

drop policy if exists vendas_read on public.vendas;
create policy vendas_read on public.vendas
for select to authenticated
using (
  private.usuario_pode('vendas','visualizar')
  or private.usuario_pode('relatorios','visualizar')
  or private.usuario_pode('comissoes','visualizar')
  or private.usuario_pode('autorizacoes','visualizar')
  or private.usuario_pode('entregas','visualizar')
);

drop policy if exists clientes_read on public.clientes;
create policy clientes_read on public.clientes
for select to authenticated
using (
  private.usuario_pode('clientes','visualizar')
  or private.usuario_pode('vendas','visualizar')
  or private.usuario_pode('relatorios','visualizar')
  or private.usuario_pode('entregas','visualizar')
);

drop policy if exists titulos_read on public.titulos_financeiros;
create policy titulos_read on public.titulos_financeiros
for select to authenticated
using (
  private.usuario_pode('financeiro','visualizar')
  or private.usuario_pode('relatorios','visualizar')
  or (
    private.usuario_pode('entregas','visualizar')
    and tipo='receber'
    and venda_id is not null
  )
);

create or replace function public.minhas_permissoes_erp()
returns table(modulo text,nivel text)
language sql
set search_path to ''
as $function$
  select m.modulo,private.nivel_permissao_usuario((select auth.uid()),m.modulo)
  from (values
    ('dashboard'::text),('vendas'),('clientes'),('fornecedores'),('produtos'),
    ('compras'),('comissoes'),('financeiro'),('entregas'),('autorizacoes'),
    ('relatorios'),('config')
  ) m(modulo);
$function$;

create or replace function private.sync_entrega_da_venda()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op='INSERT'
     or old.status is distinct from new.status
     or old.rota_entrega is distinct from new.rota_entrega then

    if new.status in ('pedido','faturado')
       and coalesce(new.rota_entrega,'') <> 'retirada' then
      insert into public.entregas(venda_id,status,rota,criado_por,atualizado_por)
      values(new.id,'a_entregar',new.rota_entrega,auth.uid(),auth.uid())
      on conflict (venda_id) do update
        set rota=case
                   when not public.entregas.rota_manual then excluded.rota
                   else public.entregas.rota
                 end,
            status=case
                     when public.entregas.status='cancelado' then 'a_entregar'
                     else public.entregas.status
                   end,
            atualizado_por=auth.uid(),
            updated_at=now();

    elsif new.status='cancelado' or coalesce(new.rota_entrega,'')='retirada' then
      update public.entregas
         set status='cancelado',
             atualizado_por=auth.uid(),
             updated_at=now()
       where venda_id=new.id
         and status<>'entregue';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.sync_entrega_da_venda() from public,anon,authenticated;

drop trigger if exists vendas_sync_entrega_logistica on public.vendas;
create trigger vendas_sync_entrega_logistica
after insert or update of status,rota_entrega on public.vendas
for each row execute function private.sync_entrega_da_venda();

insert into public.entregas(venda_id,status,rota)
select v.id,'a_entregar',v.rota_entrega
from public.vendas v
where v.status in ('pedido','faturado')
  and coalesce(v.rota_entrega,'') <> 'retirada'
on conflict (venda_id) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'entregas-comprovantes',
  'entregas-comprovantes',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists entregas_storage_read on storage.objects;
create policy entregas_storage_read on storage.objects
for select to authenticated
using (
  bucket_id='entregas-comprovantes'
  and private.usuario_pode('entregas','visualizar')
);

drop policy if exists entregas_storage_insert on storage.objects;
create policy entregas_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='entregas-comprovantes'
  and private.usuario_pode('entregas','editar')
);

drop policy if exists entregas_storage_update on storage.objects;
create policy entregas_storage_update on storage.objects
for update to authenticated
using (
  bucket_id='entregas-comprovantes'
  and private.usuario_pode('entregas','editar')
)
with check (
  bucket_id='entregas-comprovantes'
  and private.usuario_pode('entregas','editar')
);

drop policy if exists entregas_storage_delete on storage.objects;
create policy entregas_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id='entregas-comprovantes'
  and private.usuario_pode('entregas','editar')
);
