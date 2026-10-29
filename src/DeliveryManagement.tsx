import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {Camera,CheckCircle2,Clock3,FileDown,MapPin,MessageCircle,Navigation,PenLine,Route,Truck,XCircle} from 'lucide-react'
import {supabase} from './lib/supabase'

type DeliveryStatus='a_entregar'|'em_transito'|'entregue'|'reagendamento'|'cancelado'
type Delivery={
  id:string;venda_id:string;status:DeliveryStatus;rota:string|null;rota_manual:boolean;data_prevista:string;entregador_nome:string|null;
  cobrar_na_entrega:boolean;valor_cobrar:number;observacoes_entrega:string|null;recebedor_nome:string|null;recebedor_documento:string|null;
  comprovante_path:string|null;assinatura_path:string|null;falha_motivo:string|null;falha_detalhes:string|null;em_transito_em:string|null;
  entregue_em:string|null;falha_em:string|null;created_at:string;updated_at:string
}
type Sale={id:string;cliente_id:string|null;status:string;total:number;observacoes:string|null;rota_entrega:string|null;forma_pagamento:string;fatura_numero:number|null;created_at:string}
type Client={id:string;nome:string;telefone:string|null;logradouro?:string|null;numero?:string|null;bairro?:string|null;municipio?:string|null;uf?:string|null;cep?:string|null}
type Title={venda_id:string|null;tipo:'receber'|'pagar';valor:number;valor_pago:number;status:string}
type Company={nome_fantasia:string;razao_social:string}
type Mode='entregue'|'falha'|null

const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0)
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})
const dateTimeBr=(v:string|null)=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(v)):'—'
const cleanPhone=(v:string|null)=>String(v||'').replace(/\D/g,'')
const routeLabel=(v:string|null)=>v?String(v).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()):'Sem rota'
const paymentLabel=(v:string)=>v==='pix'?'PIX':v==='cartao'?'Cartão':v==='boleto'?'Boleto':v==='dinheiro'?'Dinheiro':v
const failLabel=(v:string|null)=>v==='cliente_ausente'?'Cliente ausente':v==='endereco_nao_localizado'?'Endereço não localizado':v==='recusado_cliente'?'Recusado pelo cliente':v==='avaria_mercadoria'?'Avaria na mercadoria':v==='outro'?'Outro':'—'

function addressOf(c?:Client){
  if(!c)return''
  return [[c.logradouro,c.numero].filter(Boolean).join(', '),c.bairro,c.municipio,c.uf,c.cep].filter(Boolean).join(' - ')
}

