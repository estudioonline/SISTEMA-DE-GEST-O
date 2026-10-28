import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type Request = {id:string;tipo:string;status:string;motivo:string|null;solicitado_em:string;aprovado_em:string|null;decisao_motivo:string|null;resultado_id:string|null;entidade_id:string|null;payload:Record<string,unknown>|null}
type Product = {id:string;descricao:string}

export function AuthorizationCenter({admin,products,clients,sellers,onChanged}:{admin:boolean;products:Product[];clients:{id:string;nome:string}[];sellers:{id:string;nome:string}[];onChanged:()=>Promise<void>}) {
  const [rows,setRows]=useState<Request[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState<string|null>(null)
  const [filter,setFilter]=useState('pendente')
  const [page,setPage]=useState(0)
  const [count,setCount]=useState(0)
  const [reasons,setReasons]=useState<Record<string,string>>({})
  const [decisionErrors,setDecisionErrors]=useState<Record<string,string>>({})
  const load=useCallback(async()=>{
    let query=supabase.from('aprovacoes_operacoes').select('id,tipo,status,motivo,solicitado_em,aprovado_em,decisao_motivo,resultado_id,entidade_id,payload',{count:'exact'})
    if(filter!=='todos')query=query.eq('status',filter)
    const result=await query.order('solicitado_em',{ascending:false}).order('id').range(page*50,page*50+49)
    if(result.error){setError(result.error.message);return}
    setRows(result.data as Request[])
    setCount(result.count||0)
    if(page>0&&!result.data.length)setPage(p=>p-1)
  },[page,filter])
  useEffect(()=>{void load()},[load])
  async function decide(row:Request,approve:boolean){
    const reason=(reasons[row.id]||'').trim()
    if(reason.length<5){
      setDecisionErrors(old=>({...old,[row.id]:'Digite uma justificativa com pelo menos 5 caracteres para continuar.'}))
      return
    }
    setBusy(row.id)
    setDecisionErrors(old=>({...old,[row.id]:''}))
    try{
      const result=await supabase.rpc('decidir_autorizacao_venda',{p_id:row.id,p_aprovar:approve,p_motivo:reason})
      if(result.error){
        setDecisionErrors(old=>({...old,[row.id]:result.error.message}))
        return
      }
      setReasons(old=>({...old,[row.id]:''}))
      await load()
      await onChanged()
    }finally{setBusy(null)}
  }
  return <section className="panel">
    <div className="panelHead"><div><h3>Central de autorizações</h3><p>A aprovação salva a venda e seus vínculos em uma única operação. Preços, crédito e estoque são verificados novamente no banco.</p></div><button className="ghost" onClick={()=>void load()}>Atualizar</button></div>
    {error&&<p role="alert">{error}</p>}
    <label className="fieldLabel">Status<select value={filter} onChange={e=>{setPage(0);setFilter(e.target.value)}}><option value="pendente">Pendentes</option><option value="todos">Todos</option><option value="aprovado">Aprovados</option><option value="rejeitado">Rejeitados</option></select></label>
    <p>{count} registro(s). {admin?'Ao autorizar, você também aprova eventuais exceções de crédito, desconto, margem e estoque negativo deste rascunho. O preço mínimo por produto continua obrigatório.':'Você acompanha suas próprias solicitações.'}</p>
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
        {admin&&p&&row.status==='pendente'&&<>{(()=>{
          const decisionReason=(reasons[row.id]||'').trim()
          const canDecide=decisionReason.length>=5&&busy===null
          return <>
            <label className="fieldLabel authorizationReasonField">Justificativa da decisão
              <textarea
                minLength={5}
                placeholder="Digite o motivo da aprovação ou rejeição (mínimo 5 caracteres)"
                value={reasons[row.id]||''}
                onChange={e=>{
                  const value=e.target.value
                  setReasons(old=>({...old,[row.id]:value}))
                  if(value.trim().length>=5)setDecisionErrors(old=>({...old,[row.id]:''}))
                }}
              />
              <small className={decisionReason.length>=5?'authorizationReasonOk':'authorizationReasonHint'}>
                {decisionReason.length>=5?'Justificativa preenchida.':`Faltam ${Math.max(0,5-decisionReason.length)} caractere(s) para liberar a decisão.`}
              </small>
            </label>
            {decisionErrors[row.id]&&<p className="authorizationInlineError" role="alert">{decisionErrors[row.id]}</p>}
            <div className="formActions">
              <button className="ghost" disabled={!canDecide} title={!canDecide?'Preencha a justificativa com pelo menos 5 caracteres':''} onClick={()=>void decide(row,false)}>Rejeitar</button>
              <button className="primary" disabled={!canDecide} title={!canDecide?'Preencha a justificativa com pelo menos 5 caracteres':''} onClick={()=>void decide(row,true)}>{busy===row.id?'Processando...':'Autorizar e salvar venda'}</button>
            </div>
          </>
        })()}</>}
      </article>
    })}
    {!rows.length&&<p>Nenhuma autorização neste status.</p>}
    <div className="formActions"><button className="ghost" disabled={!page||busy!==null} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} de {Math.max(1,Math.ceil(count/50))}</span><button className="ghost" disabled={(page+1)*50>=count||busy!==null} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
  </section>
}
