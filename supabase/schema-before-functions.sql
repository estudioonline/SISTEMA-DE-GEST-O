-- Read-only snapshot of deployed function definitions before the ERP improvements.
-- Not a baseline migration or a complete database backup.
CREATE OR REPLACE FUNCTION private.atualizar_custo_medio_compra_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old uuid; v_new uuid;
begin
  v_old:=case when tg_op in ('UPDATE','DELETE') then old.produto_id else null end;
  v_new:=case when tg_op in ('INSERT','UPDATE') then new.produto_id else null end;
  if v_old is not null then perform private.recalcular_custo_medio_produto(v_old); end if;
  if v_new is not null and v_new is distinct from v_old then perform private.recalcular_custo_medio_produto(v_new); end if;
  return coalesce(new,old);
end;
$function$;
CREATE OR REPLACE FUNCTION private.atualizar_custo_medio_compra_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if new.status is distinct from old.status then
    for r in select distinct produto_id from public.compra_itens where compra_id=new.id loop
      perform private.recalcular_custo_medio_produto(r.produto_id);
    end loop;
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.atualizar_usuario_erp_impl(p_user_id uuid, p_nome text, p_perfil text, p_ativo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_perfil_atual text;
  v_outros_admins integer;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id=v_uid
      and p.ativo
      and p.perfil='administrador'
  ) then
    raise exception 'Somente administrador pode gerenciar usuários';
  end if;

  if coalesce(trim(p_nome),'')='' then
    raise exception 'Informe o nome do usuário';
  end if;

  if p_perfil not in ('administrador','financeiro','vendas','estoque','visualizador') then
    raise exception 'Perfil de acesso inválido';
  end if;

  select perfil
  into v_perfil_atual
  from public.profiles
  where id=p_user_id
  for update;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  if p_user_id=v_uid and (not p_ativo or p_perfil<>'administrador') then
    raise exception 'Você não pode desativar ou remover seu próprio perfil de administrador';
  end if;

  if v_perfil_atual='administrador' and (p_perfil<>'administrador' or not p_ativo) then
    select count(*)
    into v_outros_admins
    from public.profiles
    where id<>p_user_id
      and ativo
      and perfil='administrador';

    if v_outros_admins=0 then
      raise exception 'O sistema precisa manter pelo menos um administrador ativo';
    end if;
  end if;

  update public.profiles
  set nome=trim(p_nome),
      perfil=p_perfil,
      ativo=p_ativo
  where id=p_user_id;
