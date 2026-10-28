begin;
create table private.focus_config_erp (
 id boolean primary key default true check(id),
 config jsonb not null default '{}'::jsonb check(jsonb_typeof(config)='object'),
 token_id uuid references vault.secrets(id),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table private.focus_config_erp enable row level security;
revoke all on private.focus_config_erp from public,anon,authenticated;
create table public.notas_fiscais_teste (
 id uuid primary key default gen_random_uuid(),
 venda_id uuid not null unique references public.vendas(id) on delete restrict,
 referencia text not null unique,
 ambiente text not null default 'homologacao' check(ambiente='homologacao'),
 status text not null default 'rascunho' check(status in ('rascunho','enviando','processando_autorizacao','autorizado','erro_autorizacao','rejeitado','incerto','nao_encontrado','cancelado','denegado')),
 dados_fiscais jsonb not null default '{}'::jsonb,
 payload jsonb,
 retorno jsonb not null default '{}'::jsonb,
 source_hash text,
 criado_por uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.notas_fiscais_teste enable row level security;
revoke all on public.notas_fiscais_teste from public,anon,authenticated;
grant select on public.notas_fiscais_teste to authenticated;
create policy notas_fiscais_teste_read on public.notas_fiscais_teste for select to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and ativo and perfil='administrador')
 and private.usuario_pode('vendas','visualizar'));
create function private.focus_backend_erp(p_action text,p_actor uuid,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 c private.focus_config_erp%rowtype;
 n public.notas_fiscais_teste%rowtype;
 v public.vendas%rowtype;
 s jsonb; h text; token text; tid uuid; locked boolean:=false;
begin
 if not exists(select 1 from public.profiles where id=p_actor and ativo and perfil='administrador') then
  raise exception 'Somente administrador ativo pode acessar a integração fiscal.' using errcode='42501';
 end if;
 if private.nivel_permissao_usuario(p_actor,'config')<>'editar' then
  raise exception 'Sem permissão para configurar a integração fiscal.' using errcode='42501';
 end if;
 if p_action in ('config','save_config') then
  perform pg_advisory_xact_lock(hashtext('focus_config_erp'));
  select * into c from private.focus_config_erp where id=true;
  if p_action='save_config' then
   if exists(select 1 from public.notas_fiscais_teste where payload is not null)
    and c.config->>'cnpj_emitente' is distinct from p_data->'config'->>'cnpj_emitente' then
    raise exception 'O CNPJ não pode mudar após o primeiro envio de teste.';
   end if;
   tid:=c.token_id;
   token:=nullif(btrim(p_data->>'token'),'');
   if token is not null then
    if length(token)<10 or length(token)>256 or token!~'^[A-Za-z0-9_-]+$' then raise exception 'Token inválido.'; end if;
    if tid is null then tid:=vault.create_secret(token,'erp_focus_homologacao','Token de testes Focus NFe');
    else perform vault.update_secret(tid,token); end if;
   end if;
   insert into private.focus_config_erp(id,config,token_id,updated_by,updated_at)
    values(true,p_data->'config',tid,p_actor,now())
    on conflict(id) do update set config=excluded.config,token_id=excluded.token_id,updated_by=excluded.updated_by,updated_at=now();
   select * into c from private.focus_config_erp where id=true;
  end if;
  select decrypted_secret into token from vault.decrypted_secrets where id=c.token_id;
  return jsonb_build_object('config',coalesce(c.config,'{}'::jsonb),'token',token,'updated_at',c.updated_at);
 end if;
 if private.nivel_permissao_usuario(p_actor,'vendas')<>'editar' then raise exception 'Sem permissão para emitir NF-e.' using errcode='42501'; end if;
 select * into v from public.vendas where id=(p_data->>'venda_id')::uuid for update;
 if not found then raise exception 'Venda não encontrada.'; end if;
 select jsonb_build_object('venda',to_jsonb(v),'itens',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('produto',to_jsonb(p)) order by i.id)
 from public.venda_itens i join public.produtos p on p.id=i.produto_id where i.venda_id=v.id),'[]'::jsonb),
 'cliente',(select to_jsonb(x) from public.clientes x where x.id=v.cliente_id),
 'empresa',(select to_jsonb(x) from public.empresa_config x where x.id=1)) into s;
 h:=md5(s::text);
 select * into n from public.notas_fiscais_teste where venda_id=v.id for update;
 if p_action='sale' then return s||jsonb_build_object('source_hash',h,'nota',case when n.id is not null then to_jsonb(n) else null end); end if;
 if p_action in ('draft','claim') then
  if v.status not in ('pedido','faturado') then raise exception 'Somente pedidos confirmados ou vendas faturadas podem emitir NF-e de teste.'; end if;
  if exists(select 1 from public.aprovacoes_operacoes where (entidade_id=v.id or payload->>'p_venda_id'=v.id::text) and status='pendente') then
   raise exception 'Aguarde a decisão da autorização desta venda.';
  end if;
  if n.id is not null and n.status not in ('rascunho','erro_autorizacao','rejeitado','nao_encontrado') then
   return jsonb_build_object('claimed',false,'nota',to_jsonb(n));
  end if;
  if p_action='claim' and p_data->>'source_hash' is distinct from h then raise exception 'A venda foi alterada. Atualize os dados antes de emitir.'; end if;
  -- A timeout followed by 404 retries the SAME request and reference.
  if n.status='nao_encontrado' and p_action='draft' then raise exception 'Consulte ou reenvie a solicitação original antes de alterar os dados.'; end if;
  insert into public.notas_fiscais_teste(venda_id,referencia,dados_fiscais,payload,source_hash,status,criado_por)
   values(v.id,'erp-h-'||replace(v.id::text,'-',''),p_data->'dados_fiscais',
    case when p_action='claim' then p_data->'payload' end,h,case when p_action='claim' then 'enviando' else 'rascunho' end,p_actor)
   on conflict(venda_id) do update set
    dados_fiscais=case when notas_fiscais_teste.status='nao_encontrado' then notas_fiscais_teste.dados_fiscais else excluded.dados_fiscais end,
    payload=case when notas_fiscais_teste.status='nao_encontrado' then notas_fiscais_teste.payload else excluded.payload end,
    source_hash=excluded.source_hash,status=excluded.status,updated_at=now()
   returning * into n;
  return jsonb_build_object('claimed',p_action='claim','nota',to_jsonb(n));
 end if;
 if p_action='result' and n.id is not null then
  if n.status in ('cancelado','denegado') or (n.status='autorizado' and p_data->>'status' not in ('autorizado','cancelado','denegado')) then return to_jsonb(n); end if;
  update public.notas_fiscais_teste set status=p_data->>'status',retorno=coalesce(p_data->'retorno','{}'::jsonb),updated_at=now()
   where id=n.id returning * into n;
  return to_jsonb(n);
 end if;
 raise exception 'Ação fiscal inválida.';
end; $$;
revoke all on function private.focus_backend_erp(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.focus_backend_erp(text,uuid,jsonb) to service_role;
create function public.focus_backend_erp(p_action text,p_actor uuid,p_data jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.focus_backend_erp(p_action,p_actor,p_data);
$$;
revoke all on function public.focus_backend_erp(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.focus_backend_erp(text,uuid,jsonb) to service_role;
commit;

