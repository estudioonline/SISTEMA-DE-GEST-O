-- Modelos de conciliação, regras automáticas e transferências internas.
create table if not exists public.modelos_conciliacao_bancaria (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  texto_correspondencia text not null,
  tipo_correspondencia text not null default 'contem'
    check (tipo_correspondencia in ('contem','comeca','exato')),
  tipo_transacao text not null default 'ANY'
    check (tipo_transacao in ('ANY','CREDIT','DEBIT')),
  parceiro_nome text,
  parceiro_tipo text check (parceiro_tipo is null or parceiro_tipo in ('cliente','fornecedor','outro')),
  conta_categoria text,
  centro_custo text,
  aplicar_automaticamente boolean not null default false,
  prioridade integer not null default 100,
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.modelos_conciliacao_bancaria enable row level security;
grant select,insert,update,delete on public.modelos_conciliacao_bancaria to authenticated;

drop policy if exists modelos_conciliacao_select on public.modelos_conciliacao_bancaria;
create policy modelos_conciliacao_select on public.modelos_conciliacao_bancaria
for select to authenticated using (private.usuario_pode('financeiro','visualizar'));
drop policy if exists modelos_conciliacao_insert on public.modelos_conciliacao_bancaria;
create policy modelos_conciliacao_insert on public.modelos_conciliacao_bancaria
for insert to authenticated with check (private.usuario_pode('financeiro','editar'));
drop policy if exists modelos_conciliacao_update on public.modelos_conciliacao_bancaria;
create policy modelos_conciliacao_update on public.modelos_conciliacao_bancaria
for update to authenticated using (private.usuario_pode('financeiro','editar'))
with check (private.usuario_pode('financeiro','editar'));
drop policy if exists modelos_conciliacao_delete on public.modelos_conciliacao_bancaria;
create policy modelos_conciliacao_delete on public.modelos_conciliacao_bancaria
for delete to authenticated using (private.usuario_pode('financeiro','editar'));
create index if not exists modelos_conciliacao_ativo_prioridade_idx
  on public.modelos_conciliacao_bancaria(ativo,prioridade);

create table if not exists public.transferencias_bancarias_internas (
  id uuid primary key default gen_random_uuid(),
  transacao_saida_id uuid not null unique references public.transacoes_bancarias(id),
  transacao_entrada_id uuid not null unique references public.transacoes_bancarias(id),
  diario_saida_id uuid not null references public.diarios_bancarios(id),
  diario_entrada_id uuid not null references public.diarios_bancarios(id),
  valor numeric not null check (valor > 0),
  data_saida date not null,
  data_entrada date not null,
  status text not null default 'conciliada' check (status in ('conciliada','revertida')),
  criado_por uuid default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  revertido_por uuid references auth.users(id),
  revertido_em timestamptz,
  motivo_reversao text
);

alter table public.transferencias_bancarias_internas enable row level security;
grant select,insert,update on public.transferencias_bancarias_internas to authenticated;

drop policy if exists transferencias_internas_select on public.transferencias_bancarias_internas;
create policy transferencias_internas_select on public.transferencias_bancarias_internas
for select to authenticated using (private.usuario_pode('financeiro','visualizar'));
drop policy if exists transferencias_internas_insert on public.transferencias_bancarias_internas;
create policy transferencias_internas_insert on public.transferencias_bancarias_internas
for insert to authenticated with check (private.usuario_pode('financeiro','editar'));
drop policy if exists transferencias_internas_update on public.transferencias_bancarias_internas;
create policy transferencias_internas_update on public.transferencias_bancarias_internas
for update to authenticated using (private.usuario_pode('financeiro','editar'))
with check (private.usuario_pode('financeiro','editar'));
create index if not exists transferencias_internas_diarios_idx on public.transferencias_bancarias_internas(diario_saida_id,diario_entrada_id);
create index if not exists transferencias_internas_criado_por_idx on public.transferencias_bancarias_internas(criado_por);

create or replace function public.aplicar_modelos_conciliacao_bancaria(p_transacao_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare tx public.transacoes_bancarias%rowtype; m public.modelos_conciliacao_bancaria%rowtype; hay text; matched boolean; applied_count integer:=0; reconciled_count integer:=0;
begin
  if not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para aplicar modelos de conciliação.'; end if;
  for tx in select * from public.transacoes_bancarias where status in ('pendente','parcial') and (p_transacao_id is null or id=p_transacao_id) order by data_lancamento desc,criado_em desc loop
    hay:=lower(coalesce(tx.nome,'')||' '||coalesce(tx.historico,''));
    for m in select * from public.modelos_conciliacao_bancaria where ativo and (tipo_transacao='ANY' or tipo_transacao=tx.trntype) order by prioridade asc,created_at asc loop
      matched:=case m.tipo_correspondencia when 'exato' then btrim(hay)=lower(btrim(m.texto_correspondencia)) when 'comeca' then btrim(hay) like lower(btrim(m.texto_correspondencia))||'%' else hay like '%'||lower(btrim(m.texto_correspondencia))||'%' end;
      if matched then
        update public.transacoes_bancarias set parceiro_nome=coalesce(m.parceiro_nome,parceiro_nome),parceiro_tipo=coalesce(m.parceiro_tipo,parceiro_tipo),conta_categoria=coalesce(m.conta_categoria,conta_categoria),centro_custo=coalesce(m.centro_custo,centro_custo) where id=tx.id;
        applied_count:=applied_count+1;
        if m.aplicar_automaticamente and m.conta_categoria is not null then perform public.classificar_transacao_bancaria(tx.id,m.conta_categoria,m.centro_custo); reconciled_count:=reconciled_count+1; end if;
        exit;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('aplicados',applied_count,'conciliados_automaticamente',reconciled_count);
end;
$$;
revoke execute on function public.aplicar_modelos_conciliacao_bancaria(uuid) from public,anon;
grant execute on function public.aplicar_modelos_conciliacao_bancaria(uuid) to authenticated;

create or replace function public.detectar_transferencias_bancarias_internas(p_dias integer default 2)
returns table(saida_id uuid,entrada_id uuid,diario_saida_id uuid,diario_entrada_id uuid,diario_saida text,diario_entrada text,valor numeric,data_saida date,data_entrada date,dias_diferenca integer)
language sql security invoker set search_path=public,pg_temp as $$
  with candidates as (
    select s.id saida_id,e.id entrada_id,s.diario_id diario_saida_id,e.diario_id diario_entrada_id,ds.nome diario_saida,de.nome diario_entrada,abs(s.valor) valor,s.data_lancamento data_saida,e.data_lancamento data_entrada,abs(e.data_lancamento-s.data_lancamento) dias_diferenca,
      row_number() over(partition by s.id order by abs(e.data_lancamento-s.data_lancamento),e.criado_em) rn_saida,
      row_number() over(partition by e.id order by abs(e.data_lancamento-s.data_lancamento),s.criado_em) rn_entrada
    from public.transacoes_bancarias s
    join public.transacoes_bancarias e on e.diario_id<>s.diario_id and e.trntype='CREDIT' and e.status in ('pendente','parcial')
      and abs(abs(e.valor)-abs(s.valor))<0.01 and abs(e.data_lancamento-s.data_lancamento)<=greatest(0,least(coalesce(p_dias,2),7))
    join public.diarios_bancarios ds on ds.id=s.diario_id and ds.ativo
    join public.diarios_bancarios de on de.id=e.diario_id and de.ativo
    where s.trntype='DEBIT' and s.status in ('pendente','parcial') and lower(ds.nome)<>'ajustes' and lower(de.nome)<>'ajustes'
      and not exists(select 1 from public.transferencias_bancarias_internas ti where ti.status='conciliada' and (ti.transacao_saida_id=s.id or ti.transacao_entrada_id=e.id))
  )
  select saida_id,entrada_id,diario_saida_id,diario_entrada_id,diario_saida,diario_entrada,valor,data_saida,data_entrada,dias_diferenca
  from candidates where rn_saida=1 and rn_entrada=1 order by data_saida desc,valor desc;
$$;
revoke execute on function public.detectar_transferencias_bancarias_internas(integer) from public,anon;
grant execute on function public.detectar_transferencias_bancarias_internas(integer) to authenticated;

create or replace function public.conciliar_transferencia_bancaria_interna(p_saida_id uuid,p_entrada_id uuid)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.transacoes_bancarias%rowtype; e public.transacoes_bancarias%rowtype; transfer_id uuid;
begin
  if not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para conciliar transferência.'; end if;
  select * into s from public.transacoes_bancarias where id=p_saida_id for update;
  select * into e from public.transacoes_bancarias where id=p_entrada_id for update;
  if s.id is null or e.id is null then raise exception 'Transação bancária não encontrada.'; end if;
  if s.trntype<>'DEBIT' or e.trntype<>'CREDIT' then raise exception 'Selecione uma saída e uma entrada.'; end if;
  if s.diario_id=e.diario_id then raise exception 'Transferência interna exige diários diferentes.'; end if;
  if s.status='conciliado' or e.status='conciliado' then raise exception 'Uma das transações já foi conciliada.'; end if;
  if abs(abs(s.valor)-abs(e.valor))>0.01 then raise exception 'Os valores da saída e da entrada precisam ser iguais.'; end if;
  if abs(e.data_lancamento-s.data_lancamento)>7 then raise exception 'As datas estão muito distantes para transferência interna.'; end if;
  if private.data_financeira_fechada(s.data_lancamento) or private.data_financeira_fechada(e.data_lancamento) then raise exception 'Uma das datas pertence a período financeiro encerrado.'; end if;
  insert into public.transferencias_bancarias_internas(transacao_saida_id,transacao_entrada_id,diario_saida_id,diario_entrada_id,valor,data_saida,data_entrada,criado_por)
  values(s.id,e.id,s.diario_id,e.diario_id,abs(s.valor),s.data_lancamento,e.data_lancamento,auth.uid()) returning id into transfer_id;
  update public.transacoes_bancarias set status='conciliado',conta_categoria='Transferência interna',centro_custo=null where id in (s.id,e.id);
  return transfer_id;
end;
$$;
revoke execute on function public.conciliar_transferencia_bancaria_interna(uuid,uuid) from public,anon;
grant execute on function public.conciliar_transferencia_bancaria_interna(uuid,uuid) to authenticated;

create or replace function public.desfazer_transferencia_bancaria_interna(p_transferencia_id uuid,p_motivo text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare tr public.transferencias_bancarias_internas%rowtype;
begin
  if not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para desfazer transferência.'; end if;
  if length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Informe o motivo da reversão.'; end if;
  select * into tr from public.transferencias_bancarias_internas where id=p_transferencia_id for update;
  if tr.id is null or tr.status<>'conciliada' then raise exception 'Transferência interna não encontrada ou já revertida.'; end if;
  if private.data_financeira_fechada(tr.data_saida) or private.data_financeira_fechada(tr.data_entrada) then raise exception 'Uma das datas pertence a período financeiro encerrado.'; end if;
  update public.transferencias_bancarias_internas set status='revertida',revertido_por=auth.uid(),revertido_em=now(),motivo_reversao=btrim(p_motivo) where id=tr.id;
  update public.transacoes_bancarias set status='pendente',conta_categoria=case when conta_categoria='Transferência interna' then null else conta_categoria end where id in (tr.transacao_saida_id,tr.transacao_entrada_id);
end;
$$;
revoke execute on function public.desfazer_transferencia_bancaria_interna(uuid,text) from public,anon;
grant execute on function public.desfazer_transferencia_bancaria_interna(uuid,text) to authenticated;
