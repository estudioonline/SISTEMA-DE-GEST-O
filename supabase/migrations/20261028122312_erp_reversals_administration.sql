create table public.estornos_pagamentos (
 id uuid primary key default gen_random_uuid(),
 pagamento_id uuid not null unique references public.pagamentos_titulos(id) on delete restrict,
 valor numeric not null check(valor>0),
 data_estorno date not null,
 motivo text not null check(length(btrim(motivo))>=5),
 criado_por uuid not null references auth.users(id),
 criado_em timestamptz not null default now()
);
alter table public.estornos_pagamentos enable row level security;
create policy estornos_financeiro_select on public.estornos_pagamentos for select to authenticated
using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.ativo and p.perfil in ('administrador','financeiro')));
revoke all on public.estornos_pagamentos from public,anon,authenticated;
grant select on public.estornos_pagamentos to authenticated;
create trigger erp_auditoria_estornos after insert on public.estornos_pagamentos for each row execute function private.registrar_auditoria();
alter table public.fechamentos_comissao add column reaberto_em timestamptz;
alter table public.fechamentos_comissao add column reaberto_por uuid references auth.users(id);
alter table public.fechamentos_comissao add column reabertura_motivo text;
alter table public.fechamentos_comissao add column resumo jsonb;
revoke insert,update,delete on public.fechamentos_comissao from authenticated,anon;

CREATE OR REPLACE FUNCTION private.registrar_pagamento_impl(p_titulo_id uuid, p_valor numeric, p_data_pagamento date, p_observacao text DEFAULT NULL::text)
 RETURNS titulos_financeiros
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_titulo public.titulos_financeiros%rowtype;
  v_total_pago numeric;
  v_vendedor_id uuid;
  v_percentual numeric;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('erp.commission_period',0));
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('administrador','financeiro')) then raise exception 'Sem permissão para registrar pagamentos'; end if;
  if p_valor is null or p_data_pagamento is null then raise exception 'Informe valor e data do pagamento'; end if;
  select * into v_titulo
  from public.titulos_financeiros
  where id=p_titulo_id
  for update;

  if not found then raise exception 'Título não encontrado'; end if;
  if v_titulo.status='cancelado' then raise exception 'Título cancelado não pode receber pagamento'; end if;
  if p_valor<=0 then raise exception 'Valor do pagamento deve ser maior que zero'; end if;
  if p_valor>greatest(v_titulo.valor-v_titulo.valor_pago,0) then
    raise exception 'Pagamento maior que o saldo em aberto';
  end if;

  if exists(
    select 1 from public.fechamentos_comissao f
    where f.reaberto_em is null and p_data_pagamento between f.inicio and f.fim
  ) and v_titulo.tipo='receber' and v_titulo.venda_id is not null then
    raise exception 'Período de comissão já fechado; recebimento retroativo bloqueado';
  end if;

  if v_titulo.tipo='receber' and v_titulo.venda_id is not null then
    select v.vendedor_cadastro_id, vd.percentual_comissao
      into v_vendedor_id, v_percentual
    from public.vendas v
    left join public.vendedores vd on vd.id=v.vendedor_cadastro_id
    where v.id=v_titulo.venda_id;
  end if;

  insert into public.pagamentos_titulos(
    titulo_id,data_pagamento,valor,observacao,vendedor_id,percentual_comissao,forma_pagamento
  )
  values (
    p_titulo_id,p_data_pagamento,p_valor,nullif(p_observacao,''),
    v_vendedor_id,v_percentual,v_titulo.forma_pagamento
  );

  select coalesce(sum(pg.valor),0)-coalesce((select sum(e.valor) from public.estornos_pagamentos e join public.pagamentos_titulos original on original.id=e.pagamento_id where original.titulo_id=p_titulo_id),0) into v_total_pago
  from public.pagamentos_titulos pg where pg.titulo_id=p_titulo_id;

  update public.titulos_financeiros
  set valor_pago=v_total_pago,
      status=case when v_total_pago>=valor then 'pago'
                  when v_total_pago>0 then 'parcial'
                  else 'aberto' end
  where id=p_titulo_id
  returning * into v_titulo;

  return v_titulo;
