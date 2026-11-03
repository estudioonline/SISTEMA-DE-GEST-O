import {useCallback,useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Clock3,FileDown,PackageCheck,RefreshCw,Route,Truck,X,Boxes,UserRound,ReceiptText,MapPin,CreditCard} from 'lucide-react'
import {supabase} from './lib/supabase'

type Sale={id:string;cliente_id:string|null;status:string;venda_numero:number|null;fatura_numero:number|null;total:number;created_at:string;forma_pagamento:string|null;parcelas:number|null;primeiro_vencimento:string|null;observacoes:string|null;rota_entrega:string|null}
type Client={id:string;nome:string}
type SaleItem={id:string;venda_id:string;produto_id:string|null;quantidade:number;valor_unitario:number;desconto:number;total:number;receita_producao:Array<{componente_id:string;quantidade:number;valor_unitario?:number}>|null}
type Product={id:string;codigo:string|null;descricao:string;unidade:string|null;tipo_produto:string|null;estoque_atual:number;rastrear_estoque:boolean}
type Sep={venda_item_id:string;quantidade_separada:number;status:'pendente'|'parcial'|'separado'}
type Prod={venda_item_id:string;status:'pendente'|'pronto';concluido_em:string|null}
type Delivery={id:string;venda_id:string;status:string;rota_logistica_id:string|null;valor_recebido_entrega:number|null;forma_recebimento_entrega:string|null}
type RoutePlan={id:string;nome:string;data_rota:string;status:string;motorista:string|null}
type ProductComponent={produto_final_id:string;componente_id:string;quantidade:number}

const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0)
const saleNumber=(s:Sale)=>'S'+String(s.venda_numero||s.fatura_numero||0).padStart(5,'0')

