begin;

alter table public.titulos_financeiros
  drop constraint if exists titulo_funcionario_vinculo;

alter table public.titulos_financeiros
  add constraint titulo_funcionario_vinculo check (
    (funcionario_id is null and tipo_funcionario is null and competencia is null and vale_descontado_em is null)
    or (
      funcionario_id is not null
      and tipo_funcionario in ('gasto','vale')
      and competencia is not null
      and extract(day from competencia)=1
      and venda_id is null
      and compra_id is null
      and valor>0
      and (
        (tipo_funcionario='gasto' and tipo='pagar')
        or
        (tipo_funcionario='vale' and tipo='receber')
      )
    )
  ) not valid;

update public.titulos_financeiros
set tipo='receber'
where tipo_funcionario='vale'
  and tipo='pagar'
  and valor_pago=0
  and status='aberto';

alter table public.titulos_financeiros
  validate constraint titulo_funcionario_vinculo;

create or replace function private.descontar_vale_folha_impl(
  p_titulo_id uuid,
  p_data date,
  p_desfazer boolean default false
)
returns public.titulos_financeiros
language plpgsql
security definer
set search_path=''
as $$
declare
  v_titulo public.titulos_financeiros%rowtype;
  v_saldo numeric;
  v_pagamento public.pagamentos_titulos%rowtype;
  v_total_pago numeric;
begin
  if auth.uid() is null or not private.usuario_pode('financeiro','editar') then
    raise exception 'Sem permissão para alterar vales de funcionário';
  end if;

  select * into v_titulo
  from public.titulos_financeiros
  where id=p_titulo_id
  for update;

  if not found then raise exception 'Vale não encontrado'; end if;
  if v_titulo.tipo_funcionario<>'vale' or v_titulo.tipo<>'receber' then
    raise exception 'O lançamento não é um vale a receber';
  end if;
  if v_titulo.status='cancelado' then raise exception 'Vale cancelado não pode ser alterado'; end if;
  if p_data is null then raise exception 'Informe a data do desconto'; end if;

  if coalesce(p_desfazer,false) then
    if v_titulo.vale_descontado_em is null then
      raise exception 'Este vale não está marcado como descontado';
    end if;

    select pg.* into v_pagamento
    from public.pagamentos_titulos pg
    where pg.titulo_id=p_titulo_id
      and pg.forma_pagamento='ajuste'
      and pg.observacao='Desconto em folha do vale'
      and coalesce((
        select sum(e.valor)
        from public.estornos_pagamentos e
        where e.pagamento_id=pg.id
      ),0) < pg.valor
    order by pg.created_at desc
    limit 1;

    if not found then raise exception 'Baixa de desconto em folha não encontrada para estorno'; end if;

    update public.titulos_financeiros
      set vale_descontado_em=null
    where id=p_titulo_id;

    insert into public.estornos_pagamentos(pagamento_id,valor,data_estorno,motivo,criado_por)
    values(v_pagamento.id,v_pagamento.valor,p_data,'Desfazer desconto em folha do vale',auth.uid());

    select coalesce(sum(pg.valor),0)
      - coalesce((
          select sum(e.valor)
          from public.estornos_pagamentos e
          join public.pagamentos_titulos original on original.id=e.pagamento_id
          where original.titulo_id=p_titulo_id
        ),0)
    into v_total_pago
    from public.pagamentos_titulos pg
    where pg.titulo_id=p_titulo_id;

    update public.titulos_financeiros
      set valor_pago=v_total_pago,
          status=case
            when v_total_pago>=valor and valor>0 then 'pago'
            when v_total_pago>0 then 'parcial'
            else 'aberto'
          end
    where id=p_titulo_id
    returning * into v_titulo;

    return v_titulo;
  end if;

  if v_titulo.vale_descontado_em is not null then raise exception 'Este vale já foi descontado em folha'; end if;

  v_saldo:=greatest(v_titulo.valor-v_titulo.valor_pago,0);
  if v_saldo<=0 then raise exception 'O vale não possui saldo em aberto'; end if;

  perform private.registrar_pagamento_impl_com_forma(
    p_titulo_id,v_saldo,p_data,'Desconto em folha do vale','ajuste'
  );

  update public.titulos_financeiros
    set vale_descontado_em=p_data
  where id=p_titulo_id
  returning * into v_titulo;

  return v_titulo;
end;
$$;

create or replace function public.descontar_vale_folha(
  p_titulo_id uuid,
  p_data date,
  p_desfazer boolean default false
)
returns public.titulos_financeiros
language sql
security invoker
set search_path=''
as $$
  select private.descontar_vale_folha_impl(p_titulo_id,p_data,p_desfazer);
$$;

revoke all on function private.descontar_vale_folha_impl(uuid,date,boolean) from public,anon;
grant execute on function private.descontar_vale_folha_impl(uuid,date,boolean) to authenticated;
revoke all on function public.descontar_vale_folha(uuid,date,boolean) from public,anon;
grant execute on function public.descontar_vale_folha(uuid,date,boolean) to authenticated;

commit;
