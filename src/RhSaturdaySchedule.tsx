import {useEffect,useMemo,useState} from 'react'
import {Save,Trash2} from 'lucide-react'
import {supabase} from './lib/supabase'

type Employee={id:string;nome:string;cargo:string|null;ativo:boolean;rhid_person_id?:number|null}
type Row={id:string;funcionario_id:string;data:string;trabalha:boolean;entrada_prevista:string|null;saida_prevista:string|null;observacao:string|null;rhid_shift_id?:number|null;rhid_shift_nome?:string|null;sync_status?:string|null;sync_erro?:string|null;sincronizado_em?:string|null}

const pad=(n:number)=>String(n).padStart(2,'0')
const saturdays=(month:string)=>{
 const [y,m]=month.split('-').map(Number)
 const out:string[]=[]
 const d=new Date(y,m-1,1,12)
 while(d.getMonth()===m-1){
  if(d.getDay()===6)out.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`)
  d.setDate(d.getDate()+1)
 }
 return out
}
const brDate=(v:string)=>new Date(v+'T12:00:00').toLocaleDateString('pt-BR')
type Shift={id:number;name:string}
function parseShifts(value:unknown):Shift[]{
 const root=(value&&typeof value==='object'?value:{}) as Record<string,unknown>
 const list=(Array.isArray(value)?value:Array.isArray(root.data)?root.data:Array.isArray(root.items)?root.items:Array.isArray(root.records)?root.records:[]) as Record<string,unknown>[]
 return list.map((o,i)=>({id:Number(o.id??o.idShift??i),name:String(o.description??o.name??o.codigo??('Escala '+String(o.id??i)))})).filter(x=>Number.isFinite(x.id)&&x.id>0)
}

export function RhSaturdaySchedule({employees,month,canEdit}:{employees:Employee[];month:string;canEdit:boolean}){
 const [rows,setRows]=useState<Row[]>([]),[shifts,setShifts]=useState<Shift[]>([]),[workShift,setWorkShift]=useState(''),[offShift,setOffShift]=useState(''),[selectedDate,setSelectedDate]=useState(''),[selected,setSelected]=useState<Record<string,boolean>>({}),[entrada,setEntrada]=useState('08:00'),[saida,setSaida]=useState('12:00'),[observacao,setObservacao]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const dates=useMemo(()=>saturdays(month),[month])
 useEffect(()=>{if(!selectedDate||!dates.includes(selectedDate))setSelectedDate(dates[0]||'')},[month,dates])
 async function load(){
  if(!month){setRows([]);return}
  const start=month+'-01'
  const [y,m]=month.split('-').map(Number)
  const end=`${month}-${pad(new Date(y,m,0).getDate())}`
  const {data,error}=await supabase.from('rh_escala_sabados').select('*').gte('data',start).lte('data',end).order('data')
  if(error)setMessage(error.message);else setRows((data||[]) as Row[])
 }
 useEffect(()=>{void load()},[month])

 const currentRows=rows.filter(r=>r.data===selectedDate)
 const currentIds=new Set(currentRows.filter(r=>r.trabalha).map(r=>r.funcionario_id))
 useEffect(()=>{
  const next:Record<string,boolean>={}
  for(const e of employees.filter(e=>e.ativo))next[e.id]=currentIds.has(e.id)
  setSelected(next)
 },[selectedDate,rows,employees.length])

 async function save(){
  if(!canEdit||!selectedDate)return
  setBusy(true);setMessage('')
  const active=employees.filter(e=>e.ativo)
  const payload=active.map(e=>({
   funcionario_id:e.id,data:selectedDate,trabalha:Boolean(selected[e.id]),
   entrada_prevista:selected[e.id]?entrada:null,saida_prevista:selected[e.id]?saida:null,
   observacao:selected[e.id]?(observacao||null):null,atualizado_em:new Date().toISOString()
  }))
  const {error}=await supabase.from('rh_escala_sabados').upsert(payload,{onConflict:'funcionario_id,data'})
  if(error)setMessage(error.message);else{setMessage('Escala de sábado salva.');await load()}
  setBusy(false)
 }
 async function clearDay(){
  if(!canEdit||!selectedDate||!window.confirm('Limpar toda a escala deste sábado?'))return
  setBusy(true)
  const {error}=await supabase.from('rh_escala_sabados').delete().eq('data',selectedDate)
  if(error)setMessage(error.message);else{setMessage('Escala removida.');await load()}
  setBusy(false)
 }
 const count=Object.values(selected).filter(Boolean).length
 return <section className="rhSaturdaySchedule">
  <div className="cards compactCards semanticCards">
   <article className="card semanticCard semanticBlue"><span>Sábado selecionado</span><strong>{selectedDate?brDate(selectedDate):'—'}</strong></article>
   <article className="card semanticCard semanticPositive"><span>Escalados</span><strong>{count}</strong></article>
   <article className="card semanticCard"><span>Horário previsto</span><strong>{count?entrada+' - '+saida:'—'}</strong></article>
  </div>

  {message&&<div className="panel noticePanel">{message}</div>}

  <div className="panel rhSaturdayToolbar">
   <label>Sábado<select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}>{dates.map(d=><option key={d} value={d}>{brDate(d)}</option>)}</select></label>
   <label>Entrada prevista<input type="time" value={entrada} onChange={e=>setEntrada(e.target.value)}/></label>
   <label>Saída prevista<input type="time" value={saida} onChange={e=>setSaida(e.target.value)}/></label>
   <label className="rhSaturdayNote">Observação<input value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Ex.: inventário, plantão, rota..."/></label>
   {canEdit&&<div className="rowActions"><button className="ghost" disabled={busy||!selectedDate} onClick={()=>void clearDay()}><Trash2 size={15}/>Limpar</button><button className="primary" disabled={busy||!selectedDate} onClick={()=>void save()}><Save size={15}/>Salvar escala</button></div>}
  </div>

  <article className="panel tablePanel">
   <div className="panelHead"><div><h3>Quem trabalha no sábado</h3><p>Marque os funcionários previstos para trabalhar no sábado selecionado.</p></div><span>{count} escalado(s)</span></div>
   <div className="tableWrap"><table className="rhSaturdayTable"><thead><tr><th>Trabalha</th><th>Funcionário</th><th>Cargo</th><th>Horário</th><th>Observação</th></tr></thead><tbody>
    {employees.filter(e=>e.ativo).map(e=>{
     const row=currentRows.find(r=>r.funcionario_id===e.id)
     const checked=Boolean(selected[e.id])
     return <tr key={e.id}><td><input type="checkbox" checked={checked} disabled={!canEdit} onChange={ev=>setSelected(prev=>({...prev,[e.id]:ev.target.checked}))}/></td><td><strong>{e.nome}</strong></td><td>{e.cargo||'—'}</td><td>{checked?(row?.entrada_prevista?.slice(0,5)||entrada)+' - '+(row?.saida_prevista?.slice(0,5)||saida):'Folga'}</td><td>{checked?(row?.observacao||observacao||'—'):'—'}</td></tr>
    })}
   </tbody></table></div>
  </article>
 </section>
}
