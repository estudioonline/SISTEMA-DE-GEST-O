import {useCallback,useEffect,useMemo,useState} from 'react'
import {ArrowDown,ArrowUp,CheckCircle2,MapPin,Plus,RefreshCw,Route,Truck,X} from 'lucide-react'
import {supabase} from './lib/supabase'

type Tab='montagem'|'rota'|'historico'
type Delivery={id:string;venda_id:string;status:string;rota:string|null;data_prevista:string|null;entregador_nome:string|null;updated_at:string}
type Sale={id:string;cliente_id:string|null;total:number;rota_entrega:string|null;fatura_numero:number|null;status:string}
type Client={id:string;nome:string;logradouro:string|null;numero:string|null;bairro:string|null;municipio:string|null;uf:string|null}

type LaneKey='retirar'|'norte'|'sul'|'leste'|'interestadual'|'entregue'
const lanes:{key:LaneKey;label:string}[]=[
  {key:'retirar',label:'RETIRAR'},
  {key:'norte',label:'NORTE'},
  {key:'sul',label:'SUL'},
  {key:'leste',label:'LESTE'},
  {key:'interestadual',label:'INTERESTADUAL'},
  {key:'entregue',label:'ENTREGUE'},
]

function normalizeRoute(value:string|null|undefined):LaneKey|null{
  const raw=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[_-]+/g,' ')
  if(!raw)return null
  if(raw.includes('retir'))return 'retirar'
  if(raw.includes('norte'))return 'norte'
  if(raw.includes('sul'))return 'sul'
  if(raw.includes('leste'))return 'leste'
  if(raw.includes('interestad'))return 'interestadual'
  return null
}
function address(c?:Client){
  if(!c)return ''
  return [[c.logradouro,c.numero].filter(Boolean).join(', '),c.bairro,c.municipio,c.uf].filter(Boolean).join(' - ')
}
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0)

