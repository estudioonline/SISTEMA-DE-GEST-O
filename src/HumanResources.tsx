import {useEffect,useRef,useState} from 'react'
import type {FormEvent} from 'react'
import {FileDown,Pencil,Plus,RefreshCw,ReceiptText,Trash2,Users,WalletCards,X} from 'lucide-react'
import {supabase} from './lib/supabase'
import {readAllRows} from './lib/readAllRows'
import {calculatePayroll,calculateAutomaticPayroll2026,calculate13thAvos,calculateHrEntitlements,cents,hrSectionForTitle,summarizeHr} from './lib/hr'
import type {HrSection,HrTitle} from './lib/hr'
import type {EmployeeTitle} from './EmployeeFinance'
import type {InvoiceCompany} from './lib/invoicePdf'
import {RhidAttendance} from './RhidAttendance'
import {RhPointMirror} from './RhPointMirror'
import {RhBenefits} from './RhBenefits'
import {RhSaturdaySchedule} from './RhSaturdaySchedule'
import {SearchableSelect} from './SearchableSelect'

type Employee={id:string;nome:string;cargo:string|null;ativo:boolean;rhid_person_id?:number|null;regime_trabalho?:string|null;jornada_semanal_horas?:number|null;salario_base?:number|null;data_admissao?:string|null;dependentes_ir?:number|null;fgts_aliquota?:number|null;bonus_assiduidade_previsto?:number|null}
type Title=EmployeeTitle&HrTitle
type PayrollImported={id:string;funcionario_id:string;competencia:string;salario_base:number;total_proventos:number;total_descontos:number;salario_liquido:number;base_fgts:number;fgts_recolher:number;base_inss:number;base_irrf:number;observacao:string|null;fonte:string}
type PayrollForecast={id:string;funcionario_id:string;competencia:string;salario_base:number;bonus_assiduidade:number;bruto_previsto:number;inss_previsto:number;irrf_previsto:number;fgts_previsto:number;liquido_previsto:number;status:string;observacao:string|null}
const tabs:[HrSection,string][]=[['geral','Visão geral'],['funcionarios','Funcionários'],['folha','Folha salarial'],['fgts','FGTS'],['decimo','13º salário'],['ferias','Férias'],['vales','Vales'],['ponto','Ponto e presença'],['espelho','Espelho de ponto'],['escala_sabado','Escala de sábado'],['beneficios','Benefícios']]
const categories=['Salário','Bônus','13º salário','FGTS','Férias','Encargos','Benefícios','Outros','Vale de funcionário']
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const date=(value:string)=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR'):'—'
const addMonths=(value:string,months:number)=>{const [year,month,day]=value.split('-').map(Number),d=new Date(year,month-1+months,1,12);const last=new Date(d.getFullYear(),d.getMonth()+1,0,12).getDate();d.setDate(Math.min(day,last));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const monthEnd=(value:string)=>{const [year,month]=value.split('-').map(Number);const d=new Date(year,month,0,12);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const errorMessage=(error:unknown)=>error instanceof Error?error.message:(error as {message?:string})?.message||'Não foi possível concluir. Atualize e tente novamente.'
const statusLabel:Record<string,string>={aberto:'Em aberto',parcial:'Parcial',pago:'Pago',cancelado:'Cancelado'}

export function HumanResources<T extends Title>({titles,canEdit,company,onChanged,onOpen}:{titles:T[];canEdit:boolean;company:InvoiceCompany|null;onChanged:()=>Promise<void>;onOpen:(title:T)=>void}){
 const [section,setSection]=useState<HrSection>('geral'),[employees,setEmployees]=useState<Employee[]>([])
 const [month,setMonth]=useState(()=>today().slice(0,7)),[employee,setEmployee]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState('todos')
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true)
 const [personForm,setPersonForm]=useState<{person:Employee|null}|null>(null),[entryForm,setEntryForm]=useState<{title:T|null}|null>(null)
 const [category,setCategory]=useState('Salário'),[formEmployee,setFormEmployee]=useState(''),[detailed,setDetailed]=useState(true)
 const [gross,setGross]=useState(''),[deductions,setDeductions]=useState('0'),[advances,setAdvances]=useState('0'),[installments,setInstallments]=useState(1)
 const [selected,setSelected]=useState<Record<string,boolean>>({}),[bulkPaymentDate,setBulkPaymentDate]=useState(today())
 const [payrollImported,setPayrollImported]=useState<PayrollImported[]>([])
 const [payrollForecast,setPayrollForecast]=useState<PayrollForecast[]>([])
 const [personSalaryPreview,setPersonSalaryPreview]=useState(()=>String(personForm?.person?.salario_base??''))
 const [personBonusPreview,setPersonBonusPreview]=useState(()=>String(personForm?.person?.bonus_assiduidade_previsto??0))
 const [personAdmissionPreview,setPersonAdmissionPreview]=useState(()=>personForm?.person?.data_admissao||'')
 const [personFgtsPreview,setPersonFgtsPreview]=useState(()=>String(personForm?.person?.fgts_aliquota??8))
 const saving=useRef(false),loadSequence=useRef(0)
 const heading=useRef<HTMLHeadingElement>(null)
 async function load(){
  const sequence=++loadSequence.current
  setLoading(true)
  try{
   const r=await readAllRows<Employee>((from,to)=>supabase.from('funcionarios').select('id,nome,cargo,ativo,rhid_person_id,regime_trabalho,jornada_semanal_horas,salario_base,data_admissao,dependentes_ir,fgts_aliquota,bonus_assiduidade_previsto').order('nome').order('id').range(from,to))
   if(sequence!==loadSequence.current)return
   if(r.error)throw r.error
   setEmployees(r.data||[])
  }catch(e){if(sequence===loadSequence.current){setEmployees([]);setError(errorMessage(e))}}
  finally{if(sequence===loadSequence.current)setLoading(false)}
 }
 useEffect(()=>{void load();return()=>{loadSequence.current++}},[])
 useEffect(()=>{
  let cancelled=false
  async function loadPayroll(){
   if(!month){setPayrollImported([]);return}
   const r=await readAllRows<PayrollImported>((from,to)=>supabase.from('rh_folha_mensal').select('*').eq('competencia',month+'-01').order('funcionario_id').range(from,to))
   if(cancelled)return
   if(r.error){setPayrollImported([]);return}
   setPayrollImported((r.data||[]).filter(row=>!employee||row.funcionario_id===employee))
  }
  if(section==='folha'||section==='fgts')void loadPayroll()
  return()=>{cancelled=true}
 },[section,month,employee])
 useEffect(()=>{
  let cancelled=false
  async function loadForecast(){
   if(!month||section!=='folha'){setPayrollForecast([]);return}
   const r=await readAllRows<PayrollForecast>((from,to)=>supabase.from('rh_previsao_mensal').select('*').eq('competencia',month+'-01').order('funcionario_id').range(from,to))
   if(cancelled)return
   if(r.error){setPayrollForecast([]);return}
   setPayrollForecast((r.data||[]).filter(row=>!employee||row.funcionario_id===employee))
  }
  void loadForecast()
  return()=>{cancelled=true}
 },[section,month,employee])
 useEffect(()=>{if(!canEdit){setEntryForm(null);setPersonForm(null)}},[canEdit])
 useEffect(()=>{
  if(!personForm)return
  setPersonSalaryPreview(String(personForm.person?.salario_base??''))
  setPersonBonusPreview(String(personForm.person?.bonus_assiduidade_previsto??0))
  setPersonAdmissionPreview(personForm.person?.data_admissao||'')
  setPersonFgtsPreview(String(personForm.person?.fgts_aliquota??8))
 },[personForm])
 useEffect(()=>{heading.current?.focus()},[section])
 useEffect(()=>{
  if(!entryForm&&!personForm)return
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!saving.current){setEntryForm(null);setPersonForm(null)}}
  window.addEventListener('keydown',escape)
  return()=>window.removeEventListener('keydown',escape)
 },[entryForm,personForm])
 const rows=titles.filter(t=>hrSectionForTitle(t)!==null)
  .filter(t=>section==='geral'||section==='funcionarios'||section==='ponto'||section==='espelho'||section==='escala_sabado'||section==='beneficios'||hrSectionForTitle(t)===section)
  .filter(t=>!month||t.competencia?.slice(0,7)===month)
  .filter(t=>!employee||t.funcionario_id===employee)
  .filter(t=>status==='todos'||(status==='a_descontar'?t.tipo_funcionario==='vale'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0&&!t.vale_descontado_em:status==='descontado'?!!t.vale_descontado_em:t.status===status))
  .filter(t=>`${employees.find(p=>p.id===t.funcionario_id)?.nome||''} ${t.descricao} ${t.categoria||''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
 const selectedRows=rows.filter(t=>selected[t.id])
 const selectableRows=rows.filter(t=>t.status!=='cancelado')
 const allRowsSelected=selectableRows.length>0&&selectableRows.every(t=>selected[t.id])
 const summary=summarizeHr(rows)
 const visibleEmployees=employees.filter(p=>(!employee||p.id===employee)&&`${p.nome} ${p.cargo||''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
 const payrollCategory=category==='Salário'||category==='13º salário'
 let payroll:ReturnType<typeof calculatePayroll>|null=null,previewError=''
 if(entryForm&&payrollCategory&&detailed){try{payroll=calculatePayroll(gross,deductions,advances)}catch(e){previewError=errorMessage(e)}}
 const selectedEmployee=employees.find(p=>p.id===formEmployee)
 const automaticPreview=selectedEmployee&&Number(gross)>0?calculateAutomaticPayroll2026(Number(gross),Number(selectedEmployee.dependentes_ir||0),0,Number(advances||0),Number(selectedEmployee.fgts_aliquota||8)):null
 const personRemunerationPreview=Math.max(0,Number(personSalaryPreview||0))+Math.max(0,Number(personBonusPreview||0))
 const personEntitlementsPreview=calculateHrEntitlements(personRemunerationPreview,personAdmissionPreview||null,Number(personFgtsPreview||8),new Date())
 const outstandingAdvances=titles.filter(t=>t.funcionario_id===formEmployee&&t.tipo_funcionario==='vale'&&t.status!=='cancelado'&&!t.vale_descontado_em).reduce((sum,t)=>sum+Math.round(Math.max(0,Number(t.valor)-Number(t.valor_pago))*100),0)/100
 const payrollImportedTotals=payrollImported.reduce((acc,row)=>({
  proventos:acc.proventos+Number(row.total_proventos||0),
  descontos:acc.descontos+Number(row.total_descontos||0),
  liquido:acc.liquido+Number(row.salario_liquido||0),
  baseFgts:acc.baseFgts+Number(row.base_fgts||0),
  fgts:acc.fgts+Number(row.fgts_recolher||0)
 }),{proventos:0,descontos:0,liquido:0,baseFgts:0,fgts:0})
 function openEntry(title:T|null=null){
  if(!canEdit||loading)return
  const nextCategory=title?.categoria||(section==='fgts'?'FGTS':section==='decimo'?'13º salário':section==='ferias'?'Férias':section==='vales'?'Vale de funcionário':'Salário')
  const targetId=title?.funcionario_id||employee
  const target=employees.find(p=>p.id===targetId)
  let suggestedGross=0
  const baseRemuneration=target?Number(target.salario_base||0)+Number(target.bonus_assiduidade_previsto||0):0
  if(baseRemuneration>0){
   if(nextCategory==='13º salário'){
    const year=Number((month||today().slice(0,7)).slice(0,4))
    const avos=calculate13thAvos(target?.data_admissao,year,12)
    suggestedGross=Math.round(baseRemuneration*avos/12*100)/100
   }else if(nextCategory==='Salário'){
    suggestedGross=baseRemuneration
   }
  }
  const suggested=suggestedGross>0?calculateAutomaticPayroll2026(suggestedGross,Number(target?.dependentes_ir||0),0,Number(title?.vales_folha||0),Number(target?.fgts_aliquota||8)):null
  setCategory(nextCategory);setFormEmployee(targetId);setDetailed(title?title.salario_bruto!=null:true)
  setGross(title?.salario_bruto==null?(suggestedGross?String(suggestedGross):''):String(title.salario_bruto))
  setDeductions(title?String(title?.descontos_folha||0):(suggested?String((suggested.inss+suggested.irrf).toFixed(2)):'0'))
  setAdvances(String(title?.vales_folha||0));setInstallments(1)
  setError('');setNotice('');setEntryForm({title})
 }
 function toggleSelected(id:string){setSelected(prev=>({...prev,[id]:!prev[id]}))}
 function toggleAllRows(){
  setSelected(prev=>{
   const next={...prev},shouldSelect=!allRowsSelected
   for(const t of selectableRows)next[t.id]=shouldSelect
   return next
  })
 }
 async function paySelected(){
  if(!canEdit||busy||!selectedRows.length)return
  if(!selectedRows.every(t=>t.status==='aberto'||t.status==='parcial')){setError('Selecione apenas lançamentos em aberto ou parciais para pagar.');return}
  if(!bulkPaymentDate){setError('Informe a data do pagamento.');return}
  const total=selectedRows.reduce((sum,t)=>sum+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  if(!window.confirm(`Pagar ${selectedRows.length} lançamento(s), totalizando ${money(total)}, em ${date(bulkPaymentDate)}?`))return
  setBusy(true);setError('');setNotice('')
  try{
   const {data,error}=await supabase.rpc('pagar_titulos_rh_lote',{p_titulo_ids:selectedRows.map(t=>t.id),p_data_pagamento:bulkPaymentDate})
   if(error)throw error
   setSelected({});await onChanged();setNotice(`${Number(data)||selectedRows.length} lançamento(s) pagos com sucesso.`)
  }catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 async function deleteSelected(){
  if(!canEdit||busy||!selectedRows.length)return
  if(!selectedRows.every(t=>Number(t.valor_pago)===0&&t.status!=='pago'&&t.status!=='parcial')){setError('Não é possível excluir lançamentos com pagamento. Remova esses itens da seleção.');return}
  if(!window.confirm(`Excluir definitivamente ${selectedRows.length} lançamento(s) selecionado(s)? Essa ação também remove as respectivas contas a pagar do RH.`))return
  setBusy(true);setError('');setNotice('')
  try{
   const {data,error}=await supabase.rpc('excluir_titulos_rh_lote',{p_titulo_ids:selectedRows.map(t=>t.id)})
   if(error)throw error
   setSelected({});await onChanged();setNotice(`${Number(data)||selectedRows.length} lançamento(s) excluído(s).`)
  }catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }

 async function savePerson(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!canEdit||saving.current||!personForm)return
  const data=new FormData(event.currentTarget),nome=String(data.get('nome')||'').trim(),cargo=String(data.get('cargo')||'').trim()||null,ativo=data.get('ativo')!=='false',salario_base=Number(data.get('salario_base')||0)||null,data_admissao=String(data.get('data_admissao')||'')||null,dependentes_ir=Math.max(0,Number(data.get('dependentes_ir')||0)||0),fgts_aliquota=Math.max(0,Number(data.get('fgts_aliquota')||8)||8),bonus_assiduidade_previsto=Math.max(0,Number(data.get('bonus_assiduidade_previsto')||0)||0)
  if(!nome){setError('Informe o nome do funcionário.');return}
  saving.current=true;setBusy(true);setError('');setNotice('')
  try{
   const person=personForm.person
   const query=person?supabase.from('funcionarios').update({nome,cargo,ativo,salario_base,data_admissao,dependentes_ir,fgts_aliquota,bonus_assiduidade_previsto}).eq('id',person.id).eq('nome',person.nome).eq('ativo',person.ativo):supabase.from('funcionarios').insert({nome,cargo,ativo,salario_base,data_admissao,dependentes_ir,fgts_aliquota,bonus_assiduidade_previsto})
   const r=await query.select('id').maybeSingle()
   if(r.error)throw r.error
   if(!r.data)throw new Error('O cadastro mudou em outra sessão ou seu acesso foi alterado. Atualize antes de tentar novamente.')
   await load();setPersonForm(null);setNotice(person?'Funcionário atualizado. Os lançamentos e pagamentos foram preservados.':'Funcionário cadastrado.')
  }catch(e){setError(errorMessage(e))}finally{saving.current=false;setBusy(false)}
 }
 async function saveEntry(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!canEdit||saving.current||!entryForm)return
  const data=new FormData(event.currentTarget),person=employees.find(p=>p.id===formEmployee)
  const competencia=String(data.get('competencia')||''),vencimento=String(data.get('vencimento')||''),descricao=String(data.get('descricao')||'').trim()
  if(!person||!person.ativo){setError('Selecione um funcionário ativo.');return}
  if(!/^\d{4}-\d{2}$/.test(competencia)||!vencimento||!descricao){setError('Preencha competência, vencimento e descrição.');return}
  let detail:ReturnType<typeof calculatePayroll>|null=null,value:number
  try{
   if(payrollCategory&&detailed){detail=calculatePayroll(gross,deductions,advances);value=detail.liquido}
   else{value=cents(data.get('valor'))/100;if(value<=0)throw new Error('O valor a pagar precisa ser maior que zero.')}
  }catch(e){setError(errorMessage(e));return}
  const parcelCount=category==='Vale de funcionário'&&!entryForm.title?installments:1
  if(!Number.isInteger(parcelCount)||parcelCount<1||parcelCount>24){setError('Informe de 1 a 24 parcelas para o vale.');return}
  saving.current=true;setBusy(true);setError('');setNotice('')
  try{
   const payload={tipo:category==='Vale de funcionário'?'receber':'pagar',funcionario_id:person.id,tipo_funcionario:category==='Vale de funcionário'?'vale':'gasto',competencia:competencia+'-01',descricao,entidade_nome:person.nome,categoria:category,centro_custo:'Funcionários',vencimento,valor:value,salario_bruto:detail?.bruto??null,descontos_folha:detail?.descontos??null,vales_folha:detail?.vales??null}
   const title=entryForm.title
   if(title){
    const r=await supabase.from('titulos_financeiros').update(payload).eq('id',title.id).eq('status','aberto').eq('valor_pago',0).eq('valor',title.valor).eq('descricao',title.descricao).eq('vencimento',title.vencimento).select('id').maybeSingle()
    if(r.error)throw r.error
    if(!r.data)throw new Error('O lançamento mudou ou já recebeu um pagamento. Atualize antes de editar; seus campos foram mantidos.')
   }else{
    const totalCents=Math.round(value*100),base=Math.floor(totalCents/parcelCount),remainder=totalCents-base*parcelCount
    const parcels=Array.from({length:parcelCount},(_,index)=>({...payload,descricao:parcelCount>1?`${descricao} · Parcela ${index+1}/${parcelCount}`:descricao,vencimento:addMonths(vencimento,index),valor:(base+(index<remainder?1:0))/100,valor_pago:0,status:'aberto'}))
    const r=await supabase.from('titulos_financeiros').insert(parcels).select('id')
    if(r.error)throw r.error
    if(!r.data?.length)throw new Error('Não foi possível gerar as parcelas do vale.')
   }
   setEntryForm(null);await onChanged();setMonth(competencia);setEmployee(person.id);setSearch('');setStatus('todos');setSection(category==='FGTS'?'fgts':category==='13º salário'?'decimo':category==='Férias'?'ferias':category==='Vale de funcionário'?'vales':'folha');setNotice(parcelCount>1?`Vale salvo em ${parcelCount} parcelas mensais no RH e em Contas a receber.`:category==='Vale de funcionário'?'Vale salvo no RH e em Contas a receber.':'Lançamento salvo no RH e em Contas a pagar. Nenhum pagamento foi registrado automaticamente.')
  }catch(e){setError(errorMessage(e))}finally{saving.current=false;setBusy(false)}
 }
 async function discount(title:T){
  if(!canEdit||saving.current)return
  if(!window.confirm(title.vale_descontado_em?'Desfazer o desconto em folha deste vale? O recebimento por ajuste será estornado.':'Confirmar o desconto deste vale no salário? O SG dará baixa no Contas a receber como ajuste por desconto em folha.'))return
  saving.current=true;setBusy(true);setError('');setNotice('')
  try{
   const {error}=await supabase.rpc('descontar_vale_folha',{p_titulo_id:title.id,p_data:today(),p_desfazer:!!title.vale_descontado_em})
   if(error)throw error
   await onChanged();setNotice(title.vale_descontado_em?'Desconto em folha desfeito e recebimento estornado.':'Vale descontado em folha e baixado em Contas a receber.')
  }catch(e){setError(errorMessage(e))}finally{saving.current=false;setBusy(false)}
 }
 async function generatePayrollInvoice(){
  if(busy||!month)return
  const imported=payrollImported.filter(row=>!employee||row.funcionario_id===employee)
  const forecast=payrollForecast.filter(row=>!employee||row.funcionario_id===employee)
  const useImported=imported.length>0
  const source=useImported?imported:forecast
  if(!source.length){
   setError('Não há folha importada nem previsão para gerar a fatura desta competência.')
   return
  }
  setBusy(true);setError('');setNotice('')
  try{
   const linhas=useImported
    ? imported.map(row=>({
       nome:employees.find(p=>p.id===row.funcionario_id)?.nome||'Funcionário',
       bruto:Number(row.total_proventos||row.salario_base||0),
       descontos:Number(row.total_descontos||0),
       liquido:Number(row.salario_liquido||0)
      }))
    : forecast.map(row=>({
       nome:employees.find(p=>p.id===row.funcionario_id)?.nome||'Funcionário',
       bruto:Number(row.bruto_previsto||0),
       descontos:Number(row.inss_previsto||0)+Number(row.irrf_previsto||0),
       liquido:Number(row.liquido_previsto||0)
      }))
   const {generateHrPayrollInvoicePdf}=await import('./lib/hrPayrollInvoicePdf')
   generateHrPayrollInvoicePdf({
    company,
    competencia:month,
    vencimento:monthEnd(month),
    linhas,
    origem:useImported?'folha_importada':'previsao'
   })
   const total=linhas.reduce((sum,row)=>sum+Number(row.liquido||0),0)
   setNotice(`Fatura da folha gerada: ${money(total)}. Importe o PDF manualmente no Financeiro para criar a conta a pagar.`)
  }catch(e){setError(errorMessage(e))}
  finally{setBusy(false)}
 }

 async function downloadReport(){
  try{
   const {generateFinanceReportPdf}=await import('./lib/financeReportPdf')
   generateFinanceReportPdf({company,title:'RH — '+tabs.find(t=>t[0]===section)?.[1],filename:'relatorio-rh-'+section,filters:['Competência: '+(month||'Todas'),'Funcionário: '+(employees.find(p=>p.id===employee)?.nome||'Todos'),'Situação: '+(statusLabel[status]||status)],summary:[{label:'Bruto informado',value:money(summary.bruto)},{label:'Valor a pagar',value:money(summary.liquido)},{label:'Pago',value:money(summary.pago)},{label:'Saldo',value:money(summary.saldo)}],sections:[{title:'Lançamentos de RH',note:'Histórico informativo do RH. Estes registros não devem gerar movimentação financeira automática.',rows:rows.map(t=>({descricao:t.descricao+(t.salario_bruto!=null?` | Bruto ${money(Number(t.salario_bruto))}; descontos ${money(Number(t.descontos_folha||0))}; vales ${money(Number(t.vales_folha||0))}`:''),entidade:employees.find(p=>p.id===t.funcionario_id)?.nome||'Funcionário',vencimento:t.vencimento,valor:Number(t.valor),pago:Number(t.valor_pago),saldo:Math.max(0,Number(t.valor)-Number(t.valor_pago)),status:statusLabel[t.status]||t.status,categoria:t.categoria||'',centro_custo:'Funcionários',tipo:'pagar',funcionario_tipo:t.tipo_funcionario,competencia:t.competencia,vale_descontado_em:t.vale_descontado_em}))}]})
  }catch(e){setError(errorMessage(e))}
 }
 return <section className="employeeFinance rhApp">
  <div className="panelHead"><div><h2 ref={heading} tabIndex={-1}>Recursos Humanos</h2><p>Funcionários, folha, ponto, presença e benefícios. RH informativo, sem lançamentos automáticos no Financeiro.</p></div><div className="rowActions"><button className="ghost" disabled={loading||busy} onClick={()=>void load()} aria-label="Atualizar funcionários"><RefreshCw size={16}/></button>{!['funcionarios','ponto','espelho','escala_sabado','beneficios'].includes(section)&&<button className="ghost" onClick={()=>void downloadReport()}><FileDown size={16}/>PDF</button>}{section==='folha'&&<button className="primary" disabled={busy||(!payrollImported.length&&!payrollForecast.length)} onClick={()=>void generatePayrollInvoice()}><ReceiptText size={16}/>Gerar fatura da folha</button>}{canEdit&&section==='funcionarios'&&<button className="primary" onClick={()=>{setError('');setPersonForm({person:null})}}><Plus size={16}/>Cadastrar funcionário</button>}</div></div>
  <nav className="financeSubtabs rhTabs" aria-label="Áreas de RH">{tabs.map(([key,label])=><button type="button" key={key} className={section===key?'subTab active':'subTab'} aria-current={section===key?'page':undefined} onClick={()=>{setSection(key);setStatus('todos');setSelected({});setEntryForm(null);setPersonForm(null);setError('');setNotice('')}}>{key==='funcionarios'?<Users size={16}/>:<WalletCards size={16}/>} {label}</button>)}</nav>
  {error&&!personForm&&!entryForm&&<div className="panel noticePanel" role="alert">{error}</div>}{notice&&<div className="panel noticePanel" role="status">{notice}</div>}
  {!canEdit&&<p className="readOnlyTag">Somente leitura</p>}
  <div className="panel financeFilterPanel employeeFilters">{section!=='funcionarios'&&<label>Competência<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>}{!['ponto','espelho','escala_sabado','beneficios'].includes(section)&&<><label>Funcionário<SearchableSelect value={employee} onChange={setEmployee} placeholder="Todos os funcionários" searchPlaceholder="Pesquisar funcionário..." options={employees.map(p=>({value:p.id,label:p.nome+(!p.ativo?' · Inativo':''),keywords:[p.nome,p.cargo].filter(Boolean).join(' ')}))}/></label>{section!=='funcionarios'&&<label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}><option value="todos">Todas</option><option value="aberto">Em aberto</option><option value="parcial">Parcial</option><option value="pago">Pago</option>{section==='vales'&&<><option value="a_descontar">A descontar</option><option value="descontado">Descontado</option></>}<option value="cancelado">Cancelado</option></select></label>}<label>Pesquisar<input type="search" value={search} placeholder="Nome, cargo, descrição ou categoria" onChange={e=>setSearch(e.target.value)}/></label><button className="ghost financeClearFilters" onClick={()=>{setMonth('');setEmployee('');setStatus('todos');setSearch('')}}>Limpar filtros</button></>}</div>
  {loading?<p role="status">Carregando funcionários…</p>:section==='ponto'?<RhidAttendance employees={employees} canEdit={canEdit} onLinked={load}/>:section==='espelho'?<RhPointMirror employees={employees} month={month||today().slice(0,7)} canEdit={canEdit}/>:section==='escala_sabado'?<RhSaturdaySchedule employees={employees} month={month||today().slice(0,7)} canEdit={canEdit}/>:section==='beneficios'?<RhBenefits employees={employees} month={month||today().slice(0,7)} canEdit={canEdit}/>:section==='funcionarios'?<article className="panel tablePanel"><div className="panelHead"><h3>{visibleEmployees.length} funcionário(s)</h3><span>{employees.filter(p=>p.ativo).length} ativo(s)</span></div><div className="tableWrap"><table><thead><tr><th>Nome</th><th>Cargo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{visibleEmployees.map(p=><tr key={p.id}><td>{p.nome}</td><td>{p.cargo||'—'}</td><td>{p.ativo?'Ativo':'Inativo'}</td><td><div className="rowActions"><button className="ghost" onClick={()=>{setEmployee(p.id);setSection('geral');setMonth('');setSearch('');setStatus('todos')}}>Ver lançamentos</button>{canEdit&&<button className="ghost" onClick={()=>{setError('');setPersonForm({person:p})}}><Pencil size={15}/>Editar</button>}</div></td></tr>)}{!visibleEmployees.length&&<tr><td colSpan={4}>Nenhum funcionário com estes filtros.</td></tr>}</tbody></table></div></article>:<>
   {['fgts','decimo','ferias'].includes(section)&&visibleEmployees.length>0&&<article className="panel tablePanel rhEntitlementsPanel">
    <div className="panelHead"><div><h3>{section==='fgts'?'Previsão automática de FGTS':section==='decimo'?'Previsão automática de 13º':'Previsão automática de férias'}</h3><p>Calculado com salário-base + bônus de assiduidade previsto e data de admissão.</p></div><strong>{visibleEmployees.filter(p=>p.ativo&&Number(p.salario_base||0)>0).length} funcionário(s)</strong></div>
    <div className="tableWrap"><table><thead><tr><th>Funcionário</th><th className="rhMoney">Remuneração-base</th>{section==='fgts'?<><th className="rhMoney">FGTS mensal</th><th className="rhMoney">FGTS 13º</th><th className="rhMoney">FGTS férias</th></>:section==='decimo'?<><th>Avos</th><th className="rhMoney">13º estimado</th><th className="rhMoney">FGTS 13º</th></>:<><th>Avos</th><th className="rhMoney">1/3 constitucional</th><th className="rhMoney">Férias integrais</th><th className="rhMoney">Férias proporcionais</th></>}</tr></thead>
    <tbody>{visibleEmployees.filter(p=>p.ativo&&Number(p.salario_base||0)>0).map(p=>{const calc=calculateHrEntitlements(Number(p.salario_base||0)+Number(p.bonus_assiduidade_previsto||0),p.data_admissao,Number(p.fgts_aliquota||8),new Date());return <tr key={p.id}><td>{p.nome}<small className="employeeCategory">{p.cargo||'Funcionário'}</small></td><td className="rhMoney">{money(calc.remuneracaoBase)}</td>{section==='fgts'?<><td className="rhMoney"><strong>{money(calc.fgtsMensal)}</strong></td><td className="rhMoney">{money(calc.fgtsDecimo)}</td><td className="rhMoney">{money(calc.fgtsFerias)}</td></>:section==='decimo'?<><td>{calc.decimoAvos}/12</td><td className="rhMoney"><strong>{money(calc.decimo)}</strong></td><td className="rhMoney">{money(calc.fgtsDecimo)}</td></>:<><td>{calc.feriasAvos}/12</td><td className="rhMoney">{money(calc.tercoFerias)}</td><td className="rhMoney"><strong>{money(calc.feriasIntegrais)}</strong></td><td className="rhMoney">{money(calc.feriasProporcionais)}</td></>}</tr>})}</tbody></table></div>
   </article>}
   {section==='folha'&&payrollForecast.length>0&&<article className="panel tablePanel rhForecastPanel">
    <div className="panelHead"><div><h3>Previsão de folha</h3><p>Salário-base + bônus de assiduidade previsto. Eventos variáveis não estão incluídos.</p></div><strong>{payrollForecast.length} funcionário(s)</strong></div>
    <div className="tableWrap"><table><thead><tr><th>Funcionário</th><th className="rhMoney">Salário-base</th><th className="rhMoney">Bônus assiduidade</th><th className="rhMoney">INSS</th><th className="rhMoney">IRRF</th><th className="rhMoney">FGTS</th><th className="rhMoney">Líquido previsto</th></tr></thead><tbody>{payrollForecast.map(row=><tr key={row.id}><td>{employees.find(p=>p.id===row.funcionario_id)?.nome||'Funcionário'}</td><td className="rhMoney">{money(Number(row.salario_base))}</td><td className="rhMoney">{money(Number(row.bonus_assiduidade))}</td><td className="rhMoney">{money(Number(row.inss_previsto))}</td><td className="rhMoney">{money(Number(row.irrf_previsto))}</td><td className="rhMoney">{money(Number(row.fgts_previsto))}</td><td className="rhMoney"><strong>{money(Number(row.liquido_previsto))}</strong></td></tr>)}</tbody></table></div>
   </article>}{(section==='folha'||section==='fgts')&&payrollImported.length>0&&<article className="panel tablePanel rhImportedPayroll">
    <div className="panelHead"><div><h3>{section==='fgts'?'FGTS da folha importada':'Folha importada da contabilidade'}</h3><p>Competência {month.split('-').reverse().join('/')} · histórico separado dos pagamentos financeiros.</p></div><strong>{payrollImported.length} registro(s)</strong></div>
    <div className="cards compactCards semanticCards">
     {section==='folha'?<><article className="card semanticCard semanticBlue"><span>Proventos</span><strong>{money(payrollImportedTotals.proventos)}</strong></article><article className="card semanticCard semanticWarning"><span>Descontos</span><strong>{money(payrollImportedTotals.descontos)}</strong></article><article className="card semanticCard semanticPositive"><span>Líquido</span><strong>{money(payrollImportedTotals.liquido)}</strong></article></>:<><article className="card semanticCard semanticBlue"><span>Base FGTS</span><strong>{money(payrollImportedTotals.baseFgts)}</strong></article><article className="card semanticCard semanticNegative"><span>FGTS a recolher</span><strong>{money(payrollImportedTotals.fgts)}</strong></article></>}
    </div>
    <div className="tableWrap"><table><thead><tr><th>Funcionário</th>{section==='folha'?<><th className="rhMoney">Salário base</th><th className="rhMoney">Proventos</th><th className="rhMoney">Descontos</th><th className="rhMoney">Líquido</th></>:<><th className="rhMoney">Base FGTS</th><th className="rhMoney">FGTS</th><th className="rhMoney">Base INSS</th><th className="rhMoney">Base IRRF</th></>}<th>Observação</th></tr></thead><tbody>{payrollImported.map(row=><tr key={row.id}><td>{employees.find(p=>p.id===row.funcionario_id)?.nome||'Funcionário'}</td>{section==='folha'?<><td className="rhMoney">{money(Number(row.salario_base))}</td><td className="rhMoney">{money(Number(row.total_proventos))}</td><td className="rhMoney">{money(Number(row.total_descontos))}</td><td className="rhMoney"><strong>{money(Number(row.salario_liquido))}</strong></td></>:<><td className="rhMoney">{money(Number(row.base_fgts))}</td><td className="rhMoney"><strong>{money(Number(row.fgts_recolher))}</strong></td><td className="rhMoney">{money(Number(row.base_inss))}</td><td className="rhMoney">{money(Number(row.base_irrf))}</td></>}<td>{row.observacao||'—'}</td></tr>)}</tbody></table></div>
   </article>}
   <div className="cards compactCards semanticCards rhCards">{(section==='geral'||section==='folha'||section==='decimo')&&<article className="card semanticCard semanticBlue"><span>Bruto informado</span><strong>{money(summary.bruto)}</strong><small>Referência da folha, sem somar ao contas a pagar</small></article>}<article className="card semanticCard"><span>{section==='folha'||section==='decimo'?'Líquido / obrigações':'Total lançado'}</span><strong>{money(summary.liquido)}</strong><small>Cancelados excluídos</small></article><article className="card semanticCard semanticPositive"><span>{section==='vales'?'Recebido':'Pago'}</span><strong>{money(summary.pago)}</strong></article><article className="card semanticCard semanticNegative"><span>{section==='vales'?'Saldo informativo':'Saldo informativo'}</span><strong>{money(summary.saldo)}</strong></article>{section==='geral'&&<><article className="card semanticCard"><span>FGTS lançado</span><strong>{money(summary.fgts)}</strong></article><article className="card semanticCard"><span>13º lançado</span><strong>{money(summary.decimo)}</strong></article></>}{(section==='geral'||section==='vales')&&<article className="card semanticCard"><span>Vales a descontar</span><strong>{money(summary.valesPendentes)}</strong><small>Saldo que será descontado nos salários</small></article>}</div>
   {!!summary.brutoAusente&&<p className="employeeHelp">{summary.brutoAusente} lançamento(s) anterior(es) sem bruto informado. Seus valores líquidos e pagamentos foram preservados.</p>}
   {section==='fgts'&&<p className="employeeHelp">Informe os valores da guia de FGTS por funcionário e competência. O FGTS é uma obrigação separada do líquido do funcionário.</p>}
   <article className="panel tablePanel">
    <div className="panelHead"><h3>{rows.length} registro(s) legado(s)</h3><span>Histórico informativo preservado. Novos registros do RH não movimentam o Financeiro automaticamente.</span></div>
    <div className="tableWrap"><table className={section==='vales'?'rhLedger rhLedgerVales':'rhLedger'}><thead><tr><th className="rhSelectCol">Info</th><th>Funcionário</th><th>Descrição</th><th>Competência</th><th>Vencimento</th><th className="rhMoney">Bruto</th><th className="rhMoney">Descontos / vales</th><th className="rhMoney">Líquido / valor</th><th className="rhMoney">{section==='vales'?'Recebido':'Pago'}</th><th className="rhMoney">{section==='vales'?'A receber':'Saldo'}</th><th>Situação</th>{section==='vales'&&<th className="rhDiscountCol">Desconto na folha</th>}<th className="rhActionsCol">Ações</th></tr></thead><tbody>{rows.map(t=><tr key={t.id} className={selected[t.id]?'rhSelectedRow':''}><td className="rhSelectCol"><span className="readOnlyTag">RH</span></td><td>{employees.find(p=>p.id===t.funcionario_id)?.nome||'Funcionário'}</td><td>{t.descricao}<small className="employeeCategory">{t.categoria}</small></td><td>{t.competencia?.slice(0,7).split('-').reverse().join('/')||'—'}</td><td>{date(t.vencimento)}</td><td className="rhMoney">{t.salario_bruto==null?'—':money(Number(t.salario_bruto))}</td><td className="rhMoney">{t.salario_bruto==null?'—':<>{money(Number(t.descontos_folha||0))}<small className="employeeCategory">Vales: {money(Number(t.vales_folha||0))}</small></>}</td><td className="rhMoney">{money(Number(t.valor))}</td><td className="rhMoney">{money(Number(t.valor_pago))}</td><td className="rhMoney">{money(Math.max(0,Number(t.valor)-Number(t.valor_pago)))}</td><td><span className={'statusBadge payment-'+t.status}>{statusLabel[t.status]||t.status}</span></td>{section==='vales'&&<td className="rhDiscountCol">{t.vale_descontado_em?'Descontado em '+date(t.vale_descontado_em):'A descontar no salário'}</td>}<td className="rhActionsCol"><span className="readOnlyTag">Somente histórico</span></td></tr>)}{!rows.length&&<tr><td colSpan={section==='vales'?13:12}>Nenhum lançamento com estes filtros.</td></tr>}</tbody></table></div>
   </article>
  </>}
  {personForm&&canEdit&&<div className="employeeEditBackdrop"><form className="panel employeeEditModal" role="dialog" aria-modal="true" aria-labelledby="rh-person-title" onSubmit={e=>void savePerson(e)}><div className="panelHead"><h3 id="rh-person-title">{personForm.person?'Editar':'Cadastrar'} funcionário</h3><button type="button" className="ghost" disabled={busy} aria-label="Fechar funcionário" onClick={()=>setPersonForm(null)}><X size={16}/></button></div>{error&&<p role="alert" className="billingFormError">{error}</p>}<fieldset disabled={busy}><label>Nome<input name="nome" required maxLength={120} defaultValue={personForm.person?.nome||''} autoFocus/></label><label>Cargo<input name="cargo" maxLength={100} defaultValue={personForm.person?.cargo||''}/></label><label>Situação<select name="ativo" defaultValue={personForm.person?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select></label><label>Salário-base (R$)<input name="salario_base" type="number" min="0" step="0.01" value={personSalaryPreview} onChange={e=>setPersonSalaryPreview(e.target.value)}/></label><label>Data de admissão<input name="data_admissao" type="date" value={personAdmissionPreview} onChange={e=>setPersonAdmissionPreview(e.target.value)}/></label><label>Dependentes para IR<input name="dependentes_ir" type="number" min="0" step="1" defaultValue={personForm.person?.dependentes_ir??0}/></label><label>FGTS (%)<input name="fgts_aliquota" type="number" min="0" max="100" step="0.01" value={personFgtsPreview} onChange={e=>setPersonFgtsPreview(e.target.value)}/></label><label>Bônus de assiduidade previsto (R$)<input name="bonus_assiduidade_previsto" type="number" min="0" step="0.01" value={personBonusPreview} onChange={e=>setPersonBonusPreview(e.target.value)}/></label>
<div className="rhEntitlementPreview">
  <div><span>Remuneração-base prevista</span><strong>{money(personEntitlementsPreview.remuneracaoBase)}</strong><small>Salário-base + bônus previsto</small></div>
  <div><span>FGTS mensal</span><strong>{money(personEntitlementsPreview.fgtsMensal)}</strong><small>{Number(personFgtsPreview||8).toLocaleString('pt-BR')}% da remuneração-base</small></div>
  <div><span>13º estimado</span><strong>{money(personEntitlementsPreview.decimo)}</strong><small>{personEntitlementsPreview.decimoAvos}/12 avos no ano</small></div>
  <div><span>FGTS sobre 13º</span><strong>{money(personEntitlementsPreview.fgtsDecimo)}</strong><small>Provisão estimada</small></div>
  <div><span>Férias integrais + 1/3</span><strong>{money(personEntitlementsPreview.feriasIntegrais)}</strong><small>Férias {money(personEntitlementsPreview.remuneracaoBase)} + 1/3 {money(personEntitlementsPreview.tercoFerias)}</small></div>
  <div><span>Férias proporcionais</span><strong>{money(personEntitlementsPreview.feriasProporcionais)}</strong><small>{personEntitlementsPreview.feriasAvos}/12 avos no período aquisitivo atual</small></div>
</div>
<p className="employeeHelp">As previsões usam salário-base + bônus previsto. Eventos variáveis reais da folha podem alterar FGTS, 13º e férias. Inativar preserva todo o histórico.</p><div className="formActions"><button type="button" className="ghost" onClick={()=>setPersonForm(null)}>Cancelar</button><button className="primary">{busy?'Salvando…':'Salvar funcionário'}</button></div></fieldset></form></div>}

 </section>
}
