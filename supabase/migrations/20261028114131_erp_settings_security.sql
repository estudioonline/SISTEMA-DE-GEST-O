-- Incremental: no existing rows are changed.
alter table public.profiles alter column perfil set default 'visualizador';
alter table public.profiles alter column ativo set default false;
drop policy if exists profiles_self_insert on public.profiles;
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,nome,perfil,ativo)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(coalesce(new.email,''),'@',1),'Usuário'),'visualizador',false);
 return new;
end; $$;

create or replace function private.validar_empresa_config()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.desconto_max_vendedor not between 0 and 100
 or new.margem_minima_percentual not between 0 and 100
 or new.validade_orcamento_dias not between 1 and 365
 or new.sessao_inatividade_minutos not between 5 and 480
 or jsonb_typeof(new.campos_obrigatorios) is distinct from 'object' then
   raise exception 'Configurações comerciais ou de sessão inválidas';
 end if;
 if tg_op='UPDATE' and new.reservar_estoque_pedido is distinct from old.reservar_estoque_pedido then
   raise exception 'A política de estoque de pedidos exige migração específica dos pedidos abertos';
 end if;
 return new;
end; $$;
create trigger erp_validar_empresa_config before insert or update on public.empresa_config
for each row execute function private.validar_empresa_config();
alter policy categorias_financeiras_select on public.categorias_financeiras using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo));
alter policy centros_custo_select on public.centros_custo using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo));
alter policy fechamentos_comissao_select on public.fechamentos_comissao using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo));
alter policy aprovacoes_insert on public.aprovacoes_operacoes with check (
 solicitado_por=(select auth.uid()) and status='pendente' and aprovado_por is null and aprovado_em is null
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas','estoque','financeiro')));
revoke all on function private.handle_new_user() from public,anon,authenticated;
revoke all on function private.validar_empresa_config() from public,anon,authenticated;
