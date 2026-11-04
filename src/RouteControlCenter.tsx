import {useCallback,useEffect,useMemo,useState} from 'react'
import {CheckCircle2,MapPin,RefreshCw,Truck} from 'lucide-react'
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
  canEdit: _canEdit,
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
      <button type="button" onClick={()=>void load()} disabled={loading} title="Atualizar"><RefreshCw size={15}/></button>
    </div>
    {error&&<div className="deliveryNotice">{error}</div>}
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
