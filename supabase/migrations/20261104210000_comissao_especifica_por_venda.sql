alter table public.vendas
  add column if not exists percentual_comissao numeric null;

alter table public.vendas
  drop constraint if exists vendas_percentual_comissao_check;

alter table public.vendas
  add constraint vendas_percentual_comissao_check
  check (percentual_comissao is null or (percentual_comissao >= 0 and percentual_comissao <= 100));

comment on column public.vendas.percentual_comissao
  is 'Percentual de comissão específico desta venda. Null usa o percentual padrão do vendedor.';

create or replace function private.aplicar_comissao_especifica_venda_pagamento()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_sale_percent numeric;
  v_default_percent numeric;
  v_seller uuid;
begin
  select v.vendedor_cadastro_id, v.percentual_comissao, vd.percentual_comissao
    into v_seller, v_sale_percent, v_default_percent
  from public.titulos_financeiros t
  join public.vendas v on v.id=t.venda_id
  left join public.vendedores vd on vd.id=v.vendedor_cadastro_id
  where t.id=new.titulo_id
    and t.tipo='receber'
    and t.venda_id is not null;

  if found then
    new.vendedor_id:=v_seller;
    new.percentual_comissao:=coalesce(v_sale_percent,v_default_percent);
  end if;

  return new;
end;
$function$;

drop trigger if exists pagamentos_aplicar_comissao_venda on public.pagamentos_titulos;
create trigger pagamentos_aplicar_comissao_venda
before insert on public.pagamentos_titulos
for each row
execute function private.aplicar_comissao_especifica_venda_pagamento();
