import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, RefreshCw, Search, ShieldAlert, X, XCircle } from 'lucide-react'
import { supabase } from './lib/supabase'

type Request = {
  id:string
  tipo:string
  status:string
  motivo:string|null
  solicitado_em:string
  aprovado_em:string|null
  decisao_motivo:string|null
  resultado_id:string|null
  entidade_id:string|null
  payload:Record<string,unknown>|null
}

type Product = {
  id:string
  descricao:string
  estoque_atual:number
  estoque_minimo?:number|null
  unidade:string
  custo?:number|null
  custo_medio?:number|null
  percentual_minimo_custo_venda?:number|null
}

type SaleItem = {
  produto_id:string
  quantidade:number
  valor_unitario:number
  desconto:number
}

type ApprovalBlocker = {
  tipo:string
  label:string
  detalhe?:string
}

type SummaryCounts = {
  pending:number
  critical:number
  approved:number
  rejected:number
}

type ViewMode = 'pendentes'|'historico'
type HistoryFilter = 'todos'|'aprovado'|'rejeitado'

const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const saleKey=(row:Request)=>row.resultado_id||row.entidade_id||String(row.payload?.p_venda_id||'')||row.id
const rowBlockers=(row:Request)=>(Array.isArray(row.payload?.p_bloqueios)?row.payload?.p_bloqueios:[]) as ApprovalBlocker[]
const rowItems=(row:Request)=>(Array.isArray(row.payload?.p_itens)?row.payload?.p_itens:[]) as SaleItem[]
const blockerIsCritical=(blocker:ApprovalBlocker)=>{
  const key=normalize(blocker.tipo+' '+blocker.label)
  return /estoque|preco|credito|inadimpl|fatura paga|fatura_paga/.test(key)
}

