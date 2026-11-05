begin;

alter table public.perfil_permissoes drop constraint if exists perfil_permissoes_modulo_check;
alter table public.perfil_permissoes add constraint perfil_permissoes_modulo_check
check (modulo = any (array[
 'dashboard','vendas','clientes','fornecedores','produtos','compras','comissoes','financeiro',
 'rh','entregas','autorizacoes','relatorios','config'
]::text[]));

alter table public.usuario_permissoes drop constraint if exists usuario_permissoes_modulo_check;
alter table public.usuario_permissoes add constraint usuario_permissoes_modulo_check
check (modulo = any (array[
 'dashboard','vendas','clientes','fornecedores','produtos','compras','comissoes','financeiro',
 'rh','entregas','autorizacoes','relatorios','config'
]::text[]));

insert into public.perfil_permissoes(perfil,modulo,pode_editar,updated_at)
select perfil,'rh',perfil='administrador',now()
from (values ('administrador'),('financeiro'),('vendas'),('estoque'),('visualizador')) p(perfil)
on conflict(perfil,modulo) do update set pode_editar=excluded.pode_editar,updated_at=excluded.updated_at;

insert into public.usuario_permissoes(user_id,modulo,nivel,updated_at)
select p.id,'rh',case when p.perfil='administrador' then 'editar' else 'visualizar' end,now()
from public.profiles p
on conflict(user_id,modulo) do nothing;

create or replace function private.aplicar_permissoes_padrao(p_user_id uuid,p_perfil text)
returns void language plpgsql security definer set search_path='' as $$
declare v_modulo text;
begin
 delete from public.usuario_permissoes where user_id=p_user_id;
 foreach v_modulo in array array[
  'dashboard','vendas','clientes','fornecedores','produtos','compras',
  'comissoes','financeiro','rh','entregas','autorizacoes','relatorios','config'
 ] loop
   insert into public.usuario_permissoes(user_id,modulo,nivel)
   values(p_user_id,v_modulo,private.permissao_padrao_perfil(p_perfil,v_modulo));
 end loop;
end;
$$;

