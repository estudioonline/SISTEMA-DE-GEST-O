begin;
create table public.funcionarios (
 id uuid primary key default gen_random_uuid(),
 nome text not null check (length(btrim(nome)) between 1 and 120),
 cargo text check (length(cargo)<=100),
 ativo boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.funcionarios enable row level security;
revoke all on public.funcionarios from public,anon,authenticated;
grant select,insert,update on public.funcionarios to authenticated;
create policy funcionarios_read on public.funcionarios for select to authenticated
 using ((select private.usuario_pode('financeiro','visualizar')));
create policy funcionarios_insert on public.funcionarios for insert to authenticated
 with check ((select private.usuario_pode('financeiro','editar')));
create policy funcionarios_update on public.funcionarios for update to authenticated
 using ((select private.usuario_pode('financeiro','editar')))
 with check ((select private.usuario_pode('financeiro','editar')));
create trigger erp_auditar_funcionarios after insert or update or delete on public.funcionarios
 for each row execute function private.registrar_auditoria();

-- Reuse the payable ledger and its audited payment/reversal routines.
-- No second payable or payment is created by the employee views.
alter table public.titulos_financeiros
 add column funcionario_id uuid references public.funcionarios(id) on delete restrict,
 add column tipo_funcionario text,
 add column competencia date,
 add column vale_descontado_em date,
 add constraint titulo_funcionario_vinculo check (
   (funcionario_id is null and tipo_funcionario is null and competencia is null and vale_descontado_em is null)
   or (funcionario_id is not null and tipo_funcionario is not null and tipo_funcionario in ('gasto','vale')
     and competencia is not null and extract(day from competencia)=1
     and tipo='pagar' and venda_id is null and compra_id is null and valor>0)
 ),
 add constraint titulo_vale_desconto check (
   vale_descontado_em is null or (tipo_funcionario='vale' and status='pago')
 );
create index titulos_funcionario_competencia_idx on public.titulos_financeiros(funcionario_id,competencia) where funcionario_id is not null;
comment on column public.titulos_financeiros.vale_descontado_em is
 'Confirmação manual de desconto na folha; não gera pagamento. Desfazer antes de estornar o vale.';
commit;
