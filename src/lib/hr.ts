import type { PermissionModule } from './permissions'

export type AppModule=PermissionModule|'rh'|'documentos'
export const appPermission=(module:AppModule):PermissionModule=>module==='rh'||module==='documentos'?'financeiro':module
export type HrSection='geral'|'funcionarios'|'folha'|'fgts'|'decimo'|'vales'|'ponto'|'espelho'|'escala_sabado'|'beneficios'
export type HrTitle={tipo_funcionario?:'gasto'|'vale'|null;categoria:string|null;valor:number;valor_pago:number;status:string;salario_bruto?:number|null;descontos_folha?:number|null;vales_folha?:number|null;vale_descontado_em?:string|null}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
export function hrSectionForTitle(title:HrTitle):Exclude<HrSection,'geral'|'funcionarios'|'ponto'|'espelho'|'escala_sabado'|'beneficios'>|null{
  if(title.tipo_funcionario==='vale')return 'vales'
  if(title.tipo_funcionario!=='gasto')return null
  const category=normalize(title.categoria||'')
  if(category==='fgts')return 'fgts'
  if(category.includes('13')||category.includes('decimo terceiro'))return 'decimo'
  return 'folha'
}
export function cents(value:unknown){
  if(typeof value==='string'&&!value.trim())throw new Error('Informe todos os valores da folha, usando zero quando não houver desconto.')
  const amount=Number(value)
  if(value==null||!Number.isFinite(amount)||amount<0||amount>999999999||Math.abs(amount*100-Math.round(amount*100))>0.00001)throw new Error('Use valores positivos ou zero, com até duas casas decimais.')
  return Math.round(amount*100)
}
export function calculateInss2026(gross:number){
  const base=Math.min(Math.max(0,gross),8475.55)
  const bands=[[1621,0.075],[2902.84,0.09],[4354.27,0.12],[8475.55,0.14]] as const
  let previous=0,total=0
  for(const [limit,rate] of bands){
    if(base<=previous)break
    const slice=Math.min(base,limit)-previous
    total+=slice*rate
    previous=limit
  }
  return Math.round(total*100)/100
}
export function calculateIrrf2026(gross:number,inss:number,dependents=0){
  const legalDeduction=inss+Math.max(0,dependents)*189.59
  const deduction=Math.max(607.20,legalDeduction)
  const base=Math.max(0,gross-deduction)
  let tax=0
  if(base<=2428.80)tax=0
  else if(base<=2826.65)tax=base*0.075-182.16
  else if(base<=3751.05)tax=base*0.15-394.16
  else if(base<=4664.68)tax=base*0.225-675.49
  else tax=base*0.275-908.73
  tax=Math.max(0,tax)
  const reduction=gross<=5000?tax:gross<=7350?Math.min(tax,Math.max(0,978.62-(0.133145*gross))):0
  return Math.round(Math.max(0,tax-reduction)*100)/100
}
export function calculate13thAvos(admission:string|null|undefined,year:number,throughMonth=12){
  if(!admission)return 12
  const d=new Date(admission+'T12:00:00')
  if(d.getFullYear()>year)return 0
  if(d.getFullYear()<year)return Math.max(0,Math.min(12,throughMonth))
  let avos=0
  for(let month=0;month<Math.min(12,throughMonth);month++){
    const start=new Date(year,month,1,12)
    const end=new Date(year,month+1,0,12)
    if(d<=end){
      const first=d>start?d:start
      const days=Math.floor((end.getTime()-first.getTime())/86400000)+1
      if(days>=15)avos++
    }
  }
  return avos
}
export function calculateAutomaticPayroll2026(gross:number,dependents=0,otherDeductions=0,advances=0,fgtsRate=8){
  const inss=calculateInss2026(gross)
  const irrf=calculateIrrf2026(gross,inss,dependents)
  const fgts=Math.round(Math.max(0,gross)*Math.max(0,fgtsRate)/100*100)/100
  const liquido=Math.round(Math.max(0,gross-inss-irrf-otherDeductions-advances)*100)/100
  return {bruto:gross,inss,irrf,fgts,outrosDescontos:otherDeductions,vales:advances,liquido}
}
export function calculatePayroll(gross:unknown,deductions:unknown,advances:unknown){
  const g=cents(gross),d=cents(deductions),a=cents(advances)
  if(g===0)throw new Error('O valor bruto deve ser maior que zero.')
  if(d+a>=g)throw new Error('O líquido precisa ser maior que zero para gerar uma conta a pagar. Confira os descontos e vales.')
  return {bruto:g/100,descontos:d/100,vales:a/100,liquido:(g-d-a)/100}
}
export function summarizeHr(rows:HrTitle[]){
  const valid=rows.filter(row=>row.status!=='cancelado'&&hrSectionForTitle(row)!==null)
  const sum=(items:HrTitle[],get:(r:HrTitle)=>number)=>items.reduce((s,r)=>s+Math.round(get(r)*100),0)/100
  const payroll=valid.filter(r=>hrSectionForTitle(r)==='folha'||hrSectionForTitle(r)==='decimo')
  return {
    bruto:sum(payroll.filter(r=>r.salario_bruto!=null),r=>Number(r.salario_bruto)),
    brutoAusente:payroll.filter(r=>r.salario_bruto==null&&['Salário','13º salário'].includes(r.categoria||'')).length,
    liquido:sum(valid,r=>Number(r.valor)),pago:sum(valid,r=>Number(r.valor_pago)),
    saldo:sum(valid,r=>Math.max(0,Number(r.valor)-Number(r.valor_pago))),
    fgts:sum(valid.filter(r=>hrSectionForTitle(r)==='fgts'),r=>Number(r.valor)),
    decimo:sum(valid.filter(r=>hrSectionForTitle(r)==='decimo'),r=>Number(r.valor)),
    valesPendentes:sum(valid.filter(r=>hrSectionForTitle(r)==='vales'&&!r.vale_descontado_em),r=>Number(r.valor_pago)),
  }
}
