import {useEffect,useMemo,useState} from 'react'
import {ChevronLeft,ChevronRight,FileDown,Pencil,RefreshCw,Search,Save,ShieldCheck,X} from 'lucide-react'
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
const isImportedOnly=(r:Adjust)=>r.observacao==='Importado do RHID'&&!Boolean((r.rhid_resposta as {request_sent?:boolean}|null)?.request_sent)
type TimeField='entrada_1'|'saida_1'|'entrada_2'|'saida_2'
const editedTime=(r:Adjust,field:TimeField)=>{
 const snap=(r.rhid_snapshot&&typeof r.rhid_snapshot==='object'?r.rhid_snapshot:{}) as Partial<Record<TimeField,string|null>>
 const before=(snap[field]||'').slice(0,5)
 const after=(r[field]||'').slice(0,5)
 return Boolean(r.id)&&!isImportedOnly(r)&&before!==after
}

export function RhPointMirror({employees,month,canEdit}:{employees:Employee[];month:string;canEdit:boolean}){
 const defaultCycle=month?cycleForMonth(month):{start:'',end:''}
 const [employeeId,setEmployeeId]=useState(''),[rows,setRows]=useState<Adjust[]>([]),[rhidDays,setRhidDays]=useState<RhidDay[]>([]),[editing,setEditing]=useState<Adjust|null>(null),[sendingId,setSendingId]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[rhidValidated,setRhidValidated]=useState<boolean|null>(null),[periodStart,setPeriodStart]=useState(defaultCycle.start),[periodEnd,setPeriodEnd]=useState(defaultCycle.end),[sortKey,setSortKey]=useState<'data'|'entrada_1'|'saida_1'|'entrada_2'|'saida_2'|'total'|'status'|'observacao'|'envio'>('data'),[sortDir,setSortDir]=useState<'asc'|'desc'>('asc')
 const activeEmployees=employees.filter(e=>e.ativo)
 const current=employees.find(e=>e.id===employeeId)
 async function testRhidConnection(){
  setBusy(true);setMessage('')
  try{
   const {data,error}=await supabase.functions.invoke('rhid-proxy',{body:{action:'status'}})
   if(error)throw error
   if(data?.error)throw new Error(String(data.error))
   setRhidValidated(Boolean(data?.configured&&data?.connected!==false))
   setMessage('Conexão com RHID validada.')
  }catch(e){setRhidValidated(false);setMessage('Falha na conexão com RHID: '+((e as Error)?.message||'erro desconhecido'))}
  finally{setBusy(false)}
 }
 async function syncRhid(){
  if(!employeeId){setMessage('Selecione um funcionário.');return}
  await load()
  setRhidValidated(true)
  setMessage('Espelho sincronizado com o RHID.')
 }
 function moveEmployee(direction:-1|1){
  if(!activeEmployees.length)return
  const index=activeEmployees.findIndex(e=>e.id===employeeId)
  const next=index<0?(direction>0?0:activeEmployees.length-1):(index+direction+activeEmployees.length)%activeEmployees.length
  setEmployeeId(activeEmployees[next].id)
 }
 async function load(preserveMessage=false){
  if(!employeeId||!month){setRows([]);setRhidDays([]);return}
  setBusy(true);if(!preserveMessage)setMessage('')
  if(!periodStart||!periodEnd||periodStart>periodEnd){setMessage('Informe um período válido.');setBusy(false);return}
  const start=mondayOf(periodStart),end=sundayOf(periodEnd)
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
 useEffect(()=>{const c=month?cycleForMonth(month):{start:'',end:''};setPeriodStart(c.start);setPeriodEnd(c.end)},[month])
 useEffect(()=>{void load()},[employeeId,month])
 const byDate=useMemo(()=>new Map(rows.map(r=>[r.data,r])),[rows])
 const rhidByDate=useMemo(()=>new Map(rhidDays.map(r=>[r.date,r])),[rhidDays])
 const rhidAdjustedTime=(r:Adjust,field:TimeField)=>{
  const remote=rhidByDate.get(r.data)
  const target=(r[field]||'').slice(0,5)
  if(!remote||!target)return false
  return remote.punches.some(p=>{
   if(p.time!==target)return false
   const raw=p.raw||{}
   const change=String(raw._typeAfdChange??raw.typeAfdChange??'').toUpperCase()
   const reason=String(raw.reason??'').trim()
   const manualWithoutOriginal=Number(raw.idAfd||0)===0&&Number(raw.idAfdChange||0)>0
   return change==='I'||Boolean(reason)||manualWithoutOriginal
  })
 }
 const highlightedTime=(r:Adjust,field:TimeField)=>rhidAdjustedTime(r,field)
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
 const extendedStart=periodStart?mondayOf(periodStart):''
 const extendedEnd=periodEnd?sundayOf(periodEnd):''
 const extendedCalendar=useMemo(()=>periodStart&&periodEnd?dateRange(extendedStart,extendedEnd).map(effectiveRow):[],[periodStart,periodEnd,employeeId,byDate,rhidByDate])
 const calendar=useMemo(()=>periodStart&&periodEnd?dateRange(periodStart,periodEnd).map(effectiveRow):[],[periodStart,periodEnd,employeeId,byDate,rhidByDate])
 const weeklyLimitMinutes=Math.round(Number(current?.jornada_semanal_horas||44)*60)
 const weeklySummary=useMemo(()=>{
  const map=new Map<string,{start:string;end:string;worked:number}>()
  for(const r of calendar){
   const weekStart=mondayOf(r.data),weekEnd=addDays(weekStart,6)
   const displayStart=weekStart<periodStart?periodStart:weekStart
   const displayEnd=weekEnd>periodEnd?periodEnd:weekEnd
   const item=map.get(weekStart)||{start:displayStart,end:displayEnd,worked:0}
   item.worked+=mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2)
   map.set(weekStart,item)
  }
  return [...map.values()].map(w=>({...w,overtime:Math.max(0,w.worked-weeklyLimitMinutes)}))
 },[calendar,weeklyLimitMinutes,periodStart,periodEnd])
 const worked=calendar.reduce((s,r)=>s+mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2),0)
 const overtimeTotal=weeklySummary.reduce((s,w)=>s+w.overtime,0)
 const fmtMinutes=(m:number)=>Math.floor(m/60)+'h '+pad(m%60)+'m'
 const sortValue=(r:Adjust)=>{
  if(sortKey==='data')return r.data
  if(sortKey==='entrada_1'||sortKey==='saida_1'||sortKey==='entrada_2'||sortKey==='saida_2')return r[sortKey]||''
  if(sortKey==='total')return mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2)
  if(sortKey==='status')return r.status
  if(sortKey==='observacao')return r.observacao||(rhidByDate.has(r.data)?'RHID':'')
  if(sortKey==='envio')return !r.id||isImportedOnly(r)?'Original RHID':(r.envio_status||'local')
  return ''
 }
 const sortedCalendar=useMemo(()=>[...calendar].sort((a,b)=>{
  const av=sortValue(a),bv=sortValue(b)
  const result=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'pt-BR',{numeric:true,sensitivity:'base'})
  return sortDir==='asc'?result:-result
 }),[calendar,sortKey,sortDir,rhidByDate])
 const toggleSort=(key:typeof sortKey)=>{if(sortKey===key)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortKey(key);setSortDir('asc')}}
 const sortLabel=(key:typeof sortKey)=>sortKey===key?(sortDir==='asc'?' A–Z':' Z–A'):' A–Z'
 function downloadPdf(){
  if(!current||!employeeId)return

  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
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

  const pageW=210
  const pageH=297
  const margin=8
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
   const base=r.observacao||(rhidByDate.has(r.data)?'RHID':'—')
   const has=Boolean(r.entrada_1||r.saida_1||r.entrada_2||r.saida_2)
   const m=mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2)
   if(has&&m<360)return 'Verificar'
   if(base==='Importado do RHID'||base==='RHID')return 'RHID'
   return base
  }

  const drawHeader=()=>{
   doc.setFillColor(...navy);doc.rect(0,0,pageW,20,'F')
   doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14)
   doc.text('ESPELHO DE PONTO',margin,9)
   doc.setFont('helvetica','normal');doc.setFontSize(7.6);doc.setTextColor(203,213,225)
   doc.text('Sistema de Gestão | Recursos Humanos',margin,14)
   doc.setFont('helvetica','bold');doc.setFontSize(7.6);doc.setTextColor(255,255,255)
   doc.text('Competência: '+competence,pageW-margin,7.3,{align:'right'})
   doc.setFont('helvetica','normal');doc.setFontSize(6.8)
   doc.text('Período: '+periodLabel,pageW-margin,11.6,{align:'right'})
   doc.setTextColor(203,213,225)
   doc.text('Fonte: '+(current.rhid_person_id?'RHID + ajustes':'Ajustes locais'),pageW-margin,15.5,{align:'right'})
  }

  const footer=(page:number,total:number)=>{
   doc.setDrawColor(...line);doc.setLineWidth(.2);doc.line(margin,pageH-10,pageW-margin,pageH-10)
   doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...muted)
   doc.text('Gerado pelo Sistema de Gestão - Dados integrados ao RHID',margin,pageH-5.7)
   doc.text('Página '+page+' de '+total,pageW-margin,pageH-5.7,{align:'right'})
  }

  const pill=(x:number,y:number,w:number,text:string,status:string)=>{
   if(status==='presente'){doc.setFillColor(220,252,231);doc.setTextColor(...green)}
   else if(status==='falta'){doc.setFillColor(254,226,226);doc.setTextColor(...red)}
   else if(status==='atraso'){doc.setFillColor(254,243,199);doc.setTextColor(...amber)}
   else if(status==='atestado'){doc.setFillColor(224,242,254);doc.setTextColor(3,105,161)}
   else {doc.setFillColor(226,232,240);doc.setTextColor(...ink)}
   doc.roundedRect(x,y-2.8,w,3.8,1.9,1.9,'F')
   doc.setFont('helvetica','bold');doc.setFontSize(5.8)
   doc.text(text,x+w/2,y-.2,{align:'center'})
  }

  const colX=[10.5,29,40,57,74,91,108,126,145]
  const drawTableHeader=(y:number)=>{
   doc.setFillColor(...navy);doc.roundedRect(margin,y,contentW,6.4,1.3,1.3,'F')
   doc.setFont('helvetica','bold');doc.setFontSize(5.8);doc.setTextColor(255,255,255)
   const hs=['Data','Dia','Ent. 1','Saí. 1','Ent. 2','Saí. 2','Total','Status','Obs.']
   hs.forEach((h,i)=>doc.text(h,colX[i],y+4.1))
  }

  const drawRows=(rowsToDraw:Adjust[],yStart:number)=>{
   let y=yStart
   rowsToDraw.forEach((r,idx)=>{
    const rowH=6.2
    if(idx%2===1){doc.setFillColor(...soft);doc.rect(margin,y,contentW,rowH,'F')}
    doc.setDrawColor(...line);doc.setLineWidth(.15);doc.line(margin,y+rowH,pageW-margin,y+rowH)
    doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(...ink)
    const values=[
     r.data.split('-').reverse().join('/'),
     weekday(r.data),
     r.entrada_1?.slice(0,5)||'—',
     r.saida_1?.slice(0,5)||'—',
     r.entrada_2?.slice(0,5)||'—',
     r.saida_2?.slice(0,5)||'—',
     hours(r)
    ]
    values.forEach((v,i)=>{
     if(i>=2&&i<=5){
      const field=(['entrada_1','saida_1','entrada_2','saida_2'] as TimeField[])[i-2]
      if(highlightedTime(r,field)){doc.setTextColor(...amber);doc.setFont('helvetica','bold')}
      else {doc.setTextColor(...ink);doc.setFont('helvetica','normal')}
     }else{doc.setTextColor(...ink);doc.setFont('helvetica','normal')}
     doc.text(String(v),colX[i],y+4)
    })
    const st=statusLabel(r)
    pill(colX[7]-2,y+3.7,15,st.charAt(0).toUpperCase()+st.slice(1),st)
    const obs=observation(r)
    const warn=obs==='Verificar'
    doc.setFont('helvetica',warn?'bold':'normal');doc.setFontSize(5.8)
    if(warn)doc.setTextColor(...amber);else doc.setTextColor(...muted)
    const clipped=obs.length>24?obs.slice(0,21)+'...':obs
    doc.text(clipped,colX[8],y+4)
    y+=rowH
   })
   return y
  }

  drawHeader()

  doc.setDrawColor(...line);doc.setLineWidth(.3);doc.roundedRect(margin,25,contentW,20,2,2)
  doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(...muted)
  doc.text('FUNCIONÁRIO',11,30)
  doc.text('FONTE',11,38)
  doc.text('JORNADA',108,30)
  doc.text('EMISSÃO',108,38)
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...ink)
  doc.text(current.nome,11,34.5,{maxWidth:92})
  doc.setFontSize(7.4);doc.text(current.rhid_person_id?'RHID + ajustes':'Ajustes locais',11,42)
  doc.setTextColor(...green);doc.text(String(Number(current.jornada_semanal_horas||44))+'h por semana (CLT)',108,34.5)
  doc.setTextColor(...ink);doc.text(emitted,108,42)

  const cardY=50,cardW=46.8,cardH=18,gap=2.2
  const cards=[
   {x:margin,label:'HORAS TRABALHADAS',value:Math.floor(worked/60)+'h '+pad(worked%60)+'m',c:blue},
   {x:margin+(cardW+gap),label:'DIAS COM MARCAÇÃO',value:String(daysWithMark),c:green},
   {x:margin+(cardW+gap)*2,label:'SEM MARCAÇÃO',value:String(daysWithoutMark),c:red},
   {x:margin+(cardW+gap)*3,label:'HORAS EXTRAS',value:fmtMinutes(overtimeTotal),c:amber}
  ]
  cards.forEach(card=>{
   doc.setDrawColor(...line);doc.setFillColor(255,255,255);doc.roundedRect(card.x,cardY,cardW,cardH,2,2,'FD')
   doc.setFillColor(card.c[0],card.c[1],card.c[2]);doc.roundedRect(card.x,cardY,1.2,cardH,.8,.8,'F')
   doc.setFont('helvetica','normal');doc.setFontSize(5.7);doc.setTextColor(...muted);doc.text(card.label,card.x+3.5,cardY+5)
   doc.setFont('helvetica','bold');doc.setFontSize(11.5);doc.setTextColor(...ink);doc.text(card.value,card.x+3.5,cardY+12.3)
  })

  doc.setFillColor(...lightBlue);doc.setDrawColor(147,197,253);doc.roundedRect(margin,72,contentW,9,1.8,1.8,'FD')
  doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(30,64,175)
  doc.text('Jornada considerada: '+String(Number(current.jornada_semanal_horas||44))+'h semanais. Excedente semanal = hora extra.',11,77.5)

  doc.setFont('helvetica','bold');doc.setFontSize(8.4);doc.setTextColor(...ink)
  doc.text('Marcações diárias',margin,87)
  doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(...muted)
  doc.text(periodLabel,pageW-margin,87,{align:'right'})

  const firstRows=calendar.slice(0,28)
  const restRows=calendar.slice(28)
  drawTableHeader(90)
  drawRows(firstRows,96.4)

  if(restRows.length){
   doc.addPage()
   drawHeader()
   doc.setFont('helvetica','bold');doc.setFontSize(8.4);doc.setTextColor(...ink)
   doc.text('Marcações diárias - continuação',margin,28)
   drawTableHeader(32)
   drawRows(restRows,38.4)
  }

  doc.addPage()
  drawHeader()
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...ink)
  doc.text('Demonstrativo de horas extras por semana',margin,29)
  doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...muted)
  doc.text('Período: '+periodLabel,margin,34)

  let y=40
  doc.setFillColor(...navy);doc.roundedRect(margin,y,contentW,7,1.5,1.5,'F')
  doc.setTextColor(255,255,255);doc.setFontSize(6.3);doc.setFont('helvetica','bold')
  doc.text('Semana',11,y+4.6);doc.text('Trabalhadas',95,y+4.6);doc.text('Limite',132,y+4.6);doc.text('Horas extras',164,y+4.6)
  y+=7
  weeklySummary.forEach((w,i)=>{
   if(i%2===1){doc.setFillColor(...soft);doc.rect(margin,y,contentW,8,'F')}
   doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(6.5)
   doc.text(new Date(w.start+'T12:00:00').toLocaleDateString('pt-BR')+' a '+new Date(w.end+'T12:00:00').toLocaleDateString('pt-BR'),11,y+5)
   doc.text(fmtMinutes(w.worked),95,y+5);doc.text(fmtMinutes(weeklyLimitMinutes),132,y+5)
   doc.setFont('helvetica','bold');if(w.overtime>0)doc.setTextColor(...amber);doc.text(fmtMinutes(w.overtime),164,y+5);doc.setTextColor(...ink)
   y+=8
  })

  y+=6
  doc.setFillColor(248,250,252);doc.setDrawColor(...line);doc.roundedRect(margin,y,contentW,30,2,2,'FD')
  doc.setFont('helvetica','bold');doc.setFontSize(8.2);doc.setTextColor(...ink);doc.text('Resumo de horas',11,y+6)
  doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.setTextColor(...muted)
  doc.text('Horas trabalhadas no período: '+Math.floor(worked/60)+'h '+pad(worked%60)+'m',11,y+12)
  doc.text('Horas extras no período: '+fmtMinutes(overtimeTotal),11,y+17)
  doc.text('Jornada semanal considerada: '+fmtMinutes(weeklyLimitMinutes),11,y+22)
  doc.text('Dias com marcação: '+daysWithMark+' | Sem marcação: '+daysWithoutMark+' | Marcações parciais (<6h): '+partial,11,y+27)

  const sigY=Math.min(y+48,270)
  const sigs=[
   {x:14,label:'Assinatura do funcionário'},
   {x:77,label:'Responsável pelo RH'},
   {x:140,label:'Data'}
  ]
  sigs.forEach(sig=>{
   doc.setDrawColor(71,85,105);doc.setLineWidth(.2);doc.line(sig.x,sigY,sig.x+52,sigY)
   doc.setFont('helvetica','normal');doc.setFontSize(6.3);doc.setTextColor(...muted);doc.text(sig.label,sig.x+26,sigY+3.6,{align:'center'})
  })

  const totalPages=doc.getNumberOfPages()
  for(let p=1;p<=totalPages;p++){doc.setPage(p);footer(p,totalPages)}

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
  <div className="panelHead rhidHead"><div><h3>Espelho de ponto</h3><p>Integração com RHID para conferência e ajustes. Período padrão: dia 26 até dia 25 do mês seguinte.</p></div><div className={'rhidConnection '+(rhidValidated===false?'off':'ok')}><ShieldCheck size={16}/>{rhidValidated===false?'RHID não validado':'RHID validado'}</div></div>

  <div className="panel rhidControls rhPointMirrorControls">
   <div className="employeePickerNav"><button type="button" className="ghost iconOnly" disabled={!activeEmployees.length} onClick={()=>moveEmployee(-1)} aria-label="Funcionário anterior"><ChevronLeft size={18}/></button><label>Funcionário<select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Selecione</option>{activeEmployees.map(e=><option key={e.id} value={e.id}>{e.nome}{e.rhid_person_id?' · RHID':''}</option>)}</select></label><button type="button" className="ghost iconOnly" disabled={!activeEmployees.length} onClick={()=>moveEmployee(1)} aria-label="Próximo funcionário"><ChevronRight size={18}/></button></div>
   <label>De<input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)}/></label>
   <label>Até<input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)}/></label>
   <button className="ghost" disabled={busy} onClick={()=>void testRhidConnection()}><ShieldCheck size={15}/>Testar conexão</button>
   <button className="ghost" disabled={busy||!employeeId} onClick={()=>void syncRhid()}><RefreshCw size={15}/>Sincronizar RHID</button>
   <button className="primary" disabled={busy||!employeeId} onClick={()=>void load()}><Search size={15}/>Consultar espelho</button>
  </div>

  <div className="panel rhPointHeader rhPointSummary"><div><span>Horas do período</span><strong>{Math.floor(worked/60)}h {pad(worked%60)}m</strong></div><div><span>Horas extras (44h/sem.)</span><strong>{fmtMinutes(overtimeTotal)}</strong></div><div><span>Fonte</span><strong>{current?.rhid_person_id?'RHID + ajustes':'Ajustes locais'}</strong></div></div>
  {message&&<div className="panel noticePanel">{message}</div>}
  {employeeId&&<article className="panel tablePanel rhOvertimePanel"><div className="panelHead"><div><h3>Demonstrativo de horas extras</h3><p>Regra do SG: jornada CLT de {Number(current?.jornada_semanal_horas||44)}h semanais. O excedente de cada semana é considerado hora extra.</p></div><strong>{fmtMinutes(overtimeTotal)} de HE</strong></div><div className="tableWrap"><table className="rhOvertimeTable"><thead><tr><th>Semana</th><th>Horas trabalhadas</th><th>Limite semanal</th><th>Horas extras</th></tr></thead><tbody>{weeklySummary.map(w=><tr key={w.start}><td>{new Date(w.start+'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(w.end+'T12:00:00').toLocaleDateString('pt-BR')}</td><td>{fmtMinutes(w.worked)}</td><td>{fmtMinutes(weeklyLimitMinutes)}</td><td><strong className={w.overtime>0?'rhOvertimePositive':''}>{fmtMinutes(w.overtime)}</strong></td></tr>)}</tbody></table></div></article>}
  <article className="panel tablePanel"><div className="panelHead"><div><h3>Espelho de ponto do mês</h3><p>Marcações do RHID com possibilidade de ajuste e justificativa por dia.</p></div><div className="rhPointReportActions"><span>{current?.nome||'Selecione um funcionário'}</span><button className="ghost" disabled={!current||!employeeId} onClick={downloadPdf}><FileDown size={15}/>Relatório PDF</button></div></div><div className="tableWrap"><table className="rhPointTable"><thead><tr><th><button className="rhSortHead" onClick={()=>toggleSort('data')}>Dia / Data{sortLabel('data')}</button></th><th><button className="rhSortHead" onClick={()=>toggleSort('entrada_1')}>Entrada 1{sortLabel('entrada_1')}</button></th><th><button className="rhSortHead" onClick={()=>toggleSort('saida_1')}>Saída 1{sortLabel('saida_1')}</button></th><th><button className="rhSortHead" onClick={()=>toggleSort('entrada_2')}>Entrada 2{sortLabel('entrada_2')}</button></th><th><button className="rhSortHead" onClick={()=>toggleSort('saida_2')}>Saída 2{sortLabel('saida_2')}</button></th><th><button className="rhSortHead" onClick={()=>toggleSort('total')}>Total{sortLabel('total')}</button></th><th><button className="rhSortHead" onClick={()=>toggleSort('status')}>Status{sortLabel('status')}</button></th><th><button className="rhSortHead" onClick={()=>toggleSort('observacao')}>Observação{sortLabel('observacao')}</button></th><th><button className="rhSortHead" onClick={()=>toggleSort('envio')}>Envio RHID{sortLabel('envio')}</button></th><th>Ação</th></tr></thead><tbody>
   {employeeId?sortedCalendar.map(r=><tr key={r.data}><td><strong>{r.data.slice(8,10)}</strong><small className="employeeCategory">{weekday(r.data)}</small></td><td className={highlightedTime(r,'entrada_1')?'rhEditedTime':''}>{r.entrada_1?.slice(0,5)||'—'}</td><td className={highlightedTime(r,'saida_1')?'rhEditedTime':''}>{r.saida_1?.slice(0,5)||'—'}</td><td className={highlightedTime(r,'entrada_2')?'rhEditedTime':''}>{r.entrada_2?.slice(0,5)||'—'}</td><td className={highlightedTime(r,'saida_2')?'rhEditedTime':''}>{r.saida_2?.slice(0,5)||'—'}</td><td>{hours(r)}</td><td><span className={'statusBadge rhPoint-'+r.status}>{r.status}</span></td><td>{r.observacao|| (rhidByDate.has(r.data)?'RHID':'—')}</td><td>{!r.id||isImportedOnly(r)?<span className="statusBadge">Original RHID</span>:<span className={'statusBadge rhSend-'+(r.envio_status||'local')}>{r.envio_status==='enviado'&&(r.rhid_resposta as {verified?:boolean}|null)?.verified?'Sincronizado':(r.envio_status||'local').replaceAll('_',' ')}</span>}</td><td><div className="rhRowActions">{canEdit&&<button className="ghost" disabled={Boolean(sendingId)||r.envio_status==='enviando'||pendingVerification(r)} onClick={()=>setEditing({...r})}><Pencil size={14}/>Editar</button>}{canEdit&&r.id&&!isImportedOnly(r)&&current?.rhid_person_id&&r.envio_status!=='enviado'&&<button className="ghost rhSendBtn" disabled={Boolean(sendingId)||r.envio_status==='enviando'} onClick={()=>void sendToRhid(r)}>{sendingId===r.id?'Verificando...':pendingVerification(r)?'Verificar no RHID':'Enviar ao RHID'}</button>}</div></td></tr>):<tr><td colSpan={10}>Selecione um funcionário.</td></tr>}
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


