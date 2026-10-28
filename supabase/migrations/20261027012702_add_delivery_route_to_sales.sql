alter table public.vendas
  add column if not exists rota_entrega text;

alter table public.vendas
  drop constraint if exists vendas_rota_entrega_check;

alter table public.vendas
  add constraint vendas_rota_entrega_check
  check (rota_entrega is null or rota_entrega in ('norte','sul','leste','interestadual','retirada'));
