import {useEffect,useState} from 'react'
import type {FormEvent} from 'react'
import {Plus,Users,WalletCards} from 'lucide-react'
import {supabase} from './lib/supabase'
import {readAllRows} from './lib/readAllRows'

type Employee={id:string;nome:string;cargo:string|null;ativo:boolean}
export type EmployeeTitle={id:string;funcionario_id?:string|null;tipo_funcionario?:'gasto'|'vale'|null;competencia?:string|null;vale_descontado_em?:string|null;descricao:string;categoria:string|null;vencimento:string;valor:number;valor_pago:number;status:string}
const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`} 
const date=(v:string)=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'—'
const categories=['Salário','Bônus','13º salário','Férias','Encargos','Benefícios','Outros']

export function EmployeeFinance<T extends EmployeeTitle>({kind,titles,canEdit,onChanged,onOpen}:{kind:'gasto'|'vale';titles:T[];canEdit:boolean;onChanged:()=>Promise<void>;onOpen:(title:T)=>void}){
 const [employees,setEmployees]=useState<Employee[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 const [month,setMonth]=useState(()=>today().slice(0,7)),[employee,setEmployee]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState('todos')
 const [form,setForm]=useState(false),[employeeForm,setEmployeeForm]=useState(false)
 async function load(){
  const r=await readAllRows<Employee>((from,to)=>supabase.from('funcionarios').select('*').order('nome').order('id').range(from,to))
  if(r.error)setError(r.error.message);else setEmployees(r.data||[])
 }
 useEffect(()=>{void load()},[])
 useEffect(()=>{setForm(false);setEmployeeForm(false);setError('');setNotice('');setStatus('todos')},[kind])
 async function createEmployee(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!canEdit||busy)return
  const f=new FormData(e.currentTarget),nome=String(f.get('nome')||'').trim()
  if(!nome){setError('Informe o nome do funcionário.');return}
  setBusy(true);setError('');setNotice('')
  try{const r=await supabase.from('funcionarios').insert({nome,cargo:String(f.get('cargo')||'').trim()||null}).select().single();if(r.error)throw r.error;await load();setEmployee(r.data.id);setEmployeeForm(false);setNotice('Funcionário cadastrado.')}catch(e){setError(e instanceof Error?e.message:(e as {message:string}).message)}finally{setBusy(false)}
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!canEdit||busy)return
  const f=new FormData(e.currentTarget),person=employees.find(p=>p.id===f.get('funcionario_id')),value=Number(f.get('valor'))
  if(!person||!Number.isFinite(value)||value<=0){setError('Informe o funcionário e um valor maior que zero.');return}
  setBusy(true);setError('');setNotice('')
  try{
   const r=await supabase.from('titulos_financeiros').insert({tipo:'pagar',funcionario_id:person.id,tipo_funcionario:kind,competencia:String(f.get('competencia'))+'-01',descricao:String(f.get('descricao')||'').trim(),entidade_nome:person.nome,categoria:kind==='vale'?'Vale de funcionário':String(f.get('categoria')),centro_custo:'Funcionários',vencimento:f.get('vencimento'),valor:value,valor_pago:0,status:'aberto'})
   if(r.error)throw r.error
   await onChanged();setForm(false);setNotice('Lançamento salvo em contas a pagar. Abra “Pagamentos / detalhes” para registrar o pagamento.')
  }catch(e){setError((e as {message:string}).message)}finally{setBusy(false)}
 }
 async function discount(t:T){
  if(!canEdit||busy)return
  if(!window.confirm(t.vale_descontado_em?'Desfazer a marcação de desconto deste vale?':'Confirmar que este vale já foi descontado na folha? A marcação não gera outro pagamento.'))return
  setBusy(true);setError('');setNotice('')
  try{const r=await supabase.from('titulos_financeiros').update({vale_descontado_em:t.vale_descontado_em?null:today()}).eq('id',t.id).eq('tipo_funcionario','vale').select('id');if(r.error)throw r.error;if(!r.data?.length)throw new Error('Registro não atualizado. Verifique sua permissão.');await onChanged();setNotice(t.vale_descontado_em?'Desconto desfeito.':'Vale marcado como descontado.')}catch(e){setError((e as {message:string}).message)}finally{setBusy(false)}
 }
 const rows=titles.filter(t=>t.tipo_funcionario===kind).filter(t=>!month||t.competencia?.slice(0,7)===month).filter(t=>!employee||t.funcionario_id===employee).filter(t=>status==='todos'||(status==='descontado'?!!t.vale_descontado_em:status==='a_descontar'?t.status==='pago'&&!t.vale_descontado_em:t.status===status)).filter(t=>`${employees.find(p=>p.id===t.funcionario_id)?.nome||''} ${t.descricao} ${t.categoria||''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
 const valid=rows.filter(t=>t.status!=='cancelado'),total=valid.reduce((s,t)=>s+Number(t.valor),0),paid=valid.reduce((s,t)=>s+Number(t.valor_pago),0),undiscounted=valid.filter(t=>!t.vale_descontado_em).reduce((s,t)=>s+Number(t.valor_pago),0)
 return <div className="employeeFinance">
  <div className="panelHead"><div><h2>{kind==='gasto'?'Gastos com funcionários':'Vales de funcionários'}</h2><p>{kind==='gasto'?'Controle salários, bônus, férias, 13º e demais despesas por funcionário.':'Acompanhe os adiantamentos pagos e o desconto na folha.'}</p></div>{canEdit&&<div className="rowActions"><button className="ghost" onClick={()=>setEmployeeForm(v=>!v)}><Users size={16}/>Cadastrar funcionário</button><button className="primary" onClick={()=>setForm(v=>!v)}><Plus size={16}/>{kind==='gasto'?'Novo gasto':'Novo vale'}</button></div>}</div>
  {error&&<div className="panel noticePanel" role="alert">{error}</div>}{notice&&<div className="panel noticePanel" role="status">{notice}</div>}
  {employeeForm&&canEdit&&<form className="panel employeeForm" onSubmit={e=>void createEmployee(e)}><h3>Cadastrar funcionário</h3><label>Nome<input name="nome" required maxLength={120}/></label><label>Cargo<input name="cargo" maxLength={100}/></label><div className="formActions"><button className="ghost" type="button" onClick={()=>setEmployeeForm(false)}>Cancelar</button><button className="primary" disabled={busy}>Salvar funcionário</button></div></form>}
  {form&&canEdit&&<form key={kind} className="panel employeeForm" onSubmit={e=>void save(e)}><h3>{kind==='gasto'?'Novo gasto com funcionário':'Novo vale de funcionário'}</h3><label>Funcionário<select name="funcionario_id" required defaultValue={employee}><option value="">Selecione</option>{employees.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome}{p.cargo?' · '+p.cargo:''}</option>)}</select></label>{!employees.length&&<p>Cadastre um funcionário para começar.</p>}
   {kind==='gasto'&&<label>Categoria<select name="categoria">{categories.map(c=><option key={c}>{c}</option>)}</select></label>}
   <label>Descrição<input name="descricao" required maxLength={200} placeholder={kind==='vale'?'Ex.: Adiantamento salarial':'Ex.: Salário líquido de novembro'}/></label><label>Competência<input type="month" name="competencia" required defaultValue={month||today().slice(0,7)}/></label><label>Vencimento / data prevista<input type="date" name="vencimento" required defaultValue={today()}/></label><label>Valor (R$)<input name="valor" type="number" min="0.01" step="0.01" max="999999999" required/></label>
   <p className="employeeHelp">{kind==='gasto'?'Ao lançar salário, informe o valor líquido após descontar os vales, para não duplicar a saída de caixa.':'O vale será uma conta a pagar. Depois do pagamento, marque o desconto quando ele for abatido na folha.'}</p><div className="formActions"><button type="button" className="ghost" onClick={()=>setForm(false)}>Cancelar</button><button className="primary" disabled={busy||!employees.length}>{busy?'Salvando…':'Salvar lançamento'}</button></div></form>}
  <div className="panel employeeFilters"><label>Competência<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Funcionário<select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">Todos os funcionários</option>{employees.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}><option value="todos">Todas</option><option value="aberto">Em aberto</option><option value="parcial">Parcial</option><option value="pago">Pago</option>{kind==='vale'&&<><option value="a_descontar">Pago, a descontar</option><option value="descontado">Descontado</option></>}<option value="cancelado">Cancelado</option></select></label><label>Pesquisar<input type="search" value={search} placeholder="Nome, descrição ou categoria" onChange={e=>setSearch(e.target.value)}/></label><button className="ghost" onClick={()=>{setMonth('');setEmployee('');setStatus('todos');setSearch('')}}>Limpar filtros</button></div>
  <div className="cards compactCards semanticCards"><article className="card semanticCard semanticBlue"><span>Total lançado</span><strong>{money(total)}</strong><small>cancelados excluídos</small></article><article className="card semanticCard semanticPositive"><span>Total pago</span><strong>{money(paid)}</strong></article><article className="card semanticCard semanticNegative"><span>A pagar</span><strong>{money(total-paid)}</strong></article>{kind==='vale'&&<article className="card semanticCard"><span>Pago, a descontar na folha</span><strong>{money(undiscounted)}</strong><small>inclui pagamentos parciais</small></article>}</div>
  <article className="panel tablePanel"><div className="panelHead"><h3>{rows.length} lançamento(s)</h3><span>Os mesmos registros aparecem em Contas a pagar.</span></div><div className="tableWrap"><table><thead><tr><th>Funcionário</th><th>Descrição</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Saldo</th><th>Situação</th>{kind==='vale'&&<th>Desconto na folha</th>}<th>Ações</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td>{employees.find(p=>p.id===t.funcionario_id)?.nome||'Funcionário'}</td><td>{t.descricao}<small className="employeeCategory">{t.categoria}</small></td><td>{t.competencia?.slice(0,7).split('-').reverse().join('/')||'—'}</td><td>{date(t.vencimento)}</td><td>{money(Number(t.valor))}</td><td>{money(Number(t.valor_pago))}</td><td>{money(Math.max(0,Number(t.valor)-Number(t.valor_pago)))}</td><td>{({aberto:'Em aberto',parcial:'Parcial',pago:'Pago',cancelado:'Cancelado'} as Record<string,string>)[t.status]}</td>{kind==='vale'&&<td>{t.vale_descontado_em?`Descontado em ${date(t.vale_descontado_em)}`:'A descontar'}{canEdit&&t.status==='pago'&&<button className="ghost" disabled={busy} onClick={()=>void discount(t)}>{t.vale_descontado_em?'Desfazer desconto':'Marcar descontado'}</button>}</td>}<td>{canEdit?<button className="ghost" onClick={()=>onOpen(t)}><WalletCards size={15}/>Pagamentos / detalhes</button>:<span>Somente leitura</span>}</td></tr>)}{!rows.length&&<tr><td colSpan={kind==='vale'?10:9}>Nenhum lançamento com estes filtros.</td></tr>}</tbody></table></div></article>
 </div>
}
