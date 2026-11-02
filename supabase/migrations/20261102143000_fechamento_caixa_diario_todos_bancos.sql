-- Fechamento diário consolidado de Dinheiro + todos os bancos ativos.
create table if not exists public.fechamentos_caixa_diario (
  id uuid primary key default gen_random_uuid(),
  data_caixa date not null unique,
  total_saldo_inicial numeric not null default 0,
  total_entradas numeric not null default 0,
  total_saidas numeric not null default 0,
  total_saldo_esperado numeric not null default 0,
  total_saldo_conferido numeric not null default 0,
  total_diferenca numeric not null default 0,
  observacao text,
  status text not null default 'fechado' check (status in ('fechado','reaberto')),
  fechado_por uuid references auth.users(id),
  fechado_em timestamptz not null default now(),
  reaberto_por uuid references auth.users(id),
  reaberto_em timestamptz,
  reabertura_motivo text
);

create table if not exists public.fechamentos_caixa_diario_itens (
  id uuid primary key default gen_random_uuid(),
  fechamento_id uuid not null references public.fechamentos_caixa_diario(id) on delete cascade,
  diario_id uuid not null references public.diarios_bancarios(id),
  diario_nome text not null,
  banco text,
  saldo_inicial numeric not null default 0,
  entradas numeric not null default 0,
  saidas numeric not null default 0,
  saldo_esperado numeric not null default 0,
  saldo_conferido numeric not null default 0,
  diferenca numeric not null default 0,
  unique(fechamento_id,diario_id)
);

alter table public.fechamentos_caixa_diario enable row level security;
alter table public.fechamentos_caixa_diario_itens enable row level security;

grant select,insert,update on public.fechamentos_caixa_diario to authenticated;
grant select,insert,update,delete on public.fechamentos_caixa_diario_itens to authenticated;

drop policy if exists fechamentos_caixa_select on public.fechamentos_caixa_diario;
create policy fechamentos_caixa_select on public.fechamentos_caixa_diario for select to authenticated
using (private.usuario_pode('financeiro','visualizar'));
drop policy if exists fechamentos_caixa_insert on public.fechamentos_caixa_diario;
create policy fechamentos_caixa_insert on public.fechamentos_caixa_diario for insert to authenticated
with check (private.usuario_pode('financeiro','editar'));
drop policy if exists fechamentos_caixa_update on public.fechamentos_caixa_diario;
create policy fechamentos_caixa_update on public.fechamentos_caixa_diario for update to authenticated
using (private.usuario_pode('financeiro','editar')) with check (private.usuario_pode('financeiro','editar'));

drop policy if exists fechamentos_caixa_itens_select on public.fechamentos_caixa_diario_itens;
create policy fechamentos_caixa_itens_select on public.fechamentos_caixa_diario_itens for select to authenticated
using (private.usuario_pode('financeiro','visualizar'));
drop policy if exists fechamentos_caixa_itens_insert on public.fechamentos_caixa_diario_itens;
create policy fechamentos_caixa_itens_insert on public.fechamentos_caixa_diario_itens for insert to authenticated
with check (private.usuario_pode('financeiro','editar'));
drop policy if exists fechamentos_caixa_itens_update on public.fechamentos_caixa_diario_itens;
create policy fechamentos_caixa_itens_update on public.fechamentos_caixa_diario_itens for update to authenticated
using (private.usuario_pode('financeiro','editar')) with check (private.usuario_pode('financeiro','editar'));
drop policy if exists fechamentos_caixa_itens_delete on public.fechamentos_caixa_diario_itens;
create policy fechamentos_caixa_itens_delete on public.fechamentos_caixa_diario_itens for delete to authenticated
using (private.usuario_pode('financeiro','editar'));

create or replace function public.resumo_caixa_diario(p_data date)
returns table(diario_id uuid,diario_nome text,banco text,saldo_inicial numeric,entradas numeric,saidas numeric,saldo_esperado numeric)
language sql security invoker set search_path=public,pg_temp as $$
  select d.id,d.nome,d.banco,
    coalesce(d.saldo_inicial,0)+coalesce(sum(case when t.data_lancamento<p_data then t.valor else 0 end),0),
    coalesce(sum(case when t.data_lancamento=p_data and t.valor>0 then t.valor else 0 end),0),
    coalesce(sum(case when t.data_lancamento=p_data and t.valor<0 then abs(t.valor) else 0 end),0),
    coalesce(d.saldo_inicial,0)+coalesce(sum(case when t.data_lancamento<=p_data then t.valor else 0 end),0)
  from public.diarios_bancarios d
  left join public.transacoes_bancarias t on t.diario_id=d.id
  where d.ativo=true and lower(d.nome)<>'ajustes'
  group by d.id,d.nome,d.banco,d.saldo_inicial
  order by case when lower(d.nome)='dinheiro' then 0 else 1 end,d.nome;
