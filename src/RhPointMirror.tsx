import {useEffect,useMemo,useState} from 'react'
import {Pencil,Save,X} from 'lucide-react'
import {supabase} from './lib/supabase'
import {parseRhidAttendance,RhidDay} from './lib/rhid'

type Employee={id:string;nome:string;cargo:string|null;ativo:boolean;rhid_person_id?:number|null}
type Adjust={id:string;funcionario_id:string;data:string;entrada_1:string|null;saida_1:string|null;entrada_2:string|null;saida_2:string|null;status:'presente'|'atraso'|'falta'|'folga'|'atestado';observacao:string|null}
const pad=(n:number)=>String(n).padStart(2,'0')
const daysInMonth=(m:string)=>{const p=m.split('-').map(Number),y=p[0],mo=p[1];return new Date(y,mo,0).getDate()}
const weekday=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'})
function mins(a:string|null,b:string|null){if(!a||!b)return 0;const x=a.split(':').map(Number),y=b.split(':').map(Number);return Math.max(0,(y[0]*60+y[1])-(x[0]*60+x[1]))}
const hours=(r:Adjust)=>{const m=mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2);return Math.floor(m/60)+'h '+pad(m%60)+'m'}

export function RhPointMirror({employees,month,canEdit}:{employees:Employee[];month:string;canEdit:boolean}){
 const [employeeId,setEmployeeId]=useState(''),[rows,setRows]=useState<Adjust[]>([]),[rhidDays,setRhidDays]=useState<RhidDay[]>([]),[editing,setEditing]=useState<Adjust|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const current=employees.find(e=>e.id===employeeId)
 async function load(){
  if(!employeeId||!month){setRows([]);setRhidDays([]);return}
  setBusy(true);setMessage('')
  const start=month+'-01',end=month+'-'+pad(daysInMonth(month))
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
 const calendar=useMemo(()=>month?Array.from({length:daysInMonth(month)},(_,i)=>{
  const d=month+'-'+pad(i+1)
  const local=byDate.get(d)
  const remote=rhidByDate.get(d)
  if(local)return local
  return {
   id:'',funcionario_id:employeeId,data:d,
   entrada_1:remote?.entrada_1||null,
   saida_1:remote?.saida_1||null,
   entrada_2:remote?.entrada_2||null,
   saida_2:remote?.saida_2||null,
   status:(remote?.punches.length?'presente':'presente') as Adjust['status'],
   observacao:remote?.punches.length?'Importado do RHID':null
  }
 }):[],[month,employeeId,byDate,rhidByDate])
 const worked=calendar.reduce((s,r)=>s+mins(r.entrada_1,r.saida_1)+mins(r.entrada_2,r.saida_2),0)
 async function save(){
  if(!editing||!employeeId)return
  setBusy(true);setMessage('')
  const {id,...body}=editing
  const q=id?supabase.from('rh_ponto_ajustes').update(body).eq('id',id):supabase.from('rh_ponto_ajustes').insert(body)
  const {error}=await q
  if(error)setMessage(error.message);else{setEditing(null);setMessage('Ajuste de ponto salvo.');await load()}
  setBusy(false)
 }
 return <section className="rhPointMirror">
  <div className="panel rhPointHeader"><label>Funcionário<select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Selecione</option>{employees.filter(e=>e.ativo).map(e=><option key={e.id} value={e.id}>{e.nome}{e.rhid_person_id?' · RHID':''}</option>)}</select></label><div><span>Horas no mês</span><strong>{Math.floor(worked/60)}h {pad(worked%60)}m</strong></div><div><span>Fonte</span><strong>{current?.rhid_person_id?'RHID + ajustes':'Ajustes locais'}</strong></div></div>
  {message&&<div className="panel noticePanel">{message}</div>}
  <article className="panel tablePanel"><div className="panelHead"><div><h3>Espelho de ponto do mês</h3><p>Marcações do RHID com possibilidade de ajuste e justificativa por dia.</p></div><span>{current?.nome||'Selecione um funcionário'}</span></div><div className="tableWrap"><table className="rhPointTable"><thead><tr><th>Dia / Data</th><th>Entrada 1</th><th>Saída 1</th><th>Entrada 2</th><th>Saída 2</th><th>Total</th><th>Status</th><th>Observação</th><th>Ação</th></tr></thead><tbody>
   {employeeId?calendar.map(r=><tr key={r.data}><td><strong>{r.data.slice(8,10)}</strong><small className="employeeCategory">{weekday(r.data)}</small></td><td>{r.entrada_1?.slice(0,5)||'—'}</td><td>{r.saida_1?.slice(0,5)||'—'}</td><td>{r.entrada_2?.slice(0,5)||'—'}</td><td>{r.saida_2?.slice(0,5)||'—'}</td><td>{hours(r)}</td><td><span className={'statusBadge rhPoint-'+r.status}>{r.status}</span></td><td>{r.observacao|| (rhidByDate.has(r.data)?'RHID':'—')}</td><td>{canEdit&&<button className="ghost" onClick={()=>setEditing({...r})}><Pencil size={14}/>Editar</button>}</td></tr>):<tr><td colSpan={9}>Selecione um funcionário.</td></tr>}
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