export function DeliveryManagement({canEdit}:{canEdit:boolean}){
  const [deliveries,setDeliveries]=useState<Delivery[]>([])
  const [sales,setSales]=useState<Sale[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [titles,setTitles]=useState<Title[]>([])
  const [company,setCompany]=useState<Company|null>(null)
  const [selectedRoutes,setSelectedRoutes]=useState<string[]>([])
  const [reportDate,setReportDate]=useState(today())
  const [driverFilter,setDriverFilter]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [modalDelivery,setModalDelivery]=useState<Delivery|null>(null)
  const [mode,setMode]=useState<Mode>(null)
  const [receiverName,setReceiverName]=useState('')
  const [receiverDoc,setReceiverDoc]=useState('')
  const [proofFile,setProofFile]=useState<File|null>(null)
  const [failReason,setFailReason]=useState('cliente_ausente')
  const [failDetails,setFailDetails]=useState('')
  const canvasRef=useRef<HTMLCanvasElement|null>(null)
  const drawing=useRef(false)

  const load=useCallback(async()=>{
    const [e,v,c,t,ec]=await Promise.all([
      supabase.from('entregas').select('*').order('data_prevista').order('created_at'),
      supabase.from('vendas').select('id,cliente_id,status,total,observacoes,rota_entrega,forma_pagamento,fatura_numero,created_at').order('created_at',{ascending:false}),
      supabase.from('clientes').select('id,nome,telefone,logradouro,numero,bairro,municipio,uf,cep').order('nome'),
      supabase.from('titulos_financeiros').select('venda_id,tipo,valor,valor_pago,status').eq('tipo','receber'),
      supabase.from('empresa_config').select('nome_fantasia,razao_social').eq('id',1).maybeSingle()
    ])
    const error=e.error||v.error||c.error||t.error||ec.error
    if(error){setMessage(error.message);return}
    setDeliveries((e.data||[]) as Delivery[])
    setSales((v.data||[]) as Sale[])
    setClients((c.data||[]) as Client[])
    setTitles((t.data||[]) as Title[])
    if(ec.data)setCompany(ec.data as Company)
  },[])

  useEffect(()=>{void load()},[load])

  const routes=useMemo(()=>Array.from(new Set(deliveries.map(d=>d.rota).filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,'pt-BR')),[deliveries])
  const active=useMemo(()=>deliveries.filter(d=>d.status==='a_entregar'||d.status==='em_transito').filter(d=>!selectedRoutes.length||selectedRoutes.includes(d.rota||'')),[deliveries,selectedRoutes])
  const history=useMemo(()=>deliveries.filter(d=>d.status==='entregue'||d.status==='reagendamento').sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,20),[deliveries])
  const activeRoutes=new Set(active.map(d=>d.rota).filter(Boolean)).size

  function saleFor(d:Delivery){return sales.find(s=>s.id===d.venda_id)}
  function clientFor(d:Delivery){return clients.find(c=>c.id===saleFor(d)?.cliente_id)}
  function openAmount(vendaId:string){
    return titles.filter(t=>t.venda_id===vendaId&&t.status!=='cancelado').reduce((sum,t)=>sum+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  }
  function toggleRoute(route:string){setSelectedRoutes(prev=>prev.includes(route)?prev.filter(x=>x!==route):[...prev,route])}

  function openModal(d:Delivery,next:Mode){
    setModalDelivery(d);setMode(next);setReceiverName('');setReceiverDoc('');setProofFile(null);setFailReason('cliente_ausente');setFailDetails('')
    requestAnimationFrame(()=>clearSignature())
  }
  function closeModal(){setModalDelivery(null);setMode(null);setProofFile(null)}

  function canvasPoint(e:React.PointerEvent<HTMLCanvasElement>){
    const canvas=e.currentTarget,rect=canvas.getBoundingClientRect()
    return {x:(e.clientX-rect.left)*(canvas.width/rect.width),y:(e.clientY-rect.top)*(canvas.height/rect.height)}
  }
  function startDraw(e:React.PointerEvent<HTMLCanvasElement>){
    if(!canEdit)return
    drawing.current=true;e.currentTarget.setPointerCapture(e.pointerId)
    const p=canvasPoint(e),ctx=e.currentTarget.getContext('2d');if(!ctx)return
    ctx.beginPath();ctx.moveTo(p.x,p.y)
  }
  function draw(e:React.PointerEvent<HTMLCanvasElement>){
    if(!drawing.current)return
    const p=canvasPoint(e),ctx=e.currentTarget.getContext('2d');if(!ctx)return
    ctx.lineWidth=2.2;ctx.lineCap='round';ctx.strokeStyle='#0f172a';ctx.lineTo(p.x,p.y);ctx.stroke()
  }
  function endDraw(){drawing.current=false}
  function clearSignature(){
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d');if(!ctx)return
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height)
  }
  function hasSignature(){
    const canvas=canvasRef.current;if(!canvas)return false
    const ctx=canvas.getContext('2d');if(!ctx)return false
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data
    for(let i=0;i<data.length;i+=4){if(data[i]<245||data[i+1]<245||data[i+2]<245)return true}
    return false
  }
  async function uploadAsset(deliveryId:string,file:Blob,name:string){
    const path=`${deliveryId}/${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
    const {error}=await supabase.storage.from('entregas-comprovantes').upload(path,file,{upsert:false,contentType:file.type||'image/png'})
    if(error)throw error
    return path
  }

  async function markTransit(d:Delivery){
    if(!canEdit||busy)return
    setBusy(true);setMessage('')
    try{
      const previous=d.status
      const {error}=await supabase.from('entregas').update({status:'em_transito',em_transito_em:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',d.id)
      if(error)throw error
      await supabase.from('entrega_eventos').insert({entrega_id:d.id,tipo:'em_transito',status_anterior:previous,status_novo:'em_transito'})
      await load()
    }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  }

  async function saveDelivered(){
    const d=modalDelivery;if(!d||!canEdit||busy)return
    setBusy(true);setMessage('')
    try{
      let proofPath:string|null=d.comprovante_path,signaturePath:string|null=d.assinatura_path
      if(proofFile)proofPath=await uploadAsset(d.id,proofFile,proofFile.name)
      if(hasSignature()){
        const canvas=canvasRef.current!
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Não foi possível gerar a assinatura.')),'image/png'))
        signaturePath=await uploadAsset(d.id,blob,'assinatura.png')
      }
      const stamp=new Date().toISOString()
      const {error}=await supabase.from('entregas').update({
        status:'entregue',recebedor_nome:receiverName.trim()||null,recebedor_documento:receiverDoc.trim()||null,
        comprovante_path:proofPath,assinatura_path:signaturePath,entregue_em:stamp,falha_motivo:null,falha_detalhes:null,falha_em:null,updated_at:stamp
      }).eq('id',d.id)
      if(error)throw error
      await supabase.from('entrega_eventos').insert({entrega_id:d.id,tipo:'entregue',status_anterior:d.status,status_novo:'entregue',detalhes:[receiverName.trim()&&`Recebido por ${receiverName.trim()}`,receiverDoc.trim()&&`Documento ${receiverDoc.trim()}`].filter(Boolean).join(' · ')||null})
      closeModal();setMessage('Entrega confirmada com sucesso. Nenhuma movimentação de estoque foi realizada.');await load()
    }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  }

  async function saveFailure(){
    const d=modalDelivery;if(!d||!canEdit||busy)return
    if(!failReason){setMessage('Selecione o motivo da não entrega.');return}
    if(failReason==='outro'&&!failDetails.trim()){setMessage('Detalhe o motivo da não entrega.');return}
    setBusy(true);setMessage('')
    try{
      const stamp=new Date().toISOString()
      const {error}=await supabase.from('entregas').update({status:'reagendamento',falha_motivo:failReason,falha_detalhes:failDetails.trim()||null,falha_em:stamp,updated_at:stamp}).eq('id',d.id)
      if(error)throw error
      await supabase.from('entrega_eventos').insert({entrega_id:d.id,tipo:'nao_entregue',status_anterior:d.status,status_novo:'reagendamento',motivo:failReason,detalhes:failDetails.trim()||null})
      closeModal();setMessage('Não entrega registrada para reagendamento. O estoque permaneceu inalterado.');await load()
    }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  }

  async function updateLogistics(d:Delivery,route:string,driver:string,date:string){
    if(!canEdit)return
    const {error}=await supabase.from('entregas').update({rota:route.trim()||null,rota_manual:true,entregador_nome:driver.trim()||null,data_prevista:date,updated_at:new Date().toISOString()}).eq('id',d.id)
    if(error){setMessage(error.message);return}
    await supabase.from('entrega_eventos').insert({entrega_id:d.id,tipo:'organizacao',status_anterior:d.status,status_novo:d.status,detalhes:`Rota: ${route||'sem rota'} · Entregador: ${driver||'não informado'} · Data: ${date}`})
    await load()
  }

  async function generatePdf(){
    const {jsPDF}=await import('jspdf')
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
    const rows=deliveries.filter(d=>d.data_prevista===reportDate)
      .filter(d=>!selectedRoutes.length||selectedRoutes.includes(d.rota||''))
      .filter(d=>!driverFilter.trim()||(d.entregador_nome||'').toLowerCase().includes(driverFilter.trim().toLowerCase()))
    const delivered=rows.filter(d=>d.status==='entregue').length
    const failed=rows.filter(d=>d.status==='reagendamento').length
    const pending=rows.filter(d=>d.status==='a_entregar'||d.status==='em_transito').length
    let y=14
    doc.setFillColor(15,23,42);doc.roundedRect(10,8,277,24,3,3,'F')
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(company?.nome_fantasia||company?.razao_social||'ERP Empresarial',16,18)
    doc.setFontSize(11);doc.text('Manifesto / Relatório Diário de Entregas',16,26)
    doc.setTextColor(15,23,42);y=40;doc.setFontSize(9);doc.setFont('helvetica','normal')
    doc.text(`Data: ${new Date(reportDate+'T12:00:00').toLocaleDateString('pt-BR')}  |  Rotas: ${selectedRoutes.length?selectedRoutes.map(routeLabel).join(', '):'Todas'}  |  Entregador: ${driverFilter||'Todos'}`,12,y)
    y+=8;doc.setFont('helvetica','bold');doc.text(`Total ${rows.length}   |   Entregues ${delivered}   |   Não entregues ${failed}   |   Pendentes ${pending}`,12,y)
    y+=9
    const widths=[35,86,42,34,45,28],heads=['Pedido / Cliente','Endereço','Rota / Bairro','Valor a cobrar','Status','Assinatura']
    let x=10;doc.setFillColor(226,232,240);doc.rect(10,y,277,8,'F');doc.setFontSize(7.5)
    heads.forEach((h,i)=>{doc.text(h,x+2,y+5);x+=widths[i]});y+=8
    doc.setFont('helvetica','normal')
    for(const d of rows){
      const s=saleFor(d),c=clientFor(d),addr=addressOf(c),due=openAmount(d.venda_id)
      const status=d.status==='entregue'?'Entregue':d.status==='reagendamento'?`Não entregue - ${failLabel(d.falha_motivo)}`:d.status==='em_transito'?'Em trânsito':'Pendente'
      const values=[`#${String(s?.fatura_numero||0).padStart(7,'0')} / ${c?.nome||'Cliente'}`,addr,`${routeLabel(d.rota)} / ${c?.bairro||'—'}`,due>0?money(due):'Pago',status,'']
      const wrapped=values.map((v,i)=>doc.splitTextToSize(String(v),widths[i]-4))
      const lines=Math.max(...wrapped.map(a=>a.length),1),h=Math.max(11,lines*4+3)
      if(y+h>190){doc.addPage();y=14}
      x=10;doc.setDrawColor(203,213,225);doc.rect(10,y,277,h)
      wrapped.forEach((a,i)=>{doc.text(a,x+2,y+5);x+=widths[i];if(i<wrapped.length-1)doc.line(x,y,x,y+h)})
      y+=h
    }
    if(y+20>195){doc.addPage();y=14}
    y+=10;doc.line(20,y,105,y);doc.line(175,y,265,y);doc.setFontSize(8);doc.text('Responsável da Logística',48,y+5);doc.text('Entregador',205,y+5)
    doc.save(`manifesto-entregas-${reportDate}.pdf`)
  }

  return <section className="deliveryApp">
    <div className="deliveryHero">
      <div><span>OPERAÇÃO LOGÍSTICA</span><h2>Gerenciamento de Entregas</h2><p>Status de transporte separado do estoque e do faturamento.</p></div>
      <button className="deliveryPdfButton" onClick={()=>void generatePdf()}><FileDown size={18}/>Gerar PDF de Entregas do Dia</button>
    </div>
    {message&&<div className="deliveryNotice" role="status">{message}</div>}

    <div className="deliveryToolbar">
      <div className="deliveryRouteFilter">
        <strong>Filtrar por rota</strong>
        <button className={!selectedRoutes.length?'active':''} onClick={()=>setSelectedRoutes([])}>Todas as rotas</button>
        {routes.map(r=><button key={r} className={selectedRoutes.includes(r)?'active':''} onClick={()=>toggleRoute(r)}>{routeLabel(r)}</button>)}
      </div>
      <div className="deliveryReportFilters">
        <label>Data<input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}/></label>
        <label>Motorista / Entregador<input value={driverFilter} onChange={e=>setDriverFilter(e.target.value)} placeholder="Todos"/></label>
      </div>
    </div>

    <div className="deliverySummary"><Truck size={18}/><strong>{active.length} entrega(s)</strong><span>{selectedRoutes.length?`em ${activeRoutes} rota(s) selecionada(s)`:'em todas as rotas'}</span></div>

    <div className="deliveryGrid">
      {active.map(d=>{
        const s=saleFor(d),c=clientFor(d),address=addressOf(c),phone=cleanPhone(c?.telefone||null),due=openAmount(d.venda_id)
        return <article className="deliveryCard" key={d.id}>
          <div className="deliveryCardHead"><div><span>Pedido / NF</span><strong>#{String(s?.fatura_numero||0).padStart(7,'0')}</strong></div><span className={'deliveryStatus '+d.status}>{d.status==='em_transito'?'Em trânsito':'A entregar'}</span></div>
          <div className="deliveryClient"><strong>{c?.nome||'Cliente não identificado'}</strong>{c?.telefone&&<a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer"><MessageCircle size={16}/> {c.telefone}</a>}</div>
          <div className="deliveryAddress"><MapPin size={17}/><div><strong>{address||'Endereço não cadastrado'}</strong><div>{address&&<><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Google Maps</a><a href={`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`} target="_blank" rel="noreferrer">Waze</a></>}</div></div></div>
          <div className="deliveryMeta">
            <span className="deliveryRouteTag"><Route size={14}/>{routeLabel(d.rota)}</span>
            <span><b>{money(Number(s?.total||0))}</b> · {due<=0?'Pago':`Cobrar ${money(due)} · ${paymentLabel(s?.forma_pagamento||'')}`}</span>
          </div>
          <div className="deliveryLogistics">
            <input defaultValue={d.rota||''} placeholder="Rota" aria-label="Rota" disabled={!canEdit} onBlur={e=>void updateLogistics(d,e.target.value,d.entregador_nome||'',d.data_prevista)}/>
            <input defaultValue={d.entregador_nome||''} placeholder="Entregador" aria-label="Entregador" disabled={!canEdit} onBlur={e=>void updateLogistics(d,d.rota||'',e.target.value,d.data_prevista)}/>
            <input type="date" defaultValue={d.data_prevista} aria-label="Data prevista" disabled={!canEdit} onChange={e=>void updateLogistics(d,d.rota||'',d.entregador_nome||'',e.target.value)}/>
          </div>
          {(d.observacoes_entrega||s?.observacoes)&&<div className="deliveryNotes"><strong>Observações</strong><span>{d.observacoes_entrega||s?.observacoes}</span></div>}
          <div className="deliveryActions">
            {d.status==='a_entregar'&&canEdit&&<button className="deliveryTransit" disabled={busy} onClick={()=>void markTransit(d)}><Navigation size={16}/>Em trânsito</button>}
            <button className="deliverySuccess" disabled={!canEdit||busy} onClick={()=>openModal(d,'entregue')}><CheckCircle2 size={17}/>Confirmar entregue</button>
            <button className="deliveryFail" disabled={!canEdit||busy} onClick={()=>openModal(d,'falha')}><XCircle size={17}/>Não entregue</button>
          </div>
        </article>
      })}
    </div>
    {!active.length&&<div className="deliveryEmpty"><Truck size={34}/><strong>Nenhuma entrega ativa</strong><span>Pedidos com logística “A entregar” ou “Em trânsito” aparecerão aqui.</span></div>}

    {history.length>0&&<section className="deliveryHistory">
      <div className="deliveryHistoryHead"><div><span>HISTÓRICO OPERACIONAL</span><h3>Entregas recentes</h3></div><span>{history.length} registro(s)</span></div>
      <div className="deliveryHistoryList">{history.map(d=>{
        const s=saleFor(d),c=clientFor(d)
        return <article key={d.id}>
          <div><strong>#{String(s?.fatura_numero||0).padStart(7,'0')} · {c?.nome||'Cliente'}</strong><span>{routeLabel(d.rota)} · {d.entregador_nome||'Entregador não informado'}</span></div>
          <div><span className={'deliveryHistoryStatus '+d.status}>{d.status==='entregue'?'Entregue':'Pendente de reagendamento'}</span><small>{d.status==='entregue'?dateTimeBr(d.entregue_em):`${failLabel(d.falha_motivo)} · ${dateTimeBr(d.falha_em)}`}</small></div>
        </article>
      })}</div>
    </section>}

    {modalDelivery&&mode&&<div className="deliveryModalBackdrop">
      <div className="deliveryModal" role="dialog" aria-modal="true">
        <div className="deliveryModalHead"><div><span>{mode==='entregue'?'CONFIRMAÇÃO':'OCORRÊNCIA'}</span><h3>{mode==='entregue'?'Confirmar entrega':'Registrar não entrega'}</h3></div><button onClick={closeModal}><XCircle size={20}/></button></div>
        {mode==='entregue'?<>
          <div className="deliveryFormGrid"><label>Nome de quem recebeu<input value={receiverName} onChange={e=>setReceiverName(e.target.value)} placeholder="Opcional"/></label><label>CPF / RG<input value={receiverDoc} onChange={e=>setReceiverDoc(e.target.value)} placeholder="Opcional"/></label></div>
          <label className="deliveryFile"><Camera size={18}/><span>{proofFile?proofFile.name:'Foto do comprovante / mercadoria (opcional)'}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setProofFile(e.target.files?.[0]||null)}/></label>
          <div className="deliverySignature"><div><PenLine size={17}/><strong>Assinatura digital (opcional)</strong><button onClick={clearSignature}>Limpar</button></div><canvas ref={canvasRef} width={900} height={220} onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerCancel={endDraw}/></div>
          <button className="deliverySuccess deliveryModalSave" disabled={busy} onClick={()=>void saveDelivered()}><CheckCircle2 size={18}/>{busy?'Salvando...':'Salvar entrega'}</button>
        </>:<>
          <label>Motivo<select value={failReason} onChange={e=>setFailReason(e.target.value)}><option value="cliente_ausente">Cliente ausente</option><option value="endereco_nao_localizado">Endereço não localizado</option><option value="recusado_cliente">Recusado pelo cliente</option><option value="avaria_mercadoria">Avaria na mercadoria</option><option value="outro">Outro</option></select></label>
          <label>Detalhes<textarea value={failDetails} onChange={e=>setFailDetails(e.target.value)} rows={4} placeholder="Descreva o ocorrido"/></label>
          <button className="deliveryFail deliveryModalSave" disabled={busy} onClick={()=>void saveFailure()}><XCircle size={18}/>{busy?'Salvando...':'Registrar não entrega'}</button>
        </>}
      </div>
    </div>}
  </section>
}
