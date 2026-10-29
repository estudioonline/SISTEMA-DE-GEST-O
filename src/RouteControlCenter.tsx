import {useCallback,useEffect,useMemo,useState} from 'react'
import {ArrowDown,ArrowUp,CheckCircle2,FileDown,MapPin,Plus,RefreshCw,Route,Trash2,Truck,Users,Car,XCircle} from 'lucide-react'
import {supabase} from './lib/supabase'

type RouteStatus='montagem'|'liberada'|'concluida'|'cancelada'
type RoutePlan={id:string;data_rota:string;nome:string;motorista:string|null;veiculo:string|null;motorista_id:string|null;veiculo_id:string|null;status:RouteStatus;observacoes:string|null;iniciado_em:string|null;concluido_em:string|null;distancia_estimada_km:number|null;duracao_estimada_min:number|null;created_at:string;updated_at:string}
type Delivery={id:string;venda_id:string;status:string;data_prevista:string;rota_logistica_id:string|null;ordem_rota:number|null;peso_estimado_kg:number;volume_estimado_m3:number;entregador_nome:string|null;falha_motivo:string|null;falha_detalhes:string|null;updated_at:string}
type Sale={id:string;cliente_id:string|null;total:number;forma_pagamento:string;fatura_numero:number|null}
type Client={id:string;nome:string;logradouro:string|null;numero:string|null;bairro:string|null;municipio:string|null;uf:string|null;cep:string|null;latitude:number|null;longitude:number|null}
type Title={venda_id:string|null;valor:number;valor_pago:number;status:string}
type Driver={id:string;nome:string;telefone:string|null;documento:string|null;ativo:boolean;profile_id:string|null}
type Vehicle={id:string;placa:string|null;descricao:string;capacidade_entregas:number|null;capacidade_kg:number|null;capacidade_m3:number|null;ativo:boolean}
type RouteEvent={id:string;rota_id:string;entrega_id:string|null;tipo:string;detalhes:Record<string,unknown>;created_at:string}
type UserProfile={id:string;nome:string;perfil:string;ativo:boolean}
type Tab='montagem'|'rota'|'historico'

const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0)
const dt=(v:string|null)=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(v)):'—'
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})
function address(c?:Client){return c?[[c.logradouro,c.numero].filter(Boolean).join(', '),c.bairro,c.municipio,c.uf,c.cep].filter(Boolean).join(' - '):''}
function haversine(a:Client,b:Client){
  if(a.latitude==null||a.longitude==null||b.latitude==null||b.longitude==null)return Number.POSITIVE_INFINITY
  const r=6371,toRad=(x:number)=>x*Math.PI/180
  const dLat=toRad(b.latitude-a.latitude),dLon=toRad(b.longitude-a.longitude)
  const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLon/2)**2
  return 2*r*Math.asin(Math.sqrt(x))
}

