create index if not exists vendas_estoque_negativo_autorizado_por_idx
  on public.vendas(estoque_negativo_autorizado_por);

drop policy if exists categorias_financeiras_manage on public.categorias_financeiras;
create policy categorias_financeiras_manage on public.categorias_financeiras
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));

drop policy if exists centros_custo_manage on public.centros_custo;
create policy centros_custo_manage on public.centros_custo
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));

drop policy if exists aprovacoes_select on public.aprovacoes_operacoes;
create policy aprovacoes_select on public.aprovacoes_operacoes
for select to authenticated
using (solicitado_por=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));

drop policy if exists aprovacoes_insert on public.aprovacoes_operacoes;
create policy aprovacoes_insert on public.aprovacoes_operacoes
for insert to authenticated with check (solicitado_por=(select auth.uid()));

drop policy if exists aprovacoes_admin_update on public.aprovacoes_operacoes;
create policy aprovacoes_admin_update on public.aprovacoes_operacoes
for update to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));

drop policy if exists fechamentos_comissao_manage on public.fechamentos_comissao;
create policy fechamentos_comissao_manage on public.fechamentos_comissao
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));

drop policy if exists auditoria_admin_select on public.auditoria_log;
create policy auditoria_admin_select on public.auditoria_log
for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));