create or replace function private.salvar_permissoes_usuario_erp_impl(p_user_id uuid,p_permissoes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := (select auth.uid());
  v_item record; v_modulo text; v_nivel text; v_target_perfil text; v_target_ativo boolean;
  v_config_nivel text; v_outros_config integer;
begin
  if v_uid is null or not private.usuario_pode('config','editar') then raise exception 'Sem permissão para gerenciar acessos'; end if;
  select perfil,ativo into v_target_perfil,v_target_ativo from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if jsonb_typeof(p_permissoes)<>'object' then raise exception 'Permissões inválidas'; end if;
  v_config_nivel:=coalesce(p_permissoes->>'config',private.nivel_permissao_usuario(p_user_id,'config'));
  if p_user_id=v_uid and v_config_nivel<>'editar' then raise exception 'Você não pode remover sua própria permissão de editar Configurações'; end if;
  if v_config_nivel='editar' and v_target_perfil<>'administrador' then raise exception 'Somente usuários com perfil Administrador podem editar Configurações'; end if;
  if v_target_ativo and private.nivel_permissao_usuario(p_user_id,'config')='editar' and v_config_nivel<>'editar' then
    select count(*) into v_outros_config from public.profiles p
    where p.id<>p_user_id and p.ativo and private.nivel_permissao_usuario(p.id,'config')='editar';
    if v_outros_config=0 then raise exception 'O sistema precisa manter pelo menos um administrador com edição de Configurações'; end if;
  end if;
  for v_item in select key,value from jsonb_each_text(p_permissoes) loop
    v_modulo:=v_item.key; v_nivel:=v_item.value;
    if v_modulo not in ('dashboard','vendas','clientes','fornecedores','produtos','compras','comissoes','financeiro','rh','entregas','autorizacoes','relatorios','config') then
      raise exception 'Módulo inválido: %',v_modulo;
    end if;
    if v_nivel not in ('nenhum','visualizar','editar') then raise exception 'Nível de acesso inválido'; end if;
    if v_modulo in ('dashboard','relatorios') and v_nivel='editar' then v_nivel:='visualizar'; end if;
    insert into public.usuario_permissoes(user_id,modulo,nivel,updated_at)
    values(p_user_id,v_modulo,v_nivel,now())
    on conflict(user_id,modulo) do update set nivel=excluded.nivel,updated_at=now();
  end loop;
end;
$$;

create or replace function private.salvar_permissoes_perfil_erp_impl(p_perfil text,p_modulos_edicao jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_modulo text; v_editar boolean; v_user uuid;
begin
  if (select auth.uid()) is null or not private.usuario_pode('config','editar') then raise exception 'Sem permissão para gerenciar perfis'; end if;
  if p_perfil not in ('administrador','financeiro','vendas','estoque','visualizador') then raise exception 'Perfil inválido'; end if;
  if jsonb_typeof(p_modulos_edicao)<>'object' then raise exception 'Permissões inválidas'; end if;
  foreach v_modulo in array array[
    'dashboard','vendas','clientes','fornecedores','produtos','compras',
    'comissoes','financeiro','rh','entregas','autorizacoes','relatorios','config'
  ] loop
    v_editar:=case when v_modulo in ('dashboard','relatorios') then false else coalesce((p_modulos_edicao->>v_modulo)::boolean,false) end;
    if v_modulo='config' and p_perfil<>'administrador' then v_editar:=false; end if;
    insert into public.perfil_permissoes(perfil,modulo,pode_editar,updated_at)
    values(p_perfil,v_modulo,v_editar,now())
    on conflict(perfil,modulo) do update set pode_editar=excluded.pode_editar,updated_at=now();
  end loop;
  for v_user in select id from public.profiles where perfil=p_perfil loop
    perform private.aplicar_permissoes_padrao(v_user,p_perfil);
  end loop;
end;
$$;

create or replace function private.listar_usuarios_erp_impl()
returns table(user_id uuid,nome text,email text,perfil text,ativo boolean,criado_em timestamptz,ultimo_acesso timestamptz,usuario_atual boolean,avatar_path text,permissoes jsonb)
language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not private.usuario_pode('config','editar') then raise exception 'Sem permissão para gerenciar usuários'; end if;
  return query
  select p.id,p.nome,u.email::text,p.perfil,p.ativo,p.created_at,u.last_sign_in_at,p.id=(select auth.uid()),p.avatar_path,
    (select jsonb_object_agg(m.modulo,private.nivel_permissao_usuario(p.id,m.modulo))
     from (values ('dashboard'::text),('vendas'),('clientes'),('fornecedores'),('produtos'),
      ('compras'),('comissoes'),('financeiro'),('rh'),('entregas'),('autorizacoes'),('relatorios'),('config')) m(modulo))
  from public.profiles p join auth.users u on u.id=p.id
  order by p.ativo desc,p.nome asc;
end;
$$;

create or replace function public.minhas_permissoes_erp()
returns table(modulo text,nivel text)
language sql set search_path='' as $$
  select m.modulo,private.nivel_permissao_usuario((select auth.uid()),m.modulo)
  from (values ('dashboard'::text),('vendas'),('clientes'),('fornecedores'),('produtos'),
    ('compras'),('comissoes'),('financeiro'),('rh'),('entregas'),('autorizacoes'),('relatorios'),('config')) m(modulo);
$$;

drop policy if exists funcionarios_read on public.funcionarios;
drop policy if exists funcionarios_insert on public.funcionarios;
drop policy if exists funcionarios_update on public.funcionarios;
create policy funcionarios_read on public.funcionarios for select to authenticated using ((select private.usuario_pode('rh','visualizar')));
create policy funcionarios_insert on public.funcionarios for insert to authenticated with check ((select private.usuario_pode('rh','editar')));
create policy funcionarios_update on public.funcionarios for update to authenticated using ((select private.usuario_pode('rh','editar'))) with check ((select private.usuario_pode('rh','editar')));

drop policy if exists rh_beneficios_read on public.rh_beneficios_mensais;
drop policy if exists rh_beneficios_write on public.rh_beneficios_mensais;
create policy rh_beneficios_read on public.rh_beneficios_mensais for select to authenticated using ((select private.usuario_pode('rh','visualizar')));
create policy rh_beneficios_write on public.rh_beneficios_mensais for all to authenticated using ((select private.usuario_pode('rh','editar'))) with check ((select private.usuario_pode('rh','editar')));

drop policy if exists rh_escala_sabados_read on public.rh_escala_sabados;
drop policy if exists rh_escala_sabados_write on public.rh_escala_sabados;
create policy rh_escala_sabados_read on public.rh_escala_sabados for select to authenticated using ((select private.usuario_pode('rh','visualizar')));
create policy rh_escala_sabados_write on public.rh_escala_sabados for all to authenticated using ((select private.usuario_pode('rh','editar'))) with check ((select private.usuario_pode('rh','editar')));

drop policy if exists rh_folha_read on public.rh_folha_mensal;
drop policy if exists rh_folha_write on public.rh_folha_mensal;
create policy rh_folha_read on public.rh_folha_mensal for select to authenticated using ((select private.usuario_pode('rh','visualizar')));
create policy rh_folha_write on public.rh_folha_mensal for all to authenticated using ((select private.usuario_pode('rh','editar'))) with check ((select private.usuario_pode('rh','editar')));

drop policy if exists rh_previsao_read on public.rh_previsao_mensal;
drop policy if exists rh_previsao_write on public.rh_previsao_mensal;
create policy rh_previsao_read on public.rh_previsao_mensal for select to authenticated using ((select private.usuario_pode('rh','visualizar')));
create policy rh_previsao_write on public.rh_previsao_mensal for all to authenticated using ((select private.usuario_pode('rh','editar'))) with check ((select private.usuario_pode('rh','editar')));

drop policy if exists rh_ponto_read on public.rh_ponto_ajustes;
drop policy if exists rh_ponto_write on public.rh_ponto_ajustes;
create policy rh_ponto_read on public.rh_ponto_ajustes for select to authenticated using ((select private.usuario_pode('rh','visualizar')));
create policy rh_ponto_write on public.rh_ponto_ajustes for all to authenticated using ((select private.usuario_pode('rh','editar'))) with check ((select private.usuario_pode('rh','editar')));

drop policy if exists rh_ponto_hist_read on public.rh_ponto_ajustes_historico;
drop policy if exists rh_ponto_hist_insert on public.rh_ponto_ajustes_historico;
create policy rh_ponto_hist_read on public.rh_ponto_ajustes_historico for select to authenticated using ((select private.usuario_pode('rh','visualizar')));
create policy rh_ponto_hist_insert on public.rh_ponto_ajustes_historico for insert to authenticated with check ((select private.usuario_pode('rh','editar')));

revoke execute on function public.pagar_titulos_rh_lote(uuid[],date) from authenticated;
revoke execute on function public.excluir_titulos_rh_lote(uuid[]) from authenticated;
revoke execute on function public.descontar_vale_folha(uuid,date,boolean) from authenticated;

commit;
