-- Existing business records are untouched; request tracking starts empty.
create table private.erp_requisicoes (
 usuario_id uuid not null references auth.users(id),
 requisicao_id uuid not null,
 assinatura text not null,
 venda_id uuid not null references public.vendas(id),
 criado_em timestamptz not null default now(),
 primary key(usuario_id,requisicao_id)
);
alter table private.erp_requisicoes enable row level security;
revoke all on private.erp_requisicoes from public,anon,authenticated;

create or replace function private.salvar_venda_erp_impl(p_requisicao uuid,p_payload jsonb,p_autorizar_sem_estoque boolean default false)
returns public.vendas language plpgsql security definer set search_path='' as $$
declare v public.vendas%rowtype; r private.erp_requisicoes%rowtype; v_id uuid; v_assinatura text; v_admin boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('administrador','vendas')) then
 raise exception 'Sem permissão para salvar vendas'; end if;
 select perfil='administrador' into v_admin from public.profiles where id=auth.uid() and ativo;
 if p_requisicao is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida'; end if;
 if coalesce(p_autorizar_sem_estoque,false) and not v_admin then raise exception 'Somente administrador pode autorizar estoque negativo'; end if;
 v_assinatura:=md5(p_payload::text||coalesce(p_autorizar_sem_estoque,false)::text);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_requisicao::text,0));
 select * into r from private.erp_requisicoes where usuario_id=auth.uid() and requisicao_id=p_requisicao;
 if found then
   if r.assinatura<>v_assinatura then raise exception 'Esta requisição já foi concluída com outros dados. Reabra a venda antes de alterar.'; end if;
   select * into strict v from public.vendas where id=r.venda_id;
   return v;
 end if;
 if coalesce(p_payload->>'p_rota_entrega','') not in ('norte','sul','leste','interestadual','retirada') then raise exception 'Informe uma rota de entrega válida'; end if;
 if coalesce(p_autorizar_sem_estoque,false) then perform set_config('app.allow_negative_stock','true',true); end if;
 set constraints public.erp_venda_final,public.erp_venda_itens_final deferred;
 v_id:=nullif(p_payload->>'p_venda_id','')::uuid;
 if v_id is null then
   v:=public.criar_venda_completa(nullif(p_payload->>'p_cliente_id','')::uuid,nullif(p_payload->>'p_vendedor_cadastro_id','')::uuid,
    p_payload->>'p_status',p_payload->>'p_forma_pagamento',(p_payload->>'p_parcelas')::integer,(p_payload->>'p_primeiro_vencimento')::date,p_payload->>'p_observacoes',p_payload->'p_itens');
 else
   v:=public.atualizar_venda_completa(v_id,nullif(p_payload->>'p_cliente_id','')::uuid,nullif(p_payload->>'p_vendedor_cadastro_id','')::uuid,
    p_payload->>'p_status',p_payload->>'p_forma_pagamento',(p_payload->>'p_parcelas')::integer,(p_payload->>'p_primeiro_vencimento')::date,p_payload->>'p_observacoes',p_payload->'p_itens');
 end if;
 update public.vendas set rota_entrega=p_payload->>'p_rota_entrega',
 validade_orcamento=case when status='orcamento' then (now() at time zone 'America/Sao_Paulo')::date+(select validade_orcamento_dias from public.empresa_config where id=1) else null end,
 estoque_negativo_autorizado_por=case when coalesce(p_autorizar_sem_estoque,false) then auth.uid() else estoque_negativo_autorizado_por end,
 estoque_negativo_autorizado_em=case when coalesce(p_autorizar_sem_estoque,false) then now() else estoque_negativo_autorizado_em end
 where id=v.id returning * into v;
 set constraints public.erp_venda_final,public.erp_venda_itens_final immediate;
 insert into private.erp_requisicoes(usuario_id,requisicao_id,assinatura,venda_id) values(auth.uid(),p_requisicao,v_assinatura,v.id);
 return v;
end; $$;
create or replace function public.salvar_venda_erp(p_requisicao uuid,p_payload jsonb,p_autorizar_sem_estoque boolean default false)
returns public.vendas language sql security invoker set search_path='' as $$
 select private.salvar_venda_erp_impl(p_requisicao,p_payload,p_autorizar_sem_estoque);
$$;
revoke all on function private.salvar_venda_erp_impl(uuid,jsonb,boolean),public.salvar_venda_erp(uuid,jsonb,boolean) from public,anon;
grant execute on function private.salvar_venda_erp_impl(uuid,jsonb,boolean),public.salvar_venda_erp(uuid,jsonb,boolean) to authenticated;
