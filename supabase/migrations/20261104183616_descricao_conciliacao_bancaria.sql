alter table public.transacoes_bancarias
  add column if not exists descricao_conciliacao text;

comment on column public.transacoes_bancarias.descricao_conciliacao
  is 'Descrição livre informada no momento da conciliação bancária, ex.: Boletos antecipados.';
