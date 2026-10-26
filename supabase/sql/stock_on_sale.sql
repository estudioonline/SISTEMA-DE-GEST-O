-- Baixa automatica de estoque ao inserir itens de pedido/faturamento.
-- Orçamentos não alteram estoque.
-- Aplicado no projeto Supabase ORGJSS1.

create or replace function private.aplicar_baixa_estoque_venda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_vendedor uuid;
  v_perfil text;
  v_estoque_restante numeric;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado';
  end if;

  select p.perfil into v_perfil
  from public.profiles p
  where p.id = (select auth.uid())
    and p.ativo = true;

  if v_perfil is null or v_perfil not in ('administrador','vendas') then
    raise exception 'Usuário sem permissão para registrar venda';
  end if;

  select v.status, v.vendedor_id
  into v_status, v_vendedor
  from public.vendas v
  where v.id = new.venda_id;

  if v_status is null then
    raise exception 'Venda não encontrada';
  end if;

  if v_perfil <> 'administrador'
     and v_vendedor is distinct from (select auth.uid()) then
    raise exception 'Venda pertence a outro vendedor';
  end if;

  if v_status in ('pedido','faturado') then
    update public.produtos
    set estoque_atual = estoque_atual - new.quantidade
    where id = new.produto_id
      and ativo = true
      and estoque_atual >= new.quantidade
    returning estoque_atual into v_estoque_restante;

    if not found then
      raise exception 'Estoque insuficiente para o produto selecionado';
    end if;

    insert into public.movimentos_estoque
      (produto_id, tipo, quantidade, referencia)
    values
      (new.produto_id, 'saida', new.quantidade, 'Venda ' || new.venda_id::text);
  end if;

  return new;
end;
$$;

revoke all on function private.aplicar_baixa_estoque_venda() from public, anon, authenticated;

drop trigger if exists trg_baixa_estoque_venda_item on public.venda_itens;

create trigger trg_baixa_estoque_venda_item
after insert on public.venda_itens
for each row
execute function private.aplicar_baixa_estoque_venda();
