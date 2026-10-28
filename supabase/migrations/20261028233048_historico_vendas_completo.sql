-- Historico completo de vendas: amplia auditoria e expoe somente a venda solicitada.
do $$
declare t text;
begin
  foreach t in array array[
    'venda_itens',
    'comprovantes_pagamento',
    'notas_fiscais_teste',
    'estornos_pagamentos'
  ]
  loop
    execute format('drop trigger if exists trg_auditoria_%I on public.%I',t,t);
    execute format(
      'create trigger trg_auditoria_%I after insert or update or delete on public.%I for each row execute function private.registrar_auditoria()',
      t,t
    );
  end loop;
end $$;

create or replace function public.historico_venda(p_venda_id uuid)
returns table(
  evento_id text,
  fonte text,
  acao text,
  usuario_id uuid,
  usuario_nome text,
  usuario_perfil text,
  ocorrido_em timestamptz,
  dados_antes jsonb,
  dados_depois jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fatura text;
begin
  if (select auth.uid()) is null or not private.usuario_pode('vendas','visualizar') then
    raise exception 'Sem permissão para visualizar o histórico da venda';
  end if;

  select lpad(coalesce(v.fatura_numero,0)::text,7,'0')
    into v_fatura
  from public.vendas v
  where v.id=p_venda_id;

  if v_fatura is null then
    raise exception 'Venda não encontrada';
  end if;

  return query
  with audit_rows as (
    select
      'audit:'||a.id::text as evento_id,
      a.tabela as fonte,
      a.acao,
      a.usuario_id,
      coalesce(p.nome,case when a.usuario_id is null then 'Sistema' else 'Usuário' end) as usuario_nome,
      p.perfil::text as usuario_perfil,
      a.ocorrido_em,
      a.dados_antes,
      a.dados_depois
    from public.auditoria_log a
    left join public.profiles p on p.id=a.usuario_id
    where
      (a.tabela='vendas' and a.registro_id=p_venda_id::text)
      or (
        a.tabela in ('venda_itens','titulos_financeiros','comprovantes_pagamento','notas_fiscais_teste')
        and coalesce(a.dados_depois->>'venda_id',a.dados_antes->>'venda_id')=p_venda_id::text
      )
      or (
        a.tabela='pagamentos_titulos'
        and exists(
          select 1 from public.titulos_financeiros t
          where t.id=coalesce(a.dados_depois->>'titulo_id',a.dados_antes->>'titulo_id')::uuid
            and t.venda_id=p_venda_id
        )
      )
      or (
        a.tabela='estornos_pagamentos'
        and exists(
          select 1
          from public.pagamentos_titulos pg
          join public.titulos_financeiros t on t.id=pg.titulo_id
          where pg.id=coalesce(a.dados_depois->>'pagamento_id',a.dados_antes->>'pagamento_id')::uuid
            and t.venda_id=p_venda_id
        )
      )
  ),
  approval_rows as (
    select
      'approval:req:'||a.id::text,
      'autorizacoes',
      'REQUEST',
      a.solicitado_por,
      coalesce(p.nome,'Usuário'),
      p.perfil::text,
      a.solicitado_em,
      null::jsonb,
      jsonb_build_object(
        'status','pendente',
        'motivo',a.motivo,
        'detalhes',a.detalhes,
        'payload',a.payload
      )
    from public.aprovacoes_operacoes a
    left join public.profiles p on p.id=a.solicitado_por
    where a.entidade_tipo='venda' and a.entidade_id=p_venda_id

    union all

    select
      'approval:decision:'||a.id::text,
      'autorizacoes',
      upper(a.status),
      a.aprovado_por,
      coalesce(p.nome,'Usuário'),
      p.perfil::text,
      a.aprovado_em,
      jsonb_build_object('status','pendente'),
      jsonb_build_object(
        'status',a.status,
        'motivo',a.decisao_motivo,
        'resultado_id',a.resultado_id
      )
    from public.aprovacoes_operacoes a
    left join public.profiles p on p.id=a.aprovado_por
    where a.entidade_tipo='venda'
      and a.entidade_id=p_venda_id
      and a.aprovado_em is not null
  ),
  stock_rows as (
    select
      'stock:'||m.id::text,
      'estoque',
      upper(m.tipo),
      null::uuid,
      'Sistema',
      null::text,
      m.created_at,
      null::jsonb,
      jsonb_build_object(
        'produto_id',m.produto_id,
        'produto_codigo',p.codigo,
        'produto',p.descricao,
        'quantidade',m.quantidade,
        'referencia',m.referencia
      )
    from public.movimentos_estoque m
    join public.produtos p on p.id=m.produto_id
    where m.referencia ilike '%#'||v_fatura||'%'
  ),
  legacy_attachment_rows as (
    select
      'attachment:'||c.id::text,
      'comprovantes_pagamento',
      'INSERT',
      c.uploaded_by,
      coalesce(p.nome,'Usuário'),
      p.perfil::text,
      c.created_at,
      null::jsonb,
      to_jsonb(c)
    from public.comprovantes_pagamento c
    left join public.profiles p on p.id=c.uploaded_by
    where c.venda_id=p_venda_id
      and not exists(
        select 1 from public.auditoria_log a
        where a.tabela='comprovantes_pagamento' and a.registro_id=c.id::text
      )
  ),
  legacy_nfe_rows as (
    select
      'nfe:'||n.id::text,
      'notas_fiscais_teste',
      'INSERT',
      n.criado_por,
      coalesce(p.nome,'Usuário'),
      p.perfil::text,
      n.created_at,
      null::jsonb,
      jsonb_build_object(
        'venda_id',n.venda_id,
        'referencia',n.referencia,
        'ambiente',n.ambiente,
        'status',n.status
      )
    from public.notas_fiscais_teste n
    left join public.profiles p on p.id=n.criado_por
    where n.venda_id=p_venda_id
      and not exists(
        select 1 from public.auditoria_log a
        where a.tabela='notas_fiscais_teste' and a.registro_id=n.id::text
      )
  )
  select * from audit_rows
  union all select * from approval_rows
  union all select * from stock_rows
  union all select * from legacy_attachment_rows
  union all select * from legacy_nfe_rows
  order by ocorrido_em desc nulls last;
end;
$$;

revoke all on function public.historico_venda(uuid) from public,anon;
grant execute on function public.historico_venda(uuid) to authenticated;
