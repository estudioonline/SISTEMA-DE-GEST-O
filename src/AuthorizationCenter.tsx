import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type Request = {id:string;tipo:string;status:string;motivo:string|null;solicitado_em:string;aprovado_em:string|null;decisao_motivo:string|null;resultado_id:string|null;entidade_id:string|null;payload:Record<string,unknown>|null}
type Product = {id:string;descricao:string}

export function AuthorizationCenter({admin,products,clients,sellers,onChanged}:{admin:boolean;products:Product[];clients:{id:string;nome:string}[];sellers:{id:string;nome:string}[];onChanged:()=>Promise<void>}) {
  const [rows,setRows]=useState<Request[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState<string|null>(null)
  const [filter,setFilter]=useState('pendente')
  const [reasons,setReasons]=useState<Record<string,string>>({})
  const load=useCallback(async()=>{
    const result=await supabase.from('aprovacoes_operacoes').select('id,tipo,status,motivo,solicitado_em,aprovado_em,decisao_motivo,resultado_id,entidade_id,payload').order('solicitado_em',{ascending:false}).limit(200)
    if(result.error){setError(result.error.message);return}
    setRows(result.data as Request[])
  },[])
  useEffect(()=>{void load()},[load])
  async function decide(row:Request,approve:boolean){
    const reason=(reasons[row.id]||'').trim()
    if(reason.length<5){setError('Informe uma justificativa com pelo menos 5 caracteres.');return}
    setBusy(row.id);setError('')
    try{
      const result=await supabase.rpc('decidir_autorizacao_venda',{p_id:row.id,p_aprovar:approve,p_motivo:reason})
      if(result.error){setError(result.error.message);return}
      await load();await onChanged()
    }finally{setBusy(null)}
  }
  return <section className="panel">
    <div className="panelHead"><div><h3>Central de autorizações</h3><p>A aprovação salva a venda e seus vínculos em uma única operação. Preços, crédito e estoque são verificados novamente no banco.</p></div><button className="ghost" onClick={()=>void load()}>Atualizar</button></div>
    {error&&<p role="alert">{error}</p>}
    <label className="fieldLabel">Status<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="pendente">Pendentes</option><option value="todos">Todos</option><option value="aprovado">Aprovados</option><option value="rejeitado">Rejeitados</option></select></label>
    <p>Exibindo até 200 registros recentes. {admin?'Ao autorizar, você também aprova eventuais exceções de crédito, desconto, margem e estoque negativo deste rascunho. O preço mínimo por produto continua obrigatório.':'Você acompanha suas próprias solicitações.'}</p>
    {rows.filter(r=>filter==='todos'||r.status===filter).map(row=>{
      const p=row.payload
      const items=(Array.isArray(p?.p_itens)?p.p_itens:[]) as {produto_id:string;quantidade:number;valor_unitario:number;desconto:number}[]
      const total=items.reduce((sum,i)=>sum+Number(i.quantidade)*Number(i.valor_unitario)-Number(i.desconto||0),0)
      return <article className="panel" key={row.id}>
        <h4>{p?(p.p_venda_id?'Alteração de venda':'Nova venda'):row.tipo} · {row.status}</h4>
        <p>{new Date(row.solicitado_em).toLocaleString('pt-BR')} · {row.motivo}</p>
        {p&&<><p>Cliente: {clients.find(c=>c.id===p.p_cliente_id)?.nome||'Consumidor'} · Vendedor: {sellers.find(s=>s.id===p.p_vendedor_cadastro_id)?.nome||'Sem vendedor'}</p><p>Etapa: {String(p.p_status)} · Pagamento: {String(p.p_forma_pagamento)} · Parcelas: {String(p.p_parcelas)} · Rota: {String(p.p_rota_entrega)}</p>
        <p>Primeiro vencimento: {String(p.p_primeiro_vencimento)} · Observações: {String(p.p_observacoes||'—')}</p>
        <table><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço</th><th>Desconto</th></tr></thead><tbody>{items.map((i,index)=><tr key={index}><td>{products.find(x=>x.id===i.produto_id)?.descricao||i.produto_id}</td><td>{i.quantidade}</td><td>{Number(i.valor_unitario).toFixed(2)}</td><td>{Number(i.desconto||0).toFixed(2)}</td></tr>)}</tbody></table>
        <p>Total: {total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p></>}
        {row.decisao_motivo&&<p>Decisão: {row.decisao_motivo}</p>}
        {(row.resultado_id||row.entidade_id)&&<p>Venda vinculada: {row.resultado_id||row.entidade_id}</p>}
        {admin&&p&&row.status==='pendente'&&<><label className="fieldLabel">Justificativa da decisão<textarea value={reasons[row.id]||''} onChange={e=>setReasons(old=>({...old,[row.id]:e.target.value}))}/></label><div className="formActions"><button className="ghost" disabled={busy!==null} onClick={()=>void decide(row,false)}>Rejeitar</button><button className="primary" disabled={busy!==null} onClick={()=>void decide(row,true)}>{busy===row.id?'Processando...':'Autorizar e salvar venda'}</button></div></>}
      </article>
    })}
    {!rows.some(r=>filter==='todos'||r.status===filter)&&<p>Nenhuma autorização neste status.</p>}
  </section>
}
