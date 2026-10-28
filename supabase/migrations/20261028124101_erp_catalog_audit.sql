-- Keep request tracking inaccessible to clients, explicitly.
create policy erp_requisicoes_deny_clients on private.erp_requisicoes for all to authenticated using(false) with check(false);
create or replace function private.validar_catalogo_financeiro()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.nome:=btrim(new.nome);
 if coalesce(new.nome,'')='' or length(new.nome)>100 then raise exception 'Informe um nome de até 100 caracteres'; end if;
 perform pg_advisory_xact_lock(hashtextextended(tg_table_name||lower(new.nome),0));
 if tg_table_name='categorias_financeiras' then
   if exists(select 1 from public.categorias_financeiras where lower(btrim(nome))=lower(new.nome) and id<>new.id) then raise exception 'Categoria já cadastrada; reative o registro existente'; end if;
 else
   if exists(select 1 from public.centros_custo where lower(btrim(nome))=lower(new.nome) and id<>new.id) then raise exception 'Centro de custo já cadastrado; reative o registro existente'; end if;
 end if;
 return new;
end; $$;
create trigger erp_validar_categoria before insert or update of nome on public.categorias_financeiras for each row execute function private.validar_catalogo_financeiro();
create trigger erp_validar_centro before insert or update of nome on public.centros_custo for each row execute function private.validar_catalogo_financeiro();
create trigger erp_auditar_categoria after insert or update or delete on public.categorias_financeiras for each row execute function private.registrar_auditoria();
create trigger erp_auditar_centro after insert or update or delete on public.centros_custo for each row execute function private.registrar_auditoria();
revoke all on function private.validar_catalogo_financeiro() from public,anon,authenticated;
