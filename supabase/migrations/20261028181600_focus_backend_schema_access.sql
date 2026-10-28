begin;
-- Backend-only access: no schema privilege is granted to browser roles.
grant usage on schema private to service_role;
-- Explicit backend policy documents the intentional deny-by-default private table.
create policy focus_config_backend_only on private.focus_config_erp for all to service_role using(true) with check(true);
commit;
