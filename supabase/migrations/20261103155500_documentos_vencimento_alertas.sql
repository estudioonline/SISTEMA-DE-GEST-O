alter table public.comprovantes_pagamento
  add column if not exists data_vencimento date null,
  add column if not exists alerta_dias smallint not null default 5;

alter table public.comprovantes_pagamento
  drop constraint if exists comprovantes_pagamento_alerta_dias_check;

alter table public.comprovantes_pagamento
  add constraint comprovantes_pagamento_alerta_dias_check
  check (alerta_dias between 0 and 365);

create or replace function private.documentos_definir_vencimento_impl(
  p_documento_id uuid,
  p_data_vencimento date,
  p_alerta_dias integer default 5
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('financeiro','editar') then
    raise exception 'Sem permissão para alterar vencimento de documentos';
  end if;

  if p_alerta_dias is null or p_alerta_dias < 0 or p_alerta_dias > 365 then
    raise exception 'O aviso deve estar entre 0 e 365 dias';
  end if;

  update public.comprovantes_pagamento
     set data_vencimento=p_data_vencimento,
         alerta_dias=p_alerta_dias
   where id=p_documento_id;

  if not found then
    raise exception 'Documento não encontrado';
  end if;
end;
$$;

create or replace function public.documentos_definir_vencimento(
  p_documento_id uuid,
  p_data_vencimento date,
  p_alerta_dias integer default 5
)
returns void
language sql
security invoker
set search_path=''
as $$
  select private.documentos_definir_vencimento_impl(p_documento_id,p_data_vencimento,p_alerta_dias);
$$;

revoke all on function public.documentos_definir_vencimento(uuid,date,integer) from public,anon;
grant execute on function public.documentos_definir_vencimento(uuid,date,integer) to authenticated;
