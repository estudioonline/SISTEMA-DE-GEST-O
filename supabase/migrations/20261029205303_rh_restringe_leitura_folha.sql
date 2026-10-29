begin;
-- Report access alone must never expose salaries, deductions or employee advances.
-- This restrictive condition combines with the existing permissive policies.
create policy rh_restringe_leitura_folha on public.titulos_financeiros
 as restrictive for select to authenticated
 using (funcionario_id is null or (select private.usuario_pode('financeiro','visualizar')));
commit;
