import {useEffect,useMemo,useState} from 'react'
import {ChevronLeft,ChevronRight,FileDown,Pencil,Save,X} from 'lucide-react'
import {supabase} from './lib/supabase'
import {parseRhidAttendance,RhidDay} from './lib/rhid'
import {jsPDF} from 'jspdf'

type Employee={id:string;nome:string;cargo:string|null;ativo:boolean;rhid_person_id?:number|null;regime_trabalho?:string|null;jornada_semanal_horas?:number|null}
type Adjust={id:string;funcionario_id:string;data:string;entrada_1:string|null;saida_1:string|null;entrada_2:string|null;saida_2:string|null;status:'presente'|'atraso'|'falta'|'folga'|'atestado';observacao:string|null;envio_status?:'local'|'aguardando_envio'|'enviando'|'enviado'|'erro'|'rejeitado';enviado_em?:string|null;envio_erro?:string|null;rhid_resposta?:unknown;rhid_snapshot?:unknown}
const pad=(n:number)=>String(n).padStart(2,'0')
const daysInMonth=(m:string)=>{const p=m.split('-').map(Number),y=p[0],mo=p[1];return new Date(y,mo,0).getDate()}
const weekday=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'})
const iso=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const addDays=(value:string,days:number)=>{const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+days);return iso(d)}
const mondayOf=(value:string)=>{const d=new Date(value+'T12:00:00'),day=d.getDay(),back=day===0?6:day-1;d.setDate(d.getDate()-back);return iso(d)}
const sundayOf=(value:string)=>addDays(mondayOf(value),6)
const dateRange=(start:string,end:string)=>{const out:string[]=[];for(let d=start;d<=end;d=addDays(d,1))out.push(d);return out}
const cycleForMonth=(month:string)=>{
 const [y,m]=month.split('-').map(Number)
 const start=`${y}-${pad(m)}-26`
 const endDate=new Date(y,m,25,12)
 return {start,end:iso(endDate)}
}
function mins(a:string|null,b:string|null){if(!a||!b)return 0;const x=a.split(':').map(Number),y=b.split(':').map(Number);return Math.max(0,(y[0]*60+y[1])-(x[0]*60+x[1]))}
const hours=(r:Adjust)=>{const m=mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2);return Math.floor(m/60)+'h '+pad(m%60)+'m'}
const pendingVerification=(r:Adjust)=>Boolean((r.rhid_resposta as {request_sent?:boolean;verified?:boolean}|null)?.request_sent&&!(r.rhid_resposta as {verified?:boolean}|null)?.verified)

