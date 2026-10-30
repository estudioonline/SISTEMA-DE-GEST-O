import {useEffect,useMemo,useState} from 'react'
import {ChevronLeft,ChevronRight,Link2,RefreshCw,Search,ShieldCheck,Users} from 'lucide-react'
import {supabase} from './lib/supabase'
import {parseRhidAttendance} from './lib/rhid'

type Employee={id:string;nome:string;cargo:string|null;ativo:boolean;rhid_person_id?:number|null}
type Person={id:string;name:string;raw:Record<string,unknown>}

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const cycleRange=()=>{
 const now=new Date(),year=now.getFullYear(),month=now.getMonth(),day=now.getDate()
 const start=new Date(year,day>=26?month:month-1,26,12)
 const end=new Date(start.getFullYear(),start.getMonth()+1,25,12)
 const fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
 return {start:fmt(start),end:fmt(end)}
}
const errorMessage=(e:unknown)=>e instanceof Error?e.message:(e as {message?:string})?.message||'Não foi possível concluir.'
const normalize=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()

function arrayFrom(value:unknown):unknown[]{
 if(Array.isArray(value))return value
 if(value&&typeof value==='object'){
  const o=value as Record<string,unknown>
  for(const key of ['data','items','results','persons','pessoas','apuracao','records']){
   if(Array.isArray(o[key]))return o[key] as unknown[]
  }
 }
 return []
}

function personFrom(raw:unknown,index:number):Person{
 const o=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>
 const id=String(o.idPerson??o.id_person??o.personId??o.id??index)
 const name=String(o.name??o.nome??o.fullName??o.full_name??o.description??('Colaborador '+id))
 return {id,name,raw:o}
}

function daysBetween(a:string,b:string){
 const x=new Date(a+'T12:00:00'),y=new Date(b+'T12:00:00')
 return Math.floor((y.getTime()-x.getTime())/86400000)
}

