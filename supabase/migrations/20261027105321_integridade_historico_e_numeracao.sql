create unique index if not exists vendas_fatura_numero_unq on public.vendas(fatura_numero);
create unique index if not exists compras_fatura_numero_unq on public.compras(fatura_numero);

create or replace view public.historico_pagamentos_titulos
with (security_invoker=true)
as
select p.id,p.titulo_id,t.tipo,t.descricao,t.entidade_nome,t.venda_id,t.compra_id,
       p.data_pagamento,p.valor,p.forma_pagamento,p.observacao,p.created_by,p.created_at,
       p.vendedor_id,p.percentual_comissao
from public.pagamentos_titulos p
join public.titulos_financeiros t on t.id=p.titulo_id;

grant select on public.historico_pagamentos_titulos to authenticated;

create or replace view public.integridade_erp
with (security_invoker=true)
as
select 'venda_sem_titulo'::text as tipo, v.id::text as registro_id,
       'Venda faturada/pedido sem título financeiro ativo'::text as detalhe
from public.vendas v
where v.status in ('pedido','faturado')
  and not exists (
    select 1 from public.titulos_financeiros t
    where t.venda_id=v.id and t.tipo='receber' and t.status<>'cancelado'
  )
union all
select 'compra_sem_titulo', c.id::text,
       'Compra ativa sem título financeiro ativo'
from public.compras c
where c.status<>'cancelada'
  and not exists (
    select 1 from public.titulos_financeiros t
    where t.compra_id=c.id and t.tipo='pagar' and t.status<>'cancelado'
  )
union all
select 'produto_estoque_negativo', p.id::text,
       'Produto com estoque negativo: '||p.codigo||' - '||p.descricao
from public.produtos p
where p.estoque_atual<0
union all
select 'titulo_pago_inconsistente', t.id::text,
       'Título marcado como pago com valor pago inferior ao total'
from public.titulos_financeiros t
where t.status='pago' and t.valor_pago+0.005<t.valor;

grant select on public.integridade_erp to authenticated;

insert into public.categorias_financeiras(nome,tipo)
values
 ('Vendas','receber'),('Outras receitas','receber'),
 ('Fornecedores','pagar'),('Salários','pagar'),('Impostos','pagar'),
 ('Aluguel','pagar'),('Serviços','pagar'),('Outras despesas','pagar')
on conflict do nothing;

insert into public.centros_custo(nome)
values ('Administrativo'),('Comercial'),('Operacional'),('Logística'),('Financeiro')
on conflict do nothing;