export function RhPointMirror({employees,month,canEdit}:{employees:Employee[];month:string;canEdit:boolean}){
 const [employeeId,setEmployeeId]=useState(''),[rows,setRows]=useState<Adjust[]>([]),[rhidDays,setRhidDays]=useState<RhidDay[]>([]),[editing,setEditing]=useState<Adjust|null>(null),[sendingId,setSendingId]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const activeEmployees=employees.filter(e=>e.ativo)
 const current=employees.find(e=>e.id===employeeId)
 function moveEmployee(direction:-1|1){
  if(!activeEmployees.length)return
  const index=activeEmployees.findIndex(e=>e.id===employeeId)
  const next=index<0?(direction>0?0:activeEmployees.length-1):(index+direction+activeEmployees.length)%activeEmployees.length
  setEmployeeId(activeEmployees[next].id)
 }
 async function load(preserveMessage=false){
  if(!employeeId||!month){setRows([]);setRhidDays([]);return}
  setBusy(true);if(!preserveMessage)setMessage('')
  const cycle=cycleForMonth(month),start=mondayOf(cycle.start),end=sundayOf(cycle.end)
  const currentEmployee=employees.find(e=>e.id===employeeId)
  const {data,error}=await supabase.from('rh_ponto_ajustes').select('*').eq('funcionario_id',employeeId).gte('data',start).lte('data',end).order('data')
  if(error)setMessage(error.message);else setRows((data||[]) as Adjust[])
  if(currentEmployee?.rhid_person_id){
   try{
    const {data:remote,error:fnError}=await supabase.functions.invoke('rhid-proxy',{body:{action:'attendance',person_id:currentEmployee.rhid_person_id,start,end}})
    if(fnError)throw fnError
    setRhidDays(parseRhidAttendance(remote))
   }catch(e){setRhidDays([]);setMessage((e as Error)?.message||'Não foi possível carregar o ponto do RHID.')}
  }else setRhidDays([])
  setBusy(false)
 }
 useEffect(()=>{void load()},[employeeId,month])
 const byDate=useMemo(()=>new Map(rows.map(r=>[r.data,r])),[rows])
 const rhidByDate=useMemo(()=>new Map(rhidDays.map(r=>[r.date,r])),[rhidDays])
 const effectiveRow=(d:string):Adjust=>{
  const local=byDate.get(d)
  const remote=rhidByDate.get(d)
  if(local)return local
  return {
   id:'',funcionario_id:employeeId,data:d,
   entrada_1:remote?.entrada_1||null,
   saida_1:remote?.saida_1||null,
   entrada_2:remote?.entrada_2||null,
   saida_2:remote?.saida_2||null,
   status:(remote?.punches.length?'presente':'falta') as Adjust['status'],
   observacao:remote?.punches.length?'Importado do RHID':null
  }
 }
 const cycle=month?cycleForMonth(month):{start:'',end:''}
 const periodStart=cycle.start
 const periodEnd=cycle.end
 const extendedStart=periodStart?mondayOf(periodStart):''
 const extendedEnd=periodEnd?sundayOf(periodEnd):''
 const extendedCalendar=useMemo(()=>month?dateRange(extendedStart,extendedEnd).map(effectiveRow):[],[month,employeeId,byDate,rhidByDate])
 const calendar=useMemo(()=>month?dateRange(periodStart,periodEnd).map(effectiveRow):[],[month,employeeId,byDate,rhidByDate])
 const weeklyLimitMinutes=Math.round(Number(current?.jornada_semanal_horas||44)*60)
 const weeklySummary=useMemo(()=>{
  const map=new Map<string,{start:string;end:string;worked:number}>()
  for(const r of extendedCalendar){
   const start=mondayOf(r.data),end=addDays(start,6)
   const item=map.get(start)||{start,end,worked:0}
   item.worked+=mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2)
   map.set(start,item)
  }
  return [...map.values()]
   .filter(w=>w.end>=periodStart&&w.start<=periodEnd)
   .map(w=>({...w,overtime:Math.max(0,w.worked-weeklyLimitMinutes)}))
 },[extendedCalendar,weeklyLimitMinutes,periodStart,periodEnd])
 const worked=calendar.reduce((s,r)=>s+mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2),0)
 const overtimeTotal=weeklySummary.reduce((s,w)=>s+w.overtime,0)
 const fmtMinutes=(m:number)=>Math.floor(m/60)+'h '+pad(m%60)+'m'
 function downloadPdf(){
  if(!current||!employeeId)return

  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  const navy=[15,23,42] as const
  const ink=[30,41,59] as const
  const muted=[100,116,139] as const
  const line=[203,213,225] as const
  const soft=[248,250,252] as const
  const blue=[37,99,235] as const
  const green=[22,163,74] as const
  const red=[220,38,38] as const
  const amber=[217,119,6] as const
  const lightBlue=[219,234,254] as const

  const pageW=297
  const margin=8.5
  const contentW=pageW-margin*2
  const competence=new Date(month+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
  const periodLabel=new Date(periodStart+'T12:00:00').toLocaleDateString('pt-BR')+' a '+new Date(periodEnd+'T12:00:00').toLocaleDateString('pt-BR')
  const emitted=new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
  const daysWithMark=calendar.filter(r=>Boolean(r.entrada_1||r.saida_1||r.entrada_2||r.saida_2)).length
  const daysWithoutMark=calendar.length-daysWithMark
  const partial=calendar.filter(r=>{
   const has=Boolean(r.entrada_1||r.saida_1||r.entrada_2||r.saida_2)
   const m=mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2)
   return has&&m<360
  }).length

  const statusLabel=(r:Adjust)=>{
   const has=Boolean(r.entrada_1||r.saida_1||r.entrada_2||r.saida_2)
   return has?r.status:'falta'
  }
  const observation=(r:Adjust)=>{
   const base=r.observacao||(rhidByDate.has(r.data)?'Importado do RHID':'—')
   const has=Boolean(r.entrada_1||r.saida_1||r.entrada_2||r.saida_2)
   const m=mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2)
   if(has&&m<360)return 'Verificar marcações - '+(base==='—'?'RHID':base)
   return base
  }

  const drawHeader=()=>{
   doc.setFillColor(...navy);doc.rect(0,0,pageW,22,'F')
   doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15)
   doc.text('ESPELHO DE PONTO',margin,10.2)
   doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(203,213,225)
   doc.text('Sistema de Gestão | Recursos Humanos',margin,15.5)
   doc.setFont('helvetica','bold');doc.setFontSize(8.7);doc.setTextColor(255,255,255)
   doc.text('Competência: '+competence,pageW-margin,8.7,{align:'right'})
   doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('Período: '+periodLabel,pageW-margin,12.4,{align:'right'})
   doc.setFont('helvetica','normal');doc.setTextColor(203,213,225);doc.setFontSize(8)
   doc.text('Fonte: '+(current.rhid_person_id?'RHID + ajustes':'Ajustes locais'),pageW-margin,15.2,{align:'right'})
  }

  const footer=(page:number,total:number)=>{
   doc.setDrawColor(...line);doc.setLineWidth(.25);doc.line(margin,199,pageW-margin,199)
   doc.setFont('helvetica','normal');doc.setFontSize(7.3);doc.setTextColor(...muted)
   doc.text('Gerado pelo Sistema de Gestão - Dados integrados ao RHID',margin,203.3)
   doc.text('Página '+page+' de '+total,pageW-margin,203.3,{align:'right'})
  }

  const pill=(x:number,y:number,w:number,text:string,status:string)=>{
   if(status==='presente'){doc.setFillColor(220,252,231);doc.setTextColor(...green)}
   else if(status==='falta'){doc.setFillColor(254,226,226);doc.setTextColor(...red)}
   else if(status==='atraso'){doc.setFillColor(254,243,199);doc.setTextColor(...amber)}
   else if(status==='atestado'){doc.setFillColor(224,242,254);doc.setTextColor(3,105,161)}
   else {doc.setFillColor(226,232,240);doc.setTextColor(...ink)}
   doc.roundedRect(x,y-3.1,w,4.2,2.1,2.1,'F')
   doc.setFont('helvetica','bold');doc.setFontSize(7)
   doc.text(text,x+w/2,y-.25,{align:'center'})
  }

  const colX=[12.5,34,45,64,83,102,121,141,158]
  const drawTableHeader=(y:number)=>{
   doc.setFillColor(...navy);doc.roundedRect(margin,y,contentW,7.2,1.6,1.6,'F')
   doc.setFont('helvetica','bold');doc.setFontSize(7.2);doc.setTextColor(255,255,255)
   const hs=['Data','Dia','Entrada 1','Saída 1','Entrada 2','Saída 2','Total','Status','Observação / conferência']
   hs.forEach((h,i)=>doc.text(h,colX[i],y+4.7))
  }

  const drawRows=(rows:Adjust[],yStart:number)=>{
   let y=yStart
   rows.forEach((r,idx)=>{
    const rowH=7.05
    if(idx%2===1){doc.setFillColor(...soft);doc.rect(margin,y,contentW,rowH,'F')}
    doc.setDrawColor(...line);doc.setLineWidth(.18);doc.line(margin,y+rowH,pageW-margin,y+rowH)
    doc.setFont('helvetica','normal');doc.setFontSize(7.25);doc.setTextColor(...ink)
    const values=[
     r.data.split('-').reverse().join('/'),
     weekday(r.data),
     r.entrada_1?.slice(0,5)||'—',
     r.saida_1?.slice(0,5)||'—',
     r.entrada_2?.slice(0,5)||'—',
     r.saida_2?.slice(0,5)||'—',
     hours(r)
    ]
    values.forEach((v,i)=>doc.text(String(v),colX[i],y+4.65))
    const st=statusLabel(r)
    pill(colX[7]-3.5,y+4.25,16,st.charAt(0).toUpperCase()+st.slice(1),st)
    const obs=observation(r)
    const isWarn=obs.startsWith('Verificar marcações')
    doc.setFont('helvetica',isWarn?'bold':'normal');doc.setFontSize(7.1);{const c=isWarn?amber:muted;doc.setTextColor(c[0],c[1],c[2])}
    const clipped=obs.length>42?obs.slice(0,39)+'...':obs
    doc.text(clipped,colX[8],y+4.65)
    y+=rowH
   })
   return y
  }

  drawHeader()

  doc.setDrawColor(...line);doc.setLineWidth(.35);doc.roundedRect(margin,28.5,contentW,17,2.5,2.5)
  const infoXs=[12.5,121.5,176,284]
  doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.setTextColor(...muted)
  doc.text('FUNCIONÁRIO',infoXs[0],33.2)
  doc.text('FONTE',infoXs[1],33.2)
  doc.text('JORNADA CONTRATUAL',infoXs[2],33.2)
  doc.text('EMISSÃO',infoXs[3],33.2,{align:'right'})
  doc.setFont('helvetica','bold');doc.setFontSize(10.2);doc.setTextColor(...ink)
  doc.text(current.nome,infoXs[0],39)
  doc.text(current.rhid_person_id?'RHID + ajustes':'Ajustes locais',infoXs[1],39)
  doc.setTextColor(...green);doc.text(String(Number(current.jornada_semanal_horas||44))+'h por semana (CLT)',infoXs[2],39)
  doc.setTextColor(...ink);doc.text(emitted,infoXs[3],39,{align:'right'})

  const cardY=50,cardW=67.5,cardH=19.5,gap=3.5
  const cards=[
   {x:margin,label:'HORAS TRABALHADAS',value:Math.floor(worked/60)+'h '+pad(worked%60)+'m',note:'Total informado pelo relatório atual',c:blue},
   {x:margin+(cardW+gap),label:'DIAS COM MARCAÇÃO',value:String(daysWithMark),note:'Dias com pelo menos uma marcação',c:green},
   {x:margin+(cardW+gap)*2,label:'SEM MARCAÇÃO',value:String(daysWithoutMark),note:'Classificados como falta no relatório',c:red},
   {x:margin+(cardW+gap)*3,label:'HORAS EXTRAS',value:fmtMinutes(overtimeTotal),note:'Excedente de '+String(Number(current.jornada_semanal_horas||44))+'h por semana',c:amber}
  ]
  cards.forEach(card=>{
   doc.setDrawColor(...line);doc.setFillColor(255,255,255);doc.roundedRect(card.x,cardY,cardW,cardH,2.5,2.5,'FD')
   doc.setFillColor(card.c[0],card.c[1],card.c[2]);doc.roundedRect(card.x,cardY,1.4,cardH,1,1,'F')
   doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.setTextColor(...muted);doc.text(card.label,card.x+4.2,cardY+5)
   doc.setFont('helvetica','bold');doc.setFontSize(14.2);doc.setTextColor(...ink);doc.text(card.value,card.x+4.2,cardY+11.7)
   doc.setFont('helvetica','normal');doc.setFontSize(6.6);doc.setTextColor(...muted);doc.text(card.note,card.x+4.2,cardY+16.5)
  })

  doc.setFillColor(...lightBlue);doc.setDrawColor(147,197,253);doc.roundedRect(margin,73.5,contentW,10.4,2.2,2.2,'FD')
  doc.setFont('helvetica','bold');doc.setFontSize(7.4);doc.setTextColor(30,64,175);doc.text('Leitura gerencial',12.5,77.5)
  doc.setFont('helvetica','normal');doc.setFontSize(7.2)
  doc.text('Jornada CLT considerada: '+String(Number(current.jornada_semanal_horas||44))+'h semanais. O excedente de cada semana é demonstrado como hora extra.',12.5,81.4)

  doc.setFont('helvetica','bold');doc.setFontSize(9.3);doc.setTextColor(...ink)
  const firstRows=calendar.slice(0,16)
  const restRows=calendar.slice(16)
  doc.text('Marcações diárias',margin,88.6)
  doc.setFont('helvetica','normal');doc.setFontSize(7.1);doc.setTextColor(...muted)
  doc.text('Período: '+periodLabel,40,88.6)
  drawTableHeader(91.2)
  drawRows(firstRows,98.4)

  if(restRows.length){
   doc.addPage()
   drawHeader()
   doc.setFont('helvetica','bold');doc.setFontSize(10.2);doc.setTextColor(...ink)
   doc.text('Marcações diárias - continuação',margin,28.5)
   doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(...muted)
   doc.text('Funcionário: '+current.nome+'   |   Competência: '+competence+'   |   Período: '+periodLabel,margin,33.3)
   drawTableHeader(37.2)
   let y=drawRows(restRows,44.4)

   y+=3.5
   doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...ink);doc.text('Demonstrativo de horas extras por semana',margin,y+4)
   y+=7
   doc.setFillColor(...navy);doc.roundedRect(margin,y,contentW,6.5,1.4,1.4,'F')
   doc.setTextColor(255,255,255);doc.setFontSize(7);doc.setFont('helvetica','bold')
   doc.text('Semana',12.5,y+4.2);doc.text('Trabalhadas',112,y+4.2);doc.text('Limite',158,y+4.2);doc.text('Horas extras',205,y+4.2)
   y+=6.5
   weeklySummary.forEach((w,i)=>{
    if(i%2===1){doc.setFillColor(...soft);doc.rect(margin,y,contentW,6,'F')}
    doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(7)
    doc.text(new Date(w.start+'T12:00:00').toLocaleDateString('pt-BR')+' a '+new Date(w.end+'T12:00:00').toLocaleDateString('pt-BR'),12.5,y+4)
    doc.text(fmtMinutes(w.worked),112,y+4);doc.text(fmtMinutes(weeklyLimitMinutes),158,y+4)
    doc.setFont('helvetica','bold');if(w.overtime>0)doc.setTextColor(...amber);doc.text(fmtMinutes(w.overtime),205,y+4);doc.setTextColor(...ink)
    y+=6
   })
   y+=3.5
   doc.setFillColor(248,250,252);doc.setDrawColor(...line);doc.roundedRect(margin,y,contentW,18.2,2.5,2.5,'FD')
   doc.setFont('helvetica','bold');doc.setFontSize(8.4);doc.setTextColor(...ink);doc.text('Resumo de conferência',12.5,y+5)
   doc.setFont('helvetica','normal');doc.setFontSize(7.1);doc.setTextColor(...muted)
   doc.text('Dias com marcação: '+daysWithMark+'    |    Sem marcação: '+daysWithoutMark+'    |    Marcações parciais (<6h): '+partial,12.5,y+10)
   doc.text('Horas extras nas semanas da competência: '+fmtMinutes(overtimeTotal)+' | Limite semanal: '+fmtMinutes(weeklyLimitMinutes)+'.',12.5,y+14.4)

   const sigY=y+27
   const sigs=[
    {x:25,label:'Assinatura do funcionário'},
    {x:117,label:'Responsável pelo RH'},
    {x:209,label:'Data'}
   ]
   sigs.forEach(sig=>{
    doc.setDrawColor(71,85,105);doc.setLineWidth(.25);doc.line(sig.x,sigY,sig.x+67,sigY)
    doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.setTextColor(...muted);doc.text(sig.label,sig.x+33.5,sigY+3.8,{align:'center'})
   })
   footer(2,2)
  }else{
   footer(1,1)
  }

  if(restRows.length){
   doc.setPage(1)
   // sem rodapé na primeira página para manter a mesma densidade visual da demonstração
  }

  doc.save('espelho-ponto-'+current.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+month+'.pdf')
 }
 async function save(){
  if(!editing||!employeeId)return
  setBusy(true);setMessage('')
  const before=editing.id?rows.find(r=>r.id===editing.id)||null:null
  const remote=rhidByDate.get(editing.data)
  const snapshot=remote?{
   entrada_1:remote.entrada_1,saida_1:remote.saida_1,entrada_2:remote.entrada_2,saida_2:remote.saida_2,
   punches:remote.punches.map(p=>({time:p.time,kind:p.kind}))
  }:null
  const payload={
   funcionario_id:employeeId,data:editing.data,
   entrada_1:editing.entrada_1,saida_1:editing.saida_1,entrada_2:editing.entrada_2,saida_2:editing.saida_2,
   status:editing.status,observacao:editing.observacao||null,
   envio_status:'aguardando_envio',envio_erro:null,rhid_snapshot:snapshot,rhid_resposta:null,enviado_em:null,enviado_por:null
  }
  const result=editing.id
   ?await supabase.from('rh_ponto_ajustes').update(payload).eq('id',editing.id).select('*').single()
   :await supabase.from('rh_ponto_ajustes').insert(payload).select('*').single()
  if(result.error){setMessage(result.error.message);setBusy(false);return}
  const saved=result.data as Adjust
  const {data:userData}=await supabase.auth.getUser()
  await supabase.from('rh_ponto_ajustes_historico').insert({
   ajuste_id:saved.id,funcionario_id:employeeId,data:saved.data,acao:editing.id?'editado':'criado',
   antes:before,depois:saved,usuario_id:userData.user?.id||null
  })
  setEditing(null);setMessage('Ajuste salvo e marcado como aguardando envio ao RHID.');await load(true)
  setBusy(false)
 }

 async function sendToRhid(r:Adjust){
  if(!canEdit||!r.id||!current?.rhid_person_id||sendingId)return
  const ok=window.confirm('Deseja enviar ou verificar este ajuste no RHID?\n\nO SG manterá o histórico desta tentativa.')
  if(!ok)return
  setSendingId(r.id);setMessage('')
  try{
   const {data,error}=await supabase.functions.invoke('rhid-proxy',{body:{
    action:'send_adjustment',
    adjustment_id:r.id
   }})
   if(error){
    let detail:unknown=null
    try{detail=await error.context?.json()}catch{}
    throw new Error(detail&&typeof detail==='object'&&'error' in detail?String(detail.error):error.message)
   }
   if(data?.error)throw new Error(String(data.error))
   if(!data?.verified||!data?.attendance_verified||!data?.audit_verified)throw new Error('O RHID ainda não confirmou a releitura e a auditoria.')
   setMessage('Sincronizado: alteração confirmada na apuração e na auditoria do RHID.')
  }catch(e){
   const err=(e as Error)?.message||'Falha no envio ao RHID.'
   setMessage('Não foi possível enviar ao RHID: '+err)
  }finally{setSendingId('');await load(true)}
 }
 return <section className="rhPointMirror">
  <div className="panel rhPointHeader"><div className="employeePickerNav"><button type="button" className="ghost iconOnly" disabled={!activeEmployees.length} onClick={()=>moveEmployee(-1)} aria-label="Funcionário anterior"><ChevronLeft size={18}/></button><label>Funcionário<select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Selecione</option>{activeEmployees.map(e=><option key={e.id} value={e.id}>{e.nome}{e.rhid_person_id?' · RHID':''}</option>)}</select></label><button type="button" className="ghost iconOnly" disabled={!activeEmployees.length} onClick={()=>moveEmployee(1)} aria-label="Próximo funcionário"><ChevronRight size={18}/></button></div><div><span>Horas do período</span><strong>{Math.floor(worked/60)}h {pad(worked%60)}m</strong></div><div><span>Horas extras (44h/sem.)</span><strong>{fmtMinutes(overtimeTotal)}</strong></div><div><span>Fonte</span><strong>{current?.rhid_person_id?'RHID + ajustes':'Ajustes locais'}</strong></div></div>
  {message&&<div className="panel noticePanel">{message}</div>}
  {employeeId&&<article className="panel tablePanel rhOvertimePanel"><div className="panelHead"><div><h3>Demonstrativo de horas extras</h3><p>Regra do SG: jornada CLT de {Number(current?.jornada_semanal_horas||44)}h semanais. O excedente de cada semana é considerado hora extra.</p></div><strong>{fmtMinutes(overtimeTotal)} de HE</strong></div><div className="tableWrap"><table className="rhOvertimeTable"><thead><tr><th>Semana</th><th>Horas trabalhadas</th><th>Limite semanal</th><th>Horas extras</th></tr></thead><tbody>{weeklySummary.map(w=><tr key={w.start}><td>{new Date(w.start+'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(w.end+'T12:00:00').toLocaleDateString('pt-BR')}</td><td>{fmtMinutes(w.worked)}</td><td>{fmtMinutes(weeklyLimitMinutes)}</td><td><strong className={w.overtime>0?'rhOvertimePositive':''}>{fmtMinutes(w.overtime)}</strong></td></tr>)}</tbody></table></div></article>}
  <article className="panel tablePanel"><div className="panelHead"><div><h3>Espelho de ponto do mês</h3><p>Marcações do RHID com possibilidade de ajuste e justificativa por dia.</p></div><div className="rhPointReportActions"><span>{current?.nome||'Selecione um funcionário'}</span><button className="ghost" disabled={!current||!employeeId} onClick={downloadPdf}><FileDown size={15}/>Relatório PDF</button></div></div><div className="tableWrap"><table className="rhPointTable"><thead><tr><th>Dia / Data</th><th>Entrada 1</th><th>Saída 1</th><th>Entrada 2</th><th>Saída 2</th><th>Total</th><th>Status</th><th>Observação</th><th>Envio RHID</th><th>Ação</th></tr></thead><tbody>
   {employeeId?calendar.map(r=><tr key={r.data}><td><strong>{r.data.slice(8,10)}</strong><small className="employeeCategory">{weekday(r.data)}</small></td><td>{r.entrada_1?.slice(0,5)||'—'}</td><td>{r.saida_1?.slice(0,5)||'—'}</td><td>{r.entrada_2?.slice(0,5)||'—'}</td><td>{r.saida_2?.slice(0,5)||'—'}</td><td>{hours(r)}</td><td><span className={'statusBadge rhPoint-'+r.status}>{r.status}</span></td><td>{r.observacao|| (rhidByDate.has(r.data)?'RHID':'—')}</td><td>{r.id?<span className={'statusBadge rhSend-'+(r.envio_status||'local')}>{r.envio_status==='enviado'&&(r.rhid_resposta as {verified?:boolean}|null)?.verified?'Sincronizado':(r.envio_status||'local').replaceAll('_',' ')}</span>:<span className="statusBadge">Original RHID</span>}</td><td><div className="rhRowActions">{canEdit&&<button className="ghost" disabled={Boolean(sendingId)||r.envio_status==='enviando'||pendingVerification(r)} onClick={()=>setEditing({...r})}><Pencil size={14}/>Editar</button>}{canEdit&&r.id&&current?.rhid_person_id&&r.envio_status!=='enviado'&&<button className="ghost rhSendBtn" disabled={Boolean(sendingId)||r.envio_status==='enviando'} onClick={()=>void sendToRhid(r)}>{sendingId===r.id?'Verificando...':pendingVerification(r)?'Verificar no RHID':'Enviar ao RHID'}</button>}</div></td></tr>):<tr><td colSpan={10}>Selecione um funcionário.</td></tr>}
  </tbody></table></div></article>
  {editing&&<div className="employeeEditBackdrop"><div className="panel employeeEditModal rhPointModal"><div className="panelHead"><h3>Editar horário — {editing.data.split('-').reverse().join('/')}</h3><button className="ghost" onClick={()=>setEditing(null)}><X size={16}/></button></div><div className="rhFormGrid">
   <label>Entrada 1<input type="time" value={editing.entrada_1?.slice(0,5)||''} onChange={e=>setEditing({...editing,entrada_1:e.target.value||null})}/></label>
   <label>Saída 1<input type="time" value={editing.saida_1?.slice(0,5)||''} onChange={e=>setEditing({...editing,saida_1:e.target.value||null})}/></label>
   <label>Entrada 2<input type="time" value={editing.entrada_2?.slice(0,5)||''} onChange={e=>setEditing({...editing,entrada_2:e.target.value||null})}/></label>
   <label>Saída 2<input type="time" value={editing.saida_2?.slice(0,5)||''} onChange={e=>setEditing({...editing,saida_2:e.target.value||null})}/></label>
   <label>Status<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value as Adjust['status']})}><option value="presente">Presente</option><option value="atraso">Atraso</option><option value="falta">Falta</option><option value="folga">Folga</option><option value="atestado">Atestado</option></select></label>
   <label className="rhFullWidth">Observação / justificativa<input value={editing.observacao||''} onChange={e=>setEditing({...editing,observacao:e.target.value})} placeholder="Consulta médica, esquecimento de marcação..."/></label>
   <div className="rhPayrollPreview rhFullWidth"><span>Total calculado do dia</span><strong>{hours(editing)}</strong></div>
  </div><div className="formActions"><button className="ghost" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary" disabled={busy} onClick={()=>void save()}><Save size={15}/>Salvar ajuste</button></div></div></div>}
 </section>
}


