alter table public.comprovantes_pagamento
  drop constraint if exists comprovante_uma_fatura_check;

alter table public.comprovantes_pagamento
  add constraint comprovante_uma_fatura_check
  check (
    (venda_id is not null and compra_id is null)
    or (venda_id is null and compra_id is not null)
    or (venda_id is null and compra_id is null)
  );
