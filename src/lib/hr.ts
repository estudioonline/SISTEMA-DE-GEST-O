import type { PermissionModule } from './permissions'

export type AppModule=PermissionModule|'rh'|'documentos'
export const appPermission=(module:AppModule):PermissionModule=>module==='rh'||module==='documentos'?'financeiro':module
export type HrSection='geral'|'funcionarios'|'folha'|'fgts'|'decimo'|'vales'
export type HrTitle={tipo_funcionario?:'gasto'|'vale'|null;categoria:string|null;valor:number;valor_pago:number;status:string;salario_bruto?:number|null;descontos_folha?:number|null;vales_folha?:number|null;vale_descontado_em?:string|null}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
export function hrSectionForTitle(title:HrTitle):Exclude<HrSection,'geral'|'funcionarios'>|null{
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