export function LogisticsOperations({mode,canEdit}:{mode:'separacao'|'producao'|'relatorio';canEdit:boolean}){
  const [sales,setSales]=useState<Sale[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [items,setItems]=useState<SaleItem[]>([])
  const [products,setProducts]=useState<Product[]>([])
  const [seps,setSeps]=useState<Sep[]>([])
  const [prods,setProds]=useState<Prod[]>([])
  const [deliveries,setDeliveries]=useState<Delivery[]>([])
  const [routes,setRoutes]=useState<RoutePlan[]>([])
  const [components,setComponents]=useState<ProductComponent[]>([])
  const [productionDetail,setProductionDetail]=useState<{sale:Sale;item:SaleItem}|null>(null)
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')

  const load=useCallback(async()=>{
    const [s,c,i,p,sp,pr,d,r,pc]=await Promise.all([
      supabase.from('vendas').select('id,cliente_id,status,venda_numero,fatura_numero,total,created_at,forma_pagamento,parcelas,primeiro_vencimento,observacoes,rota_entrega').eq('status','pedido').order('created_at',{ascending:false}),
      supabase.from('clientes').select('id,nome'),
      supabase.from('venda_itens').select('id,venda_id,produto_id,quantidade,valor_unitario,desconto,total,receita_producao'),
      supabase.from('produtos').select('id,codigo,descricao,unidade,tipo_produto,estoque_atual,rastrear_estoque'),
      supabase.from('logistica_separacao_itens').select('venda_item_id,quantidade_separada,status'),
      supabase.from('logistica_producao_itens').select('venda_item_id,status,concluido_em'),
      supabase.from('entregas').select('id,venda_id,status,rota_logistica_id,valor_recebido_entrega,forma_recebimento_entrega'),
      supabase.from('rotas_logisticas').select('id,nome,data_rota,status,motorista').order('data_rota',{ascending:false}),
      supabase.from('produto_componentes').select('produto_final_id,componente_id,quantidade')
    ])
    const error=s.error||c.error||i.error||p.error||sp.error||pr.error||d.error||r.error||pc.error
    if(error){setMsg(error.message);return}
    setSales((s.data||[]) as Sale[]);setClients((c.data||[]) as Client[]);setItems((i.data||[]) as SaleItem[]);setProducts((p.data||[]) as Product[])
    setSeps((sp.data||[]) as Sep[]);setProds((pr.data||[]) as Prod[]);setDeliveries((d.data||[]) as Delivery[]);setRoutes((r.data||[]) as RoutePlan[]);setComponents((pc.data||[]) as ProductComponent[])
  },[])

  useEffect(()=>{void load()},[load])

  const clientName=(id:string|null)=>clients.find(c=>c.id===id)?.nome||'Cliente'
  const productFor=(id:string|null)=>products.find(p=>p.id===id)
  const sepFor=(id:string)=>seps.find(x=>x.venda_item_id===id)
  const prodFor=(id:string)=>prods.find(x=>x.venda_item_id===id)

  const saleGroups=useMemo(()=>sales.map(s=>({sale:s,items:items.filter(i=>i.venda_id===s.id)})).filter(g=>g.items.length),[sales,items])

  async function saveSeparation(item:SaleItem,qty:number,forceFull=false){
    if(!canEdit||busy)return
    const total=Number(item.quantidade||0),value=Math.max(0,Math.min(total,forceFull?total:qty))
    const status=value>=total?'separado':value>0?'parcial':'pendente'
    setBusy(true);setMsg('')
    try{
      const {data:{user}}=await supabase.auth.getUser()
      const {error}=await supabase.from('logistica_separacao_itens').upsert({venda_item_id:item.id,quantidade_separada:value,status,atualizado_por:user?.id||null,updated_at:new Date().toISOString()})
      if(error)throw error
      await load()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }

  async function markProductionReady(item:SaleItem){
    if(!canEdit||busy)return
    setBusy(true);setMsg('')
    try{
      const {data:{user}}=await supabase.auth.getUser()
      const stamp=new Date().toISOString()
      const {error}=await supabase.from('logistica_producao_itens').upsert({venda_item_id:item.id,status:'pronto',concluido_por:user?.id||null,concluido_em:stamp,updated_at:stamp})
      if(error)throw error
      await load()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }

  if(mode==='separacao'){
    const separatedGroups=saleGroups.filter(({items:groupItems})=>groupItems.every(item=>sepFor(item.id)?.status==='separado'))
    const pendingGroups=saleGroups.filter(({items:groupItems})=>!groupItems.every(item=>sepFor(item.id)?.status==='separado'))

    const renderSeparationGroup=({sale,items:groupItems}:{sale:Sale;items:SaleItem[]},completed=false)=><article className={'logOrderCard'+(completed?' isSeparated':'')} key={sale.id}>
      <header><div><strong>{saleNumber(sale)}</strong><span>{clientName(sale.cliente_id)}</span></div><div className="logOrderHeaderMeta"><span>{groupItems.length} item(ns)</span>{completed&&<span className="logOrderDone"><CheckCircle2 size={12}/>Separado</span>}</div></header>
      <div className="logItemList">
        {groupItems.map(item=>{
          const p=productFor(item.produto_id),sep=sepFor(item.id),current=Number(sep?.quantidade_separada||0),total=Number(item.quantidade||0)
          return <div className="logItemRow" key={item.id}>
            <div><strong>{p?.descricao||'Produto'}</strong><small>{p?.codigo||'Sem código'} · {total} {p?.unidade||''}</small></div>
            <div className={'logStatus '+(sep?.status||'pendente')}>{sep?.status==='separado'?'Separado':sep?.status==='parcial'?'Parcial':'Pendente'}</div>
            <input type="number" min="0" max={total} step="0.01" defaultValue={current} aria-label="Quantidade separada" onBlur={e=>void saveSeparation(item,Number(e.target.value||0))} disabled={!canEdit||busy||completed}/>
            <button className="ghost" disabled={!canEdit||busy||completed} onClick={()=>{const q=window.prompt('Quantidade separada:',String(current||Math.min(1,total)));if(q!==null)void saveSeparation(item,Number(q))}}>Parcial</button>
            <button className="primary" disabled={!canEdit||busy||completed} onClick={()=>void saveSeparation(item,total,true)}><CheckCircle2 size={14}/>{completed?'Separado':'Confirmar'}</button>
          </div>
        })}
      </div>
    </article>

    return <section className="logOps">
      <div className="logOpsHead"><div><span>SEPARAÇÃO</span><h3>Separar pedidos</h3><p>Pedidos pendentes ficam separados dos já concluídos. Não movimenta estoque.</p></div><button onClick={()=>void load()}><RefreshCw size={15}/>Atualizar</button></div>
      {msg&&<div className="logOpsNotice">{msg}</div>}

      <section className="logSeparationSection">
        <div className="logSectionHead">
          <div><span className="logSectionDot pending"/><div><strong>Falta separar</strong><small>Pedidos com item pendente ou parcialmente separado.</small></div></div>
          <b>{pendingGroups.length}</b>
        </div>
        <div className="logOrderList">
          {pendingGroups.map(group=>renderSeparationGroup(group))}
          {!pendingGroups.length&&<div className="logEmpty">Nenhum pedido pendente de separação.</div>}
        </div>
      </section>

      <section className="logSeparationSection completed">
        <div className="logSectionHead">
          <div><span className="logSectionDot done"/><div><strong>Separados</strong><small>Pedidos com todos os itens já confirmados.</small></div></div>
          <b>{separatedGroups.length}</b>
        </div>
        <div className="logOrderList">
          {separatedGroups.map(group=>renderSeparationGroup(group,true))}
          {!separatedGroups.length&&<div className="logEmpty">Nenhum pedido totalmente separado ainda.</div>}
        </div>
      </section>
    </section>
  }

  if(mode==='producao'){
    const productionRows=saleGroups.flatMap(g=>g.items.filter(i=>productFor(i.produto_id)?.tipo_produto==='produto_final').map(i=>({sale:g.sale,item:i})))
    return <section className="logOps">
      <div className="logOpsHead"><div><span>PRODUÇÃO</span><h3>Produção pronta</h3><p>Somente itens cadastrados como produto final aparecem aqui. A confirmação não movimenta estoque.</p></div><button onClick={()=>void load()}><RefreshCw size={15}/>Atualizar</button></div>
      {msg&&<div className="logOpsNotice">{msg}</div>}
      <div className="logProductionList">
        {productionRows.map(({sale,item})=>{
          const p=productFor(item.produto_id),pr=prodFor(item.id),ready=pr?.status==='pronto'
          return <article className="logProductionCard" key={item.id} onDoubleClick={()=>setProductionDetail({sale,item})} title="Clique duplo para ver materiais e informações da venda">
            <span className="logProductionIcon"><PackageCheck size={20}/></span>
            <div className="logProductionInfo">
              <strong>{p?.descricao||'Produto final'}</strong>
              <div className="logProductionMeta">
                <span className="logProductionSale">{saleNumber(sale)}</span>
                <span className="logProductionClient">{clientName(sale.cliente_id)}</span>
                <span className="logProductionQty">{Number(item.quantidade)} {p?.unidade||''}</span>
              </div>
            </div>
            <span className={'logStatus '+(ready?'separado':'pendente')}>{ready?'Pronto':'A produzir'}</span>
            <button className="primary" disabled={!canEdit||busy||ready} onDoubleClick={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();void markProductionReady(item)}}>{ready?<><CheckCircle2 size={14}/>Pronto</>:<><Clock3 size={14}/>Confirmar pronto</>}</button>
          </article>
        })}
        {!productionRows.length&&<div className="logEmpty">Nenhum item de produção pendente.</div>}
      </div>
      {productionDetail&&(()=>{
        const detailProduct=productFor(productionDetail.item.produto_id)
        const recipe=(Array.isArray(productionDetail.item.receita_producao)&&productionDetail.item.receita_producao.length
          ?productionDetail.item.receita_producao
          :components.filter(row=>row.produto_final_id===productionDetail.item.produto_id).map(row=>({componente_id:row.componente_id,quantidade:Number(row.quantidade)})))
        return <div className="logProductionDetailOverlay" role="dialog" aria-modal="true" aria-label="Detalhes da produção">
          <div className="logProductionDetailBackdrop" onClick={()=>setProductionDetail(null)}/>
          <div className="logProductionDetail">
            <header>
              <div><span>PRODUÇÃO</span><h3>{detailProduct?.descricao||'Produto final'}</h3><p>{saleNumber(productionDetail.sale)} · {clientName(productionDetail.sale.cliente_id)}</p></div>
              <button type="button" className="iconBtn" onClick={()=>setProductionDetail(null)} aria-label="Fechar"><X size={17}/></button>
            </header>
            <div className="logProductionSaleInfo">
              <div><ReceiptText size={16}/><span>Venda</span><strong>{saleNumber(productionDetail.sale)}</strong></div>
              <div><UserRound size={16}/><span>Cliente</span><strong>{clientName(productionDetail.sale.cliente_id)}</strong></div>
              <div><Boxes size={16}/><span>Quantidade</span><strong>{Number(productionDetail.item.quantidade)} {detailProduct?.unidade||''}</strong></div>
              <div><CreditCard size={16}/><span>Pagamento</span><strong>{productionDetail.sale.forma_pagamento||'—'}{Number(productionDetail.sale.parcelas||0)>1?' · '+productionDetail.sale.parcelas+'x':''}</strong></div>
              <div><MapPin size={16}/><span>Rota</span><strong>{productionDetail.sale.rota_entrega||'Não informada'}</strong></div>
              <div><span className="logDetailCurrency">R$</span><span>Total da venda</span><strong>{money(Number(productionDetail.sale.total||0))}</strong></div>
            </div>
            <section className="logProductionMaterials">
              <div className="logProductionMaterialsHead"><div><span>RECEITA</span><h4>Materiais para produzir</h4></div><b>{recipe.length} material(is)</b></div>
              <div className="logProductionMaterialsList">
                {recipe.map((row,index)=>{
                  const material=productFor(row.componente_id)
                  const perUnit=Number(row.quantidade||0)
                  const totalQty=perUnit*Number(productionDetail.item.quantidade||0)
                  return <div className="logProductionMaterialRow" key={row.componente_id+'-'+index}>
                    <span className="logMaterialIndex">{index+1}</span>
                    <div><strong>{material?.descricao||'Material'}</strong><small>{material?.codigo||'Sem código'} · {material?.unidade||'UN'}</small></div>
                    <div><span>Por unidade</span><strong>{perUnit.toLocaleString('pt-BR',{maximumFractionDigits:3})}</strong></div>
                    <div><span>Total necessário</span><strong>{totalQty.toLocaleString('pt-BR',{maximumFractionDigits:3})} {material?.unidade||''}</strong></div>
                    <div><span>Estoque</span><strong className={material&&material.rastrear_estoque&&Number(material.estoque_atual)<totalQty?'short':''}>{material?.rastrear_estoque===false?'Não rastreado':Number(material?.estoque_atual||0).toLocaleString('pt-BR',{maximumFractionDigits:3})+' '+(material?.unidade||'')}</strong></div>
                  </div>
                })}
                {!recipe.length&&<div className="logEmpty">Nenhuma receita de produção encontrada para este item.</div>}
              </div>
            </section>
            {productionDetail.sale.observacoes&&<section className="logProductionNotes"><span>Observações da venda</span><p>{productionDetail.sale.observacoes}</p></section>}
          </div>
        </div>
      })()}
    </section>
  }

  const routeDeliveries=deliveries.filter(d=>Boolean(d.rota_logistica_id))
  async function generateLogisticsPdf(){
    const {jsPDF}=await import('jspdf')
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
    const routed=deliveries.filter(d=>Boolean(d.rota_logistica_id))
    const completedRoutes=routes.filter(r=>r.status==='concluida')
    const openRoutes=routes.filter(r=>r.status!=='concluida'&&r.status!=='cancelada')
    const receivedTotal=routed.reduce((a,d)=>a+Number(d.valor_recebido_entrega||0),0)
    const deliveredTotal=routed.filter(d=>d.status==='entregue').length
    const failedTotal=routed.filter(d=>d.status==='reagendamento'||d.status==='cancelado').length
    doc.setFillColor(15,23,42);doc.roundedRect(12,10,186,24,3,3,'F')
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('Relatório da Logística',17,20)
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Rotas, entregas e valores recebidos na entrega',17,27)
    doc.setTextColor(15,23,42);doc.setFont('helvetica','bold');doc.setFontSize(10)
    doc.text('Rotas concluídas',14,45);doc.text(String(completedRoutes.length),14,52)
    doc.text('Rotas em aberto',58,45);doc.text(String(openRoutes.length),58,52)
    doc.text('Entregas concluídas',102,45);doc.text(String(deliveredTotal),102,52)
    doc.text('Não entregues',151,45);doc.text(String(failedTotal),151,52)
    doc.setFillColor(239,246,255);doc.roundedRect(12,58,186,20,3,3,'F')
    doc.setFontSize(9);doc.text('Recebido nas entregas',17,66)
    doc.setFontSize(15);doc.text(money(receivedTotal),17,74)
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Registro operacional da Logística; não baixa títulos financeiros automaticamente.',82,73)
    let y=89
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Detalhamento por rota',14,y);y+=7
    for(const r of routes){
      const ds=routed.filter(d=>d.rota_logistica_id===r.id)
      if(y>258){doc.addPage();y=18}
      doc.setFillColor(226,232,240);doc.roundedRect(12,y,186,10,2,2,'F')
      doc.setTextColor(15,23,42);doc.setFont('helvetica','bold');doc.setFontSize(9)
      doc.text(new Date(r.data_rota+'T12:00:00').toLocaleDateString('pt-BR')+' · '+r.nome,15,y+6)
      doc.setFont('helvetica','normal');doc.text((r.motorista||'Motorista não definido')+' · '+r.status,112,y+6)
      y+=12

      doc.setFillColor(248,250,252);doc.rect(12,y,186,8,'F')
      doc.setFont('helvetica','bold');doc.setFontSize(7.5)
      doc.text('Venda',15,y+5);doc.text('Cliente',38,y+5);doc.text('Valor',137,y+5,{align:'right'});doc.text('Entrega',142,y+5);doc.text('Recebido',195,y+5,{align:'right'})
      y+=8

      for(const d of ds){
        const sale=sales.find(v=>v.id===d.venda_id)
        const client=clients.find(c=>c.id===sale?.cliente_id)
        const saleLabel=sale?saleNumber(sale):'—'
        const clientLabel=client?.nome||'Cliente'
        const value=Number(sale?.total||0)
        const rowHeight=Math.max(9,doc.splitTextToSize(clientLabel,88).length*4+3)
        if(y+rowHeight>282){doc.addPage();y=18
          doc.setFillColor(248,250,252);doc.rect(12,y,186,8,'F')
          doc.setFont('helvetica','bold');doc.setFontSize(7.5)
          doc.text('Venda',15,y+5);doc.text('Cliente',38,y+5);doc.text('Valor',137,y+5,{align:'right'});doc.text('Entrega',142,y+5);doc.text('Recebido',195,y+5,{align:'right'});y+=8
        }
        doc.setFont('helvetica','normal');doc.setFontSize(7.5)
        doc.text(saleLabel,15,y+5)
        doc.text(doc.splitTextToSize(clientLabel,88),38,y+5)
        doc.text(money(value),137,y+5,{align:'right'})
        doc.text(d.status,142,y+5)
        doc.text(money(Number(d.valor_recebido_entrega||0)),195,y+5,{align:'right'})
        doc.setDrawColor(226,232,240);doc.line(12,y+rowHeight,198,y+rowHeight)
        y+=rowHeight
      }
      y+=5
    }
    doc.save('relatorio-logistica.pdf')
  }

  const completed=routes.filter(r=>r.status==='concluida')
  const open=routes.filter(r=>r.status!=='concluida'&&r.status!=='cancelada')
  const received=routeDeliveries.reduce((a,d)=>a+Number(d.valor_recebido_entrega||0),0)
  const delivered=routeDeliveries.filter(d=>d.status==='entregue').length
  const failed=routeDeliveries.filter(d=>d.status==='reagendamento'||d.status==='cancelado').length
  return <section className="logOps">
    <div className="logOpsHead"><div><span>DASHBOARD</span><h3>Relatório da Logística</h3><p>Resumo das rotas, entregas e valores informados como recebidos na entrega.</p></div><div className="logOpsActions"><button onClick={()=>void generateLogisticsPdf()}><FileDown size={15}/>PDF</button><button onClick={()=>void load()}><RefreshCw size={15}/>Atualizar</button></div></div>
    <div className="logDashCards">
      <article><Route size={20}/><span>Rotas concluídas</span><strong>{completed.length}</strong></article>
      <article><Truck size={20}/><span>Rotas em aberto</span><strong>{open.length}</strong></article>
      <article><CheckCircle2 size={20}/><span>Entregas concluídas</span><strong>{delivered}</strong></article>
      <article><Clock3 size={20}/><span>Não entregues</span><strong>{failed}</strong></article>
      <article className="wide"><span>Recebido nas entregas</span><strong>{money(received)}</strong><small>Registro operacional; não baixa títulos automaticamente.</small></article>
    </div>
    <div className="logRouteSummary">
      {routes.slice(0,30).map(r=>{
        const ds=deliveries.filter(d=>d.rota_logistica_id===r.id)
        const routeReceived=ds.reduce((a,d)=>a+Number(d.valor_recebido_entrega||0),0)
        return <article key={r.id}><div><strong>{r.nome}</strong><small>{new Date(r.data_rota+'T12:00:00').toLocaleDateString('pt-BR')} · {r.motorista||'Motorista não definido'}</small></div><span className={'logStatus '+(r.status==='concluida'?'separado':'pendente')}>{r.status}</span><div><strong>{ds.filter(d=>d.status==='entregue').length}/{ds.length}</strong><small>entregues</small></div><div><strong>{money(routeReceived)}</strong><small>recebido</small></div></article>
      })}
    </div>
  </section>
}
