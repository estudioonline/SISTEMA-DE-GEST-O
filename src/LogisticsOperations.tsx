import {useCallback,useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Clock3,FileDown,PackageCheck,RefreshCw,Route,Truck} from 'lucide-react'
import {supabase} from './lib/supabase'

type Sale={id:string;cliente_id:string|null;status:string;venda_numero:number|null;fatura_numero:number|null;created_at:string}
type Client={id:string;nome:string}
type SaleItem={id:string;venda_id:string;produto_id:string|null;quantidade:number}
type Product={id:string;codigo:string|null;descricao:string;unidade:string|null;tipo_produto:string|null}
type Sep={venda_item_id:string;quantidade_separada:number;status:'pendente'|'parcial'|'separado'}
type Prod={venda_item_id:string;status:'pendente'|'pronto';concluido_em:string|null}
type Delivery={id:string;venda_id:string;status:string;rota_logistica_id:string|null;valor_recebido_entrega:number|null;forma_recebimento_entrega:string|null}
type RoutePlan={id:string;nome:string;data_rota:string;status:string;motorista:string|null}

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
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')

  const load=useCallback(async()=>{
    const [s,c,i,p,sp,pr,d,r]=await Promise.all([
      supabase.from('vendas').select('id,cliente_id,status,venda_numero,fatura_numero,created_at').eq('status','pedido').order('created_at',{ascending:false}),
      supabase.from('clientes').select('id,nome'),
      supabase.from('venda_itens').select('id,venda_id,produto_id,quantidade'),
      supabase.from('produtos').select('id,codigo,descricao,unidade,tipo_produto'),
      supabase.from('logistica_separacao_itens').select('venda_item_id,quantidade_separada,status'),
      supabase.from('logistica_producao_itens').select('venda_item_id,status,concluido_em'),
      supabase.from('entregas').select('id,venda_id,status,rota_logistica_id,valor_recebido_entrega,forma_recebimento_entrega'),
      supabase.from('rotas_logisticas').select('id,nome,data_rota,status,motorista').order('data_rota',{ascending:false})
    ])
    const error=s.error||c.error||i.error||p.error||sp.error||pr.error||d.error||r.error
    if(error){setMsg(error.message);return}
    setSales((s.data||[]) as Sale[]);setClients((c.data||[]) as Client[]);setItems((i.data||[]) as SaleItem[]);setProducts((p.data||[]) as Product[])
    setSeps((sp.data||[]) as Sep[]);setProds((pr.data||[]) as Prod[]);setDeliveries((d.data||[]) as Delivery[]);setRoutes((r.data||[]) as RoutePlan[])
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
    return <section className="logOps">
      <div className="logOpsHead"><div><span>SEPARAÇÃO</span><h3>Pedidos para separar</h3><p>Confirmação operacional dos itens. Não movimenta estoque.</p></div><button onClick={()=>void load()}><RefreshCw size={15}/>Atualizar</button></div>
      {msg&&<div className="logOpsNotice">{msg}</div>}
      <div className="logOrderList">
        {saleGroups.map(({sale,items:groupItems})=><article className="logOrderCard" key={sale.id}>
          <header><div><strong>{saleNumber(sale)}</strong><span>{clientName(sale.cliente_id)}</span></div><span>{groupItems.length} item(ns)</span></header>
          <div className="logItemList">
            {groupItems.map(item=>{
              const p=productFor(item.produto_id),sep=sepFor(item.id),current=Number(sep?.quantidade_separada||0),total=Number(item.quantidade||0)
              return <div className="logItemRow" key={item.id}>
                <div><strong>{p?.descricao||'Produto'}</strong><small>{p?.codigo||'Sem código'} · {total} {p?.unidade||''}</small></div>
                <div className={'logStatus '+(sep?.status||'pendente')}>{sep?.status==='separado'?'Separado':sep?.status==='parcial'?'Parcial':'Pendente'}</div>
                <input type="number" min="0" max={total} step="0.01" defaultValue={current} aria-label="Quantidade separada" onBlur={e=>void saveSeparation(item,Number(e.target.value||0))} disabled={!canEdit||busy}/>
                <button className="ghost" disabled={!canEdit||busy} onClick={()=>{const q=window.prompt('Quantidade separada:',String(current||Math.min(1,total)));if(q!==null)void saveSeparation(item,Number(q))}}>Parcial</button>
                <button className="primary" disabled={!canEdit||busy} onClick={()=>void saveSeparation(item,total,true)}><CheckCircle2 size={14}/>Confirmar</button>
              </div>
            })}
          </div>
        </article>)}
        {!saleGroups.length&&<div className="logEmpty">Nenhum pedido aguardando separação.</div>}
      </div>
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
          return <article className="logProductionCard" key={item.id}>
            <span className="logProductionIcon"><PackageCheck size={20}/></span>
            <div><strong>{p?.descricao||'Produto final'}</strong><small>{saleNumber(sale)} · {clientName(sale.cliente_id)} · {Number(item.quantidade)} {p?.unidade||''}</small></div>
            <span className={'logStatus '+(ready?'separado':'pendente')}>{ready?'Pronto':'A produzir'}</span>
            <button className="primary" disabled={!canEdit||busy||ready} onClick={()=>void markProductionReady(item)}>{ready?<><CheckCircle2 size={14}/>Pronto</>:<><Clock3 size={14}/>Confirmar pronto</>}</button>
          </article>
        })}
        {!productionRows.length&&<div className="logEmpty">Nenhum item de produção pendente.</div>}
      </div>
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
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Rotas',14,y);y+=7
    doc.setFillColor(226,232,240);doc.rect(12,y,186,8,'F')
    doc.setFontSize(8);doc.text('Data / Rota',15,y+5);doc.text('Motorista',78,y+5);doc.text('Status',120,y+5);doc.text('Entregas',148,y+5);doc.text('Recebido',171,y+5,{align:'right'});y+=8
    for(const r of routes){
      const ds=routed.filter(d=>d.rota_logistica_id===r.id)
      const rec=ds.reduce((a,d)=>a+Number(d.valor_recebido_entrega||0),0)
      const delivered=ds.filter(d=>d.status==='entregue').length
      if(y>276){doc.addPage();y=18}
      doc.setDrawColor(226,232,240);doc.line(12,y+8,198,y+8)
      doc.setTextColor(15,23,42);doc.setFont('helvetica','bold');doc.setFontSize(8)
      doc.text(new Date(r.data_rota+'T12:00:00').toLocaleDateString('pt-BR')+' · '+r.nome,15,y+5)
      doc.setFont('helvetica','normal');doc.text(r.motorista||'—',78,y+5)
      doc.text(r.status,120,y+5);doc.text(delivered+'/'+ds.length,148,y+5);doc.text(money(rec),195,y+5,{align:'right'})
      y+=9
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
