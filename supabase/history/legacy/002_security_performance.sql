-- Ajustes de seguranca e desempenho aplicados no projeto ORGJSS1

create index if not exists idx_compra_itens_compra_id on public.compra_itens(compra_id);
create index if not exists idx_compra_itens_produto_id on public.compra_itens(produto_id);
create index if not exists idx_compras_fornecedor_id on public.compras(fornecedor_id);
create index if not exists idx_movimentos_estoque_produto_id on public.movimentos_estoque(produto_id);
create index if not exists idx_produtos_fornecedor_id on public.produtos(fornecedor_id);
create index if not exists idx_venda_itens_produto_id on public.venda_itens(produto_id);
create index if not exists idx_venda_itens_venda_id on public.venda_itens(venda_id);
create index if not exists idx_vendas_cliente_id on public.vendas(cliente_id);
create index if not exists idx_vendas_vendedor_id on public.vendas(vendedor_id);
create index if not exists idx_titulos_vencimento_status on public.titulos_financeiros(vencimento,status);

drop policy if exists clientes_write on public.clientes;
drop policy if exists fornecedores_write on public.fornecedores;
drop policy if exists produtos_write on public.produtos;
drop policy if exists vendas_write on public.vendas;
drop policy if exists venda_itens_write on public.venda_itens;
drop policy if exists compras_write on public.compras;
drop policy if exists compra_itens_write on public.compra_itens;
drop policy if exists titulos_write on public.titulos_financeiros;
drop policy if exists movimentos_write on public.movimentos_estoque;

create policy clientes_insert on public.clientes for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')));
create policy clientes_update on public.clientes for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')));
create policy clientes_delete on public.clientes for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));

create policy fornecedores_insert on public.fornecedores for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy fornecedores_update on public.fornecedores for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy fornecedores_delete on public.fornecedores for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));

create policy produtos_insert on public.produtos for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy produtos_update on public.produtos for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy produtos_delete on public.produtos for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));

create policy vendas_insert on public.vendas for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')));
create policy vendas_update on public.vendas for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')));
create policy vendas_delete on public.vendas for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));

create policy venda_itens_insert on public.venda_itens for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')));
create policy venda_itens_update on public.venda_itens for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')));
create policy venda_itens_delete on public.venda_itens for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','vendas')));

create policy compras_insert on public.compras for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy compras_update on public.compras for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy compras_delete on public.compras for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));

create policy compra_itens_insert on public.compra_itens for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy compra_itens_update on public.compra_itens for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy compra_itens_delete on public.compra_itens for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));

create policy titulos_insert on public.titulos_financeiros for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
create policy titulos_update on public.titulos_financeiros for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
create policy titulos_delete on public.titulos_financeiros for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));

create policy movimentos_insert on public.movimentos_estoque for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy movimentos_update on public.movimentos_estoque for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','estoque')));
create policy movimentos_delete on public.movimentos_estoque for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil='administrador'));
