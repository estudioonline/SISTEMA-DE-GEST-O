create or replace function private.aplicar_permissoes_padrao(p_user_id uuid,p_perfil text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_modulo text;
begin
  delete from public.usuario_permissoes where user_id=p_user_id;
  foreach v_modulo in array array[
    'dashboard','vendas','clientes','fornecedores','produtos','compras',
    'comissoes','financeiro','entregas','autorizacoes','relatorios','config'
  ]
  loop
    insert into public.usuario_permissoes(user_id,modulo,nivel)
    values(p_user_id,v_modulo,private.permissao_padrao_perfil(p_perfil,v_modulo));
  end loop;
end;
$function$;

create or replace function private.salvar_permissoes_usuario_erp_impl(p_user_id uuid,p_permissoes jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_item record;
  v_modulo text;
  v_nivel text;
  v_target_perfil text;
  v_target_ativo boolean;
  v_config_nivel text;
  v_outros_config integer;
begin
  if v_uid is null or not private.usuario_pode('config','editar') then
    raise exception 'Sem permissão para gerenciar acessos';
  end if;

  select perfil,ativo into v_target_perfil,v_target_ativo
  from public.profiles
  where id=p_user_id
  for update;

  if not found then raise exception 'Usuário não encontrado'; end if;
  if jsonb_typeof(p_permissoes)<>'object' then raise exception 'Permissões inválidas'; end if;

  v_config_nivel:=coalesce(p_permissoes->>'config',private.nivel_permissao_usuario(p_user_id,'config'));

  if p_user_id=v_uid and v_config_nivel<>'editar' then
    raise exception 'Você não pode remover sua própria permissão de editar Configurações';
  end if;

  if v_config_nivel='editar' and v_target_perfil<>'administrador' then
    raise exception 'Somente usuários com perfil Administrador podem editar Configurações';
  end if;

  if v_target_ativo and private.nivel_permissao_usuario(p_user_id,'config')='editar' and v_config_nivel<>'editar' then
    select count(*) into v_outros_config
    from public.profiles p
    where p.id<>p_user_id
      and p.ativo
      and private.nivel_permissao_usuario(p.id,'config')='editar';
    if v_outros_config=0 then
      raise exception 'O sistema precisa manter pelo menos um administrador com edição de Configurações';
    end if;
  end if;

  for v_item in select key,value from jsonb_each_text(p_permissoes)
  loop
    v_modulo:=v_item.key;
    v_nivel:=v_item.value;

    if v_modulo not in ('dashboard','vendas','clientes','fornecedores','produtos','compras','comissoes','financeiro','entregas','autorizacoes','relatorios','config') then
      raise exception 'Módulo inválido: %',v_modulo;
    end if;
    if v_nivel not in ('nenhum','visualizar','editar') then
      raise exception 'Nível de acesso inválido';
    end if;
    if v_modulo in ('dashboard','relatorios') and v_nivel='editar' then
      v_nivel:='visualizar';
    end if;

    insert into public.usuario_permissoes(user_id,modulo,nivel,updated_at)
    values(p_user_id,v_modulo,v_nivel,now())
    on conflict(user_id,modulo)
    do update set nivel=excluded.nivel,updated_at=now();
  end loop;
end;
$function$;

create index if not exists entregas_criado_por_idx on public.entregas(criado_por);
create index if not exists entregas_atualizado_por_idx on public.entregas(atualizado_por);
create index if not exists entrega_eventos_usuario_idx on public.entrega_eventos(usuario_id);