end;
$function$;
CREATE OR REPLACE FUNCTION private.proteger_titulo_integrado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ledger numeric;
begin
 if tg_op='DELETE' then
   if old.valor_pago>0 or exists(select 1 from public.pagamentos_titulos where titulo_id=old.id) then
     raise exception 'Título possui pagamento e não pode ser excluído';
   end if;
   if pg_trigger_depth()=1 and (old.venda_id is not null or old.compra_id is not null) then
     raise exception 'Título vinculado: cancele ou altere o documento de origem';
   end if;
   return old;
 end if;
 if new.valor<0 or new.valor_pago<0 or new.valor_pago>new.valor
 or (new.venda_id is not null and new.compra_id is not null) then raise exception 'Valores ou vínculos do título inválidos'; end if;
 if tg_op='INSERT' then
   if pg_trigger_depth()=1 and (new.venda_id is not null or new.compra_id is not null) then raise exception 'Títulos vinculados devem ser gerados pelo documento de origem'; end if;
 else
   if old.valor_pago>0 and new.status='cancelado' then
     raise exception 'Título com pagamento não pode ser cancelado';
   end if;
   if pg_trigger_depth()=1 and (old.venda_id is not null or old.compra_id is not null) and
    (new.venda_id is distinct from old.venda_id or new.compra_id is distinct from old.compra_id
     or new.tipo is distinct from old.tipo or new.valor is distinct from old.valor
     or new.parcela_numero is distinct from old.parcela_numero or new.forma_pagamento is distinct from old.forma_pagamento
     or new.status='cancelado') then raise exception 'Altere o documento de origem para manter os vínculos financeiros'; end if;
 end if;
 select coalesce(sum(pg.valor),0)-coalesce((select sum(e.valor) from public.estornos_pagamentos e join public.pagamentos_titulos original on original.id=e.pagamento_id where original.titulo_id=new.id),0) into v_ledger from public.pagamentos_titulos pg where pg.titulo_id=new.id;
 if new.valor_pago is distinct from v_ledger then raise exception 'Saldo pago deve corresponder ao histórico de pagamentos'; end if;
 if new.status<>'cancelado' and new.status is distinct from
   (case when v_ledger>=new.valor and new.valor>0 then 'pago' when v_ledger>0 then 'parcial' else 'aberto' end) then
   raise exception 'Status do título não corresponde ao saldo pago'; end if;
 return new;
end; $function$;

create or replace function private.estornar_pagamento_impl(p_pagamento uuid,p_data date,p_motivo text)
returns public.estornos_pagamentos language plpgsql security definer set search_path='' as $$
declare pg public.pagamentos_titulos%rowtype; t public.titulos_financeiros%rowtype; e public.estornos_pagamentos%rowtype; v_paid numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil in ('administrador','financeiro')) then raise exception 'Sem permissão para estornar pagamentos'; end if;
 if length(btrim(coalesce(p_motivo,'')))<5 or p_data is null then raise exception 'Informe data e justificativa do estorno'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('erp.commission_period',0));
 select * into pg from public.pagamentos_titulos where id=p_pagamento;
 if not found then raise exception 'Pagamento não encontrado'; end if;
 select * into t from public.titulos_financeiros where id=pg.titulo_id for update;
 select * into e from public.estornos_pagamentos where pagamento_id=pg.id;
 if found then raise exception 'Este pagamento já foi estornado'; end if;
 if p_data<pg.data_pagamento or p_data>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data do estorno deve estar entre o pagamento e hoje'; end if;
 if exists(select 1 from public.fechamentos_comissao f where f.reaberto_em is null and p_data between f.inicio and f.fim)
 and t.tipo='receber' and t.venda_id is not null then raise exception 'Período de comissão fechado. Use uma data aberta ou solicite reabertura administrativa.'; end if;
 insert into public.estornos_pagamentos(pagamento_id,valor,data_estorno,motivo,criado_por)
 values(pg.id,pg.valor,p_data,btrim(p_motivo),auth.uid()) returning * into e;
 select coalesce(sum(original.valor),0)-coalesce((select sum(reversal.valor) from public.estornos_pagamentos reversal join public.pagamentos_titulos original2 on original2.id=reversal.pagamento_id where original2.titulo_id=t.id),0)
 into v_paid from public.pagamentos_titulos original where original.titulo_id=t.id;
 update public.titulos_financeiros set valor_pago=v_paid,status=case when t.status='cancelado' then 'cancelado' when v_paid>=valor and valor>0 then 'pago' when v_paid>0 then 'parcial' else 'aberto' end where id=t.id;
 return e;
end; $$;
create or replace function public.estornar_pagamento_erp(p_pagamento uuid,p_data date,p_motivo text)
returns public.estornos_pagamentos language sql security invoker set search_path='' as $$
 select private.estornar_pagamento_impl(p_pagamento,p_data,p_motivo);
$$;

create or replace view public.movimentos_financeiros_erp with (security_invoker=true) as
select pg.id,pg.id pagamento_id,pg.titulo_id,pg.data_pagamento data_movimento,pg.valor,pg.vendedor_id,pg.percentual_comissao,pg.forma_pagamento,'pagamento'::text evento
from public.pagamentos_titulos pg
union all
select e.id,pg.id,pg.titulo_id,e.data_estorno,-e.valor,pg.vendedor_id,pg.percentual_comissao,pg.forma_pagamento,'estorno'::text
from public.estornos_pagamentos e join public.pagamentos_titulos pg on pg.id=e.pagamento_id;
grant select on public.movimentos_financeiros_erp to authenticated;
revoke all on public.movimentos_financeiros_erp from anon;