export function RhidAttendance({employees,canEdit,onLinked}:{employees:Employee[];canEdit:boolean;onLinked:()=>Promise<void>}){
 const [configured,setConfigured]=useState<boolean|null>(null)
 const [connectionTested,setConnectionTested]=useState(false)
 const [people,setPeople]=useState<Person[]>([])
 const [selectedEmployee,setSelectedEmployee]=useState('')
 const initialCycle=cycleRange()
 const [start,setStart]=useState(initialCycle.start)
 const [end,setEnd]=useState(initialCycle.end)
 const [search,setSearch]=useState('')
 const [attendance,setAttendance]=useState<unknown>(null)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')

 const activeEmployees=employees.filter(e=>e.ativo)
 const current=employees.find(e=>e.id===selectedEmployee)
 function moveEmployee(direction:-1|1){
  if(!activeEmployees.length)return
  const index=activeEmployees.findIndex(e=>e.id===selectedEmployee)
  const next=index<0?(direction>0?0:activeEmployees.length-1):(index+direction+activeEmployees.length)%activeEmployees.length
  setSelectedEmployee(activeEmployees[next].id)
 }
 const filteredPeople=useMemo(()=>people.filter(p=>normalize(p.name+' '+p.id).includes(normalize(search))),[people,search])

 async function invoke(body:Record<string,unknown>){
  const {data,error}=await supabase.functions.invoke('rhid-proxy',{body})
  if(error)throw error
  if(data?.error)throw new Error(String(data.error))
  return data
 }

 async function check(){
  try{
   const data=await invoke({action:'status'})
   setConfigured(Boolean(data?.configured&&data?.connected!==false));setConnectionTested(Boolean(data?.connected))
   if(data?.connected)setMessage('Conexão com RHID validada.')
  }catch(e){setConfigured(false);setConnectionTested(true);setMessage('Falha na conexão com RHID: '+errorMessage(e))}
 }
 async function testConnection(){
  setBusy(true);setMessage('')
  try{
   const data=await invoke({action:'people'})
   const list=arrayFrom(data).map(personFrom)
   setPeople(list);setConfigured(true);setConnectionTested(true)
   setMessage(`Conexão com RHID validada. ${list.length} colaborador(es) encontrado(s).`)
  }catch(e){
   setConfigured(false);setConnectionTested(true);setMessage('Falha na conexão com RHID: '+errorMessage(e))
  }finally{setBusy(false)}
 }
 async function syncPeople(autoLink=true){
  setBusy(true);setMessage('')
  try{
   const data=await invoke({action:'people'})
   const list=arrayFrom(data).map(personFrom)
   setPeople(list)
   if(!list.length){setMessage('O RHID não retornou colaboradores.');return}
   let linked=0
   if(autoLink&&canEdit){
    for(const employee of employees.filter(e=>e.ativo&&!e.rhid_person_id)){
     const matches=list.filter(p=>normalize(p.name)===normalize(employee.nome))
     if(matches.length===1&&/^\\d+$/.test(matches[0].id)){
      const {error}=await supabase.from('funcionarios').update({rhid_person_id:Number(matches[0].id)}).eq('id',employee.id).is('rhid_person_id',null)
      if(!error)linked++
     }
    }
    if(linked)await onLinked()
   }
   setMessage(linked?`${list.length} colaborador(es) carregado(s) do RHID. ${linked} vínculo(s) automático(s) criado(s) por nome exato.`:`${list.length} colaborador(es) carregado(s) do RHID.`)
  }catch(e){setMessage(errorMessage(e))}
  finally{setBusy(false)}
 }
 async function link(personId:string){
  if(!canEdit||!current)return
  setBusy(true);setMessage('')
  try{
   const {error}=await supabase.from('funcionarios').update({rhid_person_id:Number(personId)}).eq('id',current.id)
   if(error)throw error
   await onLinked()
   setMessage('Funcionário vinculado ao RHID.')
  }catch(e){setMessage(errorMessage(e))}
  finally{setBusy(false)}
 }
 async function loadAttendance(){
  if(!current?.rhid_person_id){setMessage('Vincule este funcionário a um colaborador do RHID primeiro.');return}
  if(!start||!end||start>end){setMessage('Informe um período válido.');return}
  const span=daysBetween(start,end)
  if(span<0||span>89){setMessage('A consulta do RHID aceita período máximo de 90 dias.');return}
  setBusy(true);setMessage('');setAttendance(null)
  try{
   const data=await invoke({action:'attendance',person_id:current.rhid_person_id,start,end})
   setAttendance(data)
  }catch(e){setMessage(errorMessage(e))}
  finally{setBusy(false)}
 }

 useEffect(()=>{void check()},[])
 useEffect(()=>{if(configured===true&&!people.length&&!busy)void syncPeople(true)},[configured])
 useEffect(()=>{setAttendance(null)},[selectedEmployee,start,end])

 const parsedDays=parseRhidAttendance(attendance)
 const isRhidAdjusted=(day:{punches:Array<{time:string;raw:Record<string,unknown>}>},time:string|null)=>{
  if(!time)return false
  return day.punches.some(p=>{
   if(p.time!==time)return false
   const raw=p.raw||{}
   const change=String(raw._typeAfdChange??raw.typeAfdChange??'').toUpperCase()
   return Boolean(Number(raw.idAfdChange||0))||change==='I'||change==='D'||Boolean(raw.reason)
  })
 }

 return <section className="rhidAttendance">
  <div className="panelHead rhidHead"><div><h3>Controle de ponto e presença</h3><p>Consulta operacional das marcações do RHID. Ajustes, justificativas e relatório ficam no Espelho de ponto. Período padrão: dia 26 até dia 25 do mês seguinte.</p></div><div className={'rhidConnection '+(configured?'ok':'off')}><ShieldCheck size={16}/>{configured===null?'Verificando...':configured?(connectionTested?'RHID validado':'Credenciais detectadas'):'RHID não conectado'}</div></div>

  {!configured&&<div className="panel rhidSetupNotice"><strong>Integração preparada, aguardando credenciais do RHID.</strong><span>Cadastre RHID_EMAIL e RHID_PASSWORD nos Secrets das Edge Functions do Supabase. As credenciais não ficam no navegador nem no GitHub.</span></div>}

  <div className="panel rhidControls">
   <div className="employeePickerNav"><button type="button" className="ghost iconOnly" disabled={!activeEmployees.length} onClick={()=>moveEmployee(-1)} aria-label="Funcionário anterior"><ChevronLeft size={18}/></button><label>Funcionário<select value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)}><option value="">Selecione</option>{activeEmployees.map(e=><option key={e.id} value={e.id}>{e.nome}{e.rhid_person_id?' · vinculado':''}</option>)}</select></label><button type="button" className="ghost iconOnly" disabled={!activeEmployees.length} onClick={()=>moveEmployee(1)} aria-label="Próximo funcionário"><ChevronRight size={18}/></button></div>
   <label>De<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label>Até<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   <button className="ghost" disabled={busy||!configured} onClick={()=>void testConnection()}><ShieldCheck size={15}/>Testar conexão</button><button className="ghost" disabled={busy||!configured} onClick={()=>void syncPeople()}><RefreshCw size={15}/>Sincronizar RHID</button>
   <button className="primary" disabled={busy||!configured||!selectedEmployee} onClick={()=>void loadAttendance()}><Search size={15}/>Consultar ponto</button>
  </div>

  {message&&<div className="panel noticePanel" role="status">{message}</div>}

  {current&&!current.rhid_person_id&&<div className="panel rhidLinkPanel"><div><strong>{current.nome}</strong><span>Ainda não vinculado ao RHID</span></div>{canEdit&&<div className="rhidLinkActions"><div className="tableSearch"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar colaborador no RHID"/></div>{filteredPeople.slice(0,8).map(p=><button key={p.id} className="ghost" disabled={busy} onClick={()=>void link(p.id)}><Link2 size={14}/>{p.name}</button>)}</div>}</div>}

  <article className="panel tablePanel rhidAttendanceTable"><div className="panelHead"><h3>Apuração do período</h3><span>{current?.nome||'Selecione um funcionário'}</span></div>
   {parsedDays.length>0?<div className="tableWrap"><table><thead><tr><th>Data</th><th>Entrada 1</th><th>Saída 1</th><th>Entrada 2</th><th>Saída 2</th><th>Batidas</th></tr></thead><tbody>{parsedDays.map(day=><tr key={day.date}><td>{day.date.split('-').reverse().join('/')}</td><td className={isRhidAdjusted(day,day.entrada_1)?'rhEditedTime':''}>{day.entrada_1||'—'}</td><td className={isRhidAdjusted(day,day.saida_1)?'rhEditedTime':''}>{day.saida_1||'—'}</td><td className={isRhidAdjusted(day,day.entrada_2)?'rhEditedTime':''}>{day.entrada_2||'—'}</td><td className={isRhidAdjusted(day,day.saida_2)?'rhEditedTime':''}>{day.saida_2||'—'}</td><td>{day.punches.map(p=>p.time).join(' · ')||'—'}</td></tr>)}</tbody></table></div>:attendance?<div className="rhidEmpty"><Users size={28}/><strong>Nenhuma marcação encontrada</strong><span>O RHID respondeu, mas não retornou batidas reconhecíveis neste período.</span></div>:<div className="rhidEmpty"><Users size={28}/><strong>Nenhum ponto consultado</strong><span>Selecione um funcionário vinculado e consulte um período.</span></div>}
  </article>
 </section>
}