end;
$function$;
CREATE OR REPLACE FUNCTION private.compra_consumindo_estoque(p_status text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_status = 'pedido_recebido';
$function$;
CREATE OR REPLACE FUNCTION private.definir_visualizador(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo
      and p.perfil='administrador'
  ) then
    raise exception 'Somente administrador pode criar usuário visualizador';
  end if;

  update public.profiles
  set perfil='visualizador', ativo=true
  where id=p_user_id;

  if not found then
    raise exception 'Perfil do usuário não encontrado';
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION private.estoque_compra_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  perform set_config('app.purchase_delete_id',old.id::text,true);

  if private.compra_consumindo_estoque(old.status) then
    for r in
      select produto_id,quantidade
      from public.compra_itens
      where compra_id=old.id
    loop
      perform private.movimentar_estoque(
        r.produto_id,-r.quantidade,'saida',
        'Exclusão de compra #' || lpad(coalesce(old.fatura_numero,0)::text,7,'0')
      );
    end loop;
  end if;

  return old;
end;
$function$;
CREATE OR REPLACE FUNCTION private.estoque_compra_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status text;
  v_numero bigint;
begin
  if tg_op='INSERT' then
    select status,fatura_numero into v_status,v_numero
    from public.compras where id=new.compra_id;

    if private.compra_consumindo_estoque(v_status) then
      perform private.movimentar_estoque(
        new.produto_id,new.quantidade,'entrada',
        'Compra #' || lpad(coalesce(v_numero,0)::text,7,'0')
      );
    end if;
    return new;
  end if;

  if tg_op='UPDATE' then
    if new.compra_id is distinct from old.compra_id then
      raise exception 'Não é permitido mover item entre compras';
    end if;

    select status,fatura_numero into v_status,v_numero
    from public.compras where id=new.compra_id;

    if private.compra_consumindo_estoque(v_status)
       and (
         new.produto_id is distinct from old.produto_id
         or new.quantidade is distinct from old.quantidade
       ) then
      perform private.movimentar_estoque(
        old.produto_id,-old.quantidade,'saida',
        'Ajuste da compra #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - retirada'
      );
      perform private.movimentar_estoque(
        new.produto_id,new.quantidade,'entrada',
        'Ajuste da compra #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - nova entrada'
      );
    end if;
    return new;
  end if;

  if tg_op='DELETE' then
    if current_setting('app.purchase_delete_id',true)=old.compra_id::text then
      return old;
    end if;

    select status,fatura_numero into v_status,v_numero
    from public.compras where id=old.compra_id;

    if private.compra_consumindo_estoque(v_status) then
      perform private.movimentar_estoque(
        old.produto_id,-old.quantidade,'saida',
        'Ajuste da compra #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - item retirado'
      );
    end if;
    return old;
  end if;

  return null;
end;
$function$;
CREATE OR REPLACE FUNCTION private.estoque_compra_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  if old.status='cancelada' and new.status<>'cancelada' then
    raise exception 'Compra cancelada não pode ser reativada';
  end if;

  if private.compra_consumindo_estoque(old.status)
     and not private.compra_consumindo_estoque(new.status) then
    for r in
      select produto_id,quantidade
      from public.compra_itens
      where compra_id=new.id
    loop
      perform private.movimentar_estoque(
        r.produto_id,-r.quantidade,'saida',
        'Cancelamento de compra #' || lpad(coalesce(new.fatura_numero,0)::text,7,'0')
      );
    end loop;
  elsif not private.compra_consumindo_estoque(old.status)
        and private.compra_consumindo_estoque(new.status) then
    for r in
      select produto_id,quantidade
      from public.compra_itens
      where compra_id=new.id
    loop
      perform private.movimentar_estoque(
        r.produto_id,r.quantidade,'entrada',
        'Compra #' || lpad(coalesce(new.fatura_numero,0)::text,7,'0')
      );
    end loop;
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.estoque_venda_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  perform set_config('app.sale_delete_id',old.id::text,true);

  if private.venda_consumindo_estoque(old.status) then
    for r in
      select produto_id,quantidade
      from public.venda_itens
      where venda_id=old.id
    loop
      perform private.movimentar_estoque(
        r.produto_id,
        r.quantidade,
        'entrada',
        'Devolução de venda excluída #' || lpad(coalesce(old.fatura_numero,0)::text,7,'0')
      );
    end loop;
  end if;

  return old;
end;
$function$;
CREATE OR REPLACE FUNCTION private.estoque_venda_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status text;
  v_numero bigint;
begin
  if tg_op = 'INSERT' then
    select status,fatura_numero into v_status,v_numero
    from public.vendas where id=new.venda_id;

    if private.venda_consumindo_estoque(v_status) then
      perform private.movimentar_estoque(
        new.produto_id,
        -new.quantidade,
        'saida',
        'Venda #' || lpad(coalesce(v_numero,0)::text,7,'0')
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.venda_id is distinct from old.venda_id then
      raise exception 'Não é permitido mover item entre vendas';
    end if;

    select status,fatura_numero into v_status,v_numero
    from public.vendas where id=new.venda_id;

    if private.venda_consumindo_estoque(v_status)
       and (
         new.produto_id is distinct from old.produto_id
         or new.quantidade is distinct from old.quantidade
       ) then
      perform private.movimentar_estoque(
        old.produto_id,
        old.quantidade,
        'entrada',
        'Ajuste da venda #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - retorno'
      );

      perform private.movimentar_estoque(
        new.produto_id,
        -new.quantidade,
        'saida',
        'Ajuste da venda #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - nova saída'
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if current_setting('app.sale_delete_id',true)=old.venda_id::text then
      return old;
    end if;

    select status,fatura_numero into v_status,v_numero
    from public.vendas where id=old.venda_id;

    if private.venda_consumindo_estoque(v_status) then
      perform private.movimentar_estoque(
        old.produto_id,
        old.quantidade,
        'entrada',
        'Ajuste da venda #' || lpad(coalesce(v_numero,0)::text,7,'0') || ' - item devolvido'
      );
    end if;
    return old;
  end if;

  return null;
end;
$function$;
CREATE OR REPLACE FUNCTION private.estoque_venda_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  if old.status='cancelado' and new.status<>'cancelado' then
    raise exception 'Venda cancelada não pode ser reativada';
  end if;

  if private.venda_consumindo_estoque(old.status)
     and not private.venda_consumindo_estoque(new.status) then
    for r in
      select produto_id,quantidade
      from public.venda_itens
      where venda_id=new.id
    loop
      perform private.movimentar_estoque(
        r.produto_id,
        r.quantidade,
        'entrada',
        'Devolução de venda cancelada #' || lpad(coalesce(new.fatura_numero,0)::text,7,'0')
      );
    end loop;
  elsif not private.venda_consumindo_estoque(old.status)
        and private.venda_consumindo_estoque(new.status) then
    for r in
      select produto_id,quantidade
      from public.venda_itens
      where venda_id=new.id
    loop
      perform private.movimentar_estoque(
        r.produto_id,
        -r.quantidade,
        'saida',
        'Venda #' || lpad(coalesce(new.fatura_numero,0)::text,7,'0')
      );
    end loop;
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, nome, perfil)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,''),'@',1), 'Usuário'),
    'vendas'
  );
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.listar_usuarios_erp_impl()
 RETURNS TABLE(user_id uuid, nome text, email text, perfil text, ativo boolean, criado_em timestamp with time zone, ultimo_acesso timestamp with time zone, usuario_atual boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo
      and p.perfil='administrador'
  ) then
    raise exception 'Somente administrador pode gerenciar usuários';
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
    p.id=(select auth.uid())
  from public.profiles p
  join auth.users u on u.id=p.id
  order by p.ativo desc, p.nome asc;