export function AuthorizationCenter({
  admin,
  products,
  clients,
  sellers,
  onChanged,
  onOpenSale
}:{
  admin:boolean
  products:Product[]
  clients:{id:string;nome:string}[]
  sellers:{id:string;nome:string}[]
  onChanged:()=>Promise<void>
  onOpenSale?:(id:string)=>void
}) {
  const [rows,setRows]=useState<Request[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState<string|null>(null)
  const [view,setView]=useState<ViewMode>('pendentes')
  const [historyFilter,setHistoryFilter]=useState<HistoryFilter>('todos')
  const [search,setSearch]=useState('')
  const [page,setPage]=useState(0)
  const [count,setCount]=useState(0)
  const [loading,setLoading]=useState(true)
  const [summary,setSummary]=useState<SummaryCounts>({pending:0,critical:0,approved:0,rejected:0})
  const [selectedKey,setSelectedKey]=useState<string|null>(null)
  const [feedback,setFeedback]=useState<{message:string;saleId?:string}>()
  const loadSequence=useRef(0)
  const deciding=useRef(false)
  const [reasons,setReasons]=useState<Record<string,string>>({})
  const [decisionErrors,setDecisionErrors]=useState<Record<string,string>>({})

  const activeStatus=view==='pendentes'?'pendente':historyFilter

  const loadSummary=useCallback(async()=>{
    const [pending,approved,rejected,criticalRows]=await Promise.all([
      supabase.from('aprovacoes_operacoes').select('id',{count:'exact',head:true}).eq('status','pendente'),
      supabase.from('aprovacoes_operacoes').select('id',{count:'exact',head:true}).eq('status','aprovado'),
      supabase.from('aprovacoes_operacoes').select('id',{count:'exact',head:true}).eq('status','rejeitado'),
      supabase.from('aprovacoes_operacoes').select('payload').eq('status','pendente').limit(500)
    ])
    const critical=(criticalRows.data||[]).filter(row=>{
      const payload=row.payload as Record<string,unknown>|null
      const blockers=(Array.isArray(payload?.p_bloqueios)?payload?.p_bloqueios:[]) as ApprovalBlocker[]
      return blockers.some(blockerIsCritical)
    }).length
    setSummary({
      pending:pending.count||0,
      critical,
      approved:approved.count||0,
      rejected:rejected.count||0
    })
  },[])

  const load=useCallback(async()=>{
    const sequence=++loadSequence.current
    setLoading(true)
    setError('')
    try{
      let query=supabase
        .from('aprovacoes_operacoes')
        .select('id,tipo,status,motivo,solicitado_em,aprovado_em,decisao_motivo,resultado_id,entidade_id,payload',{count:'exact'})
      if(activeStatus!=='todos')query=query.eq('status',activeStatus)
      const result=await query
        .order('solicitado_em',{ascending:false})
        .order('id')
        .range(page*50,page*50+49)
      if(sequence!==loadSequence.current)return
      if(result.error){
        setRows([])
        setError(result.error.message)
        return
      }
      setRows(result.data as Request[])
      setCount(result.count||0)
      if(page>0&&!result.data.length)setPage(current=>current-1)
    }catch{
      if(sequence===loadSequence.current){
        setRows([])
        setError('Não foi possível carregar as autorizações. Tente atualizar.')
      }
    }finally{
      if(sequence===loadSequence.current)setLoading(false)
    }
  },[page,activeStatus])

  const reloadAll=useCallback(async()=>{
    await Promise.all([load(),loadSummary()])
  },[load,loadSummary])

  useEffect(()=>{
    void reloadAll()
    return()=>{loadSequence.current++}
  },[reloadAll])

  function buildMeta(row:Request){
    const p=row.payload
    const items=rowItems(row)
    const blockers=rowBlockers(row)
    const total=items.reduce((sum,item)=>sum+Number(item.quantidade)*Number(item.valor_unitario)-Number(item.desconto||0),0)
    const clientName=clients.find(client=>client.id===p?.p_cliente_id)?.nome||'Consumidor'
    const sellerName=sellers.find(seller=>seller.id===p?.p_vendedor_cadastro_id)?.nome||'Sem vendedor'

    const hasStockShortage=items.some(item=>{
      const product=products.find(product=>product.id===item.produto_id)
      return product?Number(product.estoque_atual)<Number(item.quantidade):false
    })

    const hasBelowMinimum=items.some(item=>{
      const product=products.find(product=>product.id===item.produto_id)
      if(!product||Number(item.quantidade)<=0)return false
      const cost=Math.round(Number(product.custo_medio??product.custo??0)*100)/100
      const minimum=cost*(1+Number(product.percentual_minimo_custo_venda??100)/100)
      const effective=Number(item.valor_unitario)-Math.min(Number(item.desconto||0),Number(item.quantidade)*Number(item.valor_unitario))/Number(item.quantidade)
      return effective+0.000001<minimum
    })

    const critical=blockers.some(blockerIsCritical)||hasStockShortage||hasBelowMinimum
    const saleId=row.resultado_id||row.entidade_id||String(p?.p_venda_id||'')
    const typeLabel=p?(row.entidade_id?'Orçamento → venda':p.p_venda_id?'Alteração de venda':'Nova venda'):row.tipo

    return {p,items,blockers,total,clientName,sellerName,hasStockShortage,hasBelowMinimum,critical,saleId,typeLabel}
  }

  const groups=useMemo(()=>{
    const map=new Map<string,Request[]>()
    for(const row of rows){
      const key=saleKey(row)
      const current=map.get(key)||[]
      current.push(row)
      map.set(key,current)
    }
    return Array.from(map.entries()).map(([key,requests])=>{
      requests.sort((a,b)=>new Date(b.solicitado_em).getTime()-new Date(a.solicitado_em).getTime())
      return {key,requests,latest:requests[0]}
    })
  },[rows])

  const filteredGroups=groups.filter(group=>{
    if(!search.trim())return true
    const query=normalize(search)
    const latestMeta=buildMeta(group.latest)
    const haystack=[
      group.key,
      latestMeta.clientName,
      latestMeta.sellerName,
      latestMeta.saleId,
      group.latest.motivo,
      ...group.requests.flatMap(request=>rowBlockers(request).flatMap(blocker=>[blocker.tipo,blocker.label,blocker.detalhe||'']))
    ].map(normalize).join(' ')
    return haystack.includes(query)
  })

  const selectedGroup=selectedKey?groups.find(group=>group.key===selectedKey)||null:null
  const selectedRow=selectedGroup?.requests.find(request=>request.status==='pendente')||selectedGroup?.latest||null
  const selectedMeta=selectedRow?buildMeta(selectedRow):null

  async function decide(row:Request,approve:boolean){
    if(!admin||deciding.current||row.status!=='pendente')return
    const reason=(reasons[row.id]||'').trim()
    if(reason.length<5){
      setDecisionErrors(old=>({...old,[row.id]:'Digite uma justificativa com pelo menos 5 caracteres para continuar.'}))
      return
    }
    deciding.current=true
    setBusy(row.id)
    setFeedback(undefined)
    setDecisionErrors(old=>({...old,[row.id]:''}))
    try{
      const result=await supabase.rpc('decidir_autorizacao_venda',{p_id:row.id,p_aprovar:approve,p_motivo:reason})
      if(result.error){
        setDecisionErrors(old=>({...old,[row.id]:result.error.message}))
        return
      }
      const saleId=typeof result.data==='string'?result.data:row.resultado_id||row.entidade_id||undefined
      setFeedback({
        message:approve?'Autorização aprovada. A venda foi atualizada e o histórico foi preservado.':'Solicitação rejeitada. A venda foi preservada.',
        saleId:approve?saleId:undefined
      })
      setReasons(old=>({...old,[row.id]:''}))
      setSelectedKey(null)
      await reloadAll()
      await onChanged()
    }catch{
      setDecisionErrors(old=>({...old,[row.id]:'Não foi possível confirmar a decisão. Atualize o status antes de tentar novamente.'}))
    }finally{
      deciding.current=false
      setBusy(null)
    }
  }

  return <section className="authorizationCenter">
    <div className="authorizationTopbar">
      <div>
        <span className="authorizationEyebrow">CENTRAL DE AUTORIZAÇÕES</span>
        <h3>Fila de decisões</h3>
        <p>Revise exceções de preço, crédito e estoque antes de liberar a venda.</p>
      </div>
      <button className="ghost authorizationRefreshBtn" onClick={()=>void reloadAll()} disabled={loading||busy!==null}><RefreshCw size={16}/>Atualizar</button>
    </div>

    <div className="authorizationSummaryGrid">
      <button className={view==='pendentes'?'authorizationSummaryCard active':'authorizationSummaryCard'} onClick={()=>{setView('pendentes');setPage(0);setSelectedKey(null)}}>
        <span><Clock3 size={17}/>Pendentes</span><strong>{summary.pending}</strong>
      </button>
      <button className="authorizationSummaryCard critical" onClick={()=>{setView('pendentes');setPage(0);setSelectedKey(null)}}>
        <span><ShieldAlert size={17}/>Críticas</span><strong>{summary.critical}</strong>
      </button>
      <button className={view==='historico'&&historyFilter==='aprovado'?'authorizationSummaryCard approved active':'authorizationSummaryCard approved'} onClick={()=>{setView('historico');setHistoryFilter('aprovado');setPage(0);setSelectedKey(null)}}>
        <span><CheckCircle2 size={17}/>Aprovadas</span><strong>{summary.approved}</strong>
      </button>
      <button className={view==='historico'&&historyFilter==='rejeitado'?'authorizationSummaryCard rejected active':'authorizationSummaryCard rejected'} onClick={()=>{setView('historico');setHistoryFilter('rejeitado');setPage(0);setSelectedKey(null)}}>
        <span><XCircle size={17}/>Rejeitadas</span><strong>{summary.rejected}</strong>
      </button>
    </div>

    {error&&<p className="authorizationInlineError" role="alert">{error}</p>}
    {feedback&&<div className="authorizationFeedback" role="status">
      <span>{feedback.message}</span>
      {feedback.saleId&&onOpenSale&&<button className="ghost" onClick={()=>onOpenSale(feedback.saleId!)}><ExternalLink size={15}/>Abrir venda</button>}
    </div>}

    <div className="authorizationToolbar">
      <div className="authorizationTabs">
        <button className={view==='pendentes'?'active':''} onClick={()=>{setView('pendentes');setPage(0);setSelectedKey(null)}}>Pendentes</button>
        <button className={view==='historico'?'active':''} onClick={()=>{setView('historico');setPage(0);setSelectedKey(null)}}>Histórico</button>
      </div>

      {view==='historico'&&<select value={historyFilter} onChange={event=>{setHistoryFilter(event.target.value as HistoryFilter);setPage(0)}}>
        <option value="todos">Todos do histórico</option>
        <option value="aprovado">Aprovados</option>
        <option value="rejeitado">Rejeitados</option>
      </select>}

      <label className="authorizationSearch">
        <Search size={17}/>
        <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Pesquisar venda, cliente, vendedor ou bloqueio"/>
      </label>
    </div>

    <div className="authorizationListHeader">
      <span>{count} registro(s) · {filteredGroups.length} venda(s) nesta página</span>
      <small>{view==='pendentes'?'Priorize os cartões críticos e abra os detalhes antes da decisão.':'Histórico consolidado por venda.'}</small>
    </div>

    {loading?<div className="authorizationLoading" role="status">Carregando autorizações…</div>:<>
      <div className="authorizationQueue">
        {filteredGroups.map(group=>{
          const latest=group.latest
          const meta=buildMeta(latest)
          const pendingCount=group.requests.filter(request=>request.status==='pendente').length
          const combinedBlockers=Array.from(new Map(group.requests.flatMap(rowBlockers).map(blocker=>[(blocker.tipo||blocker.label),blocker])).values())
          const visibleBlockers=combinedBlockers.slice(0,3)
          const status=latest.status
          return <article className={`authorizationQueueCard ${meta.critical?'critical':''}`} key={group.key}>
            <div className="authorizationQueueMain">
              <div className="authorizationQueueTitle">
                <span className={`authorizationPriorityBadge ${meta.critical?'critical':'attention'}`}>
                  {meta.critical?<><AlertTriangle size={14}/>Crítica</>:<>Atenção</>}
                </span>
                <div>
                  <h4>{meta.clientName}</h4>
                  <p>{meta.typeLabel} · {new Date(latest.solicitado_em).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="authorizationQueueMeta">
                <span><strong>{money(meta.total)}</strong></span>
                <span>{meta.sellerName}</span>
                {pendingCount>1&&<span>{pendingCount} solicitações pendentes</span>}
                {status!=='pendente'&&<span className={`authorizationStatusPill ${status}`}>{status}</span>}
              </div>

              <div className="authorizationBlockerChips">
                {visibleBlockers.length?visibleBlockers.map((blocker,index)=><span key={(blocker.tipo||blocker.label)+'-'+index}>{blocker.label||blocker.tipo}</span>):<span>Revisão administrativa</span>}
                {combinedBlockers.length>3&&<span>+{combinedBlockers.length-3}</span>}
              </div>

              <p className="authorizationQueueReason">{latest.motivo||'Sem motivo informado.'}</p>
            </div>

            <div className="authorizationQueueActions">
              <button className="ghost" onClick={()=>setSelectedKey(group.key)}>Ver detalhes</button>
              {latest.status==='pendente'&&<button className="primary" onClick={()=>setSelectedKey(group.key)}>Revisar decisão</button>}
              {latest.status!=='pendente'&&meta.saleId&&onOpenSale&&<button className="ghost" onClick={()=>onOpenSale(meta.saleId)}><ExternalLink size={15}/>Abrir venda</button>}
            </div>
          </article>
        })}

        {!filteredGroups.length&&!error&&<div className="authorizationEmpty">
          <ShieldAlert size={28}/>
          <strong>{search?'Nenhum resultado encontrado.':view==='pendentes'?'Nenhuma autorização pendente.':'Nenhum registro no histórico.'}</strong>
          <span>{search?'Tente outro termo de pesquisa.':'A fila está limpa neste momento.'}</span>
        </div>}
      </div>

      <div className="authorizationPagination">
        <button className="ghost" disabled={!page||busy!==null} onClick={()=>setPage(current=>current-1)}>Anterior</button>
        <span>Página {page+1} de {Math.max(1,Math.ceil(count/50))}</span>
        <button className="ghost" disabled={(page+1)*50>=count||busy!==null} onClick={()=>setPage(current=>current+1)}>Próxima</button>
      </div>
    </>}

    {selectedRow&&selectedMeta&&<div className="authorizationDetailOverlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&busy===null)setSelectedKey(null)}}>
      <section className="authorizationDetailModal" role="dialog" aria-modal="true" aria-label="Detalhes da autorização">
        <div className="authorizationDetailHeader">
          <div>
            <span className="authorizationEyebrow">{selectedMeta.typeLabel}</span>
            <h3>{selectedMeta.clientName}</h3>
            <p>{selectedMeta.sellerName} · {money(selectedMeta.total)} · {new Date(selectedRow.solicitado_em).toLocaleString('pt-BR')}</p>
          </div>
          <button className="iconBtn" onClick={()=>setSelectedKey(null)} disabled={busy!==null} aria-label="Fechar"><X size={18}/></button>
        </div>

        <div className="authorizationDetailBody">
          <div className="authorizationDetailSummary">
            <div><span>Cliente</span><strong>{selectedMeta.clientName}</strong></div>
            <div><span>Vendedor</span><strong>{selectedMeta.sellerName}</strong></div>
            <div><span>Pagamento</span><strong>{String(selectedMeta.p?.p_forma_pagamento||'—')}</strong></div>
            <div><span>Etapa</span><strong>{String(selectedMeta.p?.p_status||'—')}</strong></div>
            <div><span>Parcelas</span><strong>{String(selectedMeta.p?.p_parcelas||'—')}</strong></div>
            <div><span>Rota</span><strong>{String(selectedMeta.p?.p_rota_entrega||'não informada')}</strong></div>
          </div>

          <section className="authorizationDetailSection">
            <div className="authorizationDetailSectionHead">
              <div><span>Bloqueios detectados</span><strong>{selectedMeta.blockers.length} exceção(ões)</strong></div>
            </div>
            <div className="authorizationDetailBlockers">
              {selectedMeta.blockers.length?selectedMeta.blockers.map((blocker,index)=><article key={(blocker.tipo||blocker.label)+'-'+index} className={blockerIsCritical(blocker)?'critical':''}>
                <AlertTriangle size={17}/>
                <div><strong>{blocker.label||blocker.tipo}</strong>{blocker.detalhe&&<span>{blocker.detalhe}</span>}</div>
              </article>):<article><div><strong>Revisão administrativa</strong><span>Não há bloqueios estruturados no registro.</span></div></article>}
            </div>
          </section>

          <section className="authorizationDetailSection">
            <div className="authorizationDetailSectionHead">
              <div><span>Itens da venda</span><strong>{selectedMeta.items.length} item(ns)</strong></div>
            </div>
            <div className="tableWrap authorizationDetailTable"><table>
              <thead><tr><th>Produto</th><th>Qtd.</th><th>Preço</th><th>Preço mínimo</th><th>Desconto</th><th>Estoque atual</th><th>Após venda</th></tr></thead>
              <tbody>{selectedMeta.items.map((item,index)=>{
                const product=products.find(candidate=>candidate.id===item.produto_id)
                const currentStock=product?Number(product.estoque_atual):null
                const projected=currentStock===null?null:currentStock-Number(item.quantidade)
                const cost=product?Math.round(Number(product.custo_medio??product.custo??0)*100)/100:0
                const minimum=product?cost*(1+Number(product.percentual_minimo_custo_venda??100)/100):0
                const effective=Number(item.quantidade)>0?Number(item.valor_unitario)-Math.min(Number(item.desconto||0),Number(item.quantidade)*Number(item.valor_unitario))/Number(item.quantidade):0
                const below=Boolean(product)&&effective+0.000001<minimum
                return <tr key={index}>
                  <td>{product?.descricao||item.produto_id}</td>
                  <td>{Number(item.quantidade).toLocaleString('pt-BR')}</td>
                  <td><span className={below?'authorizationBelowMinPrice':''}>{money(Number(item.valor_unitario))}</span></td>
                  <td>{product?money(minimum):'—'}</td>
                  <td>{money(Number(item.desconto||0))}</td>
                  <td>{currentStock===null?'—':`${currentStock.toLocaleString('pt-BR')} ${product?.unidade||''}`}</td>
                  <td><span className={projected!==null&&projected<0?'authorizationNegativeStock':'authorizationStockOk'}>{projected===null?'—':`${projected.toLocaleString('pt-BR')} ${product?.unidade||''}`}</span></td>
                </tr>
              })}</tbody>
            </table></div>
          </section>

          {selectedMeta.hasBelowMinimum&&<div className="authorizationPriceWarning"><strong>Preço abaixo do mínimo</strong><span>Ao aprovar, o administrador também autoriza esta venda abaixo do preço mínimo configurado para o produto.</span></div>}
          {selectedMeta.hasStockShortage&&<div className="authorizationStockWarning"><strong>Estoque insuficiente</strong><span>Se a venda for aprovada, o saldo do produto poderá ficar negativo.</span></div>}

          <section className="authorizationDetailSection">
            <div className="authorizationDetailSectionHead"><div><span>Solicitação</span><strong>{selectedRow.motivo||'Sem justificativa do solicitante'}</strong></div></div>
            {selectedRow.decisao_motivo&&<p className="authorizationDecisionHistory"><strong>Decisão registrada:</strong> {selectedRow.decisao_motivo}</p>}
            {selectedGroup&&selectedGroup.requests.length>1&&<p className="authorizationRelatedRequests">{selectedGroup.requests.length} registros desta venda foram agrupados neste cartão.</p>}
          </section>
        </div>

        <div className="authorizationDecisionBar">
          {admin&&selectedRow.status==='pendente'?(()=>{
            const decisionReason=(reasons[selectedRow.id]||'').trim()
            const canDecide=decisionReason.length>=5&&busy===null
            return <>
              <label className="authorizationDecisionReason">
                <span>Justificativa da decisão</span>
                <textarea
                  minLength={5}
                  placeholder="Digite o motivo da aprovação ou rejeição (mínimo 5 caracteres)"
                  value={reasons[selectedRow.id]||''}
                  onChange={event=>{
                    const value=event.target.value
                    setReasons(old=>({...old,[selectedRow.id]:value}))
                    if(value.trim().length>=5)setDecisionErrors(old=>({...old,[selectedRow.id]:''}))
                  }}
                />
                <small className={decisionReason.length>=5?'authorizationReasonOk':'authorizationReasonHint'}>
                  {decisionReason.length>=5?'Justificativa preenchida.':`Faltam ${Math.max(0,5-decisionReason.length)} caractere(s) para liberar a decisão.`}
                </small>
                {decisionErrors[selectedRow.id]&&<span className="authorizationInlineError" role="alert">{decisionErrors[selectedRow.id]}</span>}
              </label>
              <div className="authorizationDecisionActions">
                <button className="ghost" onClick={()=>setSelectedKey(null)} disabled={busy!==null}>Cancelar</button>
                <button className="dangerAction" disabled={!canDecide} onClick={()=>void decide(selectedRow,false)}>Rejeitar solicitação</button>
                <button className="primary authorizationApproveBtn" disabled={!canDecide} onClick={()=>void decide(selectedRow,true)}>{busy===selectedRow.id?'Processando...':'Aprovar e liberar venda'}</button>
              </div>
            </>
          })():<div className="authorizationDecisionHistoryBar">
            <span>Esta solicitação está <strong>{selectedRow.status}</strong>.</span>
            <div>
              {selectedMeta.saleId&&onOpenSale&&<button className="ghost" onClick={()=>onOpenSale(selectedMeta.saleId)}><ExternalLink size={15}/>Abrir venda</button>}
              <button className="primary" onClick={()=>setSelectedKey(null)}>Fechar</button>
            </div>
          </div>}
        </div>
      </section>
    </div>}
  </section>
}
