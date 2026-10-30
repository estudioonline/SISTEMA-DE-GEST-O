import test from 'node:test'
import assert from 'node:assert/strict'
import {appPermission,calculatePayroll,hrSectionForTitle,summarizeHr} from '../src/lib/hr.ts'
import {canViewPermission,canEditPermission,defaultPermissionsForRole} from '../src/lib/permissions.ts'

test('RH reuses Financeiro access; every profile can view and only configured profiles can edit',()=>{
 for(const role of ['administrador','financeiro','vendas','estoque','visualizador']){
  const map=defaultPermissionsForRole(role)
  assert.equal(canViewPermission(map,appPermission('rh')),true)
  assert.equal(canViewPermission(map,appPermission('rh')),canViewPermission(map,'financeiro'))
  assert.equal(canEditPermission(map,appPermission('rh')),canEditPermission(map,'financeiro'))
 }
 assert.equal(canEditPermission(defaultPermissionsForRole('vendas'),appPermission('rh')),false)
})
test('net payroll uses exact cents; missing, invalid or excessive deductions do not create a payable',()=>{
 assert.deepEqual(calculatePayroll('1935.00','145.13','300.00'),{bruto:1935,descontos:145.13,vales:300,liquido:1489.87})
 assert.equal(calculatePayroll(.3,.1,.1).liquido,.1)
 for(const args of [[100,50,50],[100,101,0],[0,0,0],['',0,0],[100,'',0],[NaN,0,0],[100,-1,0],[100,1.001,0],[Infinity,0,0]])assert.throws(()=>calculatePayroll(...args as [unknown,unknown,unknown]))
})
test('legacy salary entries stay in payroll; FGTS, 13th and advances have distinct sections',()=>{
 const base={tipo_funcionario:'gasto' as const,valor:100,valor_pago:0,status:'aberto'}
 assert.equal(hrSectionForTitle({...base,categoria:'Salário'}),'folha')
 assert.equal(hrSectionForTitle({...base,categoria:'Bônus'}),'folha')
 assert.equal(hrSectionForTitle({...base,categoria:'FGTS'}),'fgts')
 assert.equal(hrSectionForTitle({...base,categoria:'13º salário'}),'decimo')
 assert.equal(hrSectionForTitle({...base,categoria:'Décimo terceiro'}),'decimo')
 assert.equal(hrSectionForTitle({...base,categoria:null,tipo_funcionario:'vale'}),'vales')
 assert.equal(hrSectionForTitle({...base,categoria:'Salário',tipo_funcionario:null}),null)
})
test('gross is reference only: net payroll, FGTS and advances enter totals once and canceled rows are excluded',()=>{
 const rows=[
  {tipo_funcionario:'gasto' as const,categoria:'Salário',valor:1500,valor_pago:500,status:'parcial',salario_bruto:2000,descontos_folha:200,vales_folha:300},
  {tipo_funcionario:'gasto' as const,categoria:'Salário',valor:1000,valor_pago:1000,status:'pago'},
  {tipo_funcionario:'gasto' as const,categoria:'FGTS',valor:160,valor_pago:0,status:'aberto'},
  {tipo_funcionario:'gasto' as const,categoria:'13º salário',valor:800,valor_pago:0,status:'aberto',salario_bruto:900,descontos_folha:100,vales_folha:0},
  {tipo_funcionario:'vale' as const,categoria:'Vale',valor:300,valor_pago:300,status:'pago'},
  {tipo_funcionario:'vale' as const,categoria:'Vale',valor:100,valor_pago:40,status:'parcial'},
  {tipo_funcionario:'vale' as const,categoria:'Vale',valor:100,valor_pago:100,status:'pago',vale_descontado_em:'2026-10-29'},
  {tipo_funcionario:'gasto' as const,categoria:'Salário',valor:9999,valor_pago:0,status:'cancelado',salario_bruto:9999},
 ]
 const totals=summarizeHr(rows)
 assert.equal(totals.bruto,2900)
 assert.equal(totals.brutoAusente,1)
 assert.equal(totals.liquido,3960)
 assert.equal(totals.pago,1940)
 assert.equal(totals.saldo,2020)
 assert.equal(totals.fgts,160)
 assert.equal(totals.decimo,800)
 assert.equal(totals.valesPendentes,340)
})
