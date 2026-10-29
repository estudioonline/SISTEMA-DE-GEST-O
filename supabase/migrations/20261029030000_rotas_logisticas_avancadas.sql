-- Evolucao avancada do roteirizador logistico.
-- Este modulo nao altera estoque.

create table if not exists public.motoristas_logistica (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid null references public.funcionarios(id) on delete set null,
  profile_id uuid null references auth.users(id) on delete set null,
  nome text not null,
  telefone text null,
  documento text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists motoristas_logistica_profile_uidx on public.motoristas_logistica(profile_id) where profile_id is not null;
create index if not exists motoristas_logistica_nome_idx on public.motoristas_logistica(lower(nome));
create index if not exists motoristas_logistica_funcionario_idx on public.motoristas_logistica(funcionario_id);

create table if not exists public.veiculos_logistica (
  id uuid primary key default gen_random_uuid(),
  placa text null,
  descricao text not null,
  capacidade_entregas integer null check (capacidade_entregas is null or capacidade_entregas > 0),
  capacidade_kg numeric(12,3) null check (capacidade_kg is null or capacidade_kg > 0),
  capacidade_m3 numeric(12,4) null check (capacidade_m3 is null or capacidade_m3 > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists veiculos_logistica_placa_uidx on public.veiculos_logistica(upper(placa)) where placa is not null and btrim(placa)<>'';

alter table public.clientes add column if not exists latitude numeric(10,7), add column if not exists longitude numeric(10,7);
alter table public.produtos add column if not exists peso_kg numeric(12,3) check (peso_kg is null or peso_kg >= 0), add column if not exists volume_m3 numeric(12,4) check (volume_m3 is null or volume_m3 >= 0);
alter table public.entregas add column if not exists peso_estimado_kg numeric(12,3) not null default 0 check (peso_estimado_kg >= 0), add column if not exists volume_estimado_m3 numeric(12,4) not null default 0 check (volume_estimado_m3 >= 0);
alter table public.rotas_logisticas
  add column if not exists motorista_id uuid null references public.motoristas_logistica(id) on delete set null,
  add column if not exists veiculo_id uuid null references public.veiculos_logistica(id) on delete set null,
  add column if not exists iniciado_em timestamptz,
  add column if not exists concluido_em timestamptz,
  add column if not exists distancia_estimada_km numeric(10,2) check (distancia_estimada_km is null or distancia_estimada_km >= 0),
  add column if not exists duracao_estimada_min integer check (duracao_estimada_min is null or duracao_estimada_min >= 0);

create index if not exists rotas_logisticas_motorista_idx on public.rotas_logisticas(motorista_id,data_rota);
create index if not exists rotas_logisticas_veiculo_idx on public.rotas_logisticas(veiculo_id,data_rota);
create index if not exists rotas_logisticas_criado_por_idx on public.rotas_logisticas(criado_por);
create index if not exists rotas_logisticas_atualizado_por_idx on public.rotas_logisticas(atualizado_por);

with ranked as (
 select id,row_number() over(partition by rota_logistica_id order by coalesce(ordem_rota,2147483647),created_at,id) rn
 from public.entregas where rota_logistica_id is not null
)
update public.entregas e set ordem_rota=r.rn from ranked r where e.id=r.id;
create unique index if not exists entregas_rota_ordem_uidx on public.entregas(rota_logistica_id,ordem_rota) where rota_logistica_id is not null and ordem_rota is not null;

create table if not exists public.rota_eventos (
 id uuid primary key default gen_random_uuid(),
 rota_id uuid not null references public.rotas_logisticas(id) on delete cascade,
 entrega_id uuid null references public.entregas(id) on delete set null,
 tipo text not null,
 detalhes jsonb not null default '{}'::jsonb,
 usuario_id uuid null references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists rota_eventos_rota_created_idx on public.rota_eventos(rota_id,created_at desc);
create index if not exists rota_eventos_entrega_idx on public.rota_eventos(entrega_id) where entrega_id is not null;
create index if not exists rota_eventos_usuario_idx on public.rota_eventos(usuario_id);

alter table public.motoristas_logistica enable row level security;
alter table public.veiculos_logistica enable row level security;
alter table public.rota_eventos enable row level security;
grant select,insert,update,delete on public.motoristas_logistica to authenticated;
grant select,insert,update,delete on public.veiculos_logistica to authenticated;
grant select,insert on public.rota_eventos to authenticated;

drop policy if exists motoristas_logistica_read on public.motoristas_logistica;
create policy motoristas_logistica_read on public.motoristas_logistica for select to authenticated using (private.usuario_pode('entregas','visualizar'));
drop policy if exists motoristas_logistica_insert on public.motoristas_logistica;
create policy motoristas_logistica_insert on public.motoristas_logistica for insert to authenticated with check (private.usuario_pode('entregas','editar'));
drop policy if exists motoristas_logistica_update on public.motoristas_logistica;
create policy motoristas_logistica_update on public.motoristas_logistica for update to authenticated using (private.usuario_pode('entregas','editar')) with check (private.usuario_pode('entregas','editar'));
drop policy if exists motoristas_logistica_delete on public.motoristas_logistica;
create policy motoristas_logistica_delete on public.motoristas_logistica for delete to authenticated using (private.usuario_pode('entregas','editar'));

drop policy if exists veiculos_logistica_read on public.veiculos_logistica;
create policy veiculos_logistica_read on public.veiculos_logistica for select to authenticated using (private.usuario_pode('entregas','visualizar'));
drop policy if exists veiculos_logistica_insert on public.veiculos_logistica;
create policy veiculos_logistica_insert on public.veiculos_logistica for insert to authenticated with check (private.usuario_pode('entregas','editar'));
drop policy if exists veiculos_logistica_update on public.veiculos_logistica;
create policy veiculos_logistica_update on public.veiculos_logistica for update to authenticated using (private.usuario_pode('entregas','editar')) with check (private.usuario_pode('entregas','editar'));
drop policy if exists veiculos_logistica_delete on public.veiculos_logistica;
create policy veiculos_logistica_delete on public.veiculos_logistica for delete to authenticated using (private.usuario_pode('entregas','editar'));

create or replace function private.logistica_motorista_usuario() returns uuid language sql stable security definer set search_path to '' as $$
 select m.id from public.motoristas_logistica m where m.profile_id=(select auth.uid()) and m.ativo limit 1;
$$;
revoke all on function private.logistica_motorista_usuario() from public,anon;
grant execute on function private.logistica_motorista_usuario() to authenticated;

drop policy if exists rotas_logisticas_read on public.rotas_logisticas;
create policy rotas_logisticas_read on public.rotas_logisticas for select to authenticated using (
 private.usuario_pode('entregas','editar') or (private.usuario_pode('entregas','visualizar') and motorista_id=private.logistica_motorista_usuario())
);
drop policy if exists rotas_logisticas_update on public.rotas_logisticas;
create policy rotas_logisticas_update on public.rotas_logisticas for update to authenticated
using (private.usuario_pode('entregas','editar') or (private.usuario_pode('entregas','visualizar') and motorista_id=private.logistica_motorista_usuario()))
with check (private.usuario_pode('entregas','editar') or (private.usuario_pode('entregas','visualizar') and motorista_id=private.logistica_motorista_usuario()));

drop policy if exists entregas_read on public.entregas;
create policy entregas_read on public.entregas for select to authenticated using (
 private.usuario_pode('entregas','editar') or (
   private.usuario_pode('entregas','visualizar') and exists(
    select 1 from public.rotas_logisticas r where r.id=entregas.rota_logistica_id and r.motorista_id=private.logistica_motorista_usuario()
   )
 )
);
drop policy if exists entregas_update on public.entregas;
create policy entregas_update on public.entregas for update to authenticated
using (
 private.usuario_pode('entregas','editar') or exists(
  select 1 from public.rotas_logisticas r where r.id=entregas.rota_logistica_id and r.motorista_id=private.logistica_motorista_usuario() and r.status='liberada'
 )
)
with check (
 private.usuario_pode('entregas','editar') or exists(
  select 1 from public.rotas_logisticas r where r.id=entregas.rota_logistica_id and r.motorista_id=private.logistica_motorista_usuario() and r.status in ('liberada','concluida')
 )
);

drop policy if exists entrega_eventos_read on public.entrega_eventos;
create policy entrega_eventos_read on public.entrega_eventos for select to authenticated using (
 private.usuario_pode('entregas','editar') or exists(
  select 1 from public.entregas e join public.rotas_logisticas r on r.id=e.rota_logistica_id
  where e.id=entrega_eventos.entrega_id and r.motorista_id=private.logistica_motorista_usuario()
 )
);
drop policy if exists entrega_eventos_insert on public.entrega_eventos;
create policy entrega_eventos_insert on public.entrega_eventos for insert to authenticated with check (
 private.usuario_pode('entregas','editar') or exists(
  select 1 from public.entregas e join public.rotas_logisticas r on r.id=e.rota_logistica_id
  where e.id=entrega_eventos.entrega_id and r.motorista_id=private.logistica_motorista_usuario() and r.status='liberada'
 )
);

drop policy if exists rota_eventos_read on public.rota_eventos;
create policy rota_eventos_read on public.rota_eventos for select to authenticated using (
 private.usuario_pode('entregas','editar') or exists(select 1 from public.rotas_logisticas r where r.id=rota_eventos.rota_id and r.motorista_id=private.logistica_motorista_usuario())
);
drop policy if exists rota_eventos_insert on public.rota_eventos;
create policy rota_eventos_insert on public.rota_eventos for insert to authenticated with check (
 private.usuario_pode('entregas','editar') or exists(select 1 from public.rotas_logisticas r where r.id=rota_eventos.rota_id and r.motorista_id=private.logistica_motorista_usuario())
);

create or replace function private.logistica_normalizar_ordem(p_rota_id uuid) returns void language plpgsql security invoker set search_path to '' as $$
begin
 update public.entregas set ordem_rota=null where rota_logistica_id=p_rota_id;
 with ordered as (
  select id,row_number() over(order by created_at,id)::integer rn from public.entregas where rota_logistica_id=p_rota_id
 )
 update public.entregas e set ordem_rota=o.rn from ordered o where e.id=o.id;
end;
$$;
revoke all on function private.logistica_normalizar_ordem(uuid) from public,anon;
grant execute on function private.logistica_normalizar_ordem(uuid) to authenticated;

create or replace function public.logistica_adicionar_entregas_rota(p_rota_id uuid,p_entrega_ids uuid[]) returns void language plpgsql security invoker set search_path to '' as $$
declare v_rota public.rotas_logisticas%rowtype; v_id uuid; v_old_routes uuid[]; v_order integer;
begin
 if not private.usuario_pode('entregas','editar') then raise exception 'Sem permissão para montar rotas'; end if;
 select * into v_rota from public.rotas_logisticas where id=p_rota_id for update;
 if not found then raise exception 'Rota não encontrada'; end if;
 if v_rota.status<>'montagem' then raise exception 'A rota precisa estar em montagem'; end if;
 select array_agg(distinct rota_logistica_id) into v_old_routes from public.entregas where id=any(p_entrega_ids) and rota_logistica_id is not null and rota_logistica_id<>p_rota_id;
 if exists(select 1 from public.entregas where id=any(p_entrega_ids) and status not in ('a_entregar','em_transito','reagendamento')) then raise exception 'Há entrega selecionada que não pode ser adicionada à rota'; end if;
 update public.entregas set rota_logistica_id=null,ordem_rota=null where id=any(p_entrega_ids);
 if v_old_routes is not null then foreach v_id in array v_old_routes loop perform private.logistica_normalizar_ordem(v_id); end loop; end if;
 select coalesce(max(ordem_rota),0) into v_order from public.entregas where rota_logistica_id=p_rota_id;
 foreach v_id in array p_entrega_ids loop
  v_order:=v_order+1;
  update public.entregas set rota_logistica_id=p_rota_id,ordem_rota=v_order,data_prevista=v_rota.data_rota,
   entregador_nome=coalesce((select m.nome from public.motoristas_logistica m where m.id=v_rota.motorista_id),v_rota.motorista,entregador_nome),updated_at=now() where id=v_id;
  insert into public.rota_eventos(rota_id,entrega_id,tipo,detalhes,usuario_id) values(p_rota_id,v_id,'entrega_adicionada',jsonb_build_object('ordem',v_order),(select auth.uid()));
 end loop;
end; $$;

create or replace function public.logistica_remover_entrega_rota(p_entrega_id uuid) returns void language plpgsql security invoker set search_path to '' as $$
declare v_rota_id uuid; v_status text;
begin
 if not private.usuario_pode('entregas','editar') then raise exception 'Sem permissão para alterar rotas'; end if;
 select e.rota_logistica_id,r.status into v_rota_id,v_status from public.entregas e left join public.rotas_logisticas r on r.id=e.rota_logistica_id where e.id=p_entrega_id for update of e;
 if v_rota_id is null then return; end if;
 if v_status<>'montagem' then raise exception 'Só é possível remover paradas enquanto a rota está em montagem'; end if;
 update public.entregas set rota_logistica_id=null,ordem_rota=null,updated_at=now() where id=p_entrega_id;
 perform private.logistica_normalizar_ordem(v_rota_id);
 insert into public.rota_eventos(rota_id,entrega_id,tipo,usuario_id) values(v_rota_id,p_entrega_id,'entrega_removida',(select auth.uid()));
end; $$;

create or replace function public.logistica_reordenar_rota(p_rota_id uuid,p_entrega_ids uuid[]) returns void language plpgsql security invoker set search_path to '' as $$
declare v_expected integer; v_received integer;
begin
 if not private.usuario_pode('entregas','editar') then raise exception 'Sem permissão para reordenar rotas'; end if;
 if not exists(select 1 from public.rotas_logisticas where id=p_rota_id and status='montagem' for update) then raise exception 'A rota precisa estar em montagem'; end if;
 select count(*) into v_expected from public.entregas where rota_logistica_id=p_rota_id;
 select count(*) into v_received from unnest(p_entrega_ids) x;
 if v_expected<>v_received then raise exception 'A lista de paradas está incompleta'; end if;
 update public.entregas set ordem_rota=null where rota_logistica_id=p_rota_id;
 update public.entregas e set ordem_rota=x.ord::integer,updated_at=now()
 from unnest(p_entrega_ids) with ordinality as x(id,ord) where e.id=x.id and e.rota_logistica_id=p_rota_id;
 insert into public.rota_eventos(rota_id,tipo,detalhes,usuario_id) values(p_rota_id,'rota_reordenada',jsonb_build_object('paradas',v_received),(select auth.uid()));
end; $$;

create or replace function public.logistica_aplicar_lote(p_entrega_ids uuid[],p_rota text default null,p_motorista_id uuid default null,p_data date default null) returns void language plpgsql security invoker set search_path to '' as $$
declare v_motorista text;
begin
 if not private.usuario_pode('entregas','editar') then raise exception 'Sem permissão para alterar entregas'; end if;
 if p_motorista_id is not null then select nome into v_motorista from public.motoristas_logistica where id=p_motorista_id and ativo; end if;
 update public.entregas set
  rota=case when p_rota is not null then nullif(btrim(p_rota),'') else rota end,
  rota_manual=case when p_rota is not null then true else rota_manual end,
  entregador_nome=case when p_motorista_id is not null then v_motorista else entregador_nome end,
  data_prevista=coalesce(p_data,data_prevista),updated_at=now()
 where id=any(p_entrega_ids) and status in ('a_entregar','em_transito','reagendamento');
end; $$;

create or replace function public.logistica_liberar_rota(p_rota_id uuid) returns void language plpgsql security invoker set search_path to '' as $$
declare v_rota public.rotas_logisticas%rowtype; v_count integer; v_peso numeric; v_volume numeric; v_cap_entregas integer; v_cap_kg numeric; v_cap_m3 numeric;
begin
 if not private.usuario_pode('entregas','editar') then raise exception 'Sem permissão para liberar rotas'; end if;
 select * into v_rota from public.rotas_logisticas where id=p_rota_id for update;
 if not found then raise exception 'Rota não encontrada'; end if;
 if v_rota.status<>'montagem' then raise exception 'A rota já foi liberada ou encerrada'; end if;
 select count(*),coalesce(sum(peso_estimado_kg),0),coalesce(sum(volume_estimado_m3),0) into v_count,v_peso,v_volume from public.entregas where rota_logistica_id=p_rota_id;
 if v_count=0 then raise exception 'A rota não possui entregas'; end if;
 if v_rota.motorista_id is null and nullif(btrim(coalesce(v_rota.motorista,'')),'') is null then raise exception 'Defina um motorista antes de liberar a rota'; end if;
 if v_rota.veiculo_id is not null then
  select capacidade_entregas,capacidade_kg,capacidade_m3 into v_cap_entregas,v_cap_kg,v_cap_m3 from public.veiculos_logistica where id=v_rota.veiculo_id;
  if v_cap_entregas is not null and v_count>v_cap_entregas then raise exception 'Capacidade de entregas do veículo excedida'; end if;
  if v_cap_kg is not null and v_peso>v_cap_kg then raise exception 'Capacidade de peso do veículo excedida'; end if;
  if v_cap_m3 is not null and v_volume>v_cap_m3 then raise exception 'Capacidade de volume do veículo excedida'; end if;
 end if;
 update public.rotas_logisticas set status='liberada',iniciado_em=coalesce(iniciado_em,now()),updated_at=now() where id=p_rota_id;
 update public.entregas set status=case when status in ('a_entregar','reagendamento') then 'em_transito' else status end,
 em_transito_em=case when status in ('a_entregar','reagendamento') then coalesce(em_transito_em,now()) else em_transito_em end,updated_at=now()
 where rota_logistica_id=p_rota_id;
 insert into public.rota_eventos(rota_id,tipo,detalhes,usuario_id) values(p_rota_id,'rota_liberada',jsonb_build_object('paradas',v_count,'peso_kg',v_peso,'volume_m3',v_volume),(select auth.uid()));
end; $$;

create or replace function public.logistica_reagendar_entrega(p_entrega_id uuid,p_data date,p_rota_id uuid default null) returns void language plpgsql security invoker set search_path to '' as $$
declare v_old_rota uuid;
begin
 if not private.usuario_pode('entregas','editar') then raise exception 'Sem permissão para reagendar entregas'; end if;
 select rota_logistica_id into v_old_rota from public.entregas where id=p_entrega_id for update;
 update public.entregas set status='a_entregar',data_prevista=p_data,rota_logistica_id=null,ordem_rota=null,em_transito_em=null,falha_motivo=null,falha_detalhes=null,falha_em=null,updated_at=now() where id=p_entrega_id;
 if v_old_rota is not null then perform private.logistica_normalizar_ordem(v_old_rota); end if;
 if p_rota_id is not null then perform public.logistica_adicionar_entregas_rota(p_rota_id,array[p_entrega_id]); end if;
 insert into public.entrega_eventos(entrega_id,tipo,status_anterior,status_novo,detalhes,usuario_id) values(p_entrega_id,'reagendado','reagendamento','a_entregar','Reagendado para '||p_data::text,(select auth.uid()));
end; $$;

grant execute on function public.logistica_adicionar_entregas_rota(uuid,uuid[]) to authenticated;
grant execute on function public.logistica_remover_entrega_rota(uuid) to authenticated;
grant execute on function public.logistica_reordenar_rota(uuid,uuid[]) to authenticated;
grant execute on function public.logistica_aplicar_lote(uuid[],text,uuid,date) to authenticated;
grant execute on function public.logistica_liberar_rota(uuid) to authenticated;
grant execute on function public.logistica_reagendar_entrega(uuid,date,uuid) to authenticated;

create or replace function private.logistica_auto_concluir_rota() returns trigger language plpgsql security definer set search_path to '' as $$
declare v_rota_id uuid;
begin
 v_rota_id:=coalesce(new.rota_logistica_id,old.rota_logistica_id);
 if v_rota_id is null then return new; end if;
 if exists(select 1 from public.rotas_logisticas where id=v_rota_id and status='liberada')
 and not exists(select 1 from public.entregas where rota_logistica_id=v_rota_id and status in ('a_entregar','em_transito')) then
  update public.rotas_logisticas set status='concluida',concluido_em=coalesce(concluido_em,now()),updated_at=now() where id=v_rota_id and status='liberada';
  if found then insert into public.rota_eventos(rota_id,tipo,detalhes,usuario_id) values(v_rota_id,'rota_concluida',jsonb_build_object('automatico',true),(select auth.uid())); end if;
 end if;
 return new;
end; $$;
revoke all on function private.logistica_auto_concluir_rota() from public,anon,authenticated;
drop trigger if exists entregas_auto_concluir_rota on public.entregas;
create trigger entregas_auto_concluir_rota after update of status on public.entregas for each row execute function private.logistica_auto_concluir_rota();

create or replace function private.logistica_auditar_rota() returns trigger language plpgsql security definer set search_path to '' as $$
declare v_tipo text; v_detalhes jsonb;
begin
 if tg_op='INSERT' then
  insert into public.rota_eventos(rota_id,tipo,detalhes,usuario_id) values(new.id,'rota_criada',jsonb_build_object('nome',new.nome,'data',new.data_rota),(select auth.uid()));
  return new;
 end if;
 if old.status is distinct from new.status then v_tipo:='status_alterado';
 elsif old.motorista_id is distinct from new.motorista_id or old.motorista is distinct from new.motorista then v_tipo:='motorista_alterado';
 elsif old.veiculo_id is distinct from new.veiculo_id or old.veiculo is distinct from new.veiculo then v_tipo:='veiculo_alterado';
 else v_tipo:='rota_alterada'; end if;
 v_detalhes=jsonb_build_object('status_anterior',old.status,'status_novo',new.status,'motorista_anterior',old.motorista_id,'motorista_novo',new.motorista_id,'veiculo_anterior',old.veiculo_id,'veiculo_novo',new.veiculo_id,'nome_anterior',old.nome,'nome_novo',new.nome);
 insert into public.rota_eventos(rota_id,tipo,detalhes,usuario_id) values(new.id,v_tipo,v_detalhes,(select auth.uid()));
 return new;
end; $$;
revoke all on function private.logistica_auditar_rota() from public,anon,authenticated;
drop trigger if exists rotas_logisticas_auditoria on public.rotas_logisticas;
create trigger rotas_logisticas_auditoria after insert or update on public.rotas_logisticas for each row execute function private.logistica_auditar_rota();

create or replace function private.logistica_recalcular_medidas_entrega(p_venda_id uuid) returns void language plpgsql security definer set search_path to '' as $$
declare v_peso numeric; v_volume numeric;
begin
 select coalesce(sum(vi.quantidade*coalesce(p.peso_kg,0)),0),coalesce(sum(vi.quantidade*coalesce(p.volume_m3,0)),0)
 into v_peso,v_volume from public.venda_itens vi join public.produtos p on p.id=vi.produto_id where vi.venda_id=p_venda_id;
 update public.entregas set peso_estimado_kg=v_peso,volume_estimado_m3=v_volume,updated_at=now() where venda_id=p_venda_id;
end; $$;
revoke all on function private.logistica_recalcular_medidas_entrega(uuid) from public,anon,authenticated;

create or replace function private.logistica_medidas_venda_item_trigger() returns trigger language plpgsql security definer set search_path to '' as $$
begin
 if tg_op='DELETE' then perform private.logistica_recalcular_medidas_entrega(old.venda_id); return old; end if;
 perform private.logistica_recalcular_medidas_entrega(new.venda_id);
 if tg_op='UPDATE' and old.venda_id is distinct from new.venda_id then perform private.logistica_recalcular_medidas_entrega(old.venda_id); end if;
 return new;
end; $$;
revoke all on function private.logistica_medidas_venda_item_trigger() from public,anon,authenticated;
drop trigger if exists venda_itens_recalcular_medidas_entrega on public.venda_itens;
create trigger venda_itens_recalcular_medidas_entrega after insert or update of quantidade,produto_id,venda_id or delete on public.venda_itens for each row execute function private.logistica_medidas_venda_item_trigger();

create or replace function private.logistica_medidas_produto_trigger() returns trigger language plpgsql security definer set search_path to '' as $$
declare v_venda uuid;
begin
 for v_venda in select distinct vi.venda_id from public.venda_itens vi where vi.produto_id=new.id loop perform private.logistica_recalcular_medidas_entrega(v_venda); end loop;
 return new;
end; $$;
revoke all on function private.logistica_medidas_produto_trigger() from public,anon,authenticated;
drop trigger if exists produtos_recalcular_medidas_entrega on public.produtos;
create trigger produtos_recalcular_medidas_entrega after update of peso_kg,volume_m3 on public.produtos for each row execute function private.logistica_medidas_produto_trigger();

drop policy if exists entregas_storage_read on storage.objects;
create policy entregas_storage_read on storage.objects for select to authenticated using (
 bucket_id='entregas-comprovantes' and (
  private.usuario_pode('entregas','editar') or exists(
   select 1 from public.entregas e join public.rotas_logisticas r on r.id=e.rota_logistica_id
   where e.id::text=(storage.foldername(name))[1] and r.motorista_id=private.logistica_motorista_usuario()
  )
 )
);
drop policy if exists entregas_storage_insert on storage.objects;
create policy entregas_storage_insert on storage.objects for insert to authenticated with check (
 bucket_id='entregas-comprovantes' and (
  private.usuario_pode('entregas','editar') or exists(
   select 1 from public.entregas e join public.rotas_logisticas r on r.id=e.rota_logistica_id
   where e.id::text=(storage.foldername(name))[1] and r.motorista_id=private.logistica_motorista_usuario() and r.status='liberada'
  )
 )
);
drop policy if exists entregas_storage_update on storage.objects;
create policy entregas_storage_update on storage.objects for update to authenticated
using (
 bucket_id='entregas-comprovantes' and (
  private.usuario_pode('entregas','editar') or exists(
   select 1 from public.entregas e join public.rotas_logisticas r on r.id=e.rota_logistica_id
   where e.id::text=(storage.foldername(name))[1] and r.motorista_id=private.logistica_motorista_usuario() and r.status='liberada'
  )
 )
)
with check (
 bucket_id='entregas-comprovantes' and (
  private.usuario_pode('entregas','editar') or exists(
   select 1 from public.entregas e join public.rotas_logisticas r on r.id=e.rota_logistica_id
   where e.id::text=(storage.foldername(name))[1] and r.motorista_id=private.logistica_motorista_usuario() and r.status='liberada'
  )
 )
);