export function RouteControlCenter({
  canEdit,
  refreshKey,
}:{
  onViewChange:(view:Tab)=>void
  canEdit:boolean
  canOperate:boolean
  selectedDeliveryIds:string[]
  onClearSelection:()=>void
  onChanged:()=>Promise<void>|void
  onConfirmDelivery:(deliveryId:string)=>void
  refreshKey:number
}){
  const [deliveries,setDeliveries]=useState<Delivery[]>([])
  const [sales,setSales]=useState<Sale[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [draggedId,setDraggedId]=useState<string|null>(null)
  const [dragOver,setDragOver]=useState<LaneKey|null>(null)
  const [savingMove,setSavingMove]=useState(false)
  const [routeBuilderOpen,setRouteBuilderOpen]=useState(false)
  const [builderLane,setBuilderLane]=useState<Exclude<LaneKey,'entregue'>>('norte')
  const [builderDate,setBuilderDate]=useState(()=>new Date().toISOString().slice(0,10))
  const [builderDriver,setBuilderDriver]=useState('')
  const [builderSelected,setBuilderSelected]=useState<string[]>([])
  const [builderOrder,setBuilderOrder]=useState<string[]>([])
  const [builderBusy,setBuilderBusy]=useState(false)
  const [builderMessage,setBuilderMessage]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    const [d,s,c]=await Promise.all([
      supabase.from('entregas').select('id,venda_id,status,rota,data_prevista,entregador_nome,updated_at').order('updated_at',{ascending:false}),
      supabase.from('vendas').select('id,cliente_id,total,rota_entrega,fatura_numero,status'),
      supabase.from('clientes').select('id,nome,logradouro,numero,bairro,municipio,uf')
    ])
    const issue=d.error||s.error||c.error
    if(issue){setError(issue.message);setLoading(false);return}
    setDeliveries((d.data||[]) as Delivery[])
    setSales((s.data||[]) as Sale[])
    setClients((c.data||[]) as Client[])
    setLoading(false)
  },[])

  useEffect(()=>{void load()},[load,refreshKey])

  const saleMap=useMemo(()=>new Map(sales.map(s=>[s.id,s])),[sales])
  const clientMap=useMemo(()=>new Map(clients.map(c=>[c.id,c])),[clients])

  const cardsByLane=useMemo(()=>{
    const map:Record<LaneKey,Delivery[]>={retirar:[],norte:[],sul:[],leste:[],interestadual:[],entregue:[]}
    for(const delivery of deliveries){
      if(delivery.status==='entregue'){map.entregue.push(delivery);continue}
      const sale=saleMap.get(delivery.venda_id)
      const lane=normalizeRoute(sale?.rota_entrega)||normalizeRoute(delivery.rota)
      if(lane)map[lane].push(delivery)
    }
    return map
  },[deliveries,saleMap])

  function openRouteBuilder(){
    const firstLane=(['norte','sul','leste','interestadual','retirar'] as const).find(key=>cardsByLane[key].length>0)||'norte'
    const ids=cardsByLane[firstLane].map(d=>d.id)
    setBuilderLane(firstLane)
    setBuilderSelected(ids)
    setBuilderOrder(ids)
    setBuilderDriver('')
    setBuilderDate(new Date().toISOString().slice(0,10))
    setBuilderMessage('')
    setRouteBuilderOpen(true)
  }

  function changeBuilderLane(next:Exclude<LaneKey,'entregue'>){
    const ids=cardsByLane[next].map(d=>d.id)
    setBuilderLane(next)
    setBuilderSelected(ids)
    setBuilderOrder(ids)
    setBuilderMessage('')
  }

  function toggleBuilderDelivery(id:string){
    setBuilderSelected(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])
  }

  function shiftBuilderDelivery(id:string,direction:-1|1){
    setBuilderOrder(current=>{
      const copy=[...current]
      const index=copy.indexOf(id)
      const target=index+direction
      if(index<0||target<0||target>=copy.length)return current
      ;[copy[index],copy[target]]=[copy[target],copy[index]]
      return copy
    })
  }

  async function saveBuiltRoute(){
    if(!canEdit||builderBusy)return
    const ordered=builderOrder.filter(id=>builderSelected.includes(id))
    if(!ordered.length){setBuilderMessage('Selecione pelo menos um pedido para montar a rota.');return}
    if(!builderDate){setBuilderMessage('Informe a data da rota.');return}
    setBuilderBusy(true);setBuilderMessage('')
    try{
      for(let index=0;index<ordered.length;index++){
        const delivery=deliveries.find(d=>d.id===ordered[index])
        if(!delivery)continue
        const {error:updateError}=await supabase.from('entregas').update({
          data_prevista:builderDate,
          entregador_nome:builderDriver.trim()||null,
          ordem_rota:index+1,
          updated_at:new Date().toISOString()
        }).eq('id',delivery.id)
        if(updateError)throw updateError
        await supabase.from('entrega_eventos').insert({
          entrega_id:delivery.id,
          tipo:'organizacao',
          status_anterior:delivery.status,
          status_novo:delivery.status,
          detalhes:'Rota montada: '+builderLane.toUpperCase()+' · parada '+(index+1)+' · '+builderDate+(builderDriver.trim()?' · '+builderDriver.trim():'')
        })
      }
      setBuilderMessage('Rota montada com '+ordered.length+' pedido(s).')
      await load()
    }catch(e){
      setBuilderMessage(e instanceof Error?e.message:'Não foi possível montar a rota.')
    }finally{
      setBuilderBusy(false)
    }
  }

  async function moveCard(deliveryId:string,target:LaneKey){
    if(target==='entregue'){
      setError('A coluna ENTREGUE só recebe pedidos após a confirmação da entrega.')
      setDraggedId(null);setDragOver(null)
      return
    }
    const delivery=deliveries.find(d=>d.id===deliveryId)
    const sale=delivery?saleMap.get(delivery.venda_id):undefined
    if(!delivery||!sale)return
    const current=normalizeRoute(sale.rota_entrega)||normalizeRoute(delivery.rota)
    if(current===target){setDraggedId(null);setDragOver(null);return}

    setSavingMove(true);setError('')
    try{
      const routeValue=target
      const [deliveryUpdate,saleUpdate]=await Promise.all([
        supabase.from('entregas').update({
          rota:routeValue,
          rota_manual:true,
          updated_at:new Date().toISOString()
        }).eq('id',delivery.id),
        supabase.from('vendas').update({rota_entrega:routeValue}).eq('id',sale.id)
      ])
      const issue=deliveryUpdate.error||saleUpdate.error
      if(issue)throw issue

      await supabase.from('entrega_eventos').insert({
        entrega_id:delivery.id,
        tipo:'organizacao',
        status_anterior:delivery.status,
        status_novo:delivery.status,
        detalhes:'Rota alterada por arrastar cartão para '+target.toUpperCase()
      })

      setDraggedId(null);setDragOver(null)
      await load()
    }catch(e){
      setError(e instanceof Error?e.message:'Não foi possível mover o pedido.')
    }finally{
      setSavingMove(false)
    }
  }

  return <section className="routeTrelloBoardShell">
    <div className="routeFixedBoardHead">
      <div><span>QUADRO DE ROTAS</span><strong>Pedidos por rota de entrega</strong><small>A rota definida na venda posiciona o pedido automaticamente na coluna correspondente.</small></div>
      <div className="routeBoardActions">
        {canEdit&&<button type="button" className="routeBuildButton" onClick={openRouteBuilder}><Route size={15}/>Montar rota</button>}
        <button type="button" onClick={()=>void load()} disabled={loading} title="Atualizar"><RefreshCw size={15}/></button>
      </div>
    </div>
    {error&&<div className="deliveryNotice">{error}</div>}
    {routeBuilderOpen&&<div className="routeBuilderOverlay" role="dialog" aria-modal="true" aria-label="Montar rota">
      <div className="routeBuilderPanel">
        <div className="routeBuilderTitle">
          <div><span>MONTAGEM DE ROTA</span><h3>Montar rota de entrega</h3><p>Selecione os pedidos, defina motorista, data e ordem das paradas.</p></div>
          <button type="button" onClick={()=>setRouteBuilderOpen(false)} aria-label="Fechar"><X size={18}/></button>
        </div>
        <div className="routeBuilderControls">
          <label>Rota<select value={builderLane} onChange={e=>changeBuilderLane(e.target.value as Exclude<LaneKey,'entregue'>)}>
            <option value="retirar">RETIRAR</option><option value="norte">NORTE</option><option value="sul">SUL</option><option value="leste">LESTE</option><option value="interestadual">INTERESTADUAL</option>
          </select></label>
          <label>Data<input type="date" value={builderDate} onChange={e=>setBuilderDate(e.target.value)}/></label>
          <label>Motorista / Entregador<input value={builderDriver} onChange={e=>setBuilderDriver(e.target.value)} placeholder="Nome do motorista"/></label>
        </div>
        <div className="routeBuilderSummary"><strong>{builderSelected.length} selecionado(s)</strong><span>{cardsByLane[builderLane].length} pedido(s) disponível(is) em {builderLane.toUpperCase()}</span></div>
        <div className="routeBuilderList">
          {builderOrder.map((id,index)=>{
            const delivery=deliveries.find(d=>d.id===id)
            if(!delivery)return null
            const sale=saleMap.get(delivery.venda_id)
            const client=sale?.cliente_id?clientMap.get(sale.cliente_id):undefined
            const checked=builderSelected.includes(id)
            return <article key={id} className={checked?'routeBuilderItem selected':'routeBuilderItem'}>
              <label className="routeBuilderCheck"><input type="checkbox" checked={checked} onChange={()=>toggleBuilderDelivery(id)}/><span>{index+1}</span></label>
              <div className="routeBuilderItemInfo"><strong>#{String(sale?.fatura_numero||0).padStart(7,'0')} · {client?.nome||'Cliente não identificado'}</strong><small>{address(client)||'Endereço não cadastrado'}</small></div>
              <b>{money(Number(sale?.total||0))}</b>
              <div className="routeBuilderOrder">
                <button type="button" disabled={index===0} onClick={()=>shiftBuilderDelivery(id,-1)} title="Subir"><ArrowUp size={14}/></button>
                <button type="button" disabled={index===builderOrder.length-1} onClick={()=>shiftBuilderDelivery(id,1)} title="Descer"><ArrowDown size={14}/></button>
              </div>
            </article>
          })}
          {!builderOrder.length&&<div className="routeBuilderEmpty">Nenhum pedido disponível nesta rota.</div>}
        </div>
        {builderMessage&&<div className="deliveryNotice">{builderMessage}</div>}
        <div className="routeBuilderFooter">
          <button type="button" className="ghost" onClick={()=>setRouteBuilderOpen(false)} disabled={builderBusy}>Cancelar</button>
          <button type="button" className="primary" onClick={()=>void saveBuiltRoute()} disabled={builderBusy||!builderSelected.length}><CheckCircle2 size={15}/>{builderBusy?'Salvando...':'Salvar rota'}</button>
        </div>
      </div>
    </div>}
    <div className="routeFixedBoard">
      {lanes.map(lane=>{
        const rows=cardsByLane[lane.key]
        return <section key={lane.key}
          className={'routeFixedLane '+(lane.key==='entregue'?'isDelivered ':'')+(dragOver===lane.key?'dragOver':'')}
          onDragOver={e=>{if(draggedId){e.preventDefault();setDragOver(lane.key)}}}
          onDragLeave={()=>setDragOver(prev=>prev===lane.key?null:prev)}
          onDrop={e=>{e.preventDefault();if(draggedId)void moveCard(draggedId,lane.key)}}>
          <header>
            <div><strong>{lane.label}</strong><span>{rows.length} pedido(s)</span></div>
            <em>{rows.length}</em>
          </header>
          <div className="routeFixedCards">
            {rows.map(delivery=>{
              const sale=saleMap.get(delivery.venda_id)
              const client=sale?.cliente_id?clientMap.get(sale.cliente_id):undefined
              return <article key={delivery.id}
                className={'routeFixedCard'+(draggedId===delivery.id?' dragging':'')+(lane.key==='entregue'?' locked':'')}
                draggable={lane.key!=='entregue'&&!savingMove}
                onDragStart={()=>{if(lane.key!=='entregue')setDraggedId(delivery.id)}}
                onDragEnd={()=>{setDraggedId(null);setDragOver(null)}}>
                <div className="routeFixedCardTop">
                  <span>#{String(sale?.fatura_numero||0).padStart(7,'0')}</span>
                  {lane.key==='entregue'?<CheckCircle2 size={15}/>:<Truck size={15}/>}
                </div>
                <strong>{client?.nome||'Cliente não identificado'}</strong>
                <p><MapPin size={12}/>{address(client)||'Endereço não cadastrado'}</p>
                <div className="routeFixedCardFoot">
                  <b>{money(Number(sale?.total||0))}</b>
                  <span>{delivery.entregador_nome||'Sem motorista'}</span>
                </div>
              </article>
            })}
            {!rows.length&&<div className="routeFixedEmpty">{loading?'Carregando...':'Nenhum pedido nesta rota'}</div>}
          </div>
        </section>
      })}
    </div>
  </section>
}