export function RouteControlCenter({canEdit,canOperate,selectedDeliveryIds,onClearSelection,onChanged,onConfirmDelivery,refreshKey}:{canEdit:boolean;canOperate:boolean;selectedDeliveryIds:string[];onClearSelection:()=>void;onChanged:()=>Promise<void>|void;onConfirmDelivery:(deliveryId:string)=>void;refreshKey:number}){
  const [tab,setTab]=useState<Tab>('montagem')
  const [day,setDay]=useState(()=>new URLSearchParams(window.location.search).get('dia')||today())
  const [routes,setRoutes]=useState<RoutePlan[]>([])
  const [deliveries,setDeliveries]=useState<Delivery[]>([])
  const [sales,setSales]=useState<Sale[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [titles,setTitles]=useState<Title[]>([])
  const [drivers,setDrivers]=useState<Driver[]>([])
  const [vehicles,setVehicles]=useState<Vehicle[]>([])
  const [events,setEvents]=useState<RouteEvent[]>([])
  const [profiles,setProfiles]=useState<UserProfile[]>([])
  const [selectedRouteId,setSelectedRouteId]=useState('')
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')
  const [newName,setNewName]=useState('')
  const [newDriverId,setNewDriverId]=useState('')
  const [newVehicleId,setNewVehicleId]=useState('')
  const [bulkRoute,setBulkRoute]=useState('')
  const [bulkDriverId,setBulkDriverId]=useState('')
  const [bulkDate,setBulkDate]=useState('')
  const [driverName,setDriverName]=useState('')
  const [driverPhone,setDriverPhone]=useState('')
  const [driverProfileId,setDriverProfileId]=useState('')
  const [vehicleName,setVehicleName]=useState('')
  const [vehiclePlate,setVehiclePlate]=useState('')
  const [vehicleStops,setVehicleStops]=useState('')
  const [vehicleKg,setVehicleKg]=useState('')
  const [vehicleM3,setVehicleM3]=useState('')
  const [showSetup,setShowSetup]=useState(false)
  const [dragId,setDragId]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const [r,e,s,c,t,d,v,ev,pf]=await Promise.all([
      supabase.from('rotas_logisticas').select('*').order('data_rota',{ascending:false}).order('created_at'),
      supabase.from('entregas').select('id,venda_id,status,data_prevista,rota_logistica_id,ordem_rota,peso_estimado_kg,volume_estimado_m3,entregador_nome,falha_motivo,falha_detalhes,updated_at'),
      supabase.from('vendas').select('id,cliente_id,total,forma_pagamento,fatura_numero'),
      supabase.from('clientes').select('id,nome,logradouro,numero,bairro,municipio,uf,cep,latitude,longitude'),
      supabase.from('titulos_financeiros').select('venda_id,valor,valor_pago,status').eq('tipo','receber'),
      supabase.from('motoristas_logistica').select('*').order('nome'),
      supabase.from('veiculos_logistica').select('*').order('descricao'),
      supabase.from('rota_eventos').select('*').order('created_at',{ascending:false}).limit(300),
      canEdit?supabase.from('profiles').select('id,nome,perfil,ativo').eq('ativo',true).order('nome'):Promise.resolve({data:[],error:null})
    ])
    const error=r.error||e.error||s.error||c.error||t.error||d.error||v.error||ev.error||pf.error
    if(error){setMsg(error.message);return}
    setRoutes((r.data||[]) as RoutePlan[]);setDeliveries((e.data||[]) as Delivery[]);setSales((s.data||[]) as Sale[])
    setClients((c.data||[]) as Client[]);setTitles((t.data||[]) as Title[]);setDrivers((d.data||[]) as Driver[]);setVehicles((v.data||[]) as Vehicle[]);setEvents((ev.data||[]) as RouteEvent[]);setProfiles((pf.data||[]) as UserProfile[])
  },[canEdit])
  useEffect(()=>{void load()},[load,refreshKey])

  const dayRoutes=useMemo(()=>routes.filter(r=>r.data_rota===day&&r.status!=='cancelada'),[routes,day])
  const displayedRoutes=useMemo(()=>tab==='montagem'
    ? dayRoutes.filter(r=>r.status==='montagem')
    : tab==='rota'
      ? routes.filter(r=>r.status==='liberada')
      : routes.filter(r=>r.status==='concluida'||r.status==='cancelada')
  ,[tab,dayRoutes,routes])
  const selectedRoute=displayedRoutes.find(r=>r.id===selectedRouteId)||displayedRoutes[0]||null
  const stops=useMemo(()=>selectedRoute?deliveries.filter(d=>d.rota_logistica_id===selectedRoute.id).sort((a,b)=>Number(a.ordem_rota||9999)-Number(b.ordem_rota||9999)):[],[selectedRoute,deliveries])
  const selectedVehicle=vehicles.find(v=>v.id===selectedRoute?.veiculo_id)
  const routeEvents=selectedRoute?events.filter(e=>e.rota_id===selectedRoute.id).slice(0,30):[]

  function saleFor(d:Delivery){return sales.find(s=>s.id===d.venda_id)}
  function clientFor(d:Delivery){return clients.find(c=>c.id===saleFor(d)?.cliente_id)}
  function dueFor(d:Delivery){return titles.filter(t=>t.venda_id===d.venda_id&&t.status!=='cancelado').reduce((a,t)=>a+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)}
  const stats=useMemo(()=>{
    const total=stops.length,delivered=stops.filter(d=>d.status==='entregue').length,failed=stops.filter(d=>d.status==='reagendamento').length,pending=stops.filter(d=>d.status==='a_entregar'||d.status==='em_transito').length
    return {total,delivered,failed,pending,value:stops.reduce((a,d)=>a+Number(saleFor(d)?.total||0),0),collect:stops.reduce((a,d)=>a+dueFor(d),0),kg:stops.reduce((a,d)=>a+Number(d.peso_estimado_kg||0),0),m3:stops.reduce((a,d)=>a+Number(d.volume_estimado_m3||0),0)}
  },[stops,sales,titles])

  async function refresh(){await load();await onChanged()}

  async function createRoute(){
    if(!canEdit||!newName.trim())return
    setBusy(true);setMsg('')
    try{
      const driver=drivers.find(d=>d.id===newDriverId),vehicle=vehicles.find(v=>v.id===newVehicleId)
      const {data,error}=await supabase.from('rotas_logisticas').insert({data_rota:day,nome:newName.trim(),motorista_id:newDriverId||null,motorista:driver?.nome||null,veiculo_id:newVehicleId||null,veiculo:vehicle?[vehicle.descricao,vehicle.placa].filter(Boolean).join(' - '):null}).select('*').single()
      if(error)throw error
      setSelectedRouteId((data as RoutePlan).id);setNewName('');setNewDriverId('');setNewVehicleId('');await refresh()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }
  async function addSelected(){
    if(!selectedRoute||!selectedDeliveryIds.length)return
    setBusy(true);setMsg('')
    try{
      const {error}=await supabase.rpc('logistica_adicionar_entregas_rota',{p_rota_id:selectedRoute.id,p_entrega_ids:selectedDeliveryIds})
      if(error)throw error
      onClearSelection();setMsg(selectedDeliveryIds.length+' entrega(s) adicionada(s) à rota.');await refresh()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }
  async function removeStop(id:string){
    setBusy(true);try{const {error}=await supabase.rpc('logistica_remover_entrega_rota',{p_entrega_id:id});if(error)throw error;await refresh()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }
  async function reorder(ids:string[]){
    if(!selectedRoute)return
    setBusy(true);try{const {error}=await supabase.rpc('logistica_reordenar_rota',{p_rota_id:selectedRoute.id,p_entrega_ids:ids});if(error)throw error;await refresh()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }
  async function moveStop(id:string,dir:-1|1){
    const i=stops.findIndex(s=>s.id===id),j=i+dir;if(i<0||j<0||j>=stops.length)return
    const ids=stops.map(s=>s.id);[ids[i],ids[j]]=[ids[j],ids[i]];await reorder(ids)
  }
  async function dropOn(targetId:string){
    if(!dragId||dragId===targetId)return
    const ids=stops.map(s=>s.id),from=ids.indexOf(dragId),to=ids.indexOf(targetId);if(from<0||to<0)return
    ids.splice(to,0,ids.splice(from,1)[0]);setDragId(null);await reorder(ids)
  }
  async function optimize(){
    if(stops.length<3)return
    const located=stops.filter(s=>{const c=clientFor(s);return c?.latitude!=null&&c?.longitude!=null})
    if(located.length!==stops.length){setMsg('Para otimização automática, cadastre latitude/longitude de todos os clientes da rota. A ordem manual continua disponível.');return}
    const remaining=[...stops],ordered:Delivery[]=[remaining.shift()!]
    while(remaining.length){
      const current=clientFor(ordered[ordered.length-1])!
      let best=0,bestD=Infinity
      remaining.forEach((d,i)=>{const dist=haversine(current,clientFor(d)!);if(dist<bestD){bestD=dist;best=i}})
      ordered.push(remaining.splice(best,1)[0])
    }
    await reorder(ordered.map(x=>x.id));setMsg('Sequência sugerida por proximidade geográfica aplicada.')
  }
  async function applyBulk(){
    if(!selectedDeliveryIds.length)return
    setBusy(true);setMsg('')
    try{
      const {error}=await supabase.rpc('logistica_aplicar_lote',{p_entrega_ids:selectedDeliveryIds,p_rota:bulkRoute||null,p_motorista_id:bulkDriverId||null,p_data:bulkDate||null})
      if(error)throw error
      setMsg('Alterações aplicadas a '+selectedDeliveryIds.length+' entrega(s).');onClearSelection();setBulkRoute('');setBulkDriverId('');setBulkDate('');await refresh()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }
  async function updateRoute(field:'nome'|'motorista_id'|'veiculo_id',value:string){
    if(!selectedRoute)return
    const patch:Record<string,unknown>={[field]:value||null,updated_at:new Date().toISOString()}
    if(field==='motorista_id')patch.motorista=drivers.find(d=>d.id===value)?.nome||null
    if(field==='veiculo_id'){const v=vehicles.find(x=>x.id===value);patch.veiculo=v?[v.descricao,v.placa].filter(Boolean).join(' - '):null}
    const {error}=await supabase.from('rotas_logisticas').update(patch).eq('id',selectedRoute.id);if(error)setMsg(error.message);else await refresh()
  }
  async function deleteRoute(){
    if(!selectedRoute||!canEdit||busy)return
    const count=stops.length
    const warning=selectedRoute.status==='montagem'&&count>0
      ? 'Esta rota tem '+count+' entrega(s). Ao excluir, elas voltarão para a fila de montagem. Deseja continuar?'
      : 'Deseja excluir a rota '+selectedRoute.nome+'?'
    if(!window.confirm(warning))return
    setBusy(true);setMsg('')
    try{
      const {error}=await supabase.rpc('logistica_excluir_rota',{p_rota_id:selectedRoute.id})
      if(error)throw error
      setSelectedRouteId('')
      setMsg('Rota excluída com sucesso.')
      await refresh()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }

  async function release(){
    if(!selectedRoute)return
    setBusy(true);try{const {error}=await supabase.rpc('logistica_liberar_rota',{p_rota_id:selectedRoute.id});if(error)throw error;setTab('rota');setMsg('Rota liberada com segurança.');await refresh()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }
  async function createDriver(){
    if(!driverName.trim())return
    const {error}=await supabase.from('motoristas_logistica').insert({nome:driverName.trim(),telefone:driverPhone.trim()||null,profile_id:driverProfileId||null});if(error)setMsg(error.message);else{setDriverName('');setDriverPhone('');setDriverProfileId('');await load()}
  }
  async function createVehicle(){
    if(!vehicleName.trim())return
    const {error}=await supabase.from('veiculos_logistica').insert({descricao:vehicleName.trim(),placa:vehiclePlate.trim()||null,capacidade_entregas:vehicleStops?Number(vehicleStops):null,capacidade_kg:vehicleKg?Number(vehicleKg):null,capacidade_m3:vehicleM3?Number(vehicleM3):null});if(error)setMsg(error.message);else{setVehicleName('');setVehiclePlate('');setVehicleStops('');setVehicleKg('');setVehicleM3('');await load()}
  }
  function openMaps(){
    const addresses=stops.map(s=>address(clientFor(s))).filter(Boolean);if(!addresses.length)return
    const p=new URLSearchParams({api:'1',origin:addresses[0],destination:addresses[addresses.length-1],travelmode:'driving'});if(addresses.length>2)p.set('waypoints',addresses.slice(1,-1).join('|'));window.open('https://www.google.com/maps/dir/?'+p,'_blank','noopener,noreferrer')
  }
  async function routePdf(){
    if(!selectedRoute)return
    const {jsPDF}=await import('jspdf'),doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
    doc.setFillColor(15,23,42);doc.roundedRect(10,8,277,22,3,3,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Manifesto de Rota - '+selectedRoute.nome,15,18);doc.setFontSize(9);doc.text('Data '+new Date(selectedRoute.data_rota+'T12:00:00').toLocaleDateString('pt-BR')+' | Motorista '+(selectedRoute.motorista||'—')+' | Veículo '+(selectedRoute.veiculo||'—'),15,25)
    doc.setTextColor(15,23,42);doc.setFontSize(9);doc.text('Paradas '+stats.total+' | Entregues '+stats.delivered+' | Falhas '+stats.failed+' | Pendentes '+stats.pending+' | A cobrar '+money(stats.collect),12,39)
    let y=48;const widths=[12,42,82,45,34,48],heads=['#','Pedido / Cliente','Endereço','Valor','Cobrança','Status'];let x=10
    doc.setFillColor(226,232,240);doc.rect(10,y,263,8,'F');heads.forEach((h,i)=>{doc.text(h,x+2,y+5);x+=widths[i]});y+=8
    for(const [i,d] of stops.entries()){const s=saleFor(d),c=clientFor(d),vals=[String(i+1),'#'+String(s?.fatura_numero||0).padStart(7,'0')+' / '+(c?.nome||'Cliente'),address(c),money(Number(s?.total||0)),dueFor(d)>0?money(dueFor(d)):'Pago',d.status];const wrap=vals.map((v,k)=>doc.splitTextToSize(v,widths[k]-4)),h=Math.max(10,Math.max(...wrap.map(a=>a.length))*4+2);if(y+h>190){doc.addPage();y=12}x=10;doc.rect(10,y,263,h);wrap.forEach((a,k)=>{doc.text(a,x+2,y+5);x+=widths[k];if(k<wrap.length-1)doc.line(x,y,x,y+h)});y+=h}
    doc.save('rota-'+selectedRoute.nome.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-'+selectedRoute.data_rota+'.pdf')
  }

  const capStops=selectedVehicle?.capacidade_entregas,capKg=selectedVehicle?.capacidade_kg,capM3=selectedVehicle?.capacidade_m3
  const overCapacity=(capStops!=null&&stats.total>capStops)||(capKg!=null&&stats.kg>capKg)||(capM3!=null&&stats.m3>capM3)

  return <section className="routeCenter">
    <div className="routeCenterTabs">
      <button className={tab==='montagem'?'active':''} onClick={()=>{setTab('montagem');setSelectedRouteId('')}}>Montagem</button>
      <button className={tab==='rota'?'active':''} onClick={()=>{setTab('rota');setSelectedRouteId('')}}>Em rota</button>
      <button className={tab==='historico'?'active':''} onClick={()=>{setTab('historico');setSelectedRouteId('')}}>Histórico</button>
      <label>Dia<input type="date" value={day} onChange={e=>{setDay(e.target.value);setSelectedRouteId('');const u=new URL(window.location.href);u.searchParams.set('dia',e.target.value);window.history.replaceState({},'',u)}}/></label>
      <button className="routeSetupBtn" onClick={()=>setShowSetup(v=>!v)}><Users size={15}/>Motoristas / Frota</button>
      <button className="routeRefreshBtn" onClick={()=>void refresh()}><RefreshCw size={15}/></button>
    </div>
    {msg&&<div className="deliveryNotice">{msg}</div>}

    {showSetup&&canEdit&&<div className="routeSetupGrid">
      <div><strong>Novo motorista</strong><input value={driverName} onChange={e=>setDriverName(e.target.value)} placeholder="Nome"/><input value={driverPhone} onChange={e=>setDriverPhone(e.target.value)} placeholder="Telefone"/><select value={driverProfileId} onChange={e=>setDriverProfileId(e.target.value)}><option value="">Usuário do ERP (opcional)</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.nome} · {p.perfil}</option>)}</select><button onClick={()=>void createDriver()}><Plus size={14}/>Cadastrar</button></div>
      <div><strong>Novo veículo</strong><input value={vehicleName} onChange={e=>setVehicleName(e.target.value)} placeholder="Descrição"/><input value={vehiclePlate} onChange={e=>setVehiclePlate(e.target.value)} placeholder="Placa"/><div className="routeCapacityInputs"><input value={vehicleStops} onChange={e=>setVehicleStops(e.target.value)} type="number" min="1" placeholder="Máx. entregas"/><input value={vehicleKg} onChange={e=>setVehicleKg(e.target.value)} type="number" min="0" step="0.001" placeholder="Cap. kg"/><input value={vehicleM3} onChange={e=>setVehicleM3(e.target.value)} type="number" min="0" step="0.0001" placeholder="Cap. m³"/></div><button onClick={()=>void createVehicle()}><Plus size={14}/>Cadastrar</button></div>
      <div className="routeRegistry"><strong>Cadastros ativos</strong><span><Users size={14}/>{drivers.filter(d=>d.ativo).length} motorista(s)</span><span><Car size={14}/>{vehicles.filter(v=>v.ativo).length} veículo(s)</span></div>
    </div>}

    {selectedDeliveryIds.length>0&&canEdit&&<div className="routeBulkApply">
      <div><strong>{selectedDeliveryIds.length} entrega(s) selecionada(s)</strong><span>Alteração em lote só é salva ao clicar em Aplicar.</span></div>
      <input value={bulkRoute} onChange={e=>setBulkRoute(e.target.value)} placeholder="Rota / região (opcional)"/>
      <select value={bulkDriverId} onChange={e=>setBulkDriverId(e.target.value)}><option value="">Motorista (opcional)</option>{drivers.filter(d=>d.ativo).map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select>
      <input type="date" value={bulkDate} onChange={e=>setBulkDate(e.target.value)}/>
      <button onClick={()=>void applyBulk()}>Aplicar</button>
      <button className="ghostRoute" onClick={onClearSelection}>Cancelar</button>
    </div>}

    <div className="routeCenterBody">
      <aside className="routeCenterSidebar">
        {tab==='montagem'&&canEdit&&<div className="routeQuickCreate"><strong>Nova rota</strong><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nome da rota"/><select value={newDriverId} onChange={e=>setNewDriverId(e.target.value)}><option value="">Motorista</option>{drivers.filter(d=>d.ativo).map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select><select value={newVehicleId} onChange={e=>setNewVehicleId(e.target.value)}><option value="">Veículo</option>{vehicles.filter(v=>v.ativo).map(v=><option key={v.id} value={v.id}>{v.descricao}{v.placa?' - '+v.placa:''}</option>)}</select><button disabled={!newName.trim()||busy} onClick={()=>void createRoute()}><Plus size={15}/>Criar rota</button></div>}
        <div className="routeCenterList">{displayedRoutes.map(r=>{const count=deliveries.filter(d=>d.rota_logistica_id===r.id).length;return <button key={r.id} className={selectedRoute?.id===r.id?'active':''} onClick={()=>setSelectedRouteId(r.id)}><div><strong>{r.nome}</strong><span>{r.motorista||'Sem motorista'} · {r.veiculo||'Sem veículo'}</span><small>{tab==='rota'&&r.data_rota!==day?'Iniciada em '+new Date(r.data_rota+'T12:00:00').toLocaleDateString('pt-BR'):new Date(r.data_rota+'T12:00:00').toLocaleDateString('pt-BR')}</small></div><em>{count}</em></button>})}{!displayedRoutes.length&&<div className="routePlanEmpty">Nenhuma rota nesta visão.</div>}</div>
      </aside>

      <div className="routeCenterWorkspace">
        {!selectedRoute?<div className="routeWorkspaceEmpty"><Route size={34}/><strong>Nenhuma rota selecionada</strong><span>Crie ou selecione uma rota para continuar.</span></div>:<>
          <div className="routeCenterHeader">
            <div><input className="routeTitleInput" defaultValue={selectedRoute.nome} disabled={!canEdit||selectedRoute.status!=='montagem'} onBlur={e=>void updateRoute('nome',e.target.value)}/><span>{selectedRoute.status==='montagem'?'Em montagem':selectedRoute.status==='liberada'?'Em rota':selectedRoute.status==='concluida'?'Concluída':'Cancelada'} · {selectedRoute.data_rota}</span></div>
            <div className="routeHeaderSelectors"><select value={selectedRoute.motorista_id||''} disabled={!canEdit||selectedRoute.status!=='montagem'} onChange={e=>void updateRoute('motorista_id',e.target.value)}><option value="">Motorista</option>{drivers.filter(d=>d.ativo).map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select><select value={selectedRoute.veiculo_id||''} disabled={!canEdit||selectedRoute.status!=='montagem'} onChange={e=>void updateRoute('veiculo_id',e.target.value)}><option value="">Veículo</option>{vehicles.filter(v=>v.ativo).map(v=><option key={v.id} value={v.id}>{v.descricao}{v.placa?' - '+v.placa:''}</option>)}</select></div>
            <div className="routeHeaderActions"><button onClick={openMaps} disabled={!stops.length}><MapPin size={15}/>Maps</button><button onClick={()=>void routePdf()} disabled={!stops.length}><FileDown size={15}/>PDF</button>{selectedRoute.status==='montagem'&&canEdit&&<button onClick={()=>void optimize()} disabled={stops.length<3}>Otimizar</button>}{canEdit&&(selectedRoute.status==='montagem'||(selectedRoute.status==='liberada'&&!stops.length))&&<button className="deleteRouteButton" onClick={()=>void deleteRoute()} disabled={busy}><Trash2 size={15}/>Excluir</button>}{selectedRoute.status==='montagem'&&canEdit&&<button className="releaseRoute" onClick={()=>void release()} disabled={!stops.length||overCapacity}><Truck size={15}/>Liberar</button>}</div>
          </div>

          <div className="routeKpis">
            <div><span>Paradas</span><strong>{stats.total}</strong>{capStops!=null&&<small>/ {capStops}</small>}</div>
            <div><span>Valor da carga</span><strong>{money(stats.value)}</strong></div>
            <div><span>A cobrar</span><strong>{money(stats.collect)}</strong></div>
            <div><span>Peso</span><strong>{stats.kg.toLocaleString('pt-BR')} kg</strong>{capKg!=null&&<small>/ {Number(capKg).toLocaleString('pt-BR')} kg</small>}</div>
            <div><span>Volume</span><strong>{stats.m3.toLocaleString('pt-BR')} m³</strong>{capM3!=null&&<small>/ {Number(capM3).toLocaleString('pt-BR')} m³</small>}</div>
            <div><span>Progresso</span><strong>{stats.delivered}/{stats.total}</strong><small>{stats.failed} falha(s)</small></div>
          </div>
          {overCapacity&&<div className="routeCapacityWarning">Capacidade do veículo excedida. A rota não pode ser liberada até ajustar a carga ou trocar o veículo.</div>}

          {tab==='montagem'&&canEdit&&<div className="routeAssignBar"><div><strong>{selectedDeliveryIds.length} entrega(s) selecionada(s) na lista</strong><span>Selecione pedidos abaixo e adicione-os à carga em uma única operação.</span></div><button disabled={!selectedDeliveryIds.length||busy} onClick={()=>void addSelected()}><Plus size={15}/>Adicionar à rota</button></div>}

          <div className="routeStops advanced">{stops.map((d,i)=>{const s=saleFor(d),c=clientFor(d),due=dueFor(d);return <article key={d.id} draggable={canEdit&&selectedRoute.status==='montagem'} onDragStart={()=>setDragId(d.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>void dropOn(d.id)}>
            <div className="routeStopOrder"><strong>{i+1}</strong>{selectedRoute.status==='montagem'&&canEdit&&<div><button onClick={()=>void moveStop(d.id,-1)} disabled={i===0||busy}><ArrowUp size={13}/></button><button onClick={()=>void moveStop(d.id,1)} disabled={i===stops.length-1||busy}><ArrowDown size={13}/></button></div>}</div>
            <div className="routeStopInfo"><strong>#{String(s?.fatura_numero||0).padStart(7,'0')} · {c?.nome||'Cliente'}</strong><span>{address(c)||'Endereço não cadastrado'}</span></div>
            <div className="routeStopValue"><strong>{money(Number(s?.total||0))}</strong><span>{due>0?'Cobrar '+money(due):'Pago'}</span></div>
            <div className="routeStopStatus"><span className={'deliveryStatus '+d.status}>{d.status.replace(/_/g,' ')}</span><small>{Number(d.peso_estimado_kg||0).toLocaleString('pt-BR')} kg · {Number(d.volume_estimado_m3||0).toLocaleString('pt-BR')} m³</small></div>
            {selectedRoute.status==='montagem'&&canEdit&&<button className="routeStopRemove" onClick={()=>void removeStop(d.id)}><XCircle size={15}/>Remover</button>}
            {selectedRoute.status==='liberada'&&d.status==='em_transito'&&canOperate&&<button className="routeStopDeliver" disabled={busy} onClick={()=>onConfirmDelivery(d.id)}><CheckCircle2 size={15}/>Entregar</button>}
          </article>})}{!stops.length&&<div className="routeStopsEmpty">Nenhuma parada nesta rota.</div>}</div>

          {routeEvents.length>0&&<details className="routeAudit"><summary>Auditoria da rota ({routeEvents.length})</summary><div>{routeEvents.map(e=><article key={e.id}><strong>{e.tipo.replace(/_/g,' ')}</strong><span>{dt(e.created_at)}</span><small>{Object.entries(e.detalhes||{}).map(([k,v])=>k+': '+String(v??'')).join(' · ')}</small></article>)}</div></details>}
        </>}
      </div>
    </div>
  </section>
}
