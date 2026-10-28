drop index if exists public.vendas_fatura_numero_unq;
drop index if exists public.compras_fatura_numero_unq;

drop policy if exists categorias_financeiras_manage on public.categorias_financeiras;
create policy categorias_financeiras_manage on public.categorias_financeiras
for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
create policy categorias_financeiras_update on public.categorias_financeiras
for update to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
create policy categorias_financeiras_delete on public.categorias_financeiras
for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));

drop policy if exists centros_custo_manage on public.centros_custo;
create policy centros_custo_insert on public.centros_custo
for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
create policy centros_custo_update on public.centros_custo
for update to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
create policy centros_custo_delete on public.centros_custo
for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));

drop policy if exists fechamentos_comissao_manage on public.fechamentos_comissao;
create policy fechamentos_comissao_insert on public.fechamentos_comissao
for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
create policy fechamentos_comissao_update on public.fechamentos_comissao
for update to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
create policy fechamentos_comissao_delete on public.fechamentos_comissao
for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