create or replace function public.comissoes_por_periodo(p_inicio date,p_fim date)
returns table(vendedor_id uuid,vendedor_nome text,percentual_comissao numeric,total_recebido numeric,comissao_apurada numeric,pagamentos integer,vendas integer)
language sql security invoker set search_path='' as $$
 select vd.id,vd.nome,vd.percentual_comissao,coalesce(sum(m.valor),0)::numeric,
 coalesce(sum(m.valor*coalesce(m.percentual_comissao,0)/100),0)::numeric,
 count(m.id) filter(where m.evento='pagamento')::integer,count(distinct t.venda_id)::integer
 from public.vendedores vd
 left join public.movimentos_financeiros_erp m on m.vendedor_id=vd.id and m.data_movimento between p_inicio and p_fim
 left join public.titulos_financeiros t on t.id=m.titulo_id
 where vd.ativo or m.id is not null group by vd.id,vd.nome,vd.percentual_comissao order by vd.nome;
$$;
create or replace function public.relatorio_comissoes_vendas(p_inicio date,p_fim date)
returns table(pagamento_id uuid,venda_id uuid,vendedor_id uuid,fatura_numero bigint,parcela_numero smallint,data_pagamento date,cliente text,vendedor text,forma_pagamento text,valor_venda numeric,valor_recebido numeric,percentual_comissao numeric,comissao_apurada numeric)
language sql security invoker set search_path='' as $$
 select m.id,v.id,coalesce(m.vendedor_id,v.vendedor_cadastro_id),v.fatura_numero,t.parcela_numero,m.data_movimento,
 coalesce(c.nome,'Consumidor'),coalesce(vd.nome,'Sem vendedor'),coalesce(m.forma_pagamento,v.forma_pagamento),v.total,m.valor,
 coalesce(m.percentual_comissao,0),(m.valor*coalesce(m.percentual_comissao,0)/100)::numeric
 from public.movimentos_financeiros_erp m join public.titulos_financeiros t on t.id=m.titulo_id and t.tipo='receber' and t.venda_id is not null
 join public.vendas v on v.id=t.venda_id left join public.clientes c on c.id=v.cliente_id
 left join public.vendedores vd on vd.id=coalesce(m.vendedor_id,v.vendedor_cadastro_id)
 where m.data_movimento between p_inicio and p_fim order by m.data_movimento,v.fatura_numero,t.parcela_numero,m.id;
$$;

create or replace function private.fechar_comissoes_impl(p_inicio date,p_fim date,p_motivo text)
returns public.fechamentos_comissao language plpgsql security definer set search_path='' as $$
declare f public.fechamentos_comissao%rowtype; v_resumo jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil='administrador') then raise exception 'Somente administrador pode fechar comissões'; end if;
 if p_inicio is null or p_fim is null or p_inicio>p_fim or p_fim>(now() at time zone 'America/Sao_Paulo')::date or length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Informe período válido e justificativa'; end if;
 perform pg_advisory_xact_lock(hashtextextended('erp.commission_period',0));
 if exists(select 1 from public.fechamentos_comissao where reaberto_em is null and daterange(inicio,fim,'[]') && daterange(p_inicio,p_fim,'[]')) then raise exception 'Período sobrepõe um fechamento ativo'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_resumo from public.comissoes_por_periodo(p_inicio,p_fim) r;
 insert into public.fechamentos_comissao(inicio,fim,fechado_por,observacao,resumo) values(p_inicio,p_fim,auth.uid(),btrim(p_motivo),v_resumo) returning * into f;
 return f;
end; $$;
create or replace function public.fechar_comissoes_erp(p_inicio date,p_fim date,p_motivo text)
returns public.fechamentos_comissao language sql security invoker set search_path='' as $$
 select private.fechar_comissoes_impl(p_inicio,p_fim,p_motivo);
$$;
create or replace function private.reabrir_comissoes_impl(p_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and ativo and perfil='administrador') then raise exception 'Somente administrador pode reabrir comissões'; end if;
 if length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Informe justificativa da reabertura'; end if;
 perform pg_advisory_xact_lock(hashtextextended('erp.commission_period',0));
 update public.fechamentos_comissao set reaberto_em=now(),reaberto_por=auth.uid(),reabertura_motivo=btrim(p_motivo) where id=p_id and reaberto_em is null;
 if not found then raise exception 'Fechamento não encontrado ou já reaberto'; end if;
end; $$;
create or replace function public.reabrir_comissoes_erp(p_id uuid,p_motivo text)
returns void language sql security invoker set search_path='' as $$ select private.reabrir_comissoes_impl(p_id,p_motivo); $$;
create trigger erp_auditoria_fechamentos after insert or update on public.fechamentos_comissao for each row execute function private.registrar_auditoria();

revoke all on function private.estornar_pagamento_impl(uuid,date,text),public.estornar_pagamento_erp(uuid,date,text),
private.fechar_comissoes_impl(date,date,text),public.fechar_comissoes_erp(date,date,text),
private.reabrir_comissoes_impl(uuid,text),public.reabrir_comissoes_erp(uuid,text) from public,anon;
grant execute on function private.estornar_pagamento_impl(uuid,date,text),public.estornar_pagamento_erp(uuid,date,text),
private.fechar_comissoes_impl(date,date,text),public.fechar_comissoes_erp(date,date,text),
private.reabrir_comissoes_impl(uuid,text),public.reabrir_comissoes_erp(uuid,text) to authenticated;