$$;

create or replace function public.fechar_caixa_diario(p_data date,p_saldos_conferidos jsonb,p_observacao text default null)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_fechamento uuid; v_existente public.fechamentos_caixa_diario%rowtype; v_item record; v_conferido numeric;
  v_total_inicial numeric:=0; v_total_entradas numeric:=0; v_total_saidas numeric:=0; v_total_esperado numeric:=0;
  v_total_conferido numeric:=0; v_total_diferenca numeric:=0; v_tem_diferenca boolean:=false;
begin
  if not private.usuario_pode('financeiro','editar') then raise exception 'Sem permissão para fechar o caixa.'; end if;
  if p_data is null then raise exception 'Informe a data do fechamento.'; end if;
  select * into v_existente from public.fechamentos_caixa_diario where data_caixa=p_data;
  if v_existente.id is not null and v_existente.status='fechado' then
    raise exception 'Este dia já está fechado. Um administrador precisa reabrir antes de refazer o fechamento.';
  end if;
  if v_existente.id is null then
    insert into public.fechamentos_caixa_diario(data_caixa,observacao,status,fechado_por,fechado_em)
    values(p_data,nullif(btrim(coalesce(p_observacao,'')),''),'fechado',auth.uid(),now()) returning id into v_fechamento;
  else
    v_fechamento:=v_existente.id;
    update public.fechamentos_caixa_diario set observacao=nullif(btrim(coalesce(p_observacao,'')),''),
      status='fechado',fechado_por=auth.uid(),fechado_em=now(),reaberto_por=null,reaberto_em=null,reabertura_motivo=null
    where id=v_fechamento;
  end if;
  delete from public.fechamentos_caixa_diario_itens where fechamento_id=v_fechamento;
  for v_item in select * from public.resumo_caixa_diario(p_data) loop
    if p_saldos_conferidos ? v_item.diario_id::text then
      v_conferido:=coalesce(nullif(p_saldos_conferidos->>v_item.diario_id::text,''),'0')::numeric;
    else
      v_conferido:=v_item.saldo_esperado;
    end if;
    insert into public.fechamentos_caixa_diario_itens(fechamento_id,diario_id,diario_nome,banco,saldo_inicial,entradas,saidas,saldo_esperado,saldo_conferido,diferenca)
    values(v_fechamento,v_item.diario_id,v_item.diario_nome,v_item.banco,v_item.saldo_inicial,v_item.entradas,v_item.saidas,v_item.saldo_esperado,v_conferido,v_conferido-v_item.saldo_esperado);
    v_total_inicial:=v_total_inicial+v_item.saldo_inicial; v_total_entradas:=v_total_entradas+v_item.entradas;
    v_total_saidas:=v_total_saidas+v_item.saidas; v_total_esperado:=v_total_esperado+v_item.saldo_esperado;
    v_total_conferido:=v_total_conferido+v_conferido; v_total_diferenca:=v_total_diferenca+(v_conferido-v_item.saldo_esperado);
    if abs(v_conferido-v_item.saldo_esperado)>0.009 then v_tem_diferenca:=true; end if;
  end loop;
  if v_tem_diferenca and length(btrim(coalesce(p_observacao,'')))<5 then
    raise exception 'Existe diferença no fechamento. Informe uma observação com pelo menos 5 caracteres.';
  end if;
  update public.fechamentos_caixa_diario set total_saldo_inicial=v_total_inicial,total_entradas=v_total_entradas,total_saidas=v_total_saidas,
    total_saldo_esperado=v_total_esperado,total_saldo_conferido=v_total_conferido,total_diferenca=v_total_diferenca where id=v_fechamento;
  return v_fechamento;
end;
$$;

create or replace function public.reabrir_caixa_diario(p_id uuid,p_motivo text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if not private.usuario_pode('config','editar') then raise exception 'Somente administrador pode reabrir o fechamento.'; end if;
  if length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Informe uma justificativa com pelo menos 5 caracteres.'; end if;
  update public.fechamentos_caixa_diario set status='reaberto',reaberto_por=auth.uid(),reaberto_em=now(),reabertura_motivo=btrim(p_motivo) where id=p_id;
  if not found then raise exception 'Fechamento não encontrado.'; end if;
end;
$$;

grant execute on function public.resumo_caixa_diario(date) to authenticated;
grant execute on function public.fechar_caixa_diario(date,jsonb,text) to authenticated;
grant execute on function public.reabrir_caixa_diario(uuid,text) to authenticated;
