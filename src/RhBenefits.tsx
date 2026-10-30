import {useEffect,useMemo,useState} from 'react'
import {Pencil,Save,X} from 'lucide-react'
import {supabase} from './lib/supabase'

type Employee={id:string;nome:string;cargo:string|null;ativo:boolean}
type BenefitRow={id:string;funcionario_id:string;competencia:string;modalidade:'presencial'|'hibrido'|'home_office';dias_uteis:number;salario_base:number;vt_conducoes_dia:number;vt_tarifa:number;vr_tipo:'VR'|'VA'|'FLEX';vr_valor_dia:number;vr_dias_direito:number;observacao:string|null}
const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const monthDate=(m:string)=>m+'-01'
const vtCost=(r:BenefitRow)=>Number(r.dias_uteis)*Number(r.vt_conducoes_dia)*Number(r.vt_tarifa)
const vtDiscount=(r:BenefitRow)=>Math.min(vtCost(r),Number(r.salario_base)*.06)
const vrCost=(r:BenefitRow)=>Number(r.vr_dias_direito)*Number(r.vr_valor_dia)

export function RhBenefits({employees,month,canEdit}:{employees:Employee[];month:string;canEdit:boolean}){
 const [rows,setRows]=useState<BenefitRow[]>([]),[busy,setBusy]=useState(false),[editing,setEditing]=useState<BenefitRow|null>(null),[message,setMessage]=useState('')
 async function load(){
  if(!month){setRows([]);return}
  setBusy(true);setMessage('')
  const {data,error}=await supabase.from('rh_beneficios_mensais').select('*').eq('competencia',monthDate(month)).order('funcionario_id')
  if(error)setMessage(error.message);else setRows((data||[]) as BenefitRow[])
  setBusy(false)
 }
 useEffect(()=>{void load()},[month])
 const byEmployee=useMemo(()=>new Map(rows.map(r=>[r.funcionario_id,r])),[rows])
 const display=employees.filter(e=>e.ativo).map(e=>({employee:e,row:byEmployee.get(e.id)||null}))
 const totalVT=display.reduce((s,x)=>s+(x.row?vtCost(x.row):0),0),totalVR=display.reduce((s,x)=>s+(x.row?vrCost(x.row):0),0)
 const presencial=display.filter(x=>x.row?.modalidade==='presencial').length,hibrido=display.filter(x=>x.row?.modalidade==='hibrido').length,home=display.filter(x=>x.row?.modalidade==='home_office').length
 function open(employee:Employee,row:BenefitRow|null){
  setEditing(row||{id:'',funcionario_id:employee.id,competencia:monthDate(month),modalidade:'presencial',dias_uteis:22,salario_base:0,vt_conducoes_dia:2,vt_tarifa:0,vr_tipo:'VR',vr_valor_dia:0,vr_dias_direito:22,observacao:null})
 }
 async function save(){
  if(!editing)return
  setBusy(true);setMessage('')
  const {id,...body}=editing
  const q=id?supabase.from('rh_beneficios_mensais').update(body).eq('id',id):supabase.from('rh_beneficios_mensais').insert(body)
  const {error}=await q
  if(error)setMessage(error.message);else{setEditing(null);setMessage('Benefício atualizado.');await load()}
  setBusy(false)
 }
 return <section className="rhBenefits">
  <div className="cards compactCards semanticCards rhBenefitCards">
   <article className="card semanticCard semanticBlue"><span>Vale Transporte no mês</span><strong>{money(totalVT)}</strong></article>
   <article className="card semanticCard semanticPositive"><span>VR / VA no mês</span><strong>{money(totalVR)}</strong></article>
   <article className="card semanticCard"><span>Presencial / Híbrido</span><strong>{presencial} / {hibrido}</strong></article>
   <article className="card semanticCard"><span>Home Office</span><strong>{home}</strong></article>
  </div>
  {message&&<div className="panel noticePanel">{message}</div>}
  <article className="panel tablePanel"><div className="panelHead"><div><h3>Apuração de benefícios</h3><p>VT, VR/VA e modalidade de trabalho por competência.</p></div><span>{month||'Selecione uma competência'}</span></div>
   <div className="tableWrap"><table className="rhBenefitsTable"><thead><tr><th>Colaborador</th><th>Modalidade</th><th>Dias úteis</th><th>VT total</th><th>Desconto VT</th><th>VR/VA diário</th><th>VR/VA total</th><th>Líquido a liberar</th><th>Ação</th></tr></thead><tbody>
    {display.map(({employee,row})=><tr key={employee.id}><td><strong>{employee.nome}</strong><small className="employeeCategory">{employee.cargo||'—'}</small></td><td>{row?row.modalidade.replace('_',' '):'Não configurado'}</td><td>{row?.dias_uteis??'—'}</td><td>{row?money(vtCost(row)):'—'}</td><td>{row?money(vtDiscount(row)):'—'}</td><td>{row?money(Number(row.vr_valor_dia)):'—'}</td><td>{row?money(vrCost(row)):'—'}</td><td>{row?money(Math.max(0,vtCost(row)-vtDiscount(row))+vrCost(row)):'—'}</td><td>{canEdit&&<button className="ghost" onClick={()=>open(employee,row)}><Pencil size={14}/>{row?'Ajustar':'Configurar'}</button>}</td></tr>)}
    {!display.length&&<tr><td colSpan={9}>Nenhum funcionário ativo.</td></tr>}
   </tbody></table></div>
  </article>
  {editing&&<div className="employeeEditBackdrop"><div className="panel employeeEditModal rhBenefitModal" role="dialog" aria-modal="true"><div className="panelHead"><h3>Ajustar benefício</h3><button className="ghost" onClick={()=>setEditing(null)}><X size={16}/></button></div><div className="rhFormGrid">
   <label>Modalidade<select value={editing.modalidade} onChange={e=>setEditing({...editing,modalidade:e.target.value as BenefitRow['modalidade']})}><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option><option value="home_office">Home Office</option></select></label>
   <label>Dias úteis<input type="number" min="0" max="31" value={editing.dias_uteis} onChange={e=>setEditing({...editing,dias_uteis:Number(e.target.value)})}/></label>
   <label>Salário base<input type="number" min="0" step="0.01" value={editing.salario_base} onChange={e=>setEditing({...editing,salario_base:Number(e.target.value)})}/></label>
   <label>Conduções por dia<input type="number" min="0" step="0.5" value={editing.vt_conducoes_dia} onChange={e=>setEditing({...editing,vt_conducoes_dia:Number(e.target.value)})}/></label>
   <label>Tarifa VT<input type="number" min="0" step="0.01" value={editing.vt_tarifa} onChange={e=>setEditing({...editing,vt_tarifa:Number(e.target.value)})}/></label>
   <label>Tipo VR/VA<select value={editing.vr_tipo} onChange={e=>setEditing({...editing,vr_tipo:e.target.value as BenefitRow['vr_tipo']})}><option>VR</option><option>VA</option><option>FLEX</option></select></label>
   <label>Valor diário VR/VA<input type="number" min="0" step="0.01" value={editing.vr_valor_dia} onChange={e=>setEditing({...editing,vr_valor_dia:Number(e.target.value)})}/></label>
   <label>Dias de direito<input type="number" min="0" max="31" value={editing.vr_dias_direito} onChange={e=>setEditing({...editing,vr_dias_direito:Number(e.target.value)})}/></label>
   <label className="rhFullWidth">Observação<input value={editing.observacao||''} onChange={e=>setEditing({...editing,observacao:e.target.value})}/></label>
   <div className="rhPayrollPreview rhFullWidth"><span>Total estimado do mês</span><strong>{money(vtCost(editing)+vrCost(editing))}</strong><small>Desconto VT em folha: {money(vtDiscount(editing))}</small></div>
  </div><div className="formActions"><button className="ghost" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary" disabled={busy} onClick={()=>void save()}><Save size={15}/>Salvar benefício</button></div></div></div>}
 </section>
}