end;
$function$;
CREATE OR REPLACE FUNCTION private.movimentar_estoque(p_produto_id uuid, p_delta numeric, p_tipo text, p_referencia text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_permitir_negativo boolean :=
    coalesce(current_setting('app.allow_negative_stock', true),'false')='true';
begin
  if p_delta < 0 then
    if v_permitir_negativo then
      update public.produtos
         set estoque_atual = estoque_atual + p_delta
       where id = p_produto_id
         and ativo = true;
    else
      update public.produtos
         set estoque_atual = estoque_atual + p_delta
       where id = p_produto_id
         and ativo = true
         and estoque_atual + p_delta >= 0;
    end if;

    if not found then
      raise exception 'Estoque insuficiente para o produto %', p_produto_id;
    end if;
  else
    update public.produtos
       set estoque_atual = estoque_atual + p_delta
     where id = p_produto_id;

    if not found then
      raise exception 'Produto não encontrado: %', p_produto_id;
    end if;
  end if;

  insert into public.movimentos_estoque(produto_id,tipo,quantidade,referencia)
  values (p_produto_id,p_tipo,abs(p_delta),p_referencia);
end;
$function$;
CREATE OR REPLACE FUNCTION private.recalcular_custo_medio_produto(p_produto_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_custo numeric;
begin
  select case when coalesce(sum(ci.quantidade),0)>0
    then sum(ci.quantidade*ci.custo_unitario)/sum(ci.quantidade)
    else null end
  into v_custo
  from public.compra_itens ci
  join public.compras c on c.id=ci.compra_id
  where ci.produto_id=p_produto_id
    and c.status='pedido_recebido';

  if v_custo is not null then
    update public.produtos
       set custo_medio=v_custo,
           custo=v_custo
     where id=p_produto_id;
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION private.registrar_auditoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.auditoria_log(
    tabela,registro_id,acao,usuario_id,dados_antes,dados_depois
  )
  values (
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'),(to_jsonb(old)->>'id')),
    tg_op,
    (select auth.uid()),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new,old);
end;
$function$;
CREATE OR REPLACE FUNCTION private.sincronizar_titulos_compra()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_fornecedor text;
  v_parcela numeric;
  v_valor numeric;
  v_vencimento date;
  v_financeiro_alterado boolean := false;
  i integer;
begin
  if new.status='cancelada' then
    update public.titulos_financeiros
       set status='cancelado'
     where compra_id=new.id
       and status<>'pago';
    return new;
  end if;

  if new.status='cotacao' then
    if exists (
      select 1
      from public.titulos_financeiros
      where compra_id=new.id
        and valor_pago>0
    ) then
      raise exception 'Compra com pagamento registrado nao pode voltar para cotacao';
    end if;

    delete from public.titulos_financeiros
     where compra_id=new.id;
    return new;
  end if;

  if new.status not in ('pedido_aprovado','pedido_recebido') then
    raise exception 'Status de compra invalido para financeiro';
  end if;

  if jsonb_typeof(new.vencimentos_parcelas)<>'array'
     or jsonb_array_length(new.vencimentos_parcelas)<>new.parcelas then
    raise exception 'Informe uma data de vencimento para cada parcela';
  end if;

  if tg_op='UPDATE' then
    v_financeiro_alterado :=
      old.total is distinct from new.total
      or old.forma_pagamento is distinct from new.forma_pagamento
      or old.parcelas is distinct from new.parcelas
      or old.vencimentos_parcelas is distinct from new.vencimentos_parcelas
      or old.fornecedor_id is distinct from new.fornecedor_id;

    if exists (
      select 1
      from public.titulos_financeiros
      where compra_id=new.id
        and valor_pago>0
    ) and v_financeiro_alterado then
      raise exception 'Compra possui pagamento registrado e nao pode ter a cobranca alterada';
    end if;

    if old.status='pedido_aprovado'
       and new.status='pedido_recebido'
       and not v_financeiro_alterado then
      return new;
    end if;

    if not v_financeiro_alterado
       and old.status in ('pedido_aprovado','pedido_recebido')
       and exists (
         select 1 from public.titulos_financeiros
         where compra_id=new.id
       ) then
      return new;
    end if;
  end if;

  delete from public.titulos_financeiros
   where compra_id=new.id
     and valor_pago=0;

  if exists (
    select 1
    from public.titulos_financeiros
    where compra_id=new.id
      and valor_pago>0
  ) then
    return new;
  end if;

  select nome into v_fornecedor
  from public.fornecedores
  where id=new.fornecedor_id;

  v_parcela := trunc((new.total/new.parcelas)::numeric,2);

  for i in 1..new.parcelas loop
    v_vencimento := (new.vencimentos_parcelas->>(i-1))::date;

    if i=new.parcelas then
      v_valor := new.total-(v_parcela*(new.parcelas-1));
    else
      v_valor := v_parcela;
    end if;

    insert into public.titulos_financeiros(
      tipo,descricao,entidade_nome,vencimento,valor,valor_pago,status,
      categoria,centro_custo,compra_id,parcela_numero,forma_pagamento
    )
    values (
      'pagar',
      'Fatura compra '||lpad(new.fatura_numero::text,7,'0')||
        ' - Parcela '||i::text||'/'||new.parcelas::text,
      coalesce(v_fornecedor,'Fornecedor nao informado'),
      v_vencimento,
      v_valor,0,'aberto','Compras','Operacional',
      new.id,i,new.forma_pagamento
    );
  end loop;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.sincronizar_titulos_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cliente text;
  v_parcela numeric;
  v_valor numeric;
  v_vencimento date;
  i integer;
begin
  if tg_op = 'UPDATE'
     and old.status = 'cancelado'
     and new.status <> 'cancelado' then
    raise exception 'Venda cancelada não pode ser reativada';
  end if;

  if new.status = 'cancelado' then
    update public.titulos_financeiros
       set status = 'cancelado'
     where venda_id = new.id
       and status <> 'pago';
    return new;
  end if;

  if tg_op = 'UPDATE'
     and exists (
       select 1
       from public.titulos_financeiros
       where venda_id = new.id
         and valor_pago > 0
     )
     and (
       old.total is distinct from new.total
       or old.forma_pagamento is distinct from new.forma_pagamento
       or old.parcelas is distinct from new.parcelas
       or old.primeiro_vencimento is distinct from new.primeiro_vencimento
       or old.cliente_id is distinct from new.cliente_id
     ) then
    raise exception 'Venda possui pagamento registrado e não pode ter cobrança alterada';
  end if;

  delete from public.titulos_financeiros
   where venda_id = new.id
     and valor_pago = 0;

  select nome into v_cliente
  from public.clientes
  where id = new.cliente_id;

  v_parcela := trunc((new.total / new.parcelas)::numeric, 2);

  for i in 1..new.parcelas loop
    if i = new.parcelas then
      v_valor := new.total - (v_parcela * (new.parcelas - 1));
    else
      v_valor := v_parcela;
    end if;

    v_vencimento := (new.primeiro_vencimento + make_interval(months => i - 1))::date;

    insert into public.titulos_financeiros(
      tipo,
      descricao,
      entidade_nome,
      vencimento,
      valor,
      valor_pago,
      status,
      categoria,
      centro_custo,
      venda_id,
      parcela_numero,
      forma_pagamento
    )
    values (
      'receber',
      'Fatura ' || lpad(new.fatura_numero::text,7,'0') ||
        ' - Parcela ' || i::text || '/' || new.parcelas::text,
      coalesce(v_cliente,'Consumidor'),
      v_vencimento,
      v_valor,
      0,
      'aberto',
      'Vendas',
      'Comercial',
      new.id,
      i,
      new.forma_pagamento
    );
  end loop;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.situacao_credito_cliente_impl(p_cliente_id uuid, p_excluir_venda_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(limite_credito numeric, em_aberto numeric, vencido numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo
      and p.perfil in ('administrador','vendas')
  ) then
    raise exception 'Perfil sem permissão para consultar situação de crédito';
  end if;

  return query
  select
    coalesce(c.limite_credito,0),
    coalesce(sum(
      case when t.status not in ('pago','cancelado')
        then greatest(t.valor-t.valor_pago,0) else 0 end
    ),0),
    coalesce(sum(
      case when t.status not in ('pago','cancelado')
                 and t.vencimento < current_date
        then greatest(t.valor-t.valor_pago,0) else 0 end
    ),0)
  from public.clientes c
  left join public.vendas v
    on v.cliente_id=c.id
   and v.status<>'cancelado'
   and (p_excluir_venda_id is null or v.id<>p_excluir_venda_id)
  left join public.titulos_financeiros t
    on t.venda_id=v.id
   and t.tipo='receber'
  where c.id=p_cliente_id
  group by c.limite_credito;
end;
$function$;
CREATE OR REPLACE FUNCTION private.validar_fluxo_compra_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.status='cancelada' and new.status<>'cancelada' then
    raise exception 'Compra cancelada nao pode ser reativada';
  end if;

  if old.status='pedido_recebido'
     and new.status not in ('pedido_recebido','cancelada') then
    raise exception 'Pedido recebido nao pode voltar para uma etapa anterior';
  end if;

  if old.status='pedido_aprovado'
     and new.status='cotacao' then
    raise exception 'Pedido aprovado nao pode voltar para cotacao';
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.venda_consumindo_estoque(p_status text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_status in ('pedido','faturado');
$function$;
CREATE OR REPLACE FUNCTION public.ajustar_estoque_produto(p_produto_id uuid, p_novo_estoque numeric, p_motivo text)
 RETURNS produtos
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_produto public.produtos%rowtype;
  v_anterior numeric;
begin
  if p_novo_estoque < 0 then
    raise exception 'Estoque não pode ser negativo';
  end if;

  select estoque_atual into v_anterior
  from public.produtos
  where id = p_produto_id
  for update;

  if not found then
    raise exception 'Produto não encontrado';
  end if;

  update public.produtos
  set estoque_atual = p_novo_estoque
  where id = p_produto_id
  returning * into v_produto;

  insert into public.movimentos_estoque(produto_id,tipo,quantidade,referencia)
  values (
    p_produto_id,
    'ajuste',
    p_novo_estoque-v_anterior,
    coalesce(nullif(p_motivo,''),'Ajuste manual de estoque')
  );

  return v_produto;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atualizar_compra_completa(p_compra_id uuid, p_fornecedor_id uuid, p_status text, p_forma_pagamento text, p_parcelas integer, p_primeiro_vencimento date, p_vencimentos jsonb, p_observacoes text, p_itens jsonb)
 RETURNS compras
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_old public.compras%rowtype;
  v_compra public.compras%rowtype;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_custo numeric;
  v_total numeric := 0;
begin
  select * into v_old
  from public.compras
  where id=p_compra_id
  for update;

  if not found then raise exception 'Compra nao encontrada'; end if;
  if v_old.status='cancelada' then raise exception 'Compra cancelada nao pode ser editada'; end if;
  if p_status not in ('cotacao','pedido_aprovado','pedido_recebido') then
    raise exception 'Status invalido';
  end if;
  if p_forma_pagamento not in ('pix','cartao','boleto') then
    raise exception 'Forma de pagamento invalida';
  end if;

  if (p_forma_pagamento='pix' and p_parcelas<>1)
     or (p_forma_pagamento='cartao' and (p_parcelas<1 or p_parcelas>12))
     or (p_forma_pagamento='boleto' and (p_parcelas<1 or p_parcelas>24)) then
    raise exception 'Quantidade de parcelas invalida';
  end if;

  if jsonb_typeof(p_vencimentos)<>'array'
     or jsonb_array_length(p_vencimentos)<>p_parcelas then
    raise exception 'Informe uma data para cada parcela';
  end if;

  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then
    raise exception 'A compra precisa ter pelo menos um item';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := nullif(v_item->>'produto_id','')::uuid;
    v_quantidade := coalesce((v_item->>'quantidade')::numeric,0);
    v_custo := coalesce((v_item->>'custo_unitario')::numeric,0);
    if v_produto_id is null or v_quantidade<=0 or v_custo<0 then
      raise exception 'Item de compra invalido';
    end if;
    v_total := v_total+(v_quantidade*v_custo);
  end loop;

  -- Compra recebida nao pode ter itens/valores alterados pela edicao comum.
  if v_old.status='pedido_recebido' then
    if p_status<>'pedido_recebido' then
      raise exception 'Pedido recebido nao pode voltar para uma etapa anterior';
    end if;

    if v_old.fornecedor_id is distinct from p_fornecedor_id
       or v_old.total is distinct from v_total
       or v_old.forma_pagamento is distinct from p_forma_pagamento
       or v_old.parcelas is distinct from p_parcelas
       or v_old.vencimentos_parcelas is distinct from p_vencimentos then
      raise exception 'Pedido recebido nao permite alterar fornecedor, itens, valores ou cobranca';
    end if;

    update public.compras
       set observacoes=nullif(p_observacoes,''),
           updated_at=now()
     where id=p_compra_id
     returning * into v_compra;

    return v_compra;
  end if;

  -- Atualiza dados financeiros mantendo temporariamente o status antigo.
  update public.compras
     set fornecedor_id=p_fornecedor_id,
         total=v_total,
         observacoes=nullif(p_observacoes,''),
         forma_pagamento=p_forma_pagamento,
         parcelas=p_parcelas,
         primeiro_vencimento=(p_vencimentos->>0)::date,
         vencimentos_parcelas=p_vencimentos,
         updated_at=now()
   where id=p_compra_id;

  -- Itens sao substituidos enquanto a compra ainda nao consome estoque.
  delete from public.compra_itens where compra_id=p_compra_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := (v_item->>'produto_id')::uuid;
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_custo := (v_item->>'custo_unitario')::numeric;
    insert into public.compra_itens(compra_id,produto_id,quantidade,custo_unitario,total)
    values (p_compra_id,v_produto_id,v_quantidade,v_custo,v_quantidade*v_custo);
  end loop;

  -- Status muda por ultimo. Ao entrar em pedido_recebido, o trigger faz uma unica entrada.
  update public.compras
     set status=p_status,
         updated_at=now()
   where id=p_compra_id
   returning * into v_compra;

  return v_compra;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atualizar_usuario_erp(p_user_id uuid, p_nome text, p_perfil text, p_ativo boolean)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.atualizar_usuario_erp_impl(p_user_id,p_nome,p_perfil,p_ativo);
$function$;
CREATE OR REPLACE FUNCTION public.atualizar_venda_completa(p_venda_id uuid, p_cliente_id uuid, p_vendedor_cadastro_id uuid, p_status text, p_forma_pagamento text, p_parcelas integer, p_primeiro_vencimento date, p_observacoes text, p_itens jsonb)
 RETURNS vendas
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_existente public.vendas%rowtype;
  v_venda public.vendas%rowtype;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_desconto_item numeric;
  v_total_item numeric;
  v_subtotal numeric := 0;
  v_desconto numeric := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  select * into v_existente
  from public.vendas
  where id=p_venda_id
  for update;

  if not found then raise exception 'Venda não encontrada'; end if;
  if v_existente.status='cancelado' then raise exception 'Venda cancelada não pode ser editada'; end if;

  if p_vendedor_cadastro_id is not null
     and not exists (
       select 1 from public.vendedores
       where id=p_vendedor_cadastro_id and ativo=true
     ) then
    raise exception 'Vendedor inválido ou inativo';
  end if;

  if p_status not in ('orcamento','pedido','faturado') then
    raise exception 'Status inválido para edição';
  end if;

  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then
    raise exception 'A venda precisa ter pelo menos um item';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := nullif(v_item->>'produto_id','')::uuid;
    v_quantidade := coalesce((v_item->>'quantidade')::numeric,0);
    v_valor_unitario := coalesce((v_item->>'valor_unitario')::numeric,0);
    v_desconto_item := greatest(coalesce((v_item->>'desconto')::numeric,0),0);

    if v_produto_id is null or v_quantidade<=0 or v_valor_unitario<0 then
      raise exception 'Item de venda inválido';
    end if;

    v_desconto_item := least(v_desconto_item,v_quantidade*v_valor_unitario);
    v_subtotal := v_subtotal+(v_quantidade*v_valor_unitario);
    v_desconto := v_desconto+v_desconto_item;
  end loop;

  update public.vendas
  set cliente_id=p_cliente_id,
      vendedor_cadastro_id=p_vendedor_cadastro_id,
      status=p_status,
      subtotal=v_subtotal,
      desconto=v_desconto,
      total=greatest(v_subtotal-v_desconto,0),
      observacoes=nullif(p_observacoes,''),
      forma_pagamento=p_forma_pagamento,
      parcelas=p_parcelas,
      primeiro_vencimento=p_primeiro_vencimento
  where id=p_venda_id
  returning * into v_venda;

  delete from public.venda_itens where venda_id=p_venda_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := (v_item->>'produto_id')::uuid;
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_valor_unitario := (v_item->>'valor_unitario')::numeric;
    v_desconto_item := least(
      greatest(coalesce((v_item->>'desconto')::numeric,0),0),
      v_quantidade*v_valor_unitario
    );
    v_total_item := greatest((v_quantidade*v_valor_unitario)-v_desconto_item,0);

    insert into public.venda_itens(
      venda_id,produto_id,quantidade,valor_unitario,desconto,total
    )
    values (
      p_venda_id,v_produto_id,v_quantidade,v_valor_unitario,v_desconto_item,v_total_item
    );
  end loop;

  return v_venda;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atualizar_venda_completa_admin_sem_estoque(p_venda_id uuid, p_cliente_id uuid, p_vendedor_cadastro_id uuid, p_status text, p_forma_pagamento text, p_parcelas integer, p_primeiro_vencimento date, p_observacoes text, p_itens jsonb)
 RETURNS vendas
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_venda public.vendas%rowtype;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo
      and p.perfil='administrador'
  ) then
    raise exception 'Apenas um administrador pode autorizar venda sem estoque';
  end if;

  if p_status not in ('pedido','faturado') then
    raise exception 'Autorização de estoque só é necessária para pedido ou faturado';
  end if;

  perform set_config('app.allow_negative_stock','true',true);

  v_venda := public.atualizar_venda_completa(
    p_venda_id,
    p_cliente_id,
    p_vendedor_cadastro_id,
    p_status,
    p_forma_pagamento,
    p_parcelas,
    p_primeiro_vencimento,
    p_observacoes,
    p_itens
  );

  update public.vendas
     set estoque_negativo_autorizado_por=(select auth.uid()),
         estoque_negativo_autorizado_em=now()
   where id=v_venda.id
   returning * into v_venda;

  return v_venda;
end;
$function$;
CREATE OR REPLACE FUNCTION public.comissoes_por_periodo(p_inicio date, p_fim date)
 RETURNS TABLE(vendedor_id uuid, vendedor_nome text, percentual_comissao numeric, total_recebido numeric, comissao_apurada numeric, pagamentos integer, vendas integer)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select
    vd.id,
    vd.nome,
    vd.percentual_comissao,
    coalesce(sum(pg.valor) filter (
      where pg.data_pagamento between p_inicio and p_fim
        and pg.vendedor_id=vd.id
    ),0)::numeric as total_recebido,
    coalesce(sum(pg.valor * coalesce(pg.percentual_comissao,0) / 100) filter (
      where pg.data_pagamento between p_inicio and p_fim
        and pg.vendedor_id=vd.id
    ),0)::numeric as comissao_apurada,
    count(pg.id) filter (
      where pg.data_pagamento between p_inicio and p_fim
        and pg.vendedor_id=vd.id
    )::integer as pagamentos,
    count(distinct t.venda_id) filter (
      where pg.data_pagamento between p_inicio and p_fim
        and pg.vendedor_id=vd.id
    )::integer as vendas
  from public.vendedores vd
  left join public.pagamentos_titulos pg on pg.vendedor_id=vd.id
  left join public.titulos_financeiros t on t.id=pg.titulo_id
  where vd.ativo=true
  group by vd.id,vd.nome,vd.percentual_comissao
  order by vd.nome;
$function$;
CREATE OR REPLACE FUNCTION public.criar_compra_completa(p_fornecedor_id uuid, p_status text, p_forma_pagamento text, p_parcelas integer, p_primeiro_vencimento date, p_vencimentos jsonb, p_observacoes text, p_itens jsonb)
 RETURNS compras
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_compra public.compras%rowtype;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_custo numeric;
  v_total numeric := 0;
begin
  if p_status not in ('cotacao','pedido_aprovado','pedido_recebido') then
    raise exception 'Status invalido';
  end if;
  if p_forma_pagamento not in ('pix','cartao','boleto') then
    raise exception 'Forma de pagamento invalida';
  end if;

  if (p_forma_pagamento='pix' and p_parcelas<>1)
     or (p_forma_pagamento='cartao' and (p_parcelas<1 or p_parcelas>12))
     or (p_forma_pagamento='boleto' and (p_parcelas<1 or p_parcelas>24)) then
    raise exception 'Quantidade de parcelas invalida';
  end if;

  if jsonb_typeof(p_vencimentos)<>'array'
     or jsonb_array_length(p_vencimentos)<>p_parcelas then
    raise exception 'Informe uma data para cada parcela';
  end if;

  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then
    raise exception 'A compra precisa ter pelo menos um item';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := nullif(v_item->>'produto_id','')::uuid;
    v_quantidade := coalesce((v_item->>'quantidade')::numeric,0);
    v_custo := coalesce((v_item->>'custo_unitario')::numeric,0);
    if v_produto_id is null or v_quantidade<=0 or v_custo<0 then
      raise exception 'Item de compra invalido';
    end if;
    v_total := v_total+(v_quantidade*v_custo);
  end loop;

  insert into public.compras(
    fornecedor_id,status,total,observacoes,
    forma_pagamento,parcelas,primeiro_vencimento,vencimentos_parcelas
  )
  values (
    p_fornecedor_id,p_status,v_total,nullif(p_observacoes,''),
    p_forma_pagamento,p_parcelas,
    coalesce(nullif(p_vencimentos->>0,'')::date,p_primeiro_vencimento),
    p_vencimentos
  )
  returning * into v_compra;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := (v_item->>'produto_id')::uuid;
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_custo := (v_item->>'custo_unitario')::numeric;
    insert into public.compra_itens(compra_id,produto_id,quantidade,custo_unitario,total)
    values (v_compra.id,v_produto_id,v_quantidade,v_custo,v_quantidade*v_custo);
  end loop;

  return v_compra;
end;
$function$;
CREATE OR REPLACE FUNCTION public.criar_venda_completa(p_cliente_id uuid, p_vendedor_cadastro_id uuid, p_status text, p_forma_pagamento text, p_parcelas integer, p_primeiro_vencimento date, p_observacoes text, p_itens jsonb)
 RETURNS vendas
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_venda public.vendas%rowtype;
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_desconto_item numeric;
  v_total_item numeric;
  v_subtotal numeric := 0;
  v_desconto numeric := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_vendedor_cadastro_id is not null
     and not exists (
       select 1 from public.vendedores
       where id=p_vendedor_cadastro_id and ativo=true
     ) then
    raise exception 'Vendedor inválido ou inativo';
  end if;

  if p_status not in ('orcamento','pedido','faturado') then
    raise exception 'Status inválido para nova venda';
  end if;

  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then
    raise exception 'A venda precisa ter pelo menos um item';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := nullif(v_item->>'produto_id','')::uuid;
    v_quantidade := coalesce((v_item->>'quantidade')::numeric,0);
    v_valor_unitario := coalesce((v_item->>'valor_unitario')::numeric,0);
    v_desconto_item := greatest(coalesce((v_item->>'desconto')::numeric,0),0);

    if v_produto_id is null or v_quantidade<=0 or v_valor_unitario<0 then
      raise exception 'Item de venda inválido';
    end if;

    v_desconto_item := least(v_desconto_item,v_quantidade*v_valor_unitario);
    v_subtotal := v_subtotal+(v_quantidade*v_valor_unitario);
    v_desconto := v_desconto+v_desconto_item;
  end loop;

  insert into public.vendas(
    cliente_id,vendedor_id,vendedor_cadastro_id,status,
    subtotal,desconto,total,observacoes,
    forma_pagamento,parcelas,primeiro_vencimento
  )
  values (
    p_cliente_id,(select auth.uid()),p_vendedor_cadastro_id,p_status,
    v_subtotal,v_desconto,greatest(v_subtotal-v_desconto,0),nullif(p_observacoes,''),
    p_forma_pagamento,p_parcelas,p_primeiro_vencimento
  )
  returning * into v_venda;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_produto_id := (v_item->>'produto_id')::uuid;
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_valor_unitario := (v_item->>'valor_unitario')::numeric;
    v_desconto_item := least(
      greatest(coalesce((v_item->>'desconto')::numeric,0),0),
      v_quantidade*v_valor_unitario
    );
    v_total_item := greatest((v_quantidade*v_valor_unitario)-v_desconto_item,0);

    insert into public.venda_itens(
      venda_id,produto_id,quantidade,valor_unitario,desconto,total
    )
    values (
      v_venda.id,v_produto_id,v_quantidade,v_valor_unitario,v_desconto_item,v_total_item
    );
  end loop;

  return v_venda;
end;
$function$;
CREATE OR REPLACE FUNCTION public.criar_venda_completa_admin_sem_estoque(p_cliente_id uuid, p_vendedor_cadastro_id uuid, p_status text, p_forma_pagamento text, p_parcelas integer, p_primeiro_vencimento date, p_observacoes text, p_itens jsonb)
 RETURNS vendas
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_venda public.vendas%rowtype;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo
      and p.perfil='administrador'
  ) then
    raise exception 'Apenas um administrador pode autorizar venda sem estoque';
  end if;

  if p_status not in ('pedido','faturado') then
    raise exception 'Autorização de estoque só é necessária para pedido ou faturado';
  end if;

  perform set_config('app.allow_negative_stock','true',true);

  v_venda := public.criar_venda_completa(
    p_cliente_id,
    p_vendedor_cadastro_id,
    p_status,
    p_forma_pagamento,
    p_parcelas,
    p_primeiro_vencimento,
    p_observacoes,
    p_itens
  );

  update public.vendas
     set estoque_negativo_autorizado_por=(select auth.uid()),
         estoque_negativo_autorizado_em=now()
   where id=v_venda.id
   returning * into v_venda;

  return v_venda;
end;
$function$;
CREATE OR REPLACE FUNCTION public.definir_perfil_visualizador(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.definir_visualizador(p_user_id);
$function$;
CREATE OR REPLACE FUNCTION public.importar_produtos_estoque(p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_linha jsonb;
  v_codigo text;
  v_descricao text;
  v_unidade text;
  v_custo numeric;
  v_preco numeric;
  v_estoque numeric;
  v_minimo numeric;
  v_ativo boolean;
  v_produto public.produtos%rowtype;
  v_anterior numeric;
  v_inseridos integer := 0;
  v_atualizados integer := 0;
  v_ajustes integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo
      and p.perfil in ('administrador','estoque')
  ) then
    raise exception 'Usuário sem permissão para importar produtos/estoque';
  end if;

  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas)=0 then
    raise exception 'A planilha não possui linhas válidas';
  end if;

  for v_linha in select value from jsonb_array_elements(p_linhas)
  loop
    v_codigo := btrim(coalesce(v_linha->>'codigo',''));
    v_descricao := btrim(coalesce(v_linha->>'descricao',''));
    v_unidade := upper(btrim(coalesce(v_linha->>'unidade','UN')));
    v_custo := greatest(coalesce(nullif(v_linha->>'custo','')::numeric,0),0);
    v_preco := greatest(coalesce(nullif(v_linha->>'preco_venda','')::numeric,0),0);
    v_estoque := greatest(coalesce(nullif(v_linha->>'estoque_atual','')::numeric,0),0);
    v_minimo := greatest(coalesce(nullif(v_linha->>'estoque_minimo','')::numeric,0),0);
    v_ativo := case lower(coalesce(v_linha->>'ativo','true'))
      when 'false' then false
      when '0' then false
      when 'nao' then false
      when 'não' then false
      when 'inativo' then false
      else true
    end;

    if v_codigo='' or v_descricao='' then
      raise exception 'Código e descrição são obrigatórios em todas as linhas';
    end if;

    select * into v_produto
    from public.produtos
    where codigo=v_codigo
    for update;

    if found then
      v_anterior := v_produto.estoque_atual;

      update public.produtos
      set descricao=v_descricao,
          unidade=v_unidade,
          custo=v_custo,
          preco_venda=v_preco,
          estoque_atual=v_estoque,
          estoque_minimo=v_minimo,
          ativo=v_ativo
      where id=v_produto.id;

      v_atualizados := v_atualizados + 1;

      if v_anterior is distinct from v_estoque then
        insert into public.movimentos_estoque(produto_id,tipo,quantidade,referencia)
        values (
          v_produto.id,
          'ajuste',
          v_estoque-v_anterior,
          'Importação Excel - estoque anterior ' || v_anterior::text || ' / novo ' || v_estoque::text
        );
        v_ajustes := v_ajustes + 1;
      end if;
    else
      insert into public.produtos(
        codigo,descricao,unidade,custo,preco_venda,estoque_atual,estoque_minimo,ativo
      )
      values (
        v_codigo,v_descricao,v_unidade,v_custo,v_preco,v_estoque,v_minimo,v_ativo
      )
      returning * into v_produto;

      v_inseridos := v_inseridos + 1;

      if v_estoque <> 0 then
        insert into public.movimentos_estoque(produto_id,tipo,quantidade,referencia)
        values (
          v_produto.id,'ajuste',v_estoque,'Importação Excel - estoque inicial'
        );
        v_ajustes := v_ajustes + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'inseridos',v_inseridos,
    'atualizados',v_atualizados,
    'ajustes_estoque',v_ajustes,
    'total_linhas',jsonb_array_length(p_linhas)
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.listar_usuarios_erp()
 RETURNS TABLE(user_id uuid, nome text, email text, perfil text, ativo boolean, criado_em timestamp with time zone, ultimo_acesso timestamp with time zone, usuario_atual boolean)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.listar_usuarios_erp_impl();
$function$;
CREATE OR REPLACE FUNCTION public.registrar_pagamento_titulo(p_titulo_id uuid, p_valor numeric, p_data_pagamento date, p_observacao text DEFAULT NULL::text)
 RETURNS titulos_financeiros
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_titulo public.titulos_financeiros%rowtype;
  v_total_pago numeric;
  v_vendedor_id uuid;
  v_percentual numeric;
begin
  select * into v_titulo
  from public.titulos_financeiros
  where id=p_titulo_id
  for update;

  if not found then raise exception 'Título não encontrado'; end if;
  if v_titulo.status='cancelado' then raise exception 'Título cancelado não pode receber pagamento'; end if;
  if p_valor<=0 then raise exception 'Valor do pagamento deve ser maior que zero'; end if;
  if p_valor>greatest(v_titulo.valor-v_titulo.valor_pago,0) then
    raise exception 'Pagamento maior que o saldo em aberto';
  end if;

  if exists(
    select 1 from public.fechamentos_comissao f
    where p_data_pagamento between f.inicio and f.fim
  ) and v_titulo.tipo='receber' and v_titulo.venda_id is not null then
    raise exception 'Período de comissão já fechado; recebimento retroativo bloqueado';
  end if;

  if v_titulo.tipo='receber' and v_titulo.venda_id is not null then
    select v.vendedor_cadastro_id, vd.percentual_comissao
      into v_vendedor_id, v_percentual
    from public.vendas v
    left join public.vendedores vd on vd.id=v.vendedor_cadastro_id
    where v.id=v_titulo.venda_id;
  end if;

  insert into public.pagamentos_titulos(
    titulo_id,data_pagamento,valor,observacao,vendedor_id,percentual_comissao,forma_pagamento
  )
  values (
    p_titulo_id,p_data_pagamento,p_valor,nullif(p_observacao,''),
    v_vendedor_id,v_percentual,v_titulo.forma_pagamento
  );

  select coalesce(sum(valor),0) into v_total_pago
  from public.pagamentos_titulos where titulo_id=p_titulo_id;

  update public.titulos_financeiros
  set valor_pago=v_total_pago,
      status=case when v_total_pago>=valor then 'pago'
                  when v_total_pago>0 then 'parcial'
                  else 'aberto' end
  where id=p_titulo_id
  returning * into v_titulo;

  return v_titulo;
end;
$function$;
CREATE OR REPLACE FUNCTION public.relatorio_comissoes_vendas(p_inicio date, p_fim date)
 RETURNS TABLE(pagamento_id uuid, venda_id uuid, vendedor_id uuid, fatura_numero bigint, parcela_numero smallint, data_pagamento date, cliente text, vendedor text, forma_pagamento text, valor_venda numeric, valor_recebido numeric, percentual_comissao numeric, comissao_apurada numeric)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select
    pg.id,
    v.id,
    coalesce(pg.vendedor_id,v.vendedor_cadastro_id),
    v.fatura_numero,
    t.parcela_numero,
    pg.data_pagamento,
    coalesce(c.nome,'Consumidor'),
    coalesce(vd.nome,'Sem vendedor'),
    coalesce(t.forma_pagamento,v.forma_pagamento),
    v.total,
    pg.valor,
    coalesce(pg.percentual_comissao,vd.percentual_comissao,0),
    (pg.valor * coalesce(pg.percentual_comissao,vd.percentual_comissao,0) / 100)::numeric
  from public.pagamentos_titulos pg
  join public.titulos_financeiros t
    on t.id=pg.titulo_id
   and t.tipo='receber'
   and t.venda_id is not null
  join public.vendas v on v.id=t.venda_id
  left join public.clientes c on c.id=v.cliente_id
  left join public.vendedores vd on vd.id=coalesce(pg.vendedor_id,v.vendedor_cadastro_id)
  where pg.data_pagamento between p_inicio and p_fim
  order by pg.data_pagamento,v.fatura_numero,t.parcela_numero,pg.created_at;
$function$;
CREATE OR REPLACE FUNCTION public.situacao_credito_cliente(p_cliente_id uuid, p_excluir_venda_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(limite_credito numeric, em_aberto numeric, vencido numeric)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.situacao_credito_cliente_impl(p_cliente_id,p_excluir_venda_id);
$function$;